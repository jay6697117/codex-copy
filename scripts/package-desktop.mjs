#!/usr/bin/env node
/**
 * Cross-Platform Desktop Packager for OpenAI Codex Desktop App
 * Produces standalone, ready-to-run desktop distributions for:
 *  1. macOS (`release/macos/Codex Desktop.app`, `release/Codex-Desktop-1.0.0-macOS-arm64.zip`, `release/Codex-Desktop-1.0.0-macOS-arm64.pkg`)
 *     - Native macOS ARM64 Cocoa + WKWebView executable compiled via `/usr/bin/swiftc`
 *     - Multi-resolution `AppIcon.icns` generated via `sips` + `iconutil`
 *     - Embedded self-contained `server/app-server.mjs` + `dist/` frontend
 *  2. Windows (`release/windows/Codex-Desktop-win32-x64/Codex Desktop.exe`, `release/Codex-Desktop-1.0.0-Windows-x64.zip`)
 *     - Genuine 64-bit Windows PE32+ GUI executable (`Codex Desktop.exe`, x86-64)
 *     - Multi-resolution Windows `icon.ico`
 *     - Windowless VBS/PowerShell/Batch launchers + embedded `resources/app/` (`server/` + `dist/` + `electron/`)
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT_DIR, 'build');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');

const AUG_PATH = `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`;

function runCmd(cmd, cwd = ROOT_DIR) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, {
    cwd,
    env: { ...process.env, PATH: AUG_PATH },
    stdio: 'pipe',
  }).toString('utf8');
}

// ============================================================================
// 1. Pure Node.js PNG & ICO Generator (Zero External Dependencies)
// ============================================================================
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateAppIconPng(size = 512) {
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  const center = size / 2;
  const radius = size * 0.44;
  const cornerRadius = size * 0.22;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rawData[rowStart] = 0; // filter type 0

    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;

      // Rounded squircle distance
      const dx = Math.max(Math.abs(x - center) - (radius - cornerRadius), 0);
      const dy = Math.max(Math.abs(y - center) - (radius - cornerRadius), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > cornerRadius) {
        rawData[px] = 0;
        rawData[px + 1] = 0;
        rawData[px + 2] = 0;
        rawData[px + 3] = 0;
        continue;
      }

      // Smooth anti-aliased edge
      const alpha = dist > cornerRadius - 1.5 ? Math.max(0, Math.min(255, Math.round((cornerRadius - dist) * 170))) : 255;

      // Deep Navy-Emerald background gradient (#0D1520 -> #122436)
      const ny = y / size;
      const nx = x / size;
      let r = Math.round(14 + ny * 12);
      let g = Math.round(24 + ny * 26);
      let b = Math.round(38 + ny * 34);

      // Subtle inner border glow
      if (dist > cornerRadius - size * 0.025) {
        r = Math.min(255, r + 25);
        g = Math.min(255, g + 85);
        b = Math.min(255, b + 65);
      }

      // Draw `>` chevron on left center and `_` cursor bar on right center (WeChat Green #07C160 / Cyan highlight)
      const relX = (x - center) / radius;
      const relY = (y - center) / radius;

      // Chevron `>`: two diagonal segments meeting at (-0.05, 0.0)
      const dChevronTop = Math.abs(relY - (0.55 * (relX + 0.05))) / Math.sqrt(1 + 0.55 * 0.55);
      const dChevronBot = Math.abs(relY - (-0.55 * (relX + 0.05))) / Math.sqrt(1 + 0.55 * 0.55);
      const inChevronBounds = relX >= -0.52 && relX <= -0.02 && Math.abs(relY) <= 0.32;
      const isChevron = inChevronBounds && (dChevronTop < 0.075 || dChevronBot < 0.075);

      // Underscore `_`: horizontal bar at bottom right
      const isUnderscore =
        relX >= 0.08 && relX <= 0.52 && relY >= 0.16 && relY <= 0.28;

      // Target ring dot at top right (representing `/goal` mode)
      const ringDist = Math.sqrt(Math.pow(relX - 0.34, 2) + Math.pow(relY + 0.24, 2));
      const isGoalRing = (ringDist >= 0.09 && ringDist <= 0.145) || ringDist <= 0.045;

      if (isChevron || isUnderscore) {
        r = 7;
        g = 193;
        b = 96; // #07C160
      } else if (isGoalRing) {
        r = 0;
        g = 153;
        b = 255; // #0099FF
      } else if (nx + ny < 0.8) {
        // Subtle top-left sheen
        r += 4;
        g += 6;
        b += 10;
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = alpha;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function generateWindowsIco(pngBuffersWithSizes) {
  const count = pngBuffersWithSizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type = 1
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let dataOffset = 6 + count * 16;

  for (const { size, buf } of pngBuffersWithSizes) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dirEntries.push(entry);
    dataOffset += buf.length;
  }

  return Buffer.concat([
    header,
    ...dirEntries,
    ...pngBuffersWithSizes.map((p) => p.buf),
  ]);
}

// ============================================================================
// 2. Genuine 64-bit Windows PE32+ GUI Executable (`Codex Desktop.exe`) Builder
// ============================================================================
/**
 * Generates a valid, standards-compliant 64-bit Windows PE32+ GUI executable (`.exe`).
 * When double-clicked on Windows 10/11, it executes `WinExec(commandLine, SW_HIDE)`
 * from `KERNEL32.dll` and exits cleanly via `ExitProcess(0)` without flashing a console window.
 */
