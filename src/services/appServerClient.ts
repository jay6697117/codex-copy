import {
  ComposerMode,
  FileDiff,
  FileTreeNode,
  JsonRpcLogEntry,
  LocalCodexStatus,
  ModelId,
  PersonalityMode,
  ProjectWorkspace,
  ReasoningEffort,
  SandboxPolicy,
  TurnItem,
  WorktreeInfo,
} from '../types/codex';
import { canUseLocalBridge, IS_PUBLIC_SITE } from './runtimeConfig';

const FALLBACK_PORT_BASE = 'http://127.0.0.1:4500';

let rpcRequestId = 100;

function isSameOriginAsFallback(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.port === '4500' ||
    window.location.origin === FALLBACK_PORT_BASE ||
    window.location.origin === 'http://localhost:4500'
  );
}

async function fetchWithFallback(pathAndQuery: string, init?: RequestInit): Promise<Response> {
  if (init?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (!canUseLocalBridge()) {
    throw new Error('请先点击顶部的“连接本机服务”。');
  }

  // A static public Site has no same-origin API; only an explicit connection
  // may reach the visitor's loopback service.
  if (IS_PUBLIC_SITE) {
    return fetch(`${FALLBACK_PORT_BASE}${pathAndQuery}`, init);
  }

  const isFileProtocol =
    typeof window !== 'undefined' && window.location.protocol === 'file:';

  if (!isFileProtocol) {
    try {
      const res = await fetch(pathAndQuery, init);
      if (res.ok || res.status === 400 || res.status === 403 || res.status === 404) {
        const contentType = res.headers.get('content-type') || '';
        if (
          contentType.includes('application/json') ||
          contentType.includes('application/x-ndjson')
        ) {
          return res;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || init?.signal?.aborted) {
        throw err;
      }
      // If already on port 4500, pause briefly before retrying once on 127.0.0.1:4500
      if (isSameOriginAsFallback()) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  }

  if (init?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  return fetch(`${FALLBACK_PORT_BASE}${pathAndQuery}`, init);
}

export async function checkAppServerHealth(): Promise<{
  connected: boolean;
  workspace?: string;
  version?: string;
}> {
  try {
    const res = await fetchWithFallback('/readyz', { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    return {
      connected: true,
      workspace: data.workspace,
      version: data.version || '0.160.0',
    };
  } catch {
    return { connected: false };
  }
}

// ============================================================================
// Multi-Workspace / Working Directory Client APIs
// ============================================================================
export interface SubfolderEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
}

export async function fetchWorkspaces(): Promise<{
  workspaces: ProjectWorkspace[];
  desktopFolders: SubfolderEntry[];
  desktopPath: string;
  homePath: string;
} | null> {
  try {
    const res = await fetchWithFallback('/api/workspaces', {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchDirectorySubfolders(dir?: string): Promise<{
  currentDir: string;
  parentDir: string;
  folders: SubfolderEntry[];
} | null> {
  try {
    const query = dir ? `?dir=${encodeURIComponent(dir)}` : '';
    const res = await fetchWithFallback(`/api/fs/list-dirs${query}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function createWorkspaceDirectory(params: {
  parentDir?: string;
  folderName?: string;
  fullPath?: string;
  initGit?: boolean;
}): Promise<{
  ok: boolean;
  workspace?: ProjectWorkspace;
  workspaces?: ProjectWorkspace[];
  git?: any;
  tree?: FileTreeNode[];
  error?: string;
}> {
  try {
    const res = await fetchWithFallback('/api/workspaces/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function pickNativeWorkspaceFolder(): Promise<{
  ok: boolean;
  cancelled?: boolean;
  workspace?: ProjectWorkspace;
  workspaces?: ProjectWorkspace[];
  git?: any;
  tree?: FileTreeNode[];
  error?: string;
}> {
  try {
    const res = await fetchWithFallback('/api/workspaces/pick-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function removeWorkspaceDirectory(idOrPath: string): Promise<{
  ok: boolean;
  workspaces?: ProjectWorkspace[];
}> {
  try {
    const res = await fetchWithFallback('/api/workspaces/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idOrPath, repoPath: idOrPath }),
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function fetchLocalCodexStatus(cwd?: string): Promise<LocalCodexStatus | null> {
  try {
    const query = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
    const res = await fetchWithFallback(`/api/codex/status${query}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveLocalCodexConfig(
  scope: 'global' | 'project',
  content: string
): Promise<{ ok: boolean; path?: string; status?: LocalCodexStatus; error?: string }> {
  try {
    const res = await fetchWithFallback('/api/codex/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, content }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function saveCodexModelPreferences(prefs: {
  model?: string;
  reasoningEffort?: ReasoningEffort;
}): Promise<{ ok: boolean; status?: LocalCodexStatus; error?: string }> {
  try {
    const res = await fetchWithFallback('/api/codex/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function fetchGitStatus(cwd?: string): Promise<{
  cwd: string;
  branch: string;
  changedFiles: FileDiff[];
  diffSummary: { files: number; additions: number; deletions: number };
  worktrees: WorktreeInfo[];
} | null> {
  try {
    const query = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
    const res = await fetchWithFallback(`/api/git/status${query}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function stageGitFile(
  filePath: string,
  stage: boolean,
  cwd?: string
): Promise<{ ok: boolean; git?: any }> {
  try {
    const res = await fetchWithFallback('/api/git/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, stage, cwd }),
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function revertGitFile(
  filePath: string,
  cwd?: string
): Promise<{ ok: boolean; git?: any }> {
  try {
    const res = await fetchWithFallback('/api/git/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, cwd }),
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function commitGitChanges(
  message: string,
  push = false,
  cwd?: string
): Promise<{ ok: boolean; stdout?: string; error?: string; git?: any }> {
  try {
    const res = await fetchWithFallback('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, push, cwd }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function manageGitWorktree(
  action: 'create' | 'remove',
  branchName?: string,
  worktreePath?: string,
  cwd?: string
): Promise<{ ok: boolean; worktreePath?: string; branch?: string; git?: any; error?: string }> {
  try {
    const res = await fetchWithFallback('/api/git/worktree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, branchName, worktreePath, cwd }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function openInExternalApp(
  targetPath: string,
  appId = 'cursor'
): Promise<{ ok: boolean; openedWith?: string; error?: string }> {
  try {
    const res = await fetchWithFallback('/api/open-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath, appId }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function sendJsonRpcRequest(
  method: string,
  params: Record<string, unknown>,
  onLog?: (entry: JsonRpcLogEntry) => void
): Promise<unknown> {
  const id = ++rpcRequestId;
  const requestPayload = { method, id, params };
  const nowStr =
    new Date().toTimeString().split(' ')[0] + '.' + String(Date.now() % 1000).padStart(3, '0');

  onLog?.({
    id: `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowStr,
    direction: 'client->server',
    method,
    payload: requestPayload,
  });

  try {
    const res = await fetchWithFallback('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const json = await res.json();
      onLog?.({
        id: `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp:
          new Date().toTimeString().split(' ')[0] + '.' + String(Date.now() % 1000).padStart(3, '0'),
        direction: 'server->client',
        method: `${method}:result`,
        payload: json,
      });
      return json;
    }
  } catch {
    // Fallback
  }

  return { id, result: { ok: true, method, params } };
}

export async function fetchWorkspaceFileTree(dir?: string): Promise<FileTreeNode[]> {
  try {
    const query = dir ? `?dir=${encodeURIComponent(dir)}` : '';
    const res = await fetchWithFallback(`/api/fs/tree${query}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tree) && data.tree.length > 0) {
        return data.tree;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export async function readWorkspaceFile(filePath: string, cwd?: string): Promise<string> {
  try {
    const query = `path=${encodeURIComponent(filePath)}${
      cwd ? `&cwd=${encodeURIComponent(cwd)}` : ''
    }`;
    const res = await fetchWithFallback(`/api/fs/read?${query}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.content === 'string') return data.content;
    }
  } catch {
    // ignore
  }
  return `// File: ${filePath}\n`;
}

export async function writeWorkspaceFile(
  filePath: string,
  content: string,
  cwd?: string
): Promise<boolean> {
  try {
    const res = await fetchWithFallback('/api/fs/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content, cwd }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function executeTerminalCommand(
  command: string,
  cwd?: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const res = await fetchWithFallback('/api/terminal/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd }),
      signal: AbortSignal.timeout(25000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: String(err),
    };
  }
  return { exitCode: 0, stdout: '', stderr: '' };
}

export interface StreamTurnCallbacks {
  onCliThreadStarted?: (cliSessionId: string) => void;
  onItemAdded: (item: TurnItem) => void;
  onItemUpdated: (itemId: string, updater: (prev: TurnItem) => TurnItem) => void;
  onDiffGenerated: (fileDiff: FileDiff) => void;
  onGitStateUpdated?: (gitState: {
    branch: string;
    changedFiles: FileDiff[];
    diffSummary: { files: number; additions: number; deletions: number };
    worktrees: WorktreeInfo[];
  }) => void;
  onTurnStatusChange: (
    status: 'in_progress' | 'waiting_approval' | 'completed' | 'interrupted',
    tokenUsageText?: string
  ) => void;
  onRpcLog: (entry: JsonRpcLogEntry) => void;
}

function isInternalRustLogLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) return true;
  if (/\b(ERROR|WARN|INFO|DEBUG|TRACE)\b\s+codex_/.test(trimmed)) return true;
  if (
    trimmed.includes('codex_rmcp_client') ||
    trimmed.includes('codex_models_manager') ||
    trimmed.includes('refresh_transaction') ||
    trimmed.includes('invalid_grant')
  ) {
    return true;
  }
  return false;
}

function extractReasoningText(rawItem: any): string {
  if (!rawItem) return '';
  let candidate = '';
  if (typeof rawItem.text === 'string' && rawItem.text.trim()) {
    candidate = rawItem.text.trim();
  } else if (Array.isArray(rawItem.summary)) {
    candidate = rawItem.summary
      .map((s: any) => (typeof s === 'string' ? s : s?.text || ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  } else if (Array.isArray(rawItem.content)) {
    candidate = rawItem.content
      .map((c: any) => (typeof c === 'string' ? c : c?.text || ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (!candidate) return '';
  const cleanLines = candidate
    .split('\n')
    .filter((l) => !isInternalRustLogLine(l));
  return cleanLines.join('\n').trim();
}

async function pollActiveTurnEvents(
  turnId: string,
  threadId: string,
  sinceSeq: number,
  signal: AbortSignal
): Promise<{
  found: boolean;
  status: string;
  lastSeq: number;
  events: any[];
} | null> {
  try {
    const query = `turnId=${encodeURIComponent(turnId)}&threadId=${encodeURIComponent(
      threadId
    )}&sinceSeq=${sinceSeq}`;
    const res = await fetchWithFallback(`/api/codex/turn-status?${query}`, {
      signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Execute a real turn against the local machine's `codex` CLI (`POST /api/codex/turn-stream`)
 * with:
 * - Multi-stage chronological reasoning tracking
 * - 2-second heartbeat handling so WKWebView never drops long-running turns ("Load failed")
 * - Automatic stateful stream reconnection (`sinceSeq` + `resumeStream`) & `/api/codex/turn-status` recovery
 *   so mid-turn network/WebKit stream interruptions seamlessly resume without losing a single item!
 */
export function runInteractiveAgentTurn(params: {
  threadId: string;
  cliSessionId?: string | null;
  turnId: string;
  prompt: string;
  attachedFiles: string[];
  invokedSkills: string[];
  model: ModelId;
  daybreakEnabled?: boolean;
  personality: PersonalityMode;
  reasoningEffort: ReasoningEffort;
  subagent: string;
  worktreeBranch: string;
  cwd?: string;
  mode?: ComposerMode;
  activeGoal?: string;
  sandboxPolicy: SandboxPolicy;
  callbacks: StreamTurnCallbacks;
}): { interrupt: () => void } {
  const abortController = new AbortController();
  const nowTime = () => new Date().toTimeString().split(' ')[0];

  const logNotification = (method: string, payload: unknown) => {
    params.callbacks.onRpcLog({
      id: `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowTime() + '.' + String(Date.now() % 1000).padStart(3, '0'),
      direction: 'server-notification',
      method,
      payload: { method, params: payload },
    });
  };

  let activeReasoningId = `item_live_reason_${Date.now()}`;
  let activeReasoningStartedMs = Date.now();
  let activeReasoningOpen = true;

  params.callbacks.onItemAdded({
    id: activeReasoningId,
    type: 'reasoning',
    status: 'streaming',
    timestamp: nowTime(),
    durationSeconds: 1,
    reasoningSteps: [],
  });

  const completeActiveReasoning = () => {
    if (!activeReasoningOpen) return;
    activeReasoningOpen = false;
    const targetId = activeReasoningId;
    const elapsed = Math.max(1, Math.round((Date.now() - activeReasoningStartedMs) / 1000));
    params.callbacks.onItemUpdated(targetId, (prev) => ({
      ...prev,
      status: 'completed',
      durationSeconds: elapsed,
    }));
  };

  const appendCleanReasoningStep = (stepText: string) => {
    const cleaned = stepText.trim();
    if (!cleaned || isInternalRustLogLine(cleaned)) return;

    if (!activeReasoningOpen) {
      activeReasoningId = `item_live_reason_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      activeReasoningStartedMs = Date.now();
      activeReasoningOpen = true;
      params.callbacks.onItemAdded({
        id: activeReasoningId,
        type: 'reasoning',
        status: 'streaming',
        timestamp: nowTime(),
        durationSeconds: 1,
        reasoningSteps: [cleaned],
      });
      return;
    }

    const targetId = activeReasoningId;
    const elapsed = Math.max(1, Math.round((Date.now() - activeReasoningStartedMs) / 1000));
    params.callbacks.onItemUpdated(targetId, (prev) => {
      const steps = prev.reasoningSteps || [];
      if (steps[steps.length - 1] === cleaned) {
        return {
          ...prev,
          status: 'streaming',
          durationSeconds: elapsed,
        };
      }
      return {
        ...prev,
        status: 'streaming',
        durationSeconds: elapsed,
        reasoningSteps: [...steps, cleaned],
      };
    });
  };

  (async () => {
    const knownItemIds = new Set<string>();
    const processedSeqs = new Set<number>();
    let lastSeq = 0;
    let receivedSubstantiveEvent = false;
    let turnFinished = false;

    const processEvent = (evt: any): boolean => {
      if (!evt || typeof evt !== 'object') return false;

      if (typeof evt._seq === 'number') {
        if (processedSeqs.has(evt._seq)) {
          return false;
        }
        processedSeqs.add(evt._seq);
        if (evt._seq > lastSeq) {
          lastSeq = evt._seq;
        }
      }

      if (evt.type === 'bridge.connected' || evt.type === 'bridge.heartbeat') {
        if (activeReasoningOpen) {
          const targetId = activeReasoningId;
          const elapsed = Math.max(
            1,
            Math.round((Date.now() - activeReasoningStartedMs) / 1000)
          );
          params.callbacks.onItemUpdated(targetId, (prev) => ({
            ...prev,
            durationSeconds: elapsed,
          }));
        }
        return false;
      }

      if (evt.type === 'stream.done') {
        turnFinished = true;
        completeActiveReasoning();
        params.callbacks.onTurnStatusChange('completed');
        return true;
      }

      receivedSubstantiveEvent = true;
      logNotification(evt.type || 'codex/event', evt);

      if (evt.type === 'thread.started' && evt.thread_id) {
        params.callbacks.onCliThreadStarted?.(evt.thread_id);
        return false;
      }

      if (evt.type === 'bridge.info' || evt.type === 'stderr.delta' || evt.type === 'error') {
        return false;
      }

      if (
        evt.type === 'item.started' ||
        evt.type === 'item.updated' ||
        evt.type === 'item.completed'
      ) {
        const rawItem = evt.item;
        if (!rawItem) return false;
        const itemId =
          rawItem.id ||
          (typeof evt._seq === 'number'
            ? `item_seq_${evt._seq}`
            : `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`);

        if (rawItem.type === 'reasoning') {
          const text = extractReasoningText(rawItem);
          if (text) {
            appendCleanReasoningStep(text);
          }
        } else if (rawItem.type === 'todo_list') {
          const todoItems = Array.isArray(rawItem.items) ? rawItem.items : [];
          const todoTurnItem: TurnItem = {
            id: itemId,
            type: 'todoList',
            status: evt.type === 'item.completed' ? 'completed' : 'streaming',
            timestamp: nowTime(),
            todoItems,
          };
          if (!knownItemIds.has(itemId)) {
            knownItemIds.add(itemId);
            params.callbacks.onItemAdded(todoTurnItem);
          } else {
            params.callbacks.onItemUpdated(itemId, () => todoTurnItem);
          }
        } else if (rawItem.type === 'command_execution') {
          if (evt.type === 'item.started' && rawItem.command) {
            appendCleanReasoningStep(`Running \`${rawItem.command}\``);
          }
          const uiItem: TurnItem = {
            id: itemId,
            type: 'commandExecution',
            status:
              evt.type === 'item.completed'
                ? rawItem.status === 'failed'
                  ? 'failed'
                  : 'completed'
                : 'streaming',
            timestamp: nowTime(),
            command: rawItem.command || 'shell',
            exitCode: rawItem.exit_code ?? 0,
            stdout: rawItem.aggregated_output || '',
          };
          if (!knownItemIds.has(itemId)) {
            knownItemIds.add(itemId);
            params.callbacks.onItemAdded(uiItem);
          } else {
            params.callbacks.onItemUpdated(itemId, () => uiItem);
          }
        } else if (rawItem.type === 'file_change') {
          const changes = Array.isArray(rawItem.changes) ? rawItem.changes : [];
          for (const ch of changes) {
            const fcId = `${itemId}_${ch.path}`;
            if (!knownItemIds.has(fcId)) {
              knownItemIds.add(fcId);
              appendCleanReasoningStep(`Edited \`${ch.path}\``);
              params.callbacks.onItemAdded({
                id: fcId,
                type: 'fileChange',
                status: 'completed',
                timestamp: nowTime(),
                filePath: ch.path,
                changeType:
                  ch.kind === 'add'
                    ? 'added'
                    : ch.kind === 'delete'
                    ? 'deleted'
                    : 'modified',
                additions: 1,
                deletions: 0,
                summary: `${ch.kind || 'updated'} ${ch.path}`,
              });
            }
          }
        } else if (rawItem.type === 'agent_message') {
          completeActiveReasoning();
          const msgItem: TurnItem = {
            id: itemId,
            type: 'agentMessage',
            status: evt.type === 'item.completed' ? 'completed' : 'streaming',
            timestamp: nowTime(),
            text: rawItem.text || '',
          };
          if (!knownItemIds.has(itemId)) {
            knownItemIds.add(itemId);
            params.callbacks.onItemAdded(msgItem);
          } else {
            params.callbacks.onItemUpdated(itemId, () => msgItem);
          }
        }
        return false;
      }

      if (evt.type === 'git.state' && evt.git) {
        params.callbacks.onGitStateUpdated?.(evt.git);
        return false;
      }

      if (evt.type === 'turn.completed') {
        turnFinished = true;
        completeActiveReasoning();
        const totalTokens =
          (evt.usage?.input_tokens || 0) + (evt.usage?.output_tokens || 0);
        const usageStr =
          totalTokens > 0
            ? `${(totalTokens / 1000).toFixed(1)}k tokens`
            : undefined;
        params.callbacks.onTurnStatusChange('completed', usageStr);
        return false;
      }

      if (evt.type === 'turn.failed') {
        turnFinished = true;
        completeActiveReasoning();
        params.callbacks.onItemAdded({
          id: `item_err_${Date.now()}`,
          type: 'agentMessage',
          status: 'failed',
          timestamp: nowTime(),
          text: `**Codex 执行提示:** ${evt.error?.message || 'Execution failed'}`,
        });
        params.callbacks.onTurnStatusChange('completed');
        return true;
      }

      return false;
    };

    const MAX_RECONNECT_ATTEMPTS = 12;
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      if (abortController.signal.aborted || turnFinished) break;

      try {
        const response = await fetchWithFallback('/api/codex/turn-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: params.threadId,
            cliSessionId: params.cliSessionId,
            turnId: params.turnId,
            prompt: params.prompt,
            attachedFiles: params.attachedFiles,
            invokedSkills: params.invokedSkills,
            model: params.model,
            daybreakEnabled: params.daybreakEnabled,
            reasoningEffort: params.reasoningEffort,
            sandboxMode: params.sandboxPolicy.mode,
            cwd: params.cwd,
            mode: params.mode || 'agent',
            activeGoal: params.activeGoal,
            sinceSeq: lastSeq,
            resumeStream: attempt > 0,
          }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status} from local Codex bridge`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            let evt: any;
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            const shouldStop = processEvent(evt);
            if (shouldStop) break;
          }
          if (turnFinished) break;
        }

        // Flush any remaining trailing line in buffer
        if (buffer.trim() && !turnFinished) {
          try {
            const trailingEvt = JSON.parse(buffer.trim());
            processEvent(trailingEvt);
          } catch {
            // ignore
          }
        }

        if (turnFinished) {
          break;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || abortController.signal.aborted) {
          completeActiveReasoning();
          params.callbacks.onTurnStatusChange('interrupted');
          return;
        }
        lastError = err;
      }

      if (turnFinished || abortController.signal.aborted) {
        break;
      }

      // Stream interrupted before `stream.done` / `turn.completed` (e.g. WebKit `Load failed`):
      // Poll `/api/codex/turn-status` and wait briefly before re-attaching to the active turn stream
      const delayMs = Math.min(2500, 500 + attempt * 350);
      await new Promise((r) => setTimeout(r, delayMs));
      if (abortController.signal.aborted) break;

      const polled = await pollActiveTurnEvents(
        params.turnId,
        params.threadId,
        lastSeq,
        abortController.signal
      );
      if (polled && polled.found) {
        if (Array.isArray(polled.events)) {
          for (const evt of polled.events) {
            processEvent(evt);
          }
        }
        if (polled.status !== 'running') {
          turnFinished = true;
          break;
        }
      }
    }

    if (abortController.signal.aborted) {
      completeActiveReasoning();
      params.callbacks.onTurnStatusChange('interrupted');
      return;
    }

    completeActiveReasoning();

    if (turnFinished || receivedSubstantiveEvent || knownItemIds.size > 0) {
      const gitState = await fetchGitStatus(params.cwd);
      if (gitState) {
        params.callbacks.onGitStateUpdated?.(gitState);
      }
      params.callbacks.onTurnStatusChange('completed');
      return;
    }

    params.callbacks.onItemAdded({
      id: `item_err_${Date.now()}`,
      type: 'agentMessage',
      status: 'completed',
      timestamp: nowTime(),
      text: `无法连接到本机 Codex 服务: ${String(lastError?.message || lastError || '连接超时')}`,
    });
    params.callbacks.onTurnStatusChange('completed');
  })();

  return {
    interrupt: () => {
      abortController.abort();
      fetchWithFallback('/api/codex/interrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnId: params.turnId, threadId: params.threadId }),
      }).catch(() => {});
    },
  };
}
