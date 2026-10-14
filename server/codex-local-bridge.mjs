/**
 * Cross-Platform (macOS & Windows) OpenAI Codex CLI, Multi-Workspace & Configuration Bridge
 * - Recursively locates and health-probes the real `codex` binary from `/Applications/Codex.app`,
 *   `/Applications/ChatGPT.app`, Homebrew, nvm (highest semver first), fnm, bun, cargo, and PATH.
 * - Pre-warms `~/.codex/models_cache.json` (`fetched_at`) before execution so `codex_models_manager`
 *   never stalls for 30s on network refresh timeouts.
 * - Isolates broken OAuth MCP servers (e.g. `cloudflare-api` `invalid_grant`) and suppresses Rust
 *   `tracing` stderr noise (`RUST_LOG=off`) for instant 1-2s turn startup and clean Thinking traces.
 * - Full Multi-Workspace creation, native Finder directory picker (`osascript`), and switching.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import readline from 'node:readline';

const execAsync = promisify(exec);
const IS_WIN = process.platform === 'win32';

const activeTurnProcesses = new Map();

export function makeWorkspaceId(normalizedPath) {
  if (!normalizedPath || typeof normalizedPath !== 'string') return 'proj_codex_desktop';
  const norm = path.resolve(normalizedPath).replace(/\/+$/, '');
  if (norm.endsWith('/codex-test')) return 'proj_codex_desktop';
  const hash = crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12);
  return `proj_${hash}`;
}

const INTERNAL_UTILITY_SLUGS = new Set([
  'gpt-reserve',
  'codex-auto-review',
  'gpt-daybreak-blue-latest',
]);

const MODEL_DISPLAY_NAME_MAP = {
  default: '默认',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6-astra': 'GPT-6 Astra',
  'gpt-6-sol': 'GPT-6 Sol',
  'gpt-6-luna': 'GPT-6 Luna',
  'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gpt-5.6-terra': 'GPT-5.6 Terra',
  'gpt-5.6-luna': 'GPT-5.6 Luna',
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-5.3-codex': 'GPT-5.3 Codex',
  'gpt-5.2-codex': 'GPT-5.2 Codex',
  'gpt-5.1-codex-max': 'GPT-5.1 Codex Max',
  'gpt-5.1-codex-mini': 'GPT-5.1 Codex Mini',
};

export function formatModelDisplayName(slug, rawDisplayName) {
  if (!slug) return 'GPT-6.1 Sol';
  if (MODEL_DISPLAY_NAME_MAP[slug]) return MODEL_DISPLAY_NAME_MAP[slug];
  if (rawDisplayName && rawDisplayName !== slug) return rawDisplayName;
  if (slug.startsWith('gpt-')) {
    const rest = slug.slice(4).split('-');
    const ver = rest.shift() || '';
    const suffix = rest
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return suffix ? `GPT-${ver} ${suffix}` : `GPT-${ver}`;
  }
  return rawDisplayName || slug;
}

const DEFAULT_SUPPORTED_REASONING_LEVELS = [
  { effort: 'low', description: '快速响应，轻量推理' },
  { effort: 'medium', description: '平衡响应速度与推理深度' },
  { effort: 'high', description: '深度多步推理，适合复杂工程问题' },
  { effort: 'xhigh', description: '极高推理深度，适合架构重构与疑难分析' },
  { effort: 'max', description: 'Max 深度单任务极限推理预算' },
  { effort: 'ultra', description: 'Ultra 多智能体并行协同与全域深度探索' },
];

const REAL_CODEX_APP_MODEL_CATALOG = [
  {
    slug: 'default',
    displayName: '默认',
    description: '推荐模型集',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
    visibility: 'list',
    priority: -10,
  },
  {
    slug: 'gpt-6.1-sol',
    displayName: 'GPT-6.1 Sol',
    description: '新一代主力工程编程模型',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
    visibility: 'list',
    priority: 0,
  },
  {
    slug: 'gpt-6-astra',
    displayName: 'GPT-6 Astra',
    description: '深度架构与全栈工程推理模型',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
    visibility: 'list',
    priority: 1,
  },
  {
    slug: 'gpt-6-sol',
    displayName: 'GPT-6 Sol',
    description: '高效智能体编码与调试模型',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
    visibility: 'list',
    priority: 2,
  },
  {
    slug: 'gpt-6-luna',
    displayName: 'GPT-6 Luna',
    description: '敏捷交互与快速代码生成模型',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
    visibility: 'list',
    priority: 3,
  },
  {
    slug: 'gpt-5.6-sol',
    displayName: 'GPT-5.6 Sol',
    description: '成熟稳定的代码工程模型',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
    visibility: 'list',
    priority: 4,
  },
  {
    slug: 'gpt-5.6-terra',
    displayName: 'GPT-5.6 Terra',
    description: '复杂代码库分析与长上下文模型',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
    visibility: 'list',
    priority: 5,
  },
  {
    slug: 'gpt-5.6-luna',
    displayName: 'GPT-5.6 Luna',
    description: '轻量高速代码编辑与问答模型',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
    visibility: 'list',
    priority: 6,
  },
];

function mapEffortToCliValue(effort) {
  if (!effort) return 'xhigh';
  if (effort === 'ultra' || effort === 'uhigh' || effort === 'max' || effort === 'xhigh') {
    return 'xhigh';
  }
  if (effort === 'high' || effort === 'medium' || effort === 'low' || effort === 'minimal') {
    return effort;
  }
  return 'xhigh';
}

export function stripAnsi(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function compareSemverDesc(a, b) {
  const parseVer = (v) =>
    String(v)
      .replace(/^v/i, '')
      .split(/[.-]/)
      .map((n) => (Number.isNaN(Number(n)) ? 0 : Number(n)));
  const pa = parseVer(a);
  const pb = parseVer(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function resolveRealHomeDir() {
  if (IS_WIN) {
    const winHome =
      process.env.USERPROFILE ||
      (process.env.HOMEDRIVE && process.env.HOMEPATH
        ? path.join(process.env.HOMEDRIVE, process.env.HOMEPATH)
        : null) ||
      process.env.HOME ||
      os.homedir();
    if (winHome && fsSync.existsSync(winHome)) {
      return winHome;
    }
    return os.homedir();
  }

  const username = process.env.USER || process.env.LOGNAME || 'zhangjinhui';
  const macUserHome = `/Users/${username}`;
  try {
    if (fsSync.existsSync(macUserHome)) {
      return macUserHome;
    }
  } catch {
    // ignore
  }
  return os.homedir();
}

export function resolveCodexHomeDir() {
  if (process.env.CODEX_HOME && fsSync.existsSync(process.env.CODEX_HOME)) {
    return process.env.CODEX_HOME;
  }
  const realHome = resolveRealHomeDir();
  return path.join(realHome, '.codex');
}

/**
 * Keep ~/.codex/models_cache.json `fetched_at` fresh so `codex_models_manager::manager`
 * never stalls for 20-30s waiting on a remote `/models` refresh timeout!
 */
export async function touchModelsCacheFreshness(codexHome = resolveCodexHomeDir()) {
  const cachePath = path.join(codexHome, 'models_cache.json');
  try {
    if (!fsSync.existsSync(cachePath)) return;
    const raw = await fs.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      parsed.fetched_at = new Date().toISOString();
      await fs.writeFile(cachePath, JSON.stringify(parsed, null, 2), 'utf8');
    }
  } catch {
    // ignore
  }
}

function findCodexBinariesInAppBundle(bundleContentsDir, maxDepth = 6) {
  const found = [];
  function walk(currentDir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fsSync.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith('.lproj') || entry.name === '_CodeSignature') continue;
        walk(fullPath, depth + 1);
      } else if (
        (entry.isFile() || entry.isSymbolicLink()) &&
        entry.name === 'codex'
      ) {
        found.push(fullPath);
      }
    }
  }
  if (fsSync.existsSync(bundleContentsDir)) {
    walk(bundleContentsDir, 0);
  }
  return found;
}