function buildWindowsPe64GuiExe(commandStr = 'wscript.exe "resources\\launch-win.vbs"') {
  const FILE_ALIGNMENT = 0x200; // 512 bytes
  const SECTION_ALIGNMENT = 0x1000; // 4096 bytes
  const IMAGE_BASE = 0x0000000140000000n;

  const totalSize = 0x600; // 1536 bytes: 0x000..0x1ff headers, 0x200..0x3ff .text, 0x400..0x5ff .rdata
  const buf = Buffer.alloc(totalSize, 0);

  // 1. DOS Header (0x00 .. 0x3F)
  buf.write('MZ', 0, 'ascii');
  buf.writeUInt32LE(0x80, 0x3c); // e_lfanew -> 0x80

  // 2. PE Signature & COFF File Header at 0x80
  let p = 0x80;
  buf.write('PE\0\0', p, 'ascii');
  p += 4;
  buf.writeUInt16LE(0x8664, p); // Machine: IMAGE_FILE_MACHINE_AMD64 (x86-64)
  buf.writeUInt16LE(2, p + 2); // NumberOfSections: 2 (.text, .rdata)
  buf.writeUInt32LE(Math.floor(Date.now() / 1000), p + 4); // TimeDateStamp
  buf.writeUInt32LE(0, p + 8); // PointerToSymbolTable
  buf.writeUInt32LE(0, p + 12); // NumberOfSymbols
  buf.writeUInt16LE(0xf0, p + 16); // SizeOfOptionalHeader (240 bytes for PE32+)
  buf.writeUInt16LE(0x0022, p + 18); // Characteristics: EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE
  p += 20;

  // 3. Optional Header PE32+ (0x98 .. 0x187)
  const optStart = p;
  buf.writeUInt16LE(0x020b, optStart + 0); // Magic: PE32+ (64-bit)
  buf[optStart + 2] = 14; // MajorLinkerVersion
  buf[optStart + 3] = 0; // MinorLinkerVersion
  buf.writeUInt32LE(0x200, optStart + 4); // SizeOfCode
  buf.writeUInt32LE(0x200, optStart + 8); // SizeOfInitializedData
  buf.writeUInt32LE(0, optStart + 12); // SizeOfUninitializedData
  buf.writeUInt32LE(0x1000, optStart + 16); // AddressOfEntryPoint (RVA 0x1000 -> .text)
  buf.writeUInt32LE(0x1000, optStart + 20); // BaseOfCode
  buf.writeBigUInt64LE(IMAGE_BASE, optStart + 24); // ImageBase
  buf.writeUInt32LE(SECTION_ALIGNMENT, optStart + 32); // SectionAlignment
  buf.writeUInt32LE(FILE_ALIGNMENT, optStart + 36); // FileAlignment
  buf.writeUInt16LE(6, optStart + 40); // MajorOperatingSystemVersion (Windows Vista/7/10/11)
  buf.writeUInt16LE(0, optStart + 42);
  buf.writeUInt16LE(1, optStart + 44); // MajorImageVersion
  buf.writeUInt16LE(0, optStart + 46);
  buf.writeUInt16LE(6, optStart + 48); // MajorSubsystemVersion
  buf.writeUInt16LE(0, optStart + 50);
  buf.writeUInt32LE(0, optStart + 52); // Win32VersionValue
  buf.writeUInt32LE(0x3000, optStart + 56); // SizeOfImage (headers + .text + .rdata aligned to 0x1000)
  buf.writeUInt32LE(0x200, optStart + 60); // SizeOfHeaders
  buf.writeUInt32LE(0, optStart + 64); // CheckSum
  buf.writeUInt16LE(2, optStart + 68); // Subsystem: IMAGE_SUBSYSTEM_WINDOWS_GUI (2 = GUI, no console window!)
  buf.writeUInt16LE(0x8140, optStart + 70); // DllCharacteristics: DYNAMIC_BASE | NX_COMPAT | TERMINAL_SERVER_AWARE
  buf.writeBigUInt64LE(0x100000n, optStart + 72); // SizeOfStackReserve
  buf.writeBigUInt64LE(0x1000n, optStart + 80); // SizeOfStackCommit
  buf.writeBigUInt64LE(0x100000n, optStart + 88); // SizeOfHeapReserve
  buf.writeBigUInt64LE(0x1000n, optStart + 96); // SizeOfHeapCommit
  buf.writeUInt32LE(0, optStart + 104); // LoaderFlags
  buf.writeUInt32LE(16, optStart + 108); // NumberOfRvaAndSizes

  // Data Directory[1]: Import Table at RVA 0x2000, size 40 (2 descriptors)
  buf.writeUInt32LE(0x2000, optStart + 112 + 8); // Import Table RVA
  buf.writeUInt32LE(40, optStart + 112 + 12); // Import Table Size
  // Data Directory[12]: IAT at RVA 0x2040, size 24
  buf.writeUInt32LE(0x2040, optStart + 112 + 12 * 8);
  buf.writeUInt32LE(24, optStart + 112 + 12 * 8 + 4);

  p = optStart + 0xf0;

  // 4. Section Headers (40 bytes each)
  // Section 1: .text (RVA 0x1000, File offset 0x200)
  buf.write('.text\0\0\0', p, 'ascii');
  buf.writeUInt32LE(0x100, p + 8); // VirtualSize
  buf.writeUInt32LE(0x1000, p + 12); // VirtualAddress
  buf.writeUInt32LE(0x200, p + 16); // SizeOfRawData
  buf.writeUInt32LE(0x200, p + 20); // PointerToRawData
  buf.writeUInt32LE(0x60000020, p + 36); // Characteristics: CODE | EXECUTE | READ
  p += 40;

  // Section 2: .rdata (RVA 0x2000, File offset 0x400)
  buf.write('.rdata\0\0', p, 'ascii');
  buf.writeUInt32LE(0x200, p + 8); // VirtualSize
  buf.writeUInt32LE(0x2000, p + 12); // VirtualAddress
  buf.writeUInt32LE(0x200, p + 16); // SizeOfRawData
  buf.writeUInt32LE(0x400, p + 20); // PointerToRawData
  buf.writeUInt32LE(0xc0000040, p + 36); // Characteristics: INITIALIZED_DATA | READ | WRITE
  p += 40;

  // 5. .rdata section at file offset 0x400 (RVA 0x2000)
  // Layout inside .rdata (base RVA 0x2000):
  //   0x2000 (off 0x400): IMAGE_IMPORT_DESCRIPTOR for KERNEL32.dll (20 bytes) + Null descriptor (20 bytes)
  //   0x2028 (off 0x428): OriginalFirstThunk (ILT): [0x2060n, 0x2070n, 0n] (24 bytes)
  //   0x2040 (off 0x440): FirstThunk (IAT):         [0x2060n, 0x2070n, 0n] (24 bytes)
  //     -> IAT[0] (RVA 0x2040) = WinExec
  //     -> IAT[1] (RVA 0x2048) = ExitProcess
  //   0x2058 (off 0x458): "KERNEL32.dll\0"
  //   0x2068 (off 0x468): Hint(0) + "WinExec\0"
  //   0x2074 (off 0x474): Hint(0) + "ExitProcess\0"
  //   0x2088 (off 0x488): commandStr + "\0"
  const rdataOff = 0x400;
  // Import descriptor
  buf.writeUInt32LE(0x2028, rdataOff + 0); // OriginalFirstThunk RVA
  buf.writeUInt32LE(0, rdataOff + 4); // TimeDateStamp
  buf.writeUInt32LE(0, rdataOff + 8); // ForwarderChain
  buf.writeUInt32LE(0x2058, rdataOff + 12); // Name RVA ("KERNEL32.dll")
  buf.writeUInt32LE(0x2040, rdataOff + 16); // FirstThunk (IAT) RVA

  // ILT at 0x2028
  buf.writeBigUInt64LE(0x2068n, rdataOff + 0x28);
  buf.writeBigUInt64LE(0x2074n, rdataOff + 0x30);
  buf.writeBigUInt64LE(0n, rdataOff + 0x38);

  // IAT at 0x2040
  buf.writeBigUInt64LE(0x2068n, rdataOff + 0x40); // WinExec @ RVA 0x2040
  buf.writeBigUInt64LE(0x2074n, rdataOff + 0x48); // ExitProcess @ RVA 0x2048
  buf.writeBigUInt64LE(0n, rdataOff + 0x50);

  // Strings
  buf.write('KERNEL32.dll\0', rdataOff + 0x58, 'ascii');
  buf.writeUInt16LE(0, rdataOff + 0x68);
  buf.write('WinExec\0', rdataOff + 0x6a, 'ascii');
  buf.writeUInt16LE(0, rdataOff + 0x74);
  buf.write('ExitProcess\0', rdataOff + 0x76, 'ascii');
  buf.write(`${commandStr}\0`, rdataOff + 0x88, 'ascii');

  // 6. .text section at file offset 0x200 (RVA 0x1000)
  // x86-64 machine code:
  //   48 83 EC 28             sub rsp, 0x28               (RVA 0x1000 .. 0x1004)
  //   48 8D 0D 7D 10 00 00    lea rcx, [rip + 0x107d]     (next RIP=0x100B -> target 0x2088 = commandStr)
  //   BA 00 00 00 00          mov edx, 0                  (SW_HIDE = 0, next RIP=0x1010)
  //   FF 15 2A 10 00 00       call qword ptr [rip+0x102a] (next RIP=0x1016 -> target 0x2040 = WinExec)
  //   31 C9                   xor ecx, ecx                (next RIP=0x1018)
  //   FF 15 2A 10 00 00       call qword ptr [rip+0x102a] (next RIP=0x101E -> target 0x2048 = ExitProcess)
  //   C3                      ret
  const code = Buffer.from([
    0x48, 0x83, 0xec, 0x28,
    0x48, 0x8d, 0x0d, 0x7d, 0x10, 0x00, 0x00,
    0xba, 0x00, 0x00, 0x00, 0x00,
    0xff, 0x15, 0x2a, 0x10, 0x00, 0x00,
    0x31, 0xc9,
    0xff, 0x15, 0x2a, 0x10, 0x00, 0x00,
    0xc3,
  ]);
  code.copy(buf, 0x200);

  return buf;
}

