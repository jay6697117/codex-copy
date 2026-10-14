/**
 * Unified HTTP API Router for OpenAI Codex Desktop App
 * Mounted by both `vite.config.ts` (dev middleware) and `server/app-server.mjs` (port 4500 / Native macOS & Windows app).
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  buildAugmentedPath,
  createOrAddWorkspace,
  getActiveTurnStatus,
  inspectGitRepository,
  inspectLocalCodexEnvironment,
  interruptLocalCodexTurn,
  listAllWorkspaces,
  listDirectorySubfolders,
  openInMacApp,
  pickNativeFolderDialog,
  removeWorkspaceFromList,
  resolveCodexHomeDir,
  resolveRealHomeDir,
  streamLocalCodexTurn,
  updateGlobalCodexConfigKeys,
} from './codex-local-bridge.mjs';

const execAsync = promisify(exec);

function resolveEffectiveWorkspace(workspaceRoot) {
  const candidate = workspaceRoot || process.cwd();
  if (candidate.includes('.app/Contents/Resources')) {
    const realHome = resolveRealHomeDir();
    const fallbackRepo = path.join(realHome, 'Desktop', 'codex-test');
    if (fsSync.existsSync(fallbackRepo)) return fallbackRepo;
    return realHome;
  }
  return candidate;
}

const rpcServerState = {
  initialized: false,
  clientInfo: null,
  capabilities: { experimentalApi: true },
  threads: new Map(),
};

export async function listWorkspaceFiles(dirPath, baseDir = dirPath, depth = 0) {
  if (depth > 4) return [];
  const ignored = new Set(['node_modules', '.git', 'dist', 'release', 'build', '.DS_Store']);
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

export async function handleJsonRpcMessage(msg, rawWorkspaceRoot = process.cwd()) {
  const workspaceRoot = resolveEffectiveWorkspace(rawWorkspaceRoot);
  const { id, method, params = {} } = msg;

  if (method === 'initialize') {
    rpcServerState.initialized = true;
    rpcServerState.clientInfo = params.clientInfo || { name: 'codex_desktop', version: '1.0.0' };
    rpcServerState.capabilities = params.capabilities || { experimentalApi: true };
    const envInfo = await inspectLocalCodexEnvironment(workspaceRoot);
    return {
      id,
      result: {
        userAgent: `codex_desktop/1.0.0 (${process.platform}; ${process.arch}) ${
          envInfo.cli.version || 'codex-app-server/0.160.0'
        }`,
        platformFamily: process.platform === 'win32' ? 'windows' : 'unix',
        platformOs: process.platform,
        codexCliInstalled: envInfo.cli.installed,
        codexBinaryPath: envInfo.cli.binaryPath,
        loggedIn: envInfo.auth.loggedIn,
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
    return null;
  }

  if (method === 'model/list') {
    const envInfo = await inspectLocalCodexEnvironment(workspaceRoot);
    const configuredModel = envInfo.config.effective.model;
    const available = envInfo.config.effective.availableModels || [];

    const models = available.map((mId) => ({
      id: mId,
      title: mId === configuredModel ? `${mId} (config.toml)` : mId,
      tier: mId === configuredModel ? 'configured' : 'official',
      description:
        mId === configuredModel
          ? 'Configured in local ~/.codex/config.toml'
          : 'OpenAI Codex model',
    }));

    return {
      id,
      result: { models },
    };
  }

  if (method === 'thread/start') {
    const threadId = params.threadId || `thr_${Date.now().toString(36)}`;
    const thread = {
      id: threadId,
      title: params.title || '新聊天',
      model: params.model || 'gpt-6.1-sol',
      cwd: params.cwd || workspaceRoot,
      createdAt: new Date().toISOString(),
      turns: [],
    };
    rpcServerState.threads.set(threadId, thread);
    return {
      id,
      result: { thread },
      notifications: [{ method: 'thread/started', params: { thread } }],
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

  if (method === 'turn/interrupt') {
    interruptLocalCodexTurn(params.turnId || params.threadId);
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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  if (res.headersSent) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

export async function handleApiRequest(req, res, rawWorkspaceRoot = process.cwd()) {
  req.on?.('error', () => {});
  res.on?.('error', () => {});

  const workspaceRoot = resolveEffectiveWorkspace(rawWorkspaceRoot);
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  if (req.method === 'GET' && pathname === '/readyz') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'codex-app-server',
      version: '0.160.0',
      workspace: workspaceRoot,
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/healthz') {
    sendJson(res, 200, { status: 'healthy', workspace: workspaceRoot });
    return true;
  }

  // 0. Multi-Workspace Management Endpoints
  if (req.method === 'GET' && pathname === '/api/workspaces') {
    try {
      const data = await listAllWorkspaces(workspaceRoot);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { error: String(err.message || err) });
    }
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/fs/list-dirs') {
    try {
      const dir = url.searchParams.get('dir') || '';
      const data = await listDirectorySubfolders(dir);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { error: String(err.message || err) });
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/workspaces/create') {
    try {
      const body = await readJsonBody(req);
      const result = await createOrAddWorkspace(body);
      const tree = result.workspace
        ? await listWorkspaceFiles(result.workspace.repoPath)
        : [];
      sendJson(res, 200, { ...result, tree });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/workspaces/pick-folder') {
    try {
      const result = await pickNativeFolderDialog();
      const tree =
        result.ok && result.workspace
          ? await listWorkspaceFiles(result.workspace.repoPath)
          : [];
      sendJson(res, 200, { ...result, tree });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/workspaces/remove') {
    try {
      const body = await readJsonBody(req);
      const result = await removeWorkspaceFromList(body.id || body.repoPath);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  // 1. Local Codex Environment & Auth & Config Status
  if (req.method === 'GET' && pathname === '/api/codex/status') {
    try {
      const targetCwd = url.searchParams.get('cwd') || workspaceRoot;
      const status = await inspectLocalCodexEnvironment(targetCwd);
      sendJson(res, 200, status);
    } catch (err) {
      sendJson(res, 500, { error: String(err.message || err) });
    }
    return true;
  }

  // 2. Save Global (~/.codex/config.toml) or Project (.codex/config.toml) Configuration
  if (req.method === 'POST' && pathname === '/api/codex/config') {
    try {
      const body = await readJsonBody(req);
      const { scope = 'project', content } = body;
      const targetPath =
        scope === 'global'
          ? path.join(resolveCodexHomeDir(), 'config.toml')
          : path.join(workspaceRoot, '.codex', 'config.toml');
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, String(content || ''), 'utf8');
      const updated = await inspectLocalCodexEnvironment(workspaceRoot);
      sendJson(res, 200, { ok: true, path: targetPath, status: updated });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  // 2b. Update Model or Reasoning Effort in ~/.codex/config.toml
  if (req.method === 'POST' && pathname === '/api/codex/preferences') {
    try {
      const body = await readJsonBody(req);
      const updates = {};
      if (body.model && body.model !== 'default') updates.model = body.model;
      if (body.reasoningEffort) {
        updates.model_reasoning_effort =
          body.reasoningEffort === 'uhigh' || body.reasoningEffort === 'max'
            ? 'xhigh'
            : body.reasoningEffort;
      }
      await updateGlobalCodexConfigKeys(updates);
      const updated = await inspectLocalCodexEnvironment(workspaceRoot);
      sendJson(res, 200, { ok: true, status: updated });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  // 3. Real Streaming Turn Execution via Local `codex exec --json -` (with Heartbeat + Stateful Resume)
  if (req.method === 'POST' && pathname === '/api/codex/turn-stream') {
    try {
      req.setTimeout?.(0);
      res.setTimeout?.(0);
      req.socket?.setTimeout?.(0);
      req.socket?.setNoDelay?.(true);
      req.socket?.setKeepAlive?.(true, 15000);

      const body = await readJsonBody(req);
      await streamLocalCodexTurn(
        {
          ...body,
          cwd: body.cwd || workspaceRoot,
        },
        res,
        req
      );
    } catch (err) {
      if (!res.headersSent) {
        sendJson(res, 500, { error: String(err.message || err) });
      } else {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
    return true;
  }

  // 3b. Query Active or Completed Turn Session Status & Incremental Events (Polling / Fallback Recovery)
  if (req.method === 'GET' && pathname === '/api/codex/turn-status') {
    try {
      const turnId = url.searchParams.get('turnId') || '';
      const threadId = url.searchParams.get('threadId') || '';
      const sinceSeq = Number(url.searchParams.get('sinceSeq') || 0);
      const statusData = getActiveTurnStatus(turnId || threadId, sinceSeq);
      sendJson(res, 200, statusData);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  // 4. Interrupt Active Turn
  if (req.method === 'POST' && pathname === '/api/codex/interrupt') {
    try {
      const body = await readJsonBody(req);
      const stopped = interruptLocalCodexTurn(body.turnId || body.threadId);
      sendJson(res, 200, { ok: true, stopped });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  // 5. Real Git Status, Diffs & Worktrees Inspection
  if (req.method === 'GET' && pathname === '/api/git/status') {
    try {
      const cwd = url.searchParams.get('cwd') || workspaceRoot;
      const gitState = await inspectGitRepository(cwd);
      sendJson(res, 200, gitState);
    } catch (err) {
      sendJson(res, 500, { error: String(err.message || err) });
    }
    return true;
  }

  // 6. Git Stage / Unstage File
  if (req.method === 'POST' && pathname === '/api/git/stage') {
    try {
      const { cwd = workspaceRoot, filePath, stage = true } = await readJsonBody(req);
      const augPath = buildAugmentedPath();
      const cmd = stage ? `git add "${filePath}"` : `git reset HEAD "${filePath}"`;
      await execAsync(cmd, { cwd, env: { ...process.env, PATH: augPath } });
      const gitState = await inspectGitRepository(cwd);
      sendJson(res, 200, { ok: true, git: gitState });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  // 7. Git Revert File
  if (req.method === 'POST' && pathname === '/api/git/revert') {
    try {
      const { cwd = workspaceRoot, filePath } = await readJsonBody(req);
      const augPath = buildAugmentedPath();
      await execAsync(`git checkout -- "${filePath}"`, {
        cwd,
        env: { ...process.env, PATH: augPath },
      });
      const gitState = await inspectGitRepository(cwd);
      sendJson(res, 200, { ok: true, git: gitState });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  // 8. Git Commit / Push / Create Branch
  if (req.method === 'POST' && pathname === '/api/git/commit') {
    try {
      const {
        cwd = workspaceRoot,
        message = 'Update via Codex Desktop',
        push = false,
      } = await readJsonBody(req);
      const augPath = buildAugmentedPath();
      const safeMsg = message.replace(/"/g, '\\"');
      const { stdout, stderr } = await execAsync(
        `git add -A && git commit -m "${safeMsg}"${push ? ' && git push' : ''}`,
        { cwd, env: { ...process.env, PATH: augPath } }
      );
      const gitState = await inspectGitRepository(cwd);
      sendJson(res, 200, { ok: true, stdout, stderr, git: gitState });
    } catch (err) {
      const gitState = await inspectGitRepository(workspaceRoot);
      sendJson(res, 200, {
        ok: false,
        error: String(err.stderr || err.stdout || err.message || err),
        git: gitState,
      });
    }
    return true;
  }

  // 9. Git Worktree Create / Remove
  if (req.method === 'POST' && pathname === '/api/git/worktree') {
    try {
      const {
        cwd = workspaceRoot,
        action = 'create',
        branchName,
        worktreePath,
      } = await readJsonBody(req);
      const augPath = buildAugmentedPath();
      if (action === 'create') {
        const cleanSlug = (branchName || `codex/task-${Date.now().toString(36)}`).replace(
          /[^a-zA-Z0-9._/-]/g,
          '-'
        );
        const folderSlug = cleanSlug.replace(/\//g, '-');
        const targetWtDir =
          worktreePath ||
          path.join(resolveCodexHomeDir(), 'worktrees', path.basename(cwd), folderSlug);
        await fs.mkdir(path.dirname(targetWtDir), { recursive: true });
        await execAsync(`git worktree add "${targetWtDir}" -b "${cleanSlug}"`, {
          cwd,
          env: { ...process.env, PATH: augPath },
        });
        const gitState = await inspectGitRepository(cwd);
        sendJson(res, 200, {
          ok: true,
          worktreePath: targetWtDir,
          branch: cleanSlug,
          git: gitState,
        });
      } else if (action === 'remove' && worktreePath) {
        await execAsync(`git worktree remove --force "${worktreePath}"`, {
          cwd,
          env: { ...process.env, PATH: augPath },
        });
        const gitState = await inspectGitRepository(cwd);
        sendJson(res, 200, { ok: true, git: gitState });
      } else {
        sendJson(res, 400, { ok: false, error: 'Invalid worktree action' });
      }
    } catch (err) {
      sendJson(res, 200, {
        ok: false,
        error: String(err.stderr || err.message || err),
      });
    }
    return true;
  }

  // 10. Open in External IDE / Terminal
  if (req.method === 'POST' && pathname === '/api/open-in') {
    try {
      const { targetPath = workspaceRoot, appId = 'cursor' } = await readJsonBody(req);
      const result = await openInMacApp(targetPath, appId);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return true;
  }

  // 11. Workspace File Tree
  if (req.method === 'GET' && pathname === '/api/fs/tree') {
    const targetDir = url.searchParams.get('dir') || workspaceRoot;
    const tree = await listWorkspaceFiles(targetDir);
    sendJson(res, 200, { root: targetDir, tree });
    return true;
  }

  // 12. Read File
  if (req.method === 'GET' && pathname === '/api/fs/read') {
    const relPath = url.searchParams.get('path') || 'AGENTS.md';
    const cwd = url.searchParams.get('cwd') || workspaceRoot;
    const realHome = resolveRealHomeDir();
    const expandedPath = relPath.startsWith('~/')
      ? path.join(realHome, relPath.slice(2))
      : path.resolve(cwd, relPath);
    try {
      const content = await fs.readFile(expandedPath, 'utf8');
      sendJson(res, 200, { path: relPath, content });
    } catch (err) {
      sendJson(res, 404, { error: String(err) });
    }
    return true;
  }

  // 13. Write File
  if (req.method === 'POST' && pathname === '/api/fs/write') {
    try {
      const { path: relPath, content, cwd = workspaceRoot } = await readJsonBody(req);
      const realHome = resolveRealHomeDir();
      const expandedPath = relPath.startsWith('~/')
        ? path.join(realHome, relPath.slice(2))
        : path.resolve(cwd, relPath);
      await fs.mkdir(path.dirname(expandedPath), { recursive: true });
      await fs.writeFile(expandedPath, content, 'utf8');
      sendJson(res, 200, { ok: true, path: relPath });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // 14. Execute Shell / Terminal Command
  if (req.method === 'POST' && pathname === '/api/terminal/exec') {
    try {
      const { command, cwd } = await readJsonBody(req);
      const execCwd = cwd ? path.resolve(workspaceRoot, cwd) : workspaceRoot;
      const augPath = buildAugmentedPath();
      const realHome = resolveRealHomeDir();
      const { stdout, stderr } = await execAsync(command, {
        cwd: execCwd,
        timeout: 25000,
        env: { ...process.env, HOME: realHome, USERPROFILE: realHome, PATH: augPath },
      });
      sendJson(res, 200, { exitCode: 0, stdout, stderr });
    } catch (err) {
      sendJson(res, 200, {
        exitCode: err.code || 1,
        stdout: err.stdout || '',
        stderr: err.stderr || String(err.message || err),
      });
    }
    return true;
  }

  // 15. JSON-RPC 2.0 Lite Endpoint
  if (req.method === 'POST' && pathname === '/api/rpc') {
    try {
      const rpcPayload = await readJsonBody(req);
      const response = await handleJsonRpcMessage(rpcPayload, workspaceRoot);
      sendJson(res, 200, response);
    } catch (err) {
      sendJson(res, 400, { error: { code: -32700, message: String(err) } });
    }
    return true;
  }

  return false;
}
