#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('Starting OpenAI Codex Desktop App (App-Server + Vite Workbench)...');

const serverProc = spawn(process.execPath, [path.join(rootDir, 'server', 'app-server.mjs')], {
  cwd: rootDir,
  stdio: 'inherit',
});

const viteProc = spawn('npm', ['run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
});

const cleanup = () => {
  serverProc.kill();
  viteProc.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