// ============================================================================
// 3. Native macOS Objective-C (Cocoa + WKWebView) Desktop Launcher Source
// ============================================================================
const MACOS_OBJC_SOURCE = `#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (strong, nonatomic) NSTask *serverTask;
@property (assign, nonatomic) NSInteger serverPort;
@property (assign, nonatomic) BOOL isTerminating;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    self.serverPort = 4500;
    self.isTerminating = NO;
    system("/usr/sbin/lsof -ti:4500 | xargs kill -9 >/dev/null 2>&1 || true");
    [self startEmbeddedNodeServer];

    NSRect screenFrame = [[NSScreen mainScreen] visibleFrame];
    if (screenFrame.size.width == 0) {
        screenFrame = NSMakeRect(0, 0, 1520, 940);
    }
    CGFloat width = MIN(1520.0, screenFrame.size.width * 0.92);
    CGFloat height = MIN(940.0, screenFrame.size.height * 0.90);
    NSRect rect = NSMakeRect(
        screenFrame.origin.x + (screenFrame.size.width - width) / 2.0,
        screenFrame.origin.y + (screenFrame.size.height - height) / 2.0,
        width,
        height
    );

    NSWindowStyleMask style = NSWindowStyleMaskTitled |
                              NSWindowStyleMaskClosable |
                              NSWindowStyleMaskMiniaturizable |
                              NSWindowStyleMaskResizable |
                              NSWindowStyleMaskFullSizeContentView;

    self.window = [[NSWindow alloc] initWithContentRect:rect
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    [self.window setTitle:@"OpenAI Codex Desktop"];
    [self.window setTitlebarAppearsTransparent:YES];
    [self.window setTitleVisibility:NSWindowTitleHidden];
    [self.window setMinSize:NSMakeSize(1020, 680)];
    [self.window setBackgroundColor:[NSColor colorWithSRGBRed:0.067 green:0.067 blue:0.067 alpha:1.0]];

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    [config.preferences setValue:@YES forKey:@"developerExtrasEnabled"];

    self.webView = [[WKWebView alloc] initWithFrame:[[self.window contentView] bounds]
                                      configuration:config];
    [self.webView setAutoresizingMask:(NSViewWidthSizable | NSViewHeightSizable)];
    [self.webView setNavigationDelegate:self];
    [self.webView setUIDelegate:self];

    [[self.window contentView] addSubview:self.webView];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];

    [self pollServerAndLoadWithAttempt:0];
}

- (NSString *)findNodeBinary {
    NSString *home = NSHomeDirectory();
    NSMutableArray<NSString *> *candidates = [NSMutableArray arrayWithObjects:
        @"/opt/homebrew/bin/node",
        @"/usr/local/bin/node",
        [home stringByAppendingPathComponent:@".volta/bin/node"],
        [home stringByAppendingPathComponent:@".bun/bin/node"],
        nil
    ];

    NSString *nvmDir = [home stringByAppendingPathComponent:@".nvm/versions/node"];
    NSArray<NSString *> *versions = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:nvmDir error:nil];
    if (versions) {
        NSArray<NSString *> *sorted = [versions sortedArrayUsingSelector:@selector(localizedStandardCompare:)];
        for (NSString *v in [sorted reverseObjectEnumerator]) {
            NSString *nvmNode = [[nvmDir stringByAppendingPathComponent:v] stringByAppendingPathComponent:@"bin/node"];
            [candidates addObject:nvmNode];
        }
    }

    for (NSString *path in candidates) {
        if ([[NSFileManager defaultManager] isExecutableFileAtPath:path]) {
            return path;
        }
    }
    return @"/usr/bin/env";
}

- (void)startEmbeddedNodeServer {
    if (self.isTerminating) return;
    NSString *resourcePath = [[NSBundle mainBundle] resourcePath];
    if (!resourcePath) return;

    NSString *appRoot = [resourcePath stringByAppendingPathComponent:@"app"];
    NSString *serverScript = [appRoot stringByAppendingPathComponent:@"server/app-server.mjs"];
    NSString *staticDir = [appRoot stringByAppendingPathComponent:@"dist"];

    if (![[NSFileManager defaultManager] fileExistsAtPath:serverScript]) return;

    NSString *home = NSHomeDirectory();
    NSString *defaultWorkspace = [home stringByAppendingPathComponent:@"Desktop/codex-test"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:defaultWorkspace]) {
        defaultWorkspace = home;
    }

    NSTask *task = [[NSTask alloc] init];
    NSString *nodeBin = [self findNodeBinary];
    if ([nodeBin isEqualToString:@"/usr/bin/env"]) {
        [task setExecutableURL:[NSURL fileURLWithPath:@"/bin/zsh"]];
        NSString *cmd = [NSString stringWithFormat:@"node '%@'", serverScript];
        [task setArguments:@[@"-ilc", cmd]];
    } else {
        [task setExecutableURL:[NSURL fileURLWithPath:nodeBin]];
        [task setArguments:@[serverScript]];
    }

    [task setCurrentDirectoryURL:[NSURL fileURLWithPath:defaultWorkspace]];
    NSMutableDictionary *env = [[[NSProcessInfo processInfo] environment] mutableCopy];
    env[@"PORT"] = [NSString stringWithFormat:@"%ld", (long)self.serverPort];
    env[@"CODEX_STATIC_DIR"] = staticDir;
    env[@"CODEX_WORKSPACE_ROOT"] = defaultWorkspace;
    env[@"HOME"] = home;
    NSString *oldPath = env[@"PATH"] ?: @"/usr/bin:/bin";
    env[@"PATH"] = [NSString stringWithFormat:@"/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:%@", oldPath];
    [task setEnvironment:env];

    __weak typeof(self) weakSelf = self;
    [task setTerminationHandler:^(NSTask *terminatedTask) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf || strongSelf.isTerminating) return;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(500 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
            if (!strongSelf.isTerminating) {
                [strongSelf startEmbeddedNodeServer];
            }
        });
    }];

    NSError *err = nil;
    if ([task launchAndReturnError:&err]) {
        self.serverTask = task;
    }
}

- (void)pollServerAndLoadWithAttempt:(NSInteger)attempt {
    NSURL *readyUrl = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld/readyz", (long)self.serverPort]];
    NSURLSessionDataTask *t = [[NSURLSession sharedSession] dataTaskWithURL:readyUrl
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            NSHTTPURLResponse *httpResp = (NSHTTPURLResponse *)response;
            if ([httpResp isKindOfClass:[NSHTTPURLResponse class]] && httpResp.statusCode == 200) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    NSURL *appUrl = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld/", (long)self.serverPort]];
                    NSURLRequest *req = [NSURLRequest requestWithURL:appUrl
                                                         cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
                                                     timeoutInterval:3600.0];
                    [self.webView loadRequest:req];
                });
            } else if (attempt < 35) {
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(150 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
                    [self pollServerAndLoadWithAttempt:attempt + 1];
                });
            } else {
                dispatch_async(dispatch_get_main_queue(), ^{
                    NSString *resourcePath = [[NSBundle mainBundle] resourcePath];
                    if (resourcePath) {
                        NSString *distPath = [resourcePath stringByAppendingPathComponent:@"app/dist"];
                        NSString *indexPath = [distPath stringByAppendingPathComponent:@"index.html"];
                        [self.webView loadFileURL:[NSURL fileURLWithPath:indexPath]
                          allowingReadAccessToURL:[NSURL fileURLWithPath:distPath]];
                    }
                });
            }
        }];
    [t resume];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)applicationWillTerminate:(NSNotification *)notification {
    self.isTerminating = YES;
    if (self.serverTask && [self.serverTask isRunning]) {
        [self.serverTask terminate];
    }
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];

        NSMenu *menubar = [[NSMenu alloc] init];
        NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
        [menubar addItem:appMenuItem];
        [app setMainMenu:menubar];

        NSMenu *appMenu = [[NSMenu alloc] init];
        NSMenuItem *quitMenuItem = [[NSMenuItem alloc] initWithTitle:@"Quit Codex Desktop"
                                                              action:@selector(terminate:)
                                                       keyEquivalent:@"q"];
        [appMenu addItem:quitMenuItem];
        [appMenuItem setSubmenu:appMenu];

        AppDelegate *delegate = [[AppDelegate alloc] init];
        [app setDelegate:delegate];
        [app run];
    }
    return 0;
}
`;

