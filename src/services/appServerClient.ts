import {
  ComposerMode,
  FileDiff,
  FileTreeNode,
  JsonRpcLogEntry,
  LocalCodexStatus,
  ModelId,
  PersonalityMode,
  ReasoningEffort,
  SandboxPolicy,
  TurnItem,
  WorktreeInfo,
} from '../types/codex';

const FALLBACK_PORT_BASE = 'http://127.0.0.1:4500';

let rpcRequestId = 100;

async function fetchWithFallback(pathAndQuery: string, init?: RequestInit): Promise<Response> {
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
  } catch {
    // fallback to port 4500
  }

  return fetch(`${FALLBACK_PORT_BASE}${pathAndQuery}`, init);
}

export async function checkAppServerHealth(): Promise<{
  connected: boolean;
  workspace?: string;
  version?: string;
}> {
  try {
    const res = await fetchWithFallback('/readyz', { signal: AbortSignal.timeout(2000) });
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

export async function fetchLocalCodexStatus(cwd?: string): Promise<LocalCodexStatus | null> {
  try {
    const query = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
    const res = await fetchWithFallback(`/api/codex/status${query}`, {
      signal: AbortSignal.timeout(6000),
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
      signal: AbortSignal.timeout(5000),
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
      signal: AbortSignal.timeout(3000),
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

export async function readWorkspaceFile(filePath: string): Promise<string> {
  try {
    const res = await fetchWithFallback(`/api/fs/read?path=${encodeURIComponent(filePath)}`, {
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

export async function writeWorkspaceFile(filePath: string, content: string): Promise<boolean> {
  try {
    const res = await fetchWithFallback('/api/fs/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
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

function extractReasoningText(rawItem: any): string {
  if (!rawItem) return '';
  if (typeof rawItem.text === 'string' && rawItem.text.trim()) {
    return rawItem.text.trim();
  }
  if (Array.isArray(rawItem.summary)) {
    const joined = rawItem.summary
      .map((s: any) => (typeof s === 'string' ? s : s?.text || ''))
      .filter(Boolean)
      .join('\n');
    if (joined.trim()) return joined.trim();
  }
  if (Array.isArray(rawItem.content)) {
    const joined = rawItem.content
      .map((c: any) => (typeof c === 'string' ? c : c?.text || ''))
      .filter(Boolean)
      .join('\n');
    if (joined.trim()) return joined.trim();
  }
  return '';
}

/**
 * Execute a real turn against the local machine's `codex` CLI (`POST /api/codex/turn-stream`)
 * and stream live JSONL events (`reasoning`, `todo_list`, `command_execution`, `file_change`, `agent_message`, `git.state`).
 */
export function runInteractiveAgentTurn(params: {
  threadId: string;
  cliSessionId?: string | null;
  turnId: string;
  prompt: string;
  attachedFiles: string[];
  invokedSkills: string[];
  model: ModelId;
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
  const startedAtMs = Date.now();
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

  const liveReasoningId = `item_live_reason_${Date.now()}`;
  let liveReasoningAdded = false;

  const ensureLiveReasoning = (initialStep: string) => {
    if (!liveReasoningAdded) {
      liveReasoningAdded = true;
      params.callbacks.onItemAdded({
        id: liveReasoningId,
        type: 'reasoning',
        status: 'streaming',
        timestamp: nowTime(),
        durationSeconds: 1,
        reasoningSteps: [initialStep],
      });
    } else {
      params.callbacks.onItemUpdated(liveReasoningId, (prev) => {
        const steps = prev.reasoningSteps || [];
        if (steps[steps.length - 1] === initialStep) {
          return {
            ...prev,
            durationSeconds: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)),
          };
        }
        return {
          ...prev,
          durationSeconds: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)),
          reasoningSteps: [...steps, initialStep],
        };
      });
    }
  };

  (async () => {
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
          reasoningEffort: params.reasoningEffort,
          sandboxMode: params.sandboxPolicy.mode,
          cwd: params.cwd,
          mode: params.mode || 'agent',
          activeGoal: params.activeGoal,
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status} from local Codex bridge`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const knownItemIds = new Set<string>();

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

          logNotification(evt.type || 'codex/event', evt);

          if (evt.type === 'bridge.info') {
            ensureLiveReasoning(evt.message || 'Connected to local Codex CLI');
            continue;
          }

          if (evt.type === 'thread.started' && evt.thread_id) {
            params.callbacks.onCliThreadStarted?.(evt.thread_id);
            continue;
          }

          if (evt.type === 'error' && evt.message) {
            if (/Reconnecting/i.test(evt.message)) {
              ensureLiveReasoning(`网络波动自动重连中: ${evt.message}`);
            }
            continue;
          }

          if (evt.type === 'stderr.delta' && evt.text) {
            const cleaned = String(evt.text).trim();
            if (cleaned && liveReasoningAdded) {
              ensureLiveReasoning(cleaned);
            }
            continue;
          }

          if (
            evt.type === 'item.started' ||
            evt.type === 'item.updated' ||
            evt.type === 'item.completed'
          ) {
            const rawItem = evt.item;
            if (!rawItem) continue;
            const itemId =
              rawItem.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

            if (rawItem.type === 'reasoning') {
              const text = extractReasoningText(rawItem);
              if (text) {
                ensureLiveReasoning(text);
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
                ensureLiveReasoning(`执行命令: \`${rawItem.command}\``);
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
              if (liveReasoningAdded) {
                params.callbacks.onItemUpdated(liveReasoningId, (prev) => ({
                  ...prev,
                  status: 'completed',
                  durationSeconds: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)),
                }));
              }
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
            continue;
          }

          if (evt.type === 'git.state' && evt.git) {
            params.callbacks.onGitStateUpdated?.(evt.git);
            continue;
          }

          if (evt.type === 'turn.completed') {
            if (liveReasoningAdded) {
              params.callbacks.onItemUpdated(liveReasoningId, (prev) => ({
                ...prev,
                status: 'completed',
                durationSeconds: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)),
              }));
            }
            const totalTokens =
              (evt.usage?.input_tokens || 0) + (evt.usage?.output_tokens || 0);
            const usageStr =
              totalTokens > 0
                ? `${(totalTokens / 1000).toFixed(1)}k tokens`
                : undefined;
            params.callbacks.onTurnStatusChange('completed', usageStr);
            continue;
          }

          if (evt.type === 'turn.failed') {
            if (liveReasoningAdded) {
              params.callbacks.onItemUpdated(liveReasoningId, (prev) => ({
                ...prev,
                status: 'completed',
                durationSeconds: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)),
              }));
            }
            params.callbacks.onItemAdded({
              id: `item_err_${Date.now()}`,
              type: 'agentMessage',
              status: 'failed',
              timestamp: nowTime(),
              text: `**Codex 执行异常:** ${evt.error?.message || 'Execution failed'}`,
            });
            params.callbacks.onTurnStatusChange('completed');
          }
        }
      }

      if (liveReasoningAdded) {
        params.callbacks.onItemUpdated(liveReasoningId, (prev) => ({
          ...prev,
          status: 'completed',
          durationSeconds: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)),
        }));
      }
      params.callbacks.onTurnStatusChange('completed');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        params.callbacks.onTurnStatusChange('interrupted');
        return;
      }
      params.callbacks.onItemAdded({
        id: `item_err_${Date.now()}`,
        type: 'agentMessage',
        status: 'completed',
        timestamp: nowTime(),
        text: `无法连接到本机 Codex 服务: ${String(err?.message || err)}`,
      });
      params.callbacks.onTurnStatusChange('completed');
    }
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
