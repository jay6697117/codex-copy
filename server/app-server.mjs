#!/usr/bin/env node
/**
 * OpenAI Codex App-Server (JSON-RPC 2.0 Lite over stdio & HTTP/SSE Bridge)
 * Supports:
 *  - `node server/app-server.mjs --listen stdio://` (JSONL over stdin/stdout)
 *  - `node server/app-server.mjs` (HTTP bridge on port 4500 with /readyz, /healthz, /api/rpc, /api/fs, /api/terminal)
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const WORKSPACE_ROOT = process.env.CODEX_WORKSPACE_ROOT || process.cwd();
const PORT = Number(process.env.PORT || 4500);
const isStdioMode = process.argv.includes('stdio://') || process.argv.includes('--stdio');

const serverState = {
  initialized: false,
  clientInfo: null,
  capabilities: { experimentalApi: true },
  threads: new Map(),
};

async function listWorkspaceFiles(dirPath, baseDir = dirPath, depth = 0) {
  if (depth > 4) return [];
  const ignored = new Set(['node_modules', '.git', 'dist', '.DS_Store']);
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const results = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      const children = await listWorkspaceFiles(fullPath, baseDir, depth + 1);
      results.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children,
      });
    } else {
      let size = 0;
      try {
        const stat = await fs.stat(fullPath);
        size = stat.size;
      } catch {
        // ignore
      }
      results.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        size,
      });
    }
  }
  return results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function handleJsonRpcMessage(msg) {
  const { id, method, params = {} } = msg;

  if (method === 'initialize') {
    serverState.initialized = true;
    serverState.clientInfo = params.clientInfo || { name: 'codex_desktop', version: '1.0.0' };
    serverState.capabilities = params.capabilities || { experimentalApi: true };
    return {
      id,
      result: {
        userAgent: `codex_desktop/1.0.0 (${process.platform}; ${process.arch}) codex-app-server/0.160.0`,
        platformFamily: process.platform === 'win32' ? 'windows' : 'unix',
        platformOs: process.platform,
        capabilities: {
          experimentalApi: true,
          subagents: true,
          worktrees: true,
          skills: true,
          automations: true,
        },
      },
    };
  }

  if (method === 'initialized') {
    return null; // Notification acknowledgment
  }

  if (method === 'model/list') {
    return {
      id,
      result: {
        models: [
          { id: 'gpt-6.1-sol', title: 'GPT-6.1 Sol', tier: 'frontier', description: 'Recommended for complex multi-agent coding & architecture' },
          { id: 'gpt-6-luna', title: 'GPT-6 Luna', tier: 'fast', description: 'High-speed execution for focused, repeatable tasks & explorer subagents' },
          { id: 'gpt-5.3-codex', title: 'GPT-5.3 Codex', tier: 'legacy', description: 'SpecializedSWE-Bench Pro coding harness model' },
        ],
      },
    };
  }

  if (method === 'thread/start') {
    const threadId = params.threadId || `thr_${Date.now().toString(36)}`;
    const thread = {
      id: threadId,
      title: params.title || 'New Agent Thread',
      model: params.model || 'gpt-6.1-sol',
      cwd: params.cwd || WORKSPACE_ROOT,
      createdAt: new Date().toISOString(),
      turns: [],
    };
    serverState.threads.set(threadId, thread);
    return {
      id,
      result: { thread },
      notifications: [
        { method: 'thread/started', params: { thread } },
      ],
    };
  }

  if (method === 'turn/start') {
    const turnId = `turn_${Date.now().toString(36)}`;
    return {
      id,
      result: {
        turn: {
          id: turnId,
          threadId: params.threadId,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        },
      },
      notifications: [
        {
          method: 'turn/started',
          params: {
            threadId: params.threadId,
            turn: { id: turnId, status: 'in_progress' },
          },
        },
      ],
    };
  }

  if (method === 'turn/steer') {
    return {
      id,
      result: {
        steered: true,
        threadId: params.threadId,
        turnId: params.turnId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  if (method === 'turn/interrupt') {
    return {
      id,
      result: {
        interrupted: true,
        threadId: params.threadId,
        turnId: params.turnId,
      },
    };
  }

  return {
    id,
    result: {
      ok: true,
      method,
      echo: params,
    },
  };
}

if (isStdioMode) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      const response = await handleJsonRpcMessage(msg);
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/readyz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'codex-app-server', version: '0.160.0' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/healthz') {
      if (req.headers.origin && req.headers.origin !== 'null' && !req.headers.origin.includes('localhost') && !req.headers.origin.includes('127.0.0.1')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', workspace: WORKSPACE_ROOT }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/fs/tree') {
      const targetDir = url.searchParams.get('dir') || WORKSPACE_ROOT;
      const tree = await listWorkspaceFiles(targetDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ root: targetDir, tree }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/fs/read') {
      const relPath = url.searchParams.get('path') || 'AGENTS.md';
      const safePath = path.resolve(WORKSPACE_ROOT, relPath);
      if (!safePath.startsWith(path.resolve(WORKSPACE_ROOT))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sandbox violation: outside workspace boundary' }));
        return;
      }
      try {
        const content = await fs.readFile(safePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ path: relPath, content }));
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    // Read JSON body helper
    const readBody = () =>
      new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(e);
          }
        });
      });

    if (req.method === 'POST' && url.pathname === '/api/fs/write') {
      try {
        const { path: relPath, content } = await readBody();
        const safePath = path.resolve(WORKSPACE_ROOT, relPath);
        if (!safePath.startsWith(path.resolve(WORKSPACE_ROOT))) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Sandbox write boundary violation' }));
          return;
        }
        await fs.mkdir(path.dirname(safePath), { recursive: true });
        await fs.writeFile(safePath, content, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: relPath }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/terminal/exec') {
      try {
        const { command, cwd } = await readBody();
        const execCwd = cwd ? path.resolve(WORKSPACE_ROOT, cwd) : WORKSPACE_ROOT;
        const envPath = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}`;
        const { stdout, stderr } = await execAsync(command, {
          cwd: execCwd,
          timeout: 15000,
          env: { ...process.env, PATH: envPath },
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exitCode: 0, stdout, stderr }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            exitCode: err.code || 1,
            stdout: err.stdout || '',
            stderr: err.stderr || String(err.message || err),
          })
        );
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/rpc') {
      try {
        const rpcPayload = await readBody();
        const response = await handleJsonRpcMessage(rpcPayload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: -32700, message: String(err) } }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[codex app-server] listening on http://127.0.0.1:${PORT} (workspace: ${WORKSPACE_ROOT})`);
  });
}