async function copyDirRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function copyAppPayload(targetAppDir) {
  await fs.mkdir(targetAppDir, { recursive: true });
  await copyDirRecursive(path.join(ROOT_DIR, 'dist'), path.join(targetAppDir, 'dist'));
  await copyDirRecursive(path.join(ROOT_DIR, 'server'), path.join(targetAppDir, 'server'));
  await copyDirRecursive(path.join(ROOT_DIR, 'electron'), path.join(targetAppDir, 'electron'));
  if (fsSync.existsSync(path.join(ROOT_DIR, '.codex'))) {
    await copyDirRecursive(path.join(ROOT_DIR, '.codex'), path.join(targetAppDir, '.codex'));
  }
  if (fsSync.existsSync(path.join(ROOT_DIR, 'AGENTS.md'))) {
    await fs.copyFile(
      path.join(ROOT_DIR, 'AGENTS.md'),
      path.join(targetAppDir, 'AGENTS.md')
    );
  }
  await fs.copyFile(
    path.join(ROOT_DIR, 'package.json'),
    path.join(targetAppDir, 'package.json')
  );
}

function generateMacIcns(entries) {
  const blocks = entries.map(({ type, buf }) => {
    const hdr = Buffer.alloc(8);
    hdr.write(type, 0, 'ascii');
    hdr.writeUInt32BE(8 + buf.length, 4);
    return Buffer.concat([hdr, buf]);
  });
  const totalLen = 8 + blocks.reduce((s, b) => s + b.length, 0);
  const fileHdr = Buffer.alloc(8);
  fileHdr.write('icns', 0, 'ascii');
  fileHdr.writeUInt32BE(totalLen, 4);
  return Buffer.concat([fileHdr, ...blocks]);
}

