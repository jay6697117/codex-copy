const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexElectron', {
  isElectron: true,
  platform: process.platform,
  pickDirectory: () => ipcRenderer.invoke('codex:pick-directory'),
  openInEditor: (targetPath, editor) =>
    ipcRenderer.invoke('codex:open-in-editor', { targetPath, editor }),
  spawnStdioServer: (command, args) =>
    ipcRenderer.invoke('codex:spawn-stdio-server', { command, args }),
  sendStdioRpc: (payload) => ipcRenderer.invoke('codex:send-stdio-rpc', payload),
  onStdioMessage: (callback) => {
    const listener = (_event, line) => callback(line);
    ipcRenderer.on('codex:stdio-message', listener);
    return () => ipcRenderer.removeListener('codex:stdio-message', listener);
  },
});
