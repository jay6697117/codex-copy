const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');
const { spawn, exec } = require('child_process');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const SERVER_PORT = Number(process.env.PORT || 4500);

let mainWindow = null;
let appServerProc = null;
let codexCliProc = null;
let isQuitting = false;

function resolveAppRoot() {
  return path.resolve(__dirname, '..');
}

function startEmbeddedAppServer() {
  if (isQuitting) return;
  const appRoot = resolveAppRoot();
  const serverScript = path.join(appRoot, 'server', 'app-server.mjs');
  const distDir = path.join(appRoot, 'dist');

  appServerProc = spawn(process.execPath, [serverScript], {
    cwd: process.env.CODEX_WORKSPACE_ROOT || process.cwd(),
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      CODEX_STATIC_DIR: distDir,
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  appServerProc.stdout.on('data', (chunk) => {
    process.stdout.write(`[app-server] ${chunk}`);
  });
  appServerProc.stderr.on('data', (chunk) => {
    process.stderr.write(`[app-server] ${chunk}`);
  });
  appServerProc.on('exit', () => {
    appServerProc = null;
    if (!isQuitting) {
      setTimeout(() => startEmbeddedAppServer(), 500);
    }
  });
}

function waitForServerReady(timeoutMs = 5000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${SERVER_PORT}/readyz`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else if (Date.now() - started < timeoutMs) {
          setTimeout(check, 120);
        } else {
          resolve(false);
        }
      });
      req.on('error', () => {
        if (Date.now() - started < timeoutMs) {
          setTimeout(check, 120);
        } else {
          resolve(false);
        }
      });
      req.end();
    };
    check();
  });
}

function stopChildProcess(proc) {
  if (!proc) return;
  try {
    if (IS_WIN && proc.pid) {
      exec(`taskkill /pid ${proc.pid} /T /F`);
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    // ignore
  }
}

async function createWindow() {
  const appRoot = resolveAppRoot();
  const iconPath = IS_WIN
    ? path.join(appRoot, 'build', 'icon.ico')
    : path.join(appRoot, 'build', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    title: 'OpenAI Codex Desktop',
    backgroundColor: '#F5F5F5',
    icon: iconPath,
    autoHideMenuBar: true,
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default',
    trafficLightPosition: IS_MAC ? { x: 16, y: 14 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await waitForServerReady(4000);

  const startUrl =
    process.env.ELECTRON_START_URL ||
    `http://127.0.0.1:${SERVER_PORT}`;

  mainWindow.loadURL(startUrl).catch(() => {
    mainWindow.loadFile(path.join(appRoot, 'dist', 'index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startEmbeddedAppServer();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopChildProcess(appServerProc);
  stopChildProcess(codexCliProc);
});

app.on('window-all-closed', () => {
  if (!IS_MAC) {
    isQuitting = true;
    stopChildProcess(appServerProc);
    appServerProc = null;
    stopChildProcess(codexCliProc);
    codexCliProc = null;
    app.quit();
  }
});

ipcMain.handle('codex:pick-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('codex:open-in-editor', async (_event, { targetPath, editor = 'code' }) => {
  try {
    spawn(editor, [targetPath], {
      detached: true,
      shell: IS_WIN,
      windowsHide: true,
      stdio: 'ignore',
    }).unref();
    return { ok: true };
  } catch (err) {
    await shell.openPath(targetPath);
    return { ok: true, fallback: true, error: String(err) };
  }
});

ipcMain.handle('codex:spawn-stdio-server', async (_event, { command = 'codex', args = ['app-server'] }) => {
  if (codexCliProc) {
    return { status: 'already_running', pid: codexCliProc.pid };
  }
  try {
    codexCliProc = spawn(command, args, {
      shell: IS_WIN,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    codexCliProc.stdout.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('codex:stdio-message', data.toString());
      }
    });
    codexCliProc.on('exit', (code) => {
      codexCliProc = null;
      if (mainWindow) {
        mainWindow.webContents.send('codex:stdio-exit', code);
      }
    });
    return { status: 'started', pid: codexCliProc.pid };
  } catch (err) {
    return { status: 'error', error: String(err) };
  }
});

ipcMain.handle('codex:send-stdio-rpc', async (_event, payload) => {
  if (!codexCliProc || !codexCliProc.stdin.writable) {
    return { ok: false, error: 'codex app-server stdio process not running' };
  }
  codexCliProc.stdin.write(`${JSON.stringify(payload)}\n`);
  return { ok: true };
});