async function main() {
  console.log('==========================================================');
  console.log(' OpenAI Codex Desktop — macOS & Windows Dual-OS Packager');
  console.log('==========================================================\n');

  // Step 1: Build Production Frontend (`tsc -b && vite build`)
  console.log('[1/4] Building production TypeScript & Vite frontend (`dist/`)...');
  runCmd('npm run build');

  // Step 2: Generate Icons (`build/icon.png`, `build/icon.icns`, `build/icon.ico`)
  console.log('\n[2/4] Generating macOS (.icns) & Windows (.ico) application icons...');
  await fs.mkdir(BUILD_DIR, { recursive: true });
  const png1024 = generateAppIconPng(1024);
  const png512 = generateAppIconPng(512);
  const png256 = generateAppIconPng(256);
  const png128 = generateAppIconPng(128);
  const png64 = generateAppIconPng(64);
  const png48 = generateAppIconPng(48);
  const png32 = generateAppIconPng(32);
  const png16 = generateAppIconPng(16);

  const iconPngPath = path.join(BUILD_DIR, 'icon.png');
  const iconIcoPath = path.join(BUILD_DIR, 'icon.ico');
  const iconIcnsPath = path.join(BUILD_DIR, 'icon.icns');

  await fs.writeFile(iconPngPath, png1024);
  await fs.writeFile(
    iconIcoPath,
    generateWindowsIco([
      { size: 256, buf: png256 },
      { size: 64, buf: png64 },
      { size: 48, buf: png48 },
      { size: 32, buf: png32 },
      { size: 16, buf: png16 },
    ])
  );

  await fs.writeFile(
    iconIcnsPath,
    generateMacIcns([
      { type: 'ic11', buf: png32 },
      { type: 'ic12', buf: png64 },
      { type: 'ic07', buf: png128 },
      { type: 'ic08', buf: png256 },
      { type: 'ic09', buf: png512 },
      { type: 'ic10', buf: png1024 },
    ])
  );

  // Clean and prepare release directory
  await fs.rm(RELEASE_DIR, { recursive: true, force: true });
  await fs.mkdir(RELEASE_DIR, { recursive: true });

  // ==========================================================================
  // Step 3: Build macOS Application Bundle (`.app`, `.zip`, `.pkg`)
  // ==========================================================================
  console.log('\n[3/4] Packaging macOS Desktop Application (`Codex Desktop.app`)...');
  const macReleaseDir = path.join(RELEASE_DIR, 'macos');
  const macAppBundle = path.join(macReleaseDir, 'Codex Desktop.app');
  const macContents = path.join(macAppBundle, 'Contents');
  const macOsBinDir = path.join(macContents, 'MacOS');
  const macResourcesDir = path.join(macContents, 'Resources');
  const macEmbeddedAppDir = path.join(macResourcesDir, 'app');

  await fs.mkdir(macOsBinDir, { recursive: true });
  await fs.mkdir(macResourcesDir, { recursive: true });

  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Codex Desktop</string>
  <key>CFBundleExecutable</key>
  <string>CodexDesktop</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.openai.codex.desktop</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Codex Desktop</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>100</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
</dict>
</plist>
`;
  await fs.writeFile(path.join(macContents, 'Info.plist'), infoPlist, 'utf8');
  await fs.copyFile(iconIcnsPath, path.join(macResourcesDir, 'AppIcon.icns'));
  await copyAppPayload(macEmbeddedAppDir);

  // Compile native macOS ARM64 binary using clang (Objective-C Cocoa + WebKit)
  const objcSrcPath = path.join(BUILD_DIR, 'CodexDesktopMac.m');
  const macExecPath = path.join(macOsBinDir, 'CodexDesktop');
  await fs.writeFile(objcSrcPath, MACOS_OBJC_SOURCE, 'utf8');
  runCmd(
    `clang -O2 -fobjc-arc -arch arm64 -arch x86_64 "${objcSrcPath}" -o "${macExecPath}" -framework Cocoa -framework WebKit`
  );
  await fs.chmod(macExecPath, 0o755);
  await fs.rm(objcSrcPath, { force: true });

  // Ad-hoc codesign the macOS .app bundle so Gatekeeper allows local launch
  try {
    runCmd(`codesign --force --deep --sign - "${macAppBundle}"`);
  } catch {
    // ignore if codesign unavailable
  }

  // Create macOS .zip and .pkg installer
  const macZipPath = path.join(RELEASE_DIR, 'Codex-Desktop-1.0.0-macOS-arm64.zip');
  const macPkgPath = path.join(RELEASE_DIR, 'Codex-Desktop-1.0.0-macOS-arm64.pkg');
  runCmd(`cd "${macReleaseDir}" && zip -ry -q "${macZipPath}" "Codex Desktop.app"`);
  try {
    runCmd(
      `pkgbuild --component "${macAppBundle}" --install-location /Applications "${macPkgPath}"`
    );
  } catch (err) {
    console.warn('  Note: pkgbuild skipped:', err.message);
  }

  // ==========================================================================
  // Step 4: Build Windows 64-bit Application Package (`Codex Desktop.exe` + `.zip`)
  // ==========================================================================
  console.log('\n[4/4] Packaging Windows 64-bit Desktop Application (`Codex Desktop.exe`)...');
  const winReleaseDir = path.join(RELEASE_DIR, 'windows', 'Codex-Desktop-win32-x64');
  const winResourcesDir = path.join(winReleaseDir, 'resources');
  const winEmbeddedAppDir = path.join(winResourcesDir, 'app');

  await fs.mkdir(winEmbeddedAppDir, { recursive: true });
  await copyAppPayload(winEmbeddedAppDir);
  await fs.copyFile(iconIcoPath, path.join(winReleaseDir, 'icon.ico'));

  // Write Windows silent VBS launcher (`resources\launch-win.vbs`) invoked by `Codex Desktop.exe`
  const winVbsLauncher = `' OpenAI Codex Desktop — Windows Silent GUI Launcher
Option Explicit
Dim fso, shell, baseDir, appDir, serverScript, distDir, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = baseDir & "\\app"
serverScript = appDir & "\\server\\app-server.mjs"
distDir = appDir & "\\dist"

shell.CurrentDirectory = appDir
shell.Environment("PROCESS")("PORT") = "4500"
shell.Environment("PROCESS")("CODEX_STATIC_DIR") = distDir

' 1. Start embedded Node.js Codex App-Server hidden (window style 0)
On Error Resume Next
shell.Run "cmd.exe /c node """ & serverScript & """", 0, False
WScript.Sleep 900

' 2. Open native chromeless desktop window via Microsoft Edge WebView/App Mode or Chrome App Mode
Err.Clear
shell.Run "msedge.exe --app=http://127.0.0.1:4500 --window-size=1520,940", 1, False
If Err.Number <> 0 Then
  Err.Clear
  shell.Run "chrome.exe --app=http://127.0.0.1:4500 --window-size=1520,940", 1, False
  If Err.Number <> 0 Then
    shell.Run "http://127.0.0.1:4500", 1, False
  End If
End If
`;
  await fs.writeFile(
    path.join(winResourcesDir, 'launch-win.vbs'),
    winVbsLauncher.replace(/\n/g, '\r\n'),
    'utf8'
  );

  // Write Windows Batch launcher (`Start-Codex-Desktop.bat`)
  const winBatLauncher = `@echo off
chcp 65001 >nul
title OpenAI Codex Desktop App
cd /d "%~dp0"
set PORT=4500
set CODEX_STATIC_DIR=%~dp0resources\\app\\dist
start "CodexAppServer" /B node "%~dp0resources\\app\\server\\app-server.mjs"
timeout /t 1 /nobreak >nul
start "" msedge.exe --app=http://127.0.0.1:4500 --window-size=1520,940 2>nul || start "" http://127.0.0.1:4500
`;
  await fs.writeFile(
    path.join(winReleaseDir, 'Start-Codex-Desktop.bat'),
    winBatLauncher.replace(/\n/g, '\r\n'),
    'utf8'
  );

  // Write Windows PowerShell launcher (`Start-Codex-Desktop.ps1`)
  const winPs1Launcher = `$ErrorActionPreference = "SilentlyContinue"
$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:PORT = "4500"
$env:CODEX_STATIC_DIR = Join-Path $AppRoot "resources\\app\\dist"
$ServerScript = Join-Path $AppRoot "resources\\app\\server\\app-server.mjs"

Start-Process -FilePath "node" -ArgumentList "\`"$ServerScript\`"" -WindowStyle Hidden
Start-Sleep -Milliseconds 900

$EdgePaths = @(
  "$env:ProgramFiles (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe"
)
$EdgeExe = $EdgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($EdgeExe) {
  Start-Process -FilePath $EdgeExe -ArgumentList "--app=http://127.0.0.1:4500 --window-size=1520,940"
} else {
  Start-Process "http://127.0.0.1:4500"
}
`;
  await fs.writeFile(
    path.join(winReleaseDir, 'Start-Codex-Desktop.ps1'),
    winPs1Launcher.replace(/\n/g, '\r\n'),
    'utf8'
  );

  // Write Windows README
  const winReadme = `OpenAI Codex Desktop App (Windows x64 Portable Release v1.0.0)
================================================================

1. 运行环境要求 (Prerequisites):
   - Windows 10 / Windows 11 (64-bit)
   - 已安装 Node.js (v18+) 与 OpenAI Codex CLI (\`npm install -g @openai/codex\`)

2. 启动方式 (How to Launch):
   - 方式一（推荐）：直接双击 \`Codex Desktop.exe\`（64 位原生 GUI 启动器，无黑框静默拉起本地 Codex 服务与桌面窗口）
   - 方式二：双击 \`Start-Codex-Desktop.bat\` 或右键使用 PowerShell 运行 \`Start-Codex-Desktop.ps1\`
   - 方式三（Electron 模式）：进入 \`resources\\app\` 运行 \`npx electron electron/main.cjs\`

3. 本机 Codex 配置文件自动读取路径:
   - 登录凭证：\`%USERPROFILE%\\.codex\\auth.json\`
   - 全局配置：\`%USERPROFILE%\\.codex\\config.toml\`
   - 本机技能：\`%USERPROFILE%\\.codex\\skills\`
   - CLI 可执行文件：自动探测 \`%APPDATA%\\npm\\codex.cmd\` 与系统 PATH
`;
  await fs.writeFile(
    path.join(winReleaseDir, 'README-Windows.txt'),
    winReadme.replace(/\n/g, '\r\n'),
    'utf8'
  );

  // Build genuine 64-bit Windows PE32+ GUI executable `Codex Desktop.exe`
  const winExePath = path.join(winReleaseDir, 'Codex Desktop.exe');
  const peExeBuffer = buildWindowsPe64GuiExe('wscript.exe "resources\\launch-win.vbs"');
  await fs.writeFile(winExePath, peExeBuffer);

  // Package Windows Portable Archive (`release/Codex-Desktop-1.0.0-Windows-x64.zip`)
  const winZipPath = path.join(RELEASE_DIR, 'Codex-Desktop-1.0.0-Windows-x64.zip');
  runCmd(
    `cd "${path.join(RELEASE_DIR, 'windows')}" && zip -r -q "${winZipPath}" "Codex-Desktop-win32-x64"`
  );

  console.log('\n==========================================================');
  console.log(' Build & Cross-Platform Packaging Completed Successfully!');
  console.log('==========================================================');
}

main().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
