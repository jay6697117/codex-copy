#!/usr/bin/env node
/**
 * OpenAI Codex App-Server (JSON-RPC 2.0 Lite over stdio & Self-Contained HTTP + Static Desktop Server)
 * Supports:
 *  - `node server/app-server.mjs --listen stdio://` (JSONL over stdin/stdout)
 *  - `node server/app-server.mjs` (HTTP bridge on port 4500 serving both `/api/*` and `dist/` desktop UI)
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { handleApiRequest, handleJsonRpcMessage } from './api-router.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = process.env.CODEX_WORKSPACE_ROOT || process.cwd();
const PORT = Number(process.env.PORT || 4500);
const STATIC_DIR =
  process.env.CODEX_STATIC_DIR || path.resolve(__dirname, '..', 'dist');
const isStdioMode = process.argv.includes('stdio://') || process.argv.includes('--stdio');

// Prevent unhandled stream/pipe errors (e.g. EPIPE / ECONNRESET) from crashing the daemon
process.on('uncaughtException', (err) => {
  if (!isStdioMode) {
    console.error('[codex app-server] uncaughtException (recovered):', err?.message || err);
  }
});

process.on('unhandledRejection', (reason) => {
  if (!isStdioMode) {
    console.error('[codex app-server] unhandledRejection (recovered):', reason);
  }
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveStaticAsset(req, res) {
  if (!fsSync.existsSync(STATIC_DIR)) return false;
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  let relPath = decodeURIComponent(urlObj.pathname);
  if (relPath === '/' || relPath === '') {
    relPath = '/index.html';
  }

  const safeTarget = path.normalize(path.join(STATIC_DIR, relPath));
  if (!safeTarget.startsWith(STATIC_DIR)) {
    return false;
  }

  try {
    const stat = await fs.stat(safeTarget);
    if (stat.isFile()) {
      const ext = path.extname(safeTarget).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = await fs.readFile(safeTarget);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      res.end(content);
      return true;
    }
  } catch {
    // Fallback to index.html for SPA routes
    try {
      const indexHtml = await fs.readFile(path.join(STATIC_DIR, 'index.html'));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(indexHtml);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

if (isStdioMode) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      const response = await handleJsonRpcMessage(msg, WORKSPACE_ROOT);
      if (response) {
        const { notifications, ...rpcReply } = response;
        process.stdout.write(`${JSON.stringify(rpcReply)}\n`);
        if (Array.isArray(notifications)) {
          for (const note of notifications) {
            process.stdout.write(`${JSON.stringify(note)}\n`);
          }
        }
      }
    } catch (err) {
      process.stdout.write(
        `${JSON.stringify({ error: { code: -32700, message: String(err) } })}\n`
      );
    }
  });
} else {
  const server = http.createServer(async (req, res) => {
    try {
      const handled = await handleApiRequest(req, res, WORKSPACE_ROOT);
      if (handled) return;

      const servedStatic = await serveStaticAsset(req, res);
      if (servedStatic) return;

      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    } catch (err) {
      console.error('[codex app-server] request error:', err?.message || err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err?.message || err) }));
      } else {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
  });

  // Disable Node 18+/22+/25+ default 300s requestTimeout so long `xhigh` Codex turns never get severed mid-stream
  server.requestTimeout = 0;
  server.timeout = 0;
  server.headersTimeout = 0;
  server.keepAliveTimeout = 65000;

  server.on('connection', (socket) => {
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 15000);
    socket.setTimeout(0);
    socket.on('error', () => {});
  });

  server.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || !socket.writable) return;
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(
      `[codex app-server] listening on http://127.0.0.1:${PORT} (workspace: ${WORKSPACE_ROOT}, static: ${STATIC_DIR})`
    );
  });
}
