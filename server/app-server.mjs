#!/usr/bin/env node
/**
 * OpenAI Codex App-Server (JSON-RPC 2.0 Lite over stdio & HTTP/SSE Local Bridge)
 * Supports:
 *  - `node server/app-server.mjs --listen stdio://` (JSONL over stdin/stdout)
 *  - `node server/app-server.mjs` (HTTP bridge on port 4500 with full local ~/.codex & CLI integration)
 */
import http from 'node:http';
import readline from 'node:readline';
import { handleApiRequest, handleJsonRpcMessage } from './api-router.mjs';

const WORKSPACE_ROOT = process.env.CODEX_WORKSPACE_ROOT || process.cwd();
const PORT = Number(process.env.PORT || 4500);
const isStdioMode = process.argv.includes('stdio://') || process.argv.includes('--stdio');

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
    const handled = await handleApiRequest(req, res, WORKSPACE_ROOT);
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(
      `[codex app-server] listening on http://127.0.0.1:${PORT} (workspace: ${WORKSPACE_ROOT})`
    );
  });
}
