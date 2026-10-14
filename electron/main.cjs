const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let appServerProc = null;
let codexCliProc = null;

function startEmbeddedAppServer() {
  const serverScript = path.join(__dirname, '..', 'server', 'app-server.mjs');
  appServerProc = spawn(process.execPath, [serverScript], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '4500', ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  appServerProc.stdout.on('data', (chunk) => {
    process.stdout.write(`[app-server] ${chunk}`);
  });
  appServerProc.stderr.on('data', (chunk) => {
    process.stderr.write(`[app-server] ${chunk}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#090A0F',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startEmbeddedAppServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (appServerProc) {
    appServerProc.kill();
    appServerProc = null;
  }
  if (codexCliProc) {
    codexCliProc.kill();
    codexCliProc = null;
  }
  if (process.platform !== 'darwin') {
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
    spawn(editor, [targetPath], { detached: true, stdio: 'ignore' }).unref();
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
    codexCliProc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
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