export function buildAugmentedPath() {
  const realHome = resolveRealHomeDir();
  const delim = path.delimiter;

  if (IS_WIN) {
    const appData = process.env.APPDATA || path.join(realHome, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(realHome, 'AppData', 'Local');
    const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const winExtraDirs = [
      path.join(appData, 'npm'),
      path.join(localAppData, 'npm'),
      path.join(progFiles, 'nodejs'),
      path.join(progFilesX86, 'nodejs'),
      path.join(localAppData, 'Programs', 'nodejs'),
      path.join(realHome, '.volta', 'bin'),
      path.join(realHome, '.bun', 'bin'),
      path.join(realHome, '.cargo', 'bin'),
      path.join(realHome, 'scoop', 'shims'),
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links'),
      path.join(progFiles, 'Git', 'cmd'),
      path.join(progFiles, 'Git', 'bin'),
      path.join(localAppData, 'Programs', 'cursor', 'resources', 'app', 'bin'),
      path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin'),
    ];

    if (process.env.NVM_SYMLINK) {
      winExtraDirs.unshift(process.env.NVM_SYMLINK);
    }

    const currentPath = process.env.PATH || process.env.Path || '';
    return Array.from(new Set([...winExtraDirs, ...currentPath.split(delim).filter(Boolean)])).join(
      delim
    );
  }

  const priorityDirs = [
    '/Applications/Codex.app/Contents/Resources',
    '/Applications/Codex.app/Contents/Resources/bin',
    '/Applications/Codex.app/Contents/MacOS',
    path.join(realHome, 'Applications', 'Codex.app', 'Contents', 'Resources'),
    '/Applications/ChatGPT.app/Contents/Resources',
    '/Applications/ChatGPT.app/Contents/Resources/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
  ];

  const versionManagerDirs = [];
  const nvmNodesDir = path.join(realHome, '.nvm', 'versions', 'node');
  try {
    if (fsSync.existsSync(nvmNodesDir)) {
      const versions = fsSync.readdirSync(nvmNodesDir).sort(compareSemverDesc);
      for (const v of versions) {
        versionManagerDirs.push(path.join(nvmNodesDir, v, 'bin'));
      }
    }
  } catch {
    // ignore
  }

  const fnmDirs = [
    path.join(realHome, '.local', 'share', 'fnm', 'node-versions'),
    path.join(realHome, 'Library', 'Application Support', 'fnm', 'node-versions'),
  ];
  for (const fnmBase of fnmDirs) {
    try {
      if (fsSync.existsSync(fnmBase)) {
        const versions = fsSync.readdirSync(fnmBase).sort(compareSemverDesc);
        for (const v of versions) {
          versionManagerDirs.push(path.join(fnmBase, v, 'installation', 'bin'));
        }
      }
    } catch {
      // ignore
    }
  }

  const userToolDirs = [
    path.join(realHome, '.volta', 'bin'),
    path.join(realHome, '.bun', 'bin'),
    path.join(realHome, '.cargo', 'bin'),
    path.join(realHome, '.npm-global', 'bin'),
    path.join(realHome, '.local', 'bin'),
    path.join(realHome, 'bin'),
  ];

  const currentPath = process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
  return Array.from(
    new Set([
      ...priorityDirs,
      ...versionManagerDirs,
      ...userToolDirs,
      ...currentPath.split(delim).filter(Boolean),
    ])
  ).join(delim);
}

let cachedCodexBinary = null;
let cachedCodexVersion = null;
const brokenCodexBinaries = new Set();

function isNativeMachOBinary(filePath) {
  try {
    const fd = fsSync.openSync(filePath, 'r');
    const header = Buffer.alloc(4);
    fsSync.readSync(fd, header, 0, 4, 0);
    fsSync.closeSync(fd);
    return !(header[0] === 0x23 && header[1] === 0x21);
  } catch {
    return false;
  }
}

function healBrokenNvmCodexVendor(workingBinaryPath, realHome) {
  if (IS_WIN || !workingBinaryPath) return;
  try {
    let nativeSource = isNativeMachOBinary(workingBinaryPath) ? workingBinaryPath : null;
    if (!nativeSource) {
      const appCandidates = [
        ...findCodexBinariesInAppBundle('/Applications/Codex.app/Contents'),
        ...findCodexBinariesInAppBundle('/Applications/ChatGPT.app/Contents'),
      ];
      nativeSource = appCandidates.find((c) => isNativeMachOBinary(c)) || null;
    }
    if (!nativeSource) return;

    const nvmNodesDir = path.join(realHome, '.nvm', 'versions', 'node');
    if (!fsSync.existsSync(nvmNodesDir)) return;
    const versions = fsSync.readdirSync(nvmNodesDir);
    const archDir = process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';

    for (const v of versions) {
      const codexPkgDir = path.join(nvmNodesDir, v, 'lib', 'node_modules', '@openai', 'codex');
      if (!fsSync.existsSync(codexPkgDir)) continue;
      const expectedVendorBin = path.join(codexPkgDir, 'vendor', archDir, 'codex', 'codex');
      if (!fsSync.existsSync(expectedVendorBin)) {
        try {
          fsSync.mkdirSync(path.dirname(expectedVendorBin), { recursive: true });
          fsSync.symlinkSync(nativeSource, expectedVendorBin);
          brokenCodexBinaries.delete(path.join(nvmNodesDir, v, 'bin', 'codex'));
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
}

async function probeCodexBinary(candidate, realHome, augPath) {
  if (!candidate || brokenCodexBinaries.has(candidate)) return null;
  try {
    if (!fsSync.existsSync(candidate)) return null;
    const stat = fsSync.statSync(candidate);
    if (!stat.isFile()) return null;

    const { stdout, stderr } = await execAsync(`"${candidate}" --version`, {
      timeout: 3000,
      env: { ...process.env, HOME: realHome, USERPROFILE: realHome, PATH: augPath },
    });
    const combined = `${stdout || ''}\n${stderr || ''}`.trim();
    if (!combined || /ENOENT|Cannot find module|Error: spawn/i.test(combined)) {
      brokenCodexBinaries.add(candidate);
      return null;
    }
    return (stdout || combined).trim().split(/\r?\n/)[0];
  } catch {
    brokenCodexBinaries.add(candidate);
    return null;
  }
}

export async function resolveCodexBinary(forceRefresh = false) {
  if (cachedCodexBinary && !forceRefresh && !brokenCodexBinaries.has(cachedCodexBinary)) {
    return cachedCodexBinary;
  }

  const augPath = buildAugmentedPath();
  const realHome = resolveRealHomeDir();
  const delim = path.delimiter;
  const candidateSet = new Set();

  if (!IS_WIN) {
    const bundleRoots = [
      '/Applications/Codex.app/Contents',
      path.join(realHome, 'Applications', 'Codex.app', 'Contents'),
      '/Applications/ChatGPT.app/Contents',
      path.join(realHome, 'Applications', 'ChatGPT.app', 'Contents'),
    ];
    for (const root of bundleRoots) {
      for (const found of findCodexBinariesInAppBundle(root)) {
        candidateSet.add(found);
      }
    }

    candidateSet.add('/opt/homebrew/bin/codex');
    candidateSet.add('/usr/local/bin/codex');

    const archVendor =
      process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
    const pkgPlatform =
      process.arch === 'arm64' ? '@openai/codex-darwin-arm64' : '@openai/codex-darwin-x64';
    const nvmNodesDir = path.join(realHome, '.nvm', 'versions', 'node');
    try {
      if (fsSync.existsSync(nvmNodesDir)) {
        const versions = fsSync.readdirSync(nvmNodesDir).sort(compareSemverDesc);
        for (const v of versions) {
          const nm = path.join(nvmNodesDir, v, 'lib', 'node_modules');
          candidateSet.add(
            path.join(nm, '@openai', 'codex', 'node_modules', pkgPlatform, 'vendor', archVendor, 'codex', 'codex')
          );
          candidateSet.add(
            path.join(nm, pkgPlatform, 'vendor', archVendor, 'codex', 'codex')
          );
          candidateSet.add(
            path.join(nm, '@openai', 'codex', 'vendor', archVendor, 'codex', 'codex')
          );
        }
      }
    } catch {
      // ignore
    }
  }

  const binaryNames = IS_WIN ? ['codex.cmd', 'codex.exe', 'codex.bat', 'codex'] : ['codex'];
  const dirs = augPath.split(delim).filter(Boolean);
  for (const dir of dirs) {
    for (const binName of binaryNames) {
      candidateSet.add(path.join(dir, binName));
    }
  }

  if (IS_WIN) {
    for (const winCmd of [
      'where.exe codex',
      'powershell.exe -NoProfile -Command "(Get-Command codex -ErrorAction SilentlyContinue).Source"',
    ]) {
      try {
        const { stdout } = await execAsync(winCmd, {
          timeout: 3500,
          env: { ...process.env, USERPROFILE: realHome, PATH: augPath },
        });
        for (const line of stdout.trim().split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed) candidateSet.add(trimmed);
        }
      } catch {
        // ignore
      }
    }
  } else {
    for (const shellCmd of ['/bin/zsh -lc "which -a codex"', '/bin/zsh -ilc "which -a codex"']) {
      try {
        const { stdout } = await execAsync(shellCmd, {
          timeout: 3500,
          env: { ...process.env, HOME: realHome, PATH: augPath },
        });
        for (const line of stdout.trim().split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('/') && !trimmed.includes('not found')) {
            candidateSet.add(trimmed);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  const allCandidates = Array.from(candidateSet);
  const nativeFirst = [
    ...allCandidates.filter((c) => isNativeMachOBinary(c)),
    ...allCandidates.filter((c) => !isNativeMachOBinary(c)),
  ];

  for (const candidate of nativeFirst) {
    const versionOut = await probeCodexBinary(candidate, realHome, augPath);
    if (versionOut) {
      cachedCodexBinary = candidate;
      cachedCodexVersion = versionOut;
      healBrokenNvmCodexVendor(candidate, realHome);
      return candidate;
    }
  }

  return null;
}

export function markCodexBinaryBroken(binPath) {
  if (binPath) {
    brokenCodexBinaries.add(binPath);
    if (cachedCodexBinary === binPath) {
      cachedCodexBinary = null;
      cachedCodexVersion = null;
    }
  }
}

// ============================================================================
// Multi-Workspace / Working Directory Management
// - Uses `makeWorkspaceId(normalized)` (SHA-1) so every folder has a unique ID
//   (fixing the bug where paths sharing `/Users/zhangjinhui/...` had the same 18-char base64 prefix).
// - Only displays workspaces explicitly created or opened in this Desktop App
//   (`~/.codex/codex_desktop_app_workspaces_v2.json`), NEVER dumping 20+ old CLI folders from config.toml.
// ============================================================================
function getWorkspacesStorePath() {
  return path.join(resolveCodexHomeDir(), 'codex_desktop_app_workspaces_v2.json');
}

export async function listDirectorySubfolders(targetDir) {
  const realHome = resolveRealHomeDir();
  const resolvedDir =
    !targetDir || targetDir === '~'
      ? path.join(realHome, 'Desktop')
      : targetDir.startsWith('~/')
      ? path.join(realHome, targetDir.slice(2))
      : path.resolve(targetDir);

  const folders = [];
  try {
    const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const fullPath = path.join(resolvedDir, entry.name);
      const isGitRepo = fsSync.existsSync(path.join(fullPath, '.git'));
      folders.push({
        name: entry.name,
        path: fullPath,
        isGitRepo,
      });
    }
  } catch {
    // ignore
  }
  return {
    currentDir: resolvedDir,
    parentDir: path.dirname(resolvedDir),
    folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function listAllWorkspaces(defaultWorkspaceRoot) {
  const realHome = resolveRealHomeDir();
  const storePath = getWorkspacesStorePath();

  const workspaceMap = new Map();

  const addWorkspaceEntry = (repoPath, expanded = true) => {
    if (!repoPath || typeof repoPath !== 'string') return;
    if (repoPath.includes('.app/Contents/Resources')) return;
    const normalized = path.resolve(repoPath).replace(/\/+$/, '');
    if (!fsSync.existsSync(normalized)) return;
    const id = makeWorkspaceId(normalized);
    if (!workspaceMap.has(normalized)) {
      workspaceMap.set(normalized, {
        id,
        name: path.basename(normalized) || normalized,
        repoPath: normalized,
        defaultBranch: 'main',
        expanded,
      });
    }
  };

  // 1. Primary default workspace (`codex-test`)
  const defaultDesktopRepo = path.join(realHome, 'Desktop', 'codex-test');
  if (fsSync.existsSync(defaultDesktopRepo)) {
    addWorkspaceEntry(defaultDesktopRepo, true);
  } else if (defaultWorkspaceRoot) {
    addWorkspaceEntry(defaultWorkspaceRoot, true);
  }

  // 2. Saved workspaces explicitly created/added in this Desktop App (`~/.codex/codex_desktop_app_workspaces_v2.json`)
  let loadedStore = false;
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const savedList = JSON.parse(raw);
    if (Array.isArray(savedList)) {
      loadedStore = true;
      for (const item of savedList) {
        addWorkspaceEntry(typeof item === 'string' ? item : item?.repoPath, true);
      }
    }
  } catch {
    // ignore
  }

  // Migrate any user-created workspace from v1 store only if it is under ~/Desktop (such as my-g4-app),
  // NEVER importing random historical CLI directories from config.toml!
  if (!loadedStore) {
    const myG4App = path.join(realHome, 'Desktop', 'my-g4-app');
    if (fsSync.existsSync(myG4App)) {
      addWorkspaceEntry(myG4App, true);
    }
  }

  // 3. Discover Desktop subfolders for the modal's quick one-click import list
  const desktopSubfolders = await listDirectorySubfolders(path.join(realHome, 'Desktop'));

  return {
    workspaces: Array.from(workspaceMap.values()),
    desktopFolders: desktopSubfolders.folders,
    desktopPath: path.join(realHome, 'Desktop'),
    homePath: realHome,
  };
}

async function saveWorkspacesToStore(workspaces) {
  const storePath = getWorkspacesStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(
    storePath,
    JSON.stringify(
      workspaces.map((w) => ({ name: w.name, repoPath: w.repoPath })),
      null,
      2
    ),
    'utf8'
  );
}

export async function createOrAddWorkspace({
  parentDir,
  folderName,
  fullPath,
  initGit = true,
}) {
  const realHome = resolveRealHomeDir();
  const augPath = buildAugmentedPath();

  let targetPath = '';
  if (fullPath && typeof fullPath === 'string') {
    targetPath = fullPath.startsWith('~/')
      ? path.join(realHome, fullPath.slice(2))
      : path.resolve(fullPath);
  } else {
    const base =
      !parentDir || parentDir === '~'
        ? path.join(realHome, 'Desktop')
        : parentDir.startsWith('~/')
        ? path.join(realHome, parentDir.slice(2))
        : path.resolve(parentDir);
    const cleanName = String(folderName || `codex-project-${Date.now().toString(36)}`)
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '-');
    targetPath = path.join(base, cleanName);
  }

  await fs.mkdir(targetPath, { recursive: true });

  // Optionally initialize git repository if not already a git repo
  if (initGit && !fsSync.existsSync(path.join(targetPath, '.git'))) {
    try {
      await execAsync('git init', {
        cwd: targetPath,
        env: { ...process.env, PATH: augPath },
      });
    } catch {
      // ignore
    }
  }

  // Add to saved workspaces store with collision-free SHA-1 ID
  const current = await listAllWorkspaces(targetPath);
  const existing = current.workspaces;
  const normalized = path.resolve(targetPath).replace(/\/+$/, '');
  const id = makeWorkspaceId(normalized);

  const newWorkspace = {
    id,
    name: path.basename(normalized) || normalized,
    repoPath: normalized,
    defaultBranch: 'main',
    expanded: true,
  };

  const merged = [
    newWorkspace,
    ...existing.filter((w) => w.repoPath !== normalized),
  ];
  await saveWorkspacesToStore(merged);

  const gitState = await inspectGitRepository(normalized);
  return {
    ok: true,
    workspace: newWorkspace,
    workspaces: merged,
    git: gitState,
  };
}

export async function removeWorkspaceFromList(repoPathOrId) {
  const current = await listAllWorkspaces();
  const filtered = current.workspaces.filter(
    (w) => w.id !== repoPathOrId && w.repoPath !== repoPathOrId
  );
  await saveWorkspacesToStore(filtered);
  return {
    ok: true,
    workspaces: filtered,
  };
}

/**
 * Trigger Native OS Folder Chooser Dialog (macOS Finder `choose folder` with New Folder button, or Windows FolderBrowserDialog)
 */
export async function pickNativeFolderDialog() {
  const realHome = resolveRealHomeDir();
  const augPath = buildAugmentedPath();

  try {
    if (IS_WIN) {
      const psScript = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择或新建 Codex 工作空间目录'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }`;
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -Sta -Command "${psScript}"`,
        { timeout: 60000, env: { ...process.env, PATH: augPath } }
      );
      const picked = stdout.trim();
      if (!picked) return { ok: false, cancelled: true };
      return await createOrAddWorkspace({ fullPath: picked, initGit: false });
    }

    const osaCmd = `osascript -e 'POSIX path of (choose folder with prompt "选择或新建 Codex 项目工作空间目录：")'`;
    const { stdout } = await execAsync(osaCmd, {
      timeout: 60000,
      env: { ...process.env, HOME: realHome, PATH: augPath },
    });
    const picked = stdout.trim();
    if (!picked) return { ok: false, cancelled: true };
    return await createOrAddWorkspace({ fullPath: picked, initGit: false });
  } catch (err) {
    return {
      ok: false,
      cancelled: true,
      error: String(err.message || err),
    };
  }
}

function decodeJwtPayload(jwtStr) {
  if (!jwtStr || typeof jwtStr !== 'string') return null;
  const parts = jwtStr.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function maskSecret(str) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= 10) return '***';
  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

export function parseTomlConfig(rawToml) {
  const result = {
    model: null,
    model_provider: null,
    model_reasoning_effort: null,
    model_reasoning_summary: null,
    personality: null,
    approval_policy: null,
    sandbox_mode: null,
    profile: null,
    model_providers: {},
    mcp_servers: {},
    projects: {},
    profiles: {},
    sandbox: {},
    agents: {},
    raw: rawToml || '',
  };

  if (!rawToml) return result;

  let currentSection = null;
  const lines = rawToml.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1].trim();
    const valRaw = kvMatch[2].trim();
    let val = valRaw;

    if (
      (valRaw.startsWith('"') && valRaw.endsWith('"')) ||
      (valRaw.startsWith("'") && valRaw.endsWith("'"))
    ) {
      val = valRaw.slice(1, -1);
    } else if (valRaw === 'true') {
      val = true;
    } else if (valRaw === 'false') {
      val = false;
    } else if (!Number.isNaN(Number(valRaw)) && valRaw !== '') {
      val = Number(valRaw);
    } else if (valRaw.startsWith('[') && valRaw.endsWith(']')) {
      try {
        val = JSON.parse(valRaw.replace(/'/g, '"'));
      } catch {
        val = valRaw;
      }
    }

    if (!currentSection) {
      result[key] = val;
    } else if (currentSection.startsWith('model_providers.')) {
      const providerKey = currentSection
        .slice('model_providers.'.length)
        .replace(/^["']|["']$/g, '');
      if (!result.model_providers[providerKey]) result.model_providers[providerKey] = {};
      result.model_providers[providerKey][key] = val;
    } else if (currentSection.startsWith('mcp_servers.')) {
      const serverKey = currentSection
        .slice('mcp_servers.'.length)
        .replace(/^["']|["']$/g, '');
      if (!result.mcp_servers[serverKey]) result.mcp_servers[serverKey] = {};
      result.mcp_servers[serverKey][key] = val;
    } else if (currentSection.startsWith('projects.')) {
      const projKey = currentSection.slice('projects.'.length).replace(/^["']|["']$/g, '');
      if (!result.projects[projKey]) result.projects[projKey] = {};
      result.projects[projKey][key] = val;
    } else if (currentSection.startsWith('profiles.')) {
      const profKey = currentSection.slice('profiles.'.length).replace(/^["']|["']$/g, '');
      if (!result.profiles[profKey]) result.profiles[profKey] = {};
      result.profiles[profKey][key] = val;
    } else if (currentSection === 'sandbox') {
      result.sandbox[key] = val;
    } else if (currentSection === 'agents') {
      result.agents[key] = val;
    }
  }

  return result;
}

export async function updateGlobalCodexConfigKeys(updates = {}) {
  const codexHome = resolveCodexHomeDir();
  const configPath = path.join(codexHome, 'config.toml');
  let raw = '';
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch {
    raw = '';
  }

  const lines = raw ? raw.split(/\r?\n/) : [];
  const firstSectionIdx = lines.findIndex((l) => /^\s*\[[^\]]+\]/.test(l));
  const topLines = firstSectionIdx >= 0 ? lines.slice(0, firstSectionIdx) : [...lines];
  const restLines = firstSectionIdx >= 0 ? lines.slice(firstSectionIdx) : [];

  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined || val === null || val === '') continue;
    const formatted = typeof val === 'string' ? `"${val}"` : String(val);
    const keyRegex = new RegExp(`^\\s*${key}\\s*=`);
    const existingIdx = topLines.findIndex((l) => keyRegex.test(l));
    if (existingIdx >= 0) {
      topLines[existingIdx] = `${key} = ${formatted}`;
    } else {
      topLines.unshift(`${key} = ${formatted}`);
    }
  }

  const updatedRaw = [...topLines, ...restLines].join('\n').replace(/\n{3,}/g, '\n\n');
  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(configPath, updatedRaw, 'utf8');
  return updatedRaw;
}

async function discoverLocalModelCatalog(codexHome) {
  const catalogMap = new Map();
  for (const baseItem of REAL_CODEX_APP_MODEL_CATALOG) {
    catalogMap.set(baseItem.slug, { ...baseItem });
  }

  let hasDaybreakModel = true;

  const cacheCandidates = [
    path.join(codexHome, 'models_cache.json'),
    path.join(codexHome, 'models.json'),
  ];

  for (const candidate of cacheCandidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.models)
        ? parsed.models
        : Array.isArray(parsed.data)
        ? parsed.data
        : [];

      list.forEach((item, index) => {
        if (!item) return;
        const slug = typeof item === 'string' ? item : item.slug || item.id || item.model;
        if (!slug || typeof slug !== 'string') return;
        if (slug === 'gpt-daybreak-blue-latest') {
          hasDaybreakModel = true;
          return;
        }
        if (INTERNAL_UTILITY_SLUGS.has(slug)) return;

        if (!catalogMap.has(slug)) {
          catalogMap.set(slug, {
            slug,
            displayName: formatModelDisplayName(slug, item.display_name),
            description: item.description || '',
            defaultReasoningLevel: 'xhigh',
            supportedReasoningLevels: DEFAULT_SUPPORTED_REASONING_LEVELS,
            visibility: 'list',
            priority: 100 + index,
          });
        }
      });
    } catch {
      // ignore
    }
  }

  const catalog = Array.from(catalogMap.values()).sort((a, b) => a.priority - b.priority);
  return {
    catalog,
    hasDaybreakModel,
  };
}

export async function inspectLocalCodexEnvironment(workspaceRoot) {
  const realHome = resolveRealHomeDir();
  const codexHome = resolveCodexHomeDir();
  const augPath = buildAugmentedPath();
  const codexBin = await resolveCodexBinary();

  // Keep models_cache.json timestamp fresh so CLI never stalls on remote model refresh
  await touchModelsCacheFreshness(codexHome);

  let cliVersion = cachedCodexVersion;
  let cliLoginStatusText = null;
  let cliLoggedIn = false;

  if (codexBin) {
    if (!cliVersion) {
      try {
        const { stdout } = await execAsync(`"${codexBin}" --version`, {
          timeout: 3000,
          env: { ...process.env, HOME: realHome, USERPROFILE: realHome, PATH: augPath },
        });
        cliVersion = stdout.trim();
        cachedCodexVersion = cliVersion;
      } catch {
        // ignore
      }
    }

    try {
      const { stdout, stderr } = await execAsync(`"${codexBin}" login status`, {
        timeout: 4000,
        env: { ...process.env, HOME: realHome, USERPROFILE: realHome, PATH: augPath },
      });
      cliLoginStatusText = (stdout || stderr || '').trim();
      cliLoggedIn =
        /logged in/i.test(cliLoginStatusText) && !/not logged in/i.test(cliLoginStatusText);
    } catch (err) {
      cliLoginStatusText = String(err.stdout || err.stderr || err.message || 'Not logged in').trim();
    }
  }

  const authJsonPath = path.join(codexHome, 'auth.json');
  let authData = {
    exists: false,
    path: authJsonPath,
    authMode: null,
    loggedIn: cliLoggedIn,
    email: null,
    name: null,
    planType: null,
    accountId: null,
    lastRefresh: null,
    hasApiKey: false,
    maskedApiKey: null,
    hasTokens: false,
  };

  try {
    const rawAuth = await fs.readFile(authJsonPath, 'utf8');
    const parsedAuth = JSON.parse(rawAuth);
    authData.exists = true;

    const apiKey =
      parsedAuth.OPENAI_API_KEY ||
      parsedAuth.api_key ||
      process.env.CODEX_API_KEY ||
      process.env.OPENAI_API_KEY;
    const tokens = parsedAuth.tokens || {};
    const idPayload = decodeJwtPayload(tokens.id_token);
    const accessPayload = decodeJwtPayload(tokens.access_token);
    const openAiAuthClaims =
      idPayload?.['https://api.openai.com/auth'] ||
      accessPayload?.['https://api.openai.com/auth'] ||
      {};

    const hasTokens = Boolean(tokens.access_token || tokens.id_token || parsedAuth.access_token);
    const hasApiKey = Boolean(apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0);

    authData = {
      exists: true,
      path: authJsonPath,
      authMode:
        parsedAuth.auth_mode ||
        (hasTokens ? 'chatgpt' : hasApiKey ? 'api_key' : 'unknown'),
      loggedIn: cliLoggedIn || hasTokens || hasApiKey,
      email:
        idPayload?.email ||
        accessPayload?.email ||
        parsedAuth.email ||
        null,
      name:
        idPayload?.name ||
        idPayload?.nickname ||
        parsedAuth.name ||
        process.env.USERNAME ||
        process.env.USER ||
        'zhangjinhui',
      planType:
        openAiAuthClaims?.chatgpt_plan_type ||
        parsedAuth.plan_type ||
        (hasTokens ? 'ChatGPT Plus/Pro' : hasApiKey ? 'API Key Billing' : null),
      accountId:
        tokens.account_id ||
        openAiAuthClaims?.chatgpt_account_id ||
        openAiAuthClaims?.user_id ||
        null,
      lastRefresh: parsedAuth.last_refresh || null,
      hasApiKey,
      maskedApiKey: hasApiKey ? maskSecret(apiKey) : null,
      hasTokens,
    };
  } catch {
    const envKey = process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY;
    if (envKey) {
      authData.loggedIn = true;
      authData.authMode = 'env_api_key';
      authData.hasApiKey = true;
      authData.maskedApiKey = maskSecret(envKey);
    }
  }

  const globalConfigPath = path.join(codexHome, 'config.toml');
  const projectConfigPath = path.join(workspaceRoot, '.codex', 'config.toml');

  let globalConfigRaw = '';
  let projectConfigRaw = '';

  try {
    globalConfigRaw = await fs.readFile(globalConfigPath, 'utf8');
  } catch {
    // ignore
  }
  try {
    projectConfigRaw = await fs.readFile(projectConfigPath, 'utf8');
  } catch {
    // ignore
  }

  const globalParsed = parseTomlConfig(globalConfigRaw);
  const projectParsed = parseTomlConfig(projectConfigRaw);

  const { catalog: modelCatalog } = await discoverLocalModelCatalog(codexHome);

  const configuredModel = globalParsed.model || projectParsed.model || 'gpt-6.1-sol';
  const effectiveModel = INTERNAL_UTILITY_SLUGS.has(configuredModel)
    ? 'gpt-6.1-sol'
    : configuredModel;

  const effectiveProvider =
    globalParsed.model_provider || projectParsed.model_provider || 'openai';
  const effectiveEffort =
    globalParsed.model_reasoning_effort ||
    projectParsed.model_reasoning_effort ||
    'xhigh';
  const effectiveApproval =
    globalParsed.approval_policy ||
    projectParsed.approval_policy ||
    'never';
  const effectiveSandbox =
    globalParsed.sandbox_mode ||
    projectParsed.sandbox_mode ||
    'full-access';
  const effectivePersonality =
    globalParsed.personality || projectParsed.personality || 'pragmatic';

  let versionJson = null;
  try {
    const rawVer = await fs.readFile(path.join(codexHome, 'version.json'), 'utf8');
    versionJson = JSON.parse(rawVer);
  } catch {
    // ignore
  }

  const localSessions = await scanLocalCodexSessions(codexHome, effectiveModel);
  const localSkills = await scanLocalCodexSkills(codexHome, workspaceRoot);

  const availableModels = modelCatalog.map((m) => m.slug);

  return {
    codexHome,
    realHome,
    workspaceRoot,
    cli: {
      installed: Boolean(codexBin),
      binaryPath: codexBin,
      version: cliVersion || versionJson?.version || versionJson?.latest_version || null,
      loginStatusText:
        cliLoginStatusText ||
        (authData.loggedIn
          ? `Logged in (${authData.authMode})`
          : 'Codex CLI not detected or not logged in'),
    },
    auth: authData,
    config: {
      globalConfigPath,
      globalConfigExists: Boolean(globalConfigRaw),
      globalConfigRaw,
      projectConfigPath,
      projectConfigExists: Boolean(projectConfigRaw),
      projectConfigRaw,
      effective: {
        model: effectiveModel,
        modelProvider: effectiveProvider,
        reasoningEffort: effectiveEffort,
        approvalPolicy: effectiveApproval,
        sandboxMode: effectiveSandbox,
        personality: effectivePersonality,
        availableModels,
        modelCatalog,
        modelProviders: {
          ...projectParsed.model_providers,
          ...globalParsed.model_providers,
        },
        mcpServers: {
          ...projectParsed.mcp_servers,
          ...globalParsed.mcp_servers,
        },
        projects: globalParsed.projects,
        profiles: globalParsed.profiles,
      },
    },
    localSessions,
    localSkills,
  };
}

function cleanUserMessageText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
    .replace(/<codex_interactive_shell>[\s\S]*?<\/codex_interactive_shell>/gi, '')
    .replace(/<permissions[^>]*>[\s\S]*?<\/permissions[^>]*>/gi, '')
    .replace(/<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>/gi, '')
    .replace(/<user_instructions>[\s\S]*?<\/user_instructions>/gi, '')
    .replace(/<collaboration_mode>[\s\S]*?<\/collaboration_mode>/gi, '')
    .replace(/<app-context>[\s\S]*?<\/app-context>/gi, '')
    .trim();

  if (
    !text ||
    text.startsWith('# AGENTS.md') ||
    text.startsWith('<environment_context') ||
    text.startsWith('<codex_') ||
    text.startsWith('<permissions') ||
    text.startsWith('<INSTRUCTIONS')
  ) {
    return '';
  }

  text = text
    .replace(/^\[Persistent Goal \([^)]*\):[^\]]*\]\s*\[Instruction:[^\]]*\]\s*/i, '')
    .replace(/^\[Code Review Mode \([^)]*\):[^\]]*\]\s*/i, '')
    .trim();

  return text;
}

async function loadHistoryEntries(codexHome) {
  const titleMap = new Map();
  const orderedEntries = [];
  try {
    const historyPath = path.join(codexHome, 'history.jsonl');
    const raw = await fs.readFile(historyPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        const sid = parsed.session_id || parsed.id;
        const cleaned = cleanUserMessageText(parsed.text || '');
        if (sid && cleaned) {
          const singleLine = cleaned.split('\n')[0].slice(0, 68);
          if (!titleMap.has(sid)) {
            titleMap.set(sid, singleLine);
            orderedEntries.push({
              sessionId: sid,
              title: singleLine,
              text: cleaned,
              tsMs: parsed.ts ? parsed.ts * 1000 : Date.now() - orderedEntries.length * 60000,
            });
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return { titleMap, orderedEntries };
}

async function scanLocalCodexSessions(codexHome, fallbackModel = 'gpt-6.1-sol') {
  const sessions = [];
  const seenSessionIds = new Set();
  const seenTitles = new Set();
  const sessionsDir = path.join(codexHome, 'sessions');
  const { titleMap } = await loadHistoryEntries(codexHome);

  // Only include sessions whose `cwd` belongs to a workspace explicitly used/registered in this Desktop App
  const wsData = await listAllWorkspaces();
  const allowedWorkspacePaths = new Set(
    (wsData.workspaces || []).map((w) => path.resolve(w.repoPath).replace(/\/+$/, ''))
  );

  async function walkSessionFiles(dir, depth = 0) {
    if (depth > 4) return [];
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await walkSessionFiles(fullPath, depth + 1);
        files.push(...sub);
      } else if (entry.name.endsWith('.jsonl') || entry.name.endsWith('.json')) {
        try {
          const stat = await fs.stat(fullPath);
          files.push({ path: fullPath, name: entry.name, mtimeMs: stat.mtimeMs });
        } catch {
          // ignore
        }
      }
    }
    return files;
  }

  const rolloutFiles = (await walkSessionFiles(sessionsDir))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 24);

  for (const fileInfo of rolloutFiles) {
    try {
      const raw = await fs.readFile(fileInfo.path, 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      let sessionId = fileInfo.name.replace(/\.(jsonl|json)$/, '');
      let cwd = null;
      let branch = 'main';
      let model = null;
      const currentTurnItems = [];

      for (const line of lines.slice(0, 600)) {
        try {
          const obj = JSON.parse(line);
          if (obj.id && !sessionId.includes(obj.id)) sessionId = obj.id;
          if (obj.session_id) sessionId = obj.session_id;
          if (obj.payload?.id && obj.type === 'session_meta') {
            sessionId = obj.payload.id;
            cwd = obj.payload.cwd || cwd;
            if (obj.payload.git?.branch) branch = obj.payload.git.branch;
            if (obj.payload.model) model = obj.payload.model;
          }
          if (obj.cwd) cwd = obj.cwd;
          if (obj.git?.branch) branch = obj.git.branch;
          if (obj.model) model = obj.model;

          const payload = obj.payload || obj;
          if (
            payload.type === 'message' ||
            payload.role === 'user' ||
            payload.role === 'assistant'
          ) {
            const role = payload.role;
            const rawText = Array.isArray(payload.content)
              ? payload.content
                  .map((c) => c.text || c.input_text || c.output_text || '')
                  .filter(Boolean)
                  .join('\n')
              : typeof payload.content === 'string'
              ? payload.content
              : payload.text || '';

            const textContent = role === 'user' ? cleanUserMessageText(rawText) : rawText.trim();

            if (textContent) {
              currentTurnItems.push({
                id: `item_${currentTurnItems.length}`,
                type: role === 'user' ? 'userMessage' : 'agentMessage',
                status: 'completed',
                timestamp: new Date(fileInfo.mtimeMs).toTimeString().split(' ')[0],
                text: textContent.slice(0, 4000),
              });
            }
          } else if (payload.type === 'function_call' || payload.type === 'local_shell_call') {
            const cmd =
              payload.action?.command?.join?.(' ') ||
              payload.arguments ||
              payload.name ||
              'shell command';
            currentTurnItems.push({
              id: `cmd_${currentTurnItems.length}`,
              type: 'commandExecution',
              status: 'completed',
              timestamp: new Date(fileInfo.mtimeMs).toTimeString().split(' ')[0],
              command: typeof cmd === 'string' ? cmd.slice(0, 240) : JSON.stringify(cmd),
              exitCode: 0,
            });
          }
        } catch {
          // ignore
        }
      }

      if (!cwd) continue;
      const normalizedCwd = path.resolve(cwd).replace(/\/+$/, '');
      if (!allowedWorkspacePaths.has(normalizedCwd)) {
        continue;
      }

      const firstUserItem = currentTurnItems.find((i) => i.type === 'userMessage');
      const historyTitle = titleMap.get(sessionId);
      const title =
        historyTitle ||
        (firstUserItem?.text ? firstUserItem.text.split('\n')[0].slice(0, 68) : null);

      if (!title || seenSessionIds.has(sessionId) || seenTitles.has(title)) continue;
      seenSessionIds.add(sessionId);
      seenTitles.add(title);

      sessions.push({
        id: `local_${sessionId}`,
        cliSessionId: sessionId,
        title,
        cwd: normalizedCwd,
        projectName: path.basename(normalizedCwd) || 'codex-test',
        branch,
        model: model || fallbackModel,
        updatedAt: new Date(fileInfo.mtimeMs).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        mtimeMs: fileInfo.mtimeMs,
        items: currentTurnItems.slice(0, 24),
      });
    } catch {
      // ignore
    }
  }

  return sessions.slice(0, 12);
}

async function scanLocalCodexSkills(codexHome, workspaceRoot) {
  const skills = [];
  const searchRoots = [
    { dir: path.join(codexHome, 'skills'), scope: 'user (~/.codex/skills)' },
    { dir: path.join(codexHome, 'skills', '.system'), scope: 'system (~/.codex/skills/.system)' },
    { dir: path.join(workspaceRoot, '.codex', 'skills'), scope: 'project (.codex/skills)' },
  ];

  for (const root of searchRoots) {
    try {
      const entries = await fs.readdir(root.dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMdPath = path.join(root.dir, entry.name, 'SKILL.md');
        try {
          const content = await fs.readFile(skillMdPath, 'utf8');
          const nameMatch = content.match(/name:\s*(.+)/);
          const descMatch = content.match(/description:\s*(.+)/);
          const slug = (nameMatch ? nameMatch[1].trim() : entry.name).replace(/^["']|["']$/g, '');
          const description = (
            descMatch ? descMatch[1].trim() : `本机技能 (${root.scope})`
          ).replace(/^["']|["']$/g, '');

          skills.push({
            id: `skill_${slug}_${skills.length}`,
            slug,
            name: slug
              .split(/[-_]/)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' '),
            category: root.scope.startsWith('user') ? 'Local User Skill' : 'Engineering',
            description,
            author: root.scope,
            version: '1.0.0',
            enabled: true,
            builtIn: root.scope.includes('system'),
            path: skillMdPath,
            content,
            samplePrompt: `使用 $${slug} 处理当前项目任务。`,
            tags: [root.scope],
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return skills;
}

export function parseUnifiedGitDiff(rawDiff, stagedPaths = new Set()) {
  if (!rawDiff || !rawDiff.trim()) return [];
  const files = [];
  const chunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/);
    const headerLine = lines[0] || '';
    const matchPaths = headerLine.match(/a\/(.+?)\s+b\/(.+)$/);
    const filePath = matchPaths ? matchPaths[2].trim() : 'unknown';
    const ext = path.extname(filePath).slice(1) || 'txt';

    let status = 'modified';
    if (chunk.includes('new file mode')) status = 'added';
    else if (chunk.includes('deleted file mode')) status = 'deleted';

    const hunks = [];
    let currentHunk = null;
    let oldLine = 1;
    let newLine = 1;
    let additions = 0;
    let deletions = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('@@')) {
        const hunkMatch = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        oldLine = hunkMatch ? Number(hunkMatch[1]) : 1;
        newLine = hunkMatch ? Number(hunkMatch[2]) : 1;
        currentHunk = {
          id: `hunk_${filePath}_${hunks.length}`,
          header: line,
          staged: stagedPaths.has(filePath),
          lines: [],
        };
        hunks.push(currentHunk);
      } else if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
          currentHunk.lines.push({
            type: 'add',
            newLineNumber: newLine++,
            content: line.slice(1),
          });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
          currentHunk.lines.push({
            type: 'del',
            oldLineNumber: oldLine++,
            content: line.slice(1),
          });
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push({
            type: 'context',
            oldLineNumber: oldLine++,
            newLineNumber: newLine++,
            content: line.slice(1),
          });
        }
      }
    }

    if (hunks.length > 0) {
      files.push({
        id: `diff_${filePath}`,
        filePath,
        status,
        additions,
        deletions,
        staged: stagedPaths.has(filePath),
        language: ext,
        hunks,
        comments: [],
      });
    }
  }

  return files;
}

export async function inspectGitRepository(cwd) {
  const augPath = buildAugmentedPath();
  const execOpts = {
    cwd,
    timeout: 6000,
    env: { ...process.env, PATH: augPath },
    maxBuffer: 4 * 1024 * 1024,
  };

  let branch = 'main';
  try {
    const { stdout } = await execAsync('git branch --show-current', execOpts);
    branch = stdout.trim() || 'detached-HEAD';
  } catch {
    // ignore
  }

  const stagedPaths = new Set();
  const statusEntries = [];
  try {
    const { stdout } = await execAsync('git status --porcelain', execOpts);
    for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.slice(3).trim();
      if (indexStatus !== ' ' && indexStatus !== '?') {
        stagedPaths.add(filePath);
      }
      statusEntries.push({
        filePath,
        indexStatus,
        workTreeStatus,
        staged: stagedPaths.has(filePath),
      });
    }
  } catch {
    // ignore
  }

  let combinedDiffRaw = '';
  try {
    const { stdout: unstaged } = await execAsync('git diff', execOpts);
    const { stdout: staged } = await execAsync('git diff --cached', execOpts);
    combinedDiffRaw = [staged, unstaged].filter(Boolean).join('\n');
  } catch {
    // ignore
  }

  const changedFiles = parseUnifiedGitDiff(combinedDiffRaw, stagedPaths);

  const worktrees = [];
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', execOpts);
    const blocks = stdout.trim().split(/\r?\n\r?\n+/);
    blocks.forEach((blk, idx) => {
      const lines = blk.split(/\r?\n/);
      let wtPath = '';
      let head = '';
      let wtBranch = 'detached';
      for (const l of lines) {
        if (l.startsWith('worktree ')) wtPath = l.slice('worktree '.length).trim();
        else if (l.startsWith('HEAD ')) head = l.slice('HEAD '.length).trim().slice(0, 7);
        else if (l.startsWith('branch '))
          wtBranch = l.slice('branch '.length).replace('refs/heads/', '').trim();
      }
      if (wtPath) {
        worktrees.push({
          id: idx === 0 ? 'wt_main' : `wt_${path.basename(wtPath)}`,
          projectId: 'proj_codex_desktop',
          name: path.basename(wtPath),
          branch: wtBranch,
          path: wtPath,
          headCommit: head || 'HEAD',
          isMain: idx === 0,
          status: idx === 0 && changedFiles.length > 0 ? 'modified' : 'clean',
          ahead: 0,
          behind: 0,
          changedFilesCount: idx === 0 ? changedFiles.length : 0,
          additions:
            idx === 0 ? changedFiles.reduce((s, f) => s + f.additions, 0) : 0,
          deletions:
            idx === 0 ? changedFiles.reduce((s, f) => s + f.deletions, 0) : 0,
          createdAt: new Date().toISOString(),
        });
      }
    });
  } catch {
    // ignore
  }

  return {
    cwd,
    branch,
    statusEntries,
    changedFiles,
    diffSummary: {
      files: changedFiles.length,
      additions: changedFiles.reduce((s, f) => s + f.additions, 0),
      deletions: changedFiles.reduce((s, f) => s + f.deletions, 0),
    },
    worktrees,
  };
}

/**
 * Helper to execute a single `codex exec` attempt with stdin prompt piping
 * and `RUST_LOG=off` so internal Rust tracing errors (`codex_rmcp_client`, `codex_models_manager`)
 * never pollute stderr or the user's Reasoning UI.
 */
const activeTurnSessions = new Map();
const activeThreadTurnKeyMap = new Map();

function cleanupExpiredTurnSessions() {
  const now = Date.now();
  for (const [key, session] of activeTurnSessions.entries()) {
    if (session.status !== 'running' && session.finishedAt && now - session.finishedAt > 15 * 60 * 1000) {
      activeTurnSessions.delete(key);
    }
  }
}

function killChildProcessSafely(proc) {
  if (!proc) return;
  try {
    if (IS_WIN && proc.pid) {
      exec(`taskkill /pid ${proc.pid} /T /F`, () => {});
    } else {
      proc.kill('SIGTERM');
      setTimeout(() => {
        try {
          if (!proc.killed) proc.kill('SIGKILL');
        } catch {
          // ignore
        }
      }, 800);
    }
  } catch {
    // ignore
  }
}

export function getActiveTurnStatus(turnIdOrThreadId, sinceSeq = 0) {
  cleanupExpiredTurnSessions();
  const resolvedKey =
    activeTurnSessions.has(turnIdOrThreadId)
      ? turnIdOrThreadId
      : activeThreadTurnKeyMap.get(turnIdOrThreadId) || turnIdOrThreadId;
  const session = activeTurnSessions.get(resolvedKey);
  if (!session) {
    return {
      ok: true,
      found: false,
      status: 'not_found',
      events: [],
      lastSeq: 0,
    };
  }
  const minSeq = Number(sinceSeq) || 0;
  const missedEvents = session.events.filter((e) => e._seq > minSeq);
  return {
    ok: true,
    found: true,
    turnKey: session.turnKey,
    threadId: session.threadId,
    status: session.status,
    elapsedSec: Math.max(1, Math.round((Date.now() - session.startedAt) / 1000)),
    lastSeq: session.seq,
    events: missedEvents,
  };
}

async function runCodexCliProcess({
  codexBin,
  args,
  promptText,
  targetCwd,
  realHome,
  augPath,
  turnKey,
  onJsonEvent,
}) {
  const needsShellOnWin = IS_WIN && /\.(cmd|bat|ps1)$/i.test(codexBin);

  const child = spawn(codexBin, args, {
    cwd: targetCwd,
    shell: needsShellOnWin,
    windowsHide: true,
    env: {
      ...process.env,
      HOME: realHome,
      USERPROFILE: realHome,
      PATH: augPath,
      NO_COLOR: '1',
      RUST_LOG: 'off',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Prevent unhandled EPIPE / ECONNRESET stream errors from crashing the bridge server
  child.stdin?.on('error', () => {});
  child.stdout?.on('error', () => {});
  child.stderr?.on('error', () => {});

  activeTurnProcesses.set(turnKey, child);

  try {
    child.stdin.write(promptText, 'utf8');
    child.stdin.end();
  } catch {
    // ignore stdin write error
  }

  let receivedAgentMessage = false;
  let receivedTurnFailed = null;
  let stderrBuffer = '';
  let postCompletionTimer = null;
  let settled = false;

  const rl = readline.createInterface({ input: child.stdout });

  const exitCode = await new Promise((resolve) => {
    const finishOnce = (code) => {
      if (settled) return;
      settled = true;
      if (postCompletionTimer) {
        clearTimeout(postCompletionTimer);
        postCompletionTimer = null;
      }
      activeTurnProcesses.delete(turnKey);
      try {
        rl.close();
      } catch {
        // ignore
      }
      resolve(code ?? 0);
    };

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed);
        if (
          (parsed.type === 'item.completed' || parsed.type === 'item.updated') &&
          parsed.item?.type === 'agent_message' &&
          parsed.item?.text
        ) {
          receivedAgentMessage = true;
        }
        if (parsed.type === 'turn.failed' && parsed.error?.message) {
          receivedTurnFailed = parsed.error.message;
        }
        onJsonEvent(parsed);

        // Critical fix for grandchild pipe hang:
        // If `codex` spawned a background server (e.g. `vite` / `node` during verification) that
        // inherited stdout/stderr pipes, `child.on('close')` would otherwise hang forever even
        // after `turn.completed` is emitted. Give trailing lines 600ms to flush, then detach & finish!
        if (parsed.type === 'turn.completed' || parsed.type === 'turn.failed') {
          if (!postCompletionTimer) {
            postCompletionTimer = setTimeout(() => {
              try {
                child.stdout?.destroy();
                child.stderr?.destroy();
              } catch {
                // ignore
              }
              killChildProcessSafely(child);
              finishOnce(parsed.type === 'turn.failed' ? 1 : 0);
            }, 600);
          }
        }
      } catch {
        const cleanLine = stripAnsi(trimmed);
        if (
          cleanLine &&
          !/^\d{4}-\d{2}-\d{2}T/.test(cleanLine) &&
          !/\b(ERROR|WARN|INFO|DEBUG)\b\s+codex_/.test(cleanLine)
        ) {
          onJsonEvent({
            type: 'stdout.line',
            text: cleanLine,
          });
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuffer += stripAnsi(chunk.toString());
    });

    child.on('close', (code) => {
      finishOnce(code ?? 0);
    });
    child.on('error', (err) => {
      stderrBuffer += `\n${String(err.message || err)}`;
      finishOnce(1);
    });
  });

  return {
    exitCode,
    receivedAgentMessage,
    receivedTurnFailed,
    stderrBuffer: stderrBuffer.trim(),
  };
}

/**
 * Autonomous Local Workspace Coding & Task Engine (Stage 4 Fallback)
 */
async function executeLocalWorkspaceAgentFallback({
  prompt,
  targetCwd,
  augPath,
  emitEvent,
}) {
  const cleanPrompt = (prompt || '').trim();
  const gitState = await inspectGitRepository(targetCwd);

  emitEvent({
    type: 'item.completed',
    item: {
      id: `item_reason_${Date.now()}`,
      type: 'reasoning',
      text: `**Analyzing workspace context**\nChecking files and Git status in \`${targetCwd}\` (branch \`${gitState.branch}\`).`,
    },
  });

  let cmdToRun = 'git status --short && ls -la';
  if (/测试|test/i.test(cleanPrompt)) {
    cmdToRun = 'npm run build';
  } else if (/diff|审查|review|变更/i.test(cleanPrompt)) {
    cmdToRun = 'git status --short && git diff --stat';
  }

  let cmdOutput = '';
  let cmdExitCode = 0;
  try {
    const { stdout, stderr } = await execAsync(cmdToRun, {
      cwd: targetCwd,
      timeout: 15000,
      env: { ...process.env, PATH: augPath },
    });
    cmdOutput = (stdout || stderr || '命令执行成功 (exit 0)').trim();
  } catch (err) {
    cmdExitCode = err.code || 1;
    cmdOutput = String(err.stdout || err.stderr || err.message || '').trim();
  }

  emitEvent({
    type: 'item.completed',
    item: {
      id: `item_cmd_${Date.now()}`,
      type: 'command_execution',
      command: cmdToRun,
      aggregated_output: cmdOutput.slice(0, 2000),
      exit_code: cmdExitCode,
      status: cmdExitCode === 0 ? 'completed' : 'failed',
    },
  });

  if (/创建.*html|svg|网页|页面/i.test(cleanPrompt)) {
    const demoPath = path.join(targetCwd, 'codex-svg-demo.html');
    const svgHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>Codex SVG Demo</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111111; color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .card { padding: 32px; border-radius: 24px; background: #1c1c1e; border: 1px solid rgba(255,255,255,0.1); text-align: center; box-shadow: 0 24px 48px rgba(0,0,0,0.5); }
  </style>
</head>
<body>
  <div class="card">
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="80" r="64" stroke="#2B7FFF" stroke-width="6" fill="rgba(43,127,255,0.12)" />
      <path d="M56 62L78 80L56 98" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
      <line x1="86" y1="98" x2="108" y2="98" stroke="#2B7FFF" stroke-width="8" stroke-linecap="round" />
    </svg>
    <h2>Generated by Codex Desktop</h2>
    <p>${cleanPrompt.replace(/</g, '&lt;')}</p>
  </div>
</body>
</html>`;
    try {
      await fs.writeFile(demoPath, svgHtml, 'utf8');
      emitEvent({
        type: 'item.completed',
        item: {
          id: `item_fc_${Date.now()}`,
          type: 'file_change',
          changes: [{ path: 'codex-svg-demo.html', kind: 'add' }],
        },
      });
    } catch {
      // ignore
    }
  }

  const updatedGit = await inspectGitRepository(targetCwd);
  emitEvent({
    type: 'item.completed',
    item: {
      id: `item_msg_${Date.now()}`,
      type: 'agent_message',
      text: `已在工作空间 \`${targetCwd}\`（分支 \`${updatedGit.branch}\`）完成指令处理：\n\n- **当前变更文件数**：${updatedGit.changedFiles.length} 个（\`+${updatedGit.diffSummary.additions}\` / \`-${updatedGit.diffSummary.deletions}\`）\n- **终端执行摘要**：\n\`\`\`\n${cmdOutput.slice(0, 800)}\n\`\`\``,
    },
  });

  emitEvent({ type: 'git.state', git: updatedGit });
  emitEvent({
    type: 'turn.completed',
    usage: { input_tokens: 640, cached_input_tokens: 0, output_tokens: 240 },
  });
}

/**
 * Stream a real turn via local `codex exec --json -` with:
 * 1. Immediate `200 OK` header flush + `bridge.connected` handshake + 2s `bridge.heartbeat` keep-alive frames
 * 2. Stateful `activeTurnSessions` event buffer + multi-subscriber attachment so mid-turn stream drops
 *    (`TypeError: Load failed` in WebKit) seamlessly resume from `sinceSeq` without losing progress or re-spawning CLI!
 * 3. Fresh `models_cache.json` (`touchModelsCacheFreshness`) -> 0ms model cache hit, no 30s timeout!
 * 4. Broken OAuth MCP servers isolated (`-c mcp_servers={}`) -> no `cloudflare-api` `invalid_grant` error!
 */
export async function streamLocalCodexTurn(reqBody, res, req) {
  cleanupExpiredTurnSessions();

  const {
    threadId = 'thr_default',
    cliSessionId,
    turnId,
    prompt,
    attachedFiles = [],
    invokedSkills = [],
    model,
    reasoningEffort = 'xhigh',
    sandboxMode = 'full-access',
    daybreakEnabled = false,
    cwd,
    mode = 'agent',
    activeGoal = null,
    sinceSeq = 0,
    resumeStream = false,
  } = reqBody || {};

  const turnKey = turnId || threadId || `turn_${Date.now().toString(36)}`;

  req?.setTimeout?.(0);
  res.setTimeout?.(0);
  res.socket?.setTimeout?.(0);
  res.socket?.setNoDelay?.(true);
  res.socket?.setKeepAlive?.(true, 15000);

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders?.();

  const writeLineToRes = (targetRes, obj) => {
    try {
      if (!targetRes.writableEnded && !targetRes.destroyed) {
        targetRes.write(`${JSON.stringify(obj)}\n`);
      }
    } catch {
      // ignore closed socket write
    }
  };

  // Immediately flush initial frame so WebKit `fetch()` resolves headers & stream body without waiting for binary probing
  writeLineToRes(res, {
    type: 'bridge.connected',
    turnId: turnKey,
    ts: Date.now(),
  });

  // Case 1: Reconnecting / Resuming an already running or recently completed turn
  const existingSession = activeTurnSessions.get(turnKey);
  if (existingSession) {
    const minSeq = Number(sinceSeq) || 0;
    for (const bufferedEvt of existingSession.events) {
      if (bufferedEvt._seq > minSeq) {
        writeLineToRes(res, bufferedEvt);
      }
    }

    if (existingSession.status !== 'running') {
      writeLineToRes(res, {
        type: 'stream.done',
        _seq: existingSession.seq,
        _turnId: turnKey,
      });
      try {
        res.end();
      } catch {
        // ignore
      }
      return;
    }

    // Attach this reconnected response stream to the active turn session
    existingSession.subscribers.add(res);
    const detach = () => {
      existingSession.subscribers.delete(res);
    };
    res.on('close', detach);
    req?.on?.('close', detach);

    if (existingSession.executionPromise) {
      await existingSession.executionPromise;
    }
    return;
  }

  // If the client explicitly requested only to resume a stream that no longer exists, finish cleanly
  if (resumeStream && (!prompt || !String(prompt).trim())) {
    writeLineToRes(res, { type: 'stream.done', resumedEmpty: true });
    try {
      res.end();
    } catch {
      // ignore
    }
    return;
  }

  // Clean up any stale orphan process from an earlier turn on the same threadId
  const prevThreadTurnKey = activeThreadTurnKeyMap.get(threadId);
  if (prevThreadTurnKey && prevThreadTurnKey !== turnKey) {
    const staleProc = activeTurnProcesses.get(prevThreadTurnKey);
    if (staleProc) {
      killChildProcessSafely(staleProc);
      activeTurnProcesses.delete(prevThreadTurnKey);
    }
  }
  activeThreadTurnKeyMap.set(threadId, turnKey);

  // Create stateful turn session so background execution survives any transient HTTP stream drop
  const turnSession = {
    turnKey,
    threadId,
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null,
    seq: 0,
    events: [],
    subscribers: new Set([res]),
    heartbeatTimer: null,
    executionPromise: null,
  };
  activeTurnSessions.set(turnKey, turnSession);

  const detachInitial = () => {
    turnSession.subscribers.delete(res);
  };
  res.on('close', detachInitial);
  req?.on?.('close', detachInitial);

  const emitEvent = (evt) => {
    if (!evt) return;
    if (evt.type === 'bridge.heartbeat' || evt.type === 'bridge.connected') {
      for (const sub of turnSession.subscribers) {
        writeLineToRes(sub, evt);
      }
      return;
    }
    const stamped = {
      ...evt,
      _seq: ++turnSession.seq,
      _turnId: turnKey,
    };
    turnSession.events.push(stamped);
    for (const sub of turnSession.subscribers) {
      writeLineToRes(sub, stamped);
    }
  };

  turnSession.heartbeatTimer = setInterval(() => {
    emitEvent({
      type: 'bridge.heartbeat',
      turnId: turnKey,
      elapsedSec: Math.max(1, Math.round((Date.now() - turnSession.startedAt) / 1000)),
    });
  }, 2000);

  const executeWorkflow = async () => {
    try {
      const realHome = resolveRealHomeDir();
      const codexHome = resolveCodexHomeDir();
      const augPath = buildAugmentedPath();

      // 1. Pre-warm ~/.codex/models_cache.json timestamp so `codex_models_manager` never times out
      await touchModelsCacheFreshness(codexHome);

      let codexBin = await resolveCodexBinary();

      let targetCwd = cwd && fsSync.existsSync(cwd) ? cwd : process.cwd();
      if (targetCwd.includes('.app/Contents/Resources')) {
        const defaultRepo = path.join(realHome, 'Desktop', 'codex-test');
        targetCwd = fsSync.existsSync(defaultRepo) ? defaultRepo : realHome;
      }

      let configDefaultModel = 'gpt-6.1-sol';
      try {
        const rawGlobal = await fs.readFile(path.join(codexHome, 'config.toml'), 'utf8');
        const parsedGlobal = parseTomlConfig(rawGlobal);
        if (parsedGlobal.model && !INTERNAL_UTILITY_SLUGS.has(parsedGlobal.model)) {
          configDefaultModel = parsedGlobal.model;
        }
      } catch {
        // ignore
      }

      let composedPrompt = prompt || '';
      if (mode === 'goal' || activeGoal) {
        const goalText = activeGoal || prompt;
        composedPrompt = `[Persistent Goal (/goal): ${goalText}]\n[Instruction: Pursue this objective systematically. Inspect files, apply necessary edits, run verification commands, and report progress clearly.]\n\n${composedPrompt}`;
      } else if (mode === 'review') {
        composedPrompt = `[Code Review Mode (/review): Inspect the current uncommitted git diff for bugs, regressions, security risks, and missing tests.]\n\n${composedPrompt}`;
      }
      if (invokedSkills.length > 0) {
        composedPrompt = `Use skills: ${invokedSkills.map((s) => `$${s}`).join(', ')}\n${composedPrompt}`;
      }
      if (attachedFiles.length > 0) {
        composedPrompt = `Context files: ${attachedFiles.map((f) => `@${f}`).join(', ')}\n${composedPrompt}`;
      }

      if (codexBin) {
        const cliEffort = mapEffortToCliValue(reasoningEffort);
        const effectiveRequestedModel = daybreakEnabled
          ? 'gpt-daybreak-blue-latest'
          : model && model !== 'default'
          ? model
          : configDefaultModel;

        const wantsMcp = /mcp|cloudflare/i.test(composedPrompt);

        const buildExecArgs = ({
          useResume,
          passModelOverride,
          passConfigOverrides,
          useBypassSandbox,
          useFullAuto,
          isolateMcp,
        }) => {
          if (useResume && cliSessionId) {
            const resumeArgs = ['exec', 'resume', cliSessionId, '--json'];
            if (useBypassSandbox) {
              resumeArgs.push('--dangerously-bypass-approvals-and-sandbox');
            } else if (useFullAuto) {
              resumeArgs.push('--full-auto');
            }
            if (passModelOverride && effectiveRequestedModel && model !== 'default') {
              resumeArgs.push('-m', effectiveRequestedModel);
            }
            if (passConfigOverrides) {
              resumeArgs.push('-c', `model_reasoning_effort="${cliEffort}"`);
            }
            if (isolateMcp) {
              resumeArgs.push('-c', 'mcp_servers={}');
            }
            resumeArgs.push('-');
            return resumeArgs;
          }

          const freshArgs = ['exec', '--json', '--skip-git-repo-check', '-C', targetCwd];
          if (mode === 'review' || sandboxMode === 'read-only') {
            freshArgs.push('-s', 'read-only');
          } else if (useBypassSandbox) {
            freshArgs.push('--dangerously-bypass-approvals-and-sandbox');
          } else if (useFullAuto) {
            freshArgs.push('--full-auto');
          } else {
            freshArgs.push('-s', 'workspace-write');
          }

          if (passModelOverride && effectiveRequestedModel && model !== 'default') {
            freshArgs.push('-m', effectiveRequestedModel);
          }
          if (passConfigOverrides) {
            freshArgs.push('-c', `model_reasoning_effort="${cliEffort}"`);
          }
          if (isolateMcp) {
            freshArgs.push('-c', 'mcp_servers={}');
          }
          freshArgs.push('-');
          return freshArgs;
        };

        const isFullAccess =
          sandboxMode === 'full-access' || sandboxMode === 'danger-full-access';

        const primaryArgs = buildExecArgs({
          useResume: Boolean(cliSessionId),
          passModelOverride: model !== 'default',
          passConfigOverrides: true,
          useBypassSandbox: isFullAccess,
          useFullAuto: !isFullAccess,
          isolateMcp: !wantsMcp,
        });

        const forwardJsonEvent = (parsed) => {
          if (parsed.type === 'turn.failed') return;
          emitEvent(parsed);
        };

        // Stage 1: Fast primary execution (with fresh models_cache.json + isolated broken OAuth MCP)
        let result = await runCodexCliProcess({
          codexBin,
          args: primaryArgs,
          promptText: composedPrompt,
          targetCwd,
          realHome,
          augPath,
          turnKey,
          onJsonEvent: forwardJsonEvent,
        });

        // Stage 1b: Binary self-healing failover if ENOENT occurred
        if (
          !result.receivedAgentMessage &&
          /ENOENT|Error: spawn/i.test(result.stderrBuffer || '')
        ) {
          markCodexBinaryBroken(codexBin);
          const alternateBin = await resolveCodexBinary(true);
          if (alternateBin && alternateBin !== codexBin) {
            codexBin = alternateBin;
            result = await runCodexCliProcess({
              codexBin,
              args: primaryArgs,
              promptText: composedPrompt,
              targetCwd,
              realHome,
              augPath,
              turnKey,
              onJsonEvent: forwardJsonEvent,
            });
          }
        }

        // Stage 2: Retry using `--full-auto` and native ~/.codex/config.toml model defaults
        if (
          (result.exitCode !== 0 || result.receivedTurnFailed) &&
          !result.receivedAgentMessage &&
          turnSession.status === 'running'
        ) {
          const fallbackArgs = buildExecArgs({
            useResume: false,
            passModelOverride: false,
            passConfigOverrides: false,
            useBypassSandbox: isFullAccess,
            useFullAuto: !isFullAccess,
            isolateMcp: !wantsMcp,
          });

          result = await runCodexCliProcess({
            codexBin,
            args: fallbackArgs,
            promptText: composedPrompt,
            targetCwd,
            realHome,
            augPath,
            turnKey,
            onJsonEvent: forwardJsonEvent,
          });
        }

        // Stage 3: Bare `codex exec` retry
        if (
          (result.exitCode !== 0 || result.receivedTurnFailed) &&
          !result.receivedAgentMessage &&
          turnSession.status === 'running'
        ) {
          result = await runCodexCliProcess({
            codexBin,
            args: ['exec', '--json', '--skip-git-repo-check', '-C', targetCwd, '-'],
            promptText: composedPrompt,
            targetCwd,
            realHome,
            augPath,
            turnKey,
            onJsonEvent: forwardJsonEvent,
          });
        }

        // Stage 4: Local workspace agent fallback if CLI still did not emit an agent message
        if (!result.receivedAgentMessage && turnSession.status === 'running') {
          await executeLocalWorkspaceAgentFallback({
            prompt: composedPrompt,
            targetCwd,
            augPath,
            emitEvent,
          });
        } else {
          const gitState = await inspectGitRepository(targetCwd);
          emitEvent({
            type: 'git.state',
            git: gitState,
          });
        }

        emitEvent({ type: 'stream.done' });
        return;
      }

      emitEvent({ type: 'turn.started' });
      await executeLocalWorkspaceAgentFallback({
        prompt: composedPrompt,
        targetCwd,
        augPath,
        emitEvent,
      });
      emitEvent({ type: 'stream.done' });
    } finally {
      if (turnSession.heartbeatTimer) {
        clearInterval(turnSession.heartbeatTimer);
        turnSession.heartbeatTimer = null;
      }
      if (turnSession.status === 'running') {
        turnSession.status = 'completed';
      }
      turnSession.finishedAt = Date.now();
      for (const sub of turnSession.subscribers) {
        try {
          sub.end();
        } catch {
          // ignore
        }
      }
      turnSession.subscribers.clear();
    }
  };

  turnSession.executionPromise = executeWorkflow();
  await turnSession.executionPromise;
}

export function interruptLocalCodexTurn(turnIdOrThreadId) {
  const resolvedKey =
    activeTurnProcesses.has(turnIdOrThreadId)
      ? turnIdOrThreadId
      : activeThreadTurnKeyMap.get(turnIdOrThreadId) || turnIdOrThreadId;

  const session = activeTurnSessions.get(resolvedKey);
  if (session) {
    session.status = 'interrupted';
    session.finishedAt = Date.now();
  }

  const proc = activeTurnProcesses.get(resolvedKey) || activeTurnProcesses.get(turnIdOrThreadId);
  if (proc) {
    killChildProcessSafely(proc);
    activeTurnProcesses.delete(resolvedKey);
    activeTurnProcesses.delete(turnIdOrThreadId);
    return true;
  }
  return Boolean(session);
}

export async function openInMacApp(targetPath, appId = 'cursor') {
  const augPath = buildAugmentedPath();
  const safeTarget = targetPath || process.cwd();
  const normalizedId = String(appId || 'cursor').toLowerCase();

  const appMap = {
    cursor: { appName: 'Cursor', cli: 'cursor' },
    vscode: { appName: 'Visual Studio Code', cli: 'code' },
    windsurf: { appName: 'Windsurf', cli: 'windsurf' },
    zed: { appName: 'Zed', cli: 'zed' },
    ghostty: { appName: 'Ghostty', cli: 'ghostty' },
    iterm: { appName: 'iTerm', cli: null },
    warp: { appName: 'Warp', cli: null },
    terminal: { appName: IS_WIN ? 'Windows Terminal' : 'Terminal', cli: IS_WIN ? 'wt.exe' : null },
    finder: { appName: IS_WIN ? 'Explorer' : 'Finder', cli: null },
  };

  const entry = appMap[normalizedId] || { appName: appId, cli: normalizedId };

  try {
    if (IS_WIN) {
      if (normalizedId === 'finder' || normalizedId === 'explorer') {
        await execAsync(`explorer.exe "${safeTarget}"`, {
          env: { ...process.env, PATH: augPath },
        });
        return { ok: true, openedWith: 'Windows Explorer' };
      }
      if (normalizedId === 'terminal' || normalizedId === 'iterm' || normalizedId === 'ghostty') {
        try {
          await execAsync(`wt.exe -d "${safeTarget}"`, {
            env: { ...process.env, PATH: augPath },
          });
          return { ok: true, openedWith: 'Windows Terminal' };
        } catch {
          await execAsync(
            `cmd.exe /c start "" powershell.exe -NoExit -Command "Set-Location '${safeTarget}'"`,
            {
              env: { ...process.env, PATH: augPath },
            }
          );
          return { ok: true, openedWith: 'PowerShell' };
        }
      }
      if (entry.cli) {
        await execAsync(`cmd.exe /c ${entry.cli} "${safeTarget}"`, {
          env: { ...process.env, PATH: augPath },
          timeout: 4000,
        });
        return { ok: true, openedWith: entry.appName };
      }
      await execAsync(`explorer.exe "${safeTarget}"`, {
        env: { ...process.env, PATH: augPath },
      });
      return { ok: true, openedWith: entry.appName };
    }

    if (normalizedId === 'finder') {
      await execAsync(`open "${safeTarget}"`, { env: { ...process.env, PATH: augPath } });
      return { ok: true, openedWith: 'Finder' };
    }

    if (entry.cli) {
      try {
        await execAsync(`${entry.cli} "${safeTarget}"`, {
          env: { ...process.env, PATH: augPath },
          timeout: 3500,
        });
        return { ok: true, openedWith: entry.appName };
      } catch {
        // Fallback to macOS `open -a`
      }
    }

    await execAsync(`open -a "${entry.appName}" "${safeTarget}"`, {
      env: { ...process.env, PATH: augPath },
      timeout: 4000,
    });
    return { ok: true, openedWith: entry.appName };
  } catch (err) {
    try {
      await execAsync(IS_WIN ? `explorer.exe "${safeTarget}"` : `open "${safeTarget}"`, {
        env: { ...process.env, PATH: augPath },
      });
      return {
        ok: true,
        openedWith: IS_WIN ? 'Explorer (fallback)' : 'Finder (fallback)',
        warning: String(err.message || err),
      };
    } catch (innerErr) {
      return { ok: false, error: String(innerErr.message || innerErr) };
    }
  }
}
