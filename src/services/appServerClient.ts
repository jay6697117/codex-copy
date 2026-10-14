import {
  FileTreeNode,
  JsonRpcLogEntry,
  ModelId,
  PersonalityMode,
  ReasoningEffort,
  SandboxPolicy,
  TurnItem,
  FileDiff,
} from '../types/codex';

const API_BASE = 'http://127.0.0.1:4500';

let rpcRequestId = 100;

export async function checkAppServerHealth(): Promise<{
  connected: boolean;
  workspace?: string;
  version?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/readyz`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    return { connected: true, version: data.version || '0.160.0' };
  } catch {
    return { connected: false };
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
    const res = await fetch(`${API_BASE}/api/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(3000),
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
    // Fallback to embedded in-memory JSON-RPC response when running in pure static mode
  }

  const simulatedReply = {
    id,
    result: {
      ok: true,
      method,
      simulatedBy: 'embedded-codex-harness',
      params,
    },
  };

  onLog?.({
    id: `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp:
      new Date().toTimeString().split(' ')[0] + '.' + String(Date.now() % 1000).padStart(3, '0'),
    direction: 'server->client',
    method: `${method}:result`,
    payload: simulatedReply,
  });

  return simulatedReply;
}

export async function fetchWorkspaceFileTree(): Promise<FileTreeNode[]> {
  try {
    const res = await fetch(`${API_BASE}/api/fs/tree`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tree) && data.tree.length > 0) {
        return data.tree;
      }
    }
  } catch {
    // Fallback tree below
  }

  return [
    {
      name: '.codex',
      path: '.codex',
      type: 'directory',
      children: [
        { name: 'config.toml', path: '.codex/config.toml', type: 'file', size: 616 },
        {
          name: 'agents',
          path: '.codex/agents',
          type: 'directory',
          children: [
            { name: 'default.toml', path: '.codex/agents/default.toml', type: 'file', size: 499 },
            { name: 'worker.toml', path: '.codex/agents/worker.toml', type: 'file', size: 376 },
            { name: 'explorer.toml', path: '.codex/agents/explorer.toml', type: 'file', size: 340 },
          ],
        },
        {
          name: 'skills',
          path: '.codex/skills',
          type: 'directory',
          children: [
            {
              name: 'develop-web-game/SKILL.md',
              path: '.codex/skills/develop-web-game/SKILL.md',
              type: 'file',
              size: 744,
            },
            {
              name: 'figma-design-to-code/SKILL.md',
              path: '.codex/skills/figma-design-to-code/SKILL.md',
              type: 'file',
              size: 680,
            },
            {
              name: 'linear-triage/SKILL.md',
              path: '.codex/skills/linear-triage/SKILL.md',
              type: 'file',
              size: 700,
            },
            {
              name: 'cloud-deploy/SKILL.md',
              path: '.codex/skills/cloud-deploy/SKILL.md',
              type: 'file',
              size: 642,
            },
          ],
        },
      ],
    },
    {
      name: 'electron',
      path: 'electron',
      type: 'directory',
      children: [
        { name: 'main.cjs', path: 'electron/main.cjs', type: 'file', size: 3545 },
        { name: 'preload.cjs', path: 'electron/preload.cjs', type: 'file', size: 762 },
      ],
    },
    {
      name: 'server',
      path: 'server',
      type: 'directory',
      children: [{ name: 'app-server.mjs', path: 'server/app-server.mjs', type: 'file', size: 11183 }],
    },
    {
      name: 'src',
      path: 'src',
      type: 'directory',
      children: [
        { name: 'App.tsx', path: 'src/App.tsx', type: 'file', size: 18420 },
        { name: 'types/codex.ts', path: 'src/types/codex.ts', type: 'file', size: 5992 },
        {
          name: 'services/appServerClient.ts',
          path: 'src/services/appServerClient.ts',
          type: 'file',
          size: 9200,
        },
        {
          name: 'components/TopCommandBar.tsx',
          path: 'src/components/TopCommandBar.tsx',
          type: 'file',
          size: 7400,
        },
        {
          name: 'components/LeftSidebar.tsx',
          path: 'src/components/LeftSidebar.tsx',
          type: 'file',
          size: 11200,
        },
        {
          name: 'components/CenterThreadView.tsx',
          path: 'src/components/CenterThreadView.tsx',
          type: 'file',
          size: 19600,
        },
        {
          name: 'components/RightInspectorPane.tsx',
          path: 'src/components/RightInspectorPane.tsx',
          type: 'file',
          size: 24500,
        },
        {
          name: 'components/MainFeatureViews.tsx',
          path: 'src/components/MainFeatureViews.tsx',
          type: 'file',
          size: 22100,
        },
      ],
    },
    { name: 'AGENTS.md', path: 'AGENTS.md', type: 'file', size: 1375 },
    { name: 'CODEX_DESKTOP_PLAN.md', path: 'CODEX_DESKTOP_PLAN.md', type: 'file', size: 9191 },
    { name: 'package.json', path: 'package.json', type: 'file', size: 1047 },
  ];
}

const FALLBACK_FILE_CONTENTS: Record<string, string> = {
  'AGENTS.md': `# AGENTS.md — Codex Workspace Rules & Subagent Guidelines\n\n## 1. Repository Overview\nThis repository (\`codex-desktop-app\`) implements the **OpenAI Codex Desktop App ("Command Center for Agents")** using Electron, React 19, TypeScript, Tailwind CSS, and a bidirectional JSON-RPC 2.0 Lite \`app-server\` harness.\n\n## 2. Subagent Routing\n- \`explorer\`: Fast read-only codebase indexing and symbol search.\n- \`worker\`: Isolated code implementation and test generation in Git worktrees.\n- \`default\`: Primary orchestrator that coordinates subagents and reviews diffs.\n`,
  '.codex/config.toml': `# OpenAI Codex Configuration (.codex/config.toml)\nmodel = "gpt-6.1-sol"\npersonality = "pragmatic"\nreasoning_effort = "high"\n\n[sandbox]\nmode = "workspace-write"\nnetwork_access = false\napproval_policy = "on-risk"\n\n[agents]\nenable_subagents = true\nmax_concurrent_threads_per_session = 6\n`,
  'package.json': `{\n  "name": "codex-desktop-app",\n  "version": "1.0.0",\n  "description": "OpenAI Codex Desktop App — Multi-Agent Command Center"\n}\n`,
};

export async function readWorkspaceFile(filePath: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/fs/read?path=${encodeURIComponent(filePath)}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.content === 'string') return data.content;
    }
  } catch {
    // Fallback
  }
  return (
    FALLBACK_FILE_CONTENTS[filePath] ||
    `// File: ${filePath}\n// Loaded in Codex Workspace Explorer\n// Connect to local app-server (npm run server) for live disk sync.\n`
  );
}

export async function writeWorkspaceFile(filePath: string, content: string): Promise<boolean> {
  FALLBACK_FILE_CONTENTS[filePath] = content;
  try {
    const res = await fetch(`${API_BASE}/api/fs/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return true;
  }
}

export async function executeTerminalCommand(
  command: string,
  cwd?: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/terminal/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback simulated shell output for offline/browser preview
  }

  const trimmed = command.trim();
  if (trimmed === 'git status' || trimmed === 'git status --short') {
    return {
      exitCode: 0,
      stdout: `On branch main\nYour branch is ahead of 'origin/main' by 2 commits.\n\nChanges not staged for commit:\n  modified:   src/components/RightInspectorPane.tsx\n  modified:   server/app-server.mjs\n`,
      stderr: '',
    };
  }
  if (trimmed.startsWith('git worktree list')) {
    return {
      exitCode: 0,
      stdout: `/Users/zhangjinhui/Desktop/codex-test                                  a8f4c21 [main]\n/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/jsonrpc-app-server  e91d04b [feat/jsonrpc-app-server]\n/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/dark-glass-ui       7c3b910 [feat/dark-glass-ui]\n/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/voxel-drift-boost   3f92a7c [feat/drift-boost-tiers]\n`,
      stderr: '',
    };
  }
  if (trimmed.startsWith('codex')) {
    return {
      exitCode: 0,
      stdout: `codex-cli 0.160.0 (app-server protocol v2, JSON-RPC 2.0 Lite over stdio/ws)\nActive models: gpt-6.1-sol (default), gpt-6-luna (explorer), gpt-5.3-codex\nSubagents enabled: default, worker, explorer\n`,
      stderr: '',
    };
  }

  return {
    exitCode: 0,
    stdout: `[codex-sandbox-shell] Executed: ${command}\nExit status: 0 (OK)\n`,
    stderr: '',
  };
}

export interface StreamTurnCallbacks {
  onItemAdded: (item: TurnItem) => void;
  onItemUpdated: (itemId: string, updater: (prev: TurnItem) => TurnItem) => void;
  onDiffGenerated: (fileDiff: FileDiff) => void;
  onTurnStatusChange: (status: 'in_progress' | 'waiting_approval' | 'completed' | 'interrupted') => void;
  onRpcLog: (entry: JsonRpcLogEntry) => void;
}

export function runInteractiveAgentTurn(params: {
  threadId: string;
  turnId: string;
  prompt: string;
  attachedFiles: string[];
  invokedSkills: string[];
  model: ModelId;
  personality: PersonalityMode;
  reasoningEffort: ReasoningEffort;
  subagent: string;
  worktreeBranch: string;
  sandboxPolicy: SandboxPolicy;
  callbacks: StreamTurnCallbacks;
}): { interrupt: () => void } {
  let cancelled = false;
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  const schedule = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      if (!cancelled) fn();
    }, ms);
    timers.push(t);
  };

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

  const reasoningId = `item_reason_${Date.now()}`;
  const subagentId = `item_sub_${Date.now()}`;
  const cmdId = `item_cmd_${Date.now()}`;
  const fileChangeId = `item_diff_${Date.now()}`;
  const approvalId = `item_appr_${Date.now()}`;
  const msgId = `item_msg_${Date.now()}`;

  const needsApproval =
    params.sandboxPolicy.approvalPolicy === 'always-ask' ||
    (params.sandboxPolicy.approvalPolicy === 'on-risk' &&
      /deploy|install|curl|fetch|network|port|ws:\/\/|http|rm |docker/i.test(params.prompt));

  schedule(180, () => {
    const item: TurnItem = {
      id: reasoningId,
      type: 'reasoning',
      status: 'streaming',
      timestamp: nowTime(),
      durationSeconds: 1,
      reasoningSteps: [
        `Parsing task intent with ${params.model} (effort: ${params.reasoningEffort}, worktree: ${params.worktreeBranch})...`,
      ],
    };
    params.callbacks.onItemAdded(item);
    logNotification('item/started', { threadId: params.threadId, turnId: params.turnId, item });
  });

  schedule(750, () => {
    params.callbacks.onItemUpdated(reasoningId, (prev) => ({
      ...prev,
      durationSeconds: 3,
      reasoningSteps: [
        ...(prev.reasoningSteps || []),
        params.invokedSkills.length > 0
          ? `Loaded skill bundle $${params.invokedSkills.join(', $')} and mapped target files.`
          : `Inspected workspace boundaries and AGENTS.md rules for branch ${params.worktreeBranch}.`,
      ],
    }));
  });

  schedule(1350, () => {
    params.callbacks.onItemUpdated(reasoningId, (prev) => ({
      ...prev,
      status: 'completed',
      durationSeconds: 4,
      reasoningSteps: [
        ...(prev.reasoningSteps || []),
        `Formulated execution plan and delegated reconnaissance to \`${params.subagent === 'default' ? 'explorer' : params.subagent}\` subagent.`,
      ],
    }));
    logNotification('item/completed', { itemId: reasoningId });

    const subItem: TurnItem = {
      id: subagentId,
      type: 'subagentRun',
      status: 'completed',
      timestamp: nowTime(),
      subagentName: params.subagent === 'default' ? 'explorer' : params.subagent,
      subagentTask: `Analyze AST & dependencies for "${params.prompt.slice(0, 56)}${params.prompt.length > 56 ? '...' : ''}"`,
      subagentTokens: '4.8k tokens',
    };
    params.callbacks.onItemAdded(subItem);
    logNotification('item/completed', { item: subItem });
  });

  if (needsApproval) {
    schedule(1900, () => {
      const apprItem: TurnItem = {
        id: approvalId,
        type: 'approvalRequest',
        status: 'waiting_approval',
        timestamp: nowTime(),
        approvalId: `appr_${Date.now()}`,
        approvalCommand: params.invokedSkills.includes('cloud-deploy')
          ? 'npx wrangler pages deploy dist --project-name codex-desktop'
          : 'npm run build && node server/app-server.mjs --listen ws://127.0.0.1:4500',
        approvalReason:
          'Command requests network/socket access or external deployment under `workspace-write` sandbox policy.',
        riskLevel: 'medium',
        sandboxRuleTriggered: `sandbox.mode = "${params.sandboxPolicy.mode}", approval_policy = "${params.sandboxPolicy.approvalPolicy}"`,
      };
      params.callbacks.onItemAdded(apprItem);
      params.callbacks.onTurnStatusChange('waiting_approval');
      params.callbacks.onRpcLog({
        id: `rpc_${Date.now()}`,
        timestamp: nowTime() + '.000',
        direction: 'server-request',
        method: 'approval/request',
        payload: {
          id: ++rpcRequestId,
          method: 'approval/request',
          params: {
            threadId: params.threadId,
            turnId: params.turnId,
            itemId: approvalId,
            command: apprItem.approvalCommand,
          },
        },
      });
    });

    return {
      interrupt: () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      },
    };
  }

  schedule(1950, () => {
    const cmdItem: TurnItem = {
      id: cmdId,
      type: 'commandExecution',
      status: 'completed',
      timestamp: nowTime(),
      command: 'npx tsc --noEmit && git diff --stat',
      cwd: '/Users/zhangjinhui/Desktop/codex-test',
      exitCode: 0,
      stdout: 'TypeScript check: 0 errors.\n2 files changed, 34 insertions(+), 5 deletions(-)',
    };
    params.callbacks.onItemAdded(cmdItem);
    logNotification('item/completed', { item: cmdItem });
  });

  schedule(2500, () => {
    const targetFile = params.attachedFiles[0] || 'src/components/CenterThreadView.tsx';
    const fcItem: TurnItem = {
      id: fileChangeId,
      type: 'fileChange',
      status: 'completed',
      timestamp: nowTime(),
      filePath: targetFile,
      changeType: 'modified',
      additions: 28,
      deletions: 4,
      summary: `Updated ${targetFile} in worktree (${params.worktreeBranch}) to fulfill request.`,
    };
    params.callbacks.onItemAdded(fcItem);

    const generatedDiff: FileDiff = {
      id: `diff_gen_${Date.now()}`,
      filePath: targetFile,
      status: 'modified',
      additions: 28,
      deletions: 4,
      staged: false,
      language: 'tsx',
      comments: [],
      hunks: [
        {
          id: `hunk_gen_${Date.now()}`,
          header: `@@ -42,6 +42,16 @@ // Codex Agent Patch (${params.worktreeBranch})`,
          staged: false,
          lines: [
            {
              type: 'context',
              oldLineNumber: 42,
              newLineNumber: 42,
              content: '  // Applied by Codex Agent (' + params.model + ')',
            },
            { type: 'del', oldLineNumber: 43, content: '  const status = "pending";' },
            { type: 'add', newLineNumber: 43, content: `  // Task: ${params.prompt.slice(0, 62)}` },
            { type: 'add', newLineNumber: 44, content: '  const status = "verified_in_worktree";' },
            { type: 'add', newLineNumber: 45, content: '  const worktreeIsolated = true;' },
            {
              type: 'context',
              oldLineNumber: 44,
              newLineNumber: 46,
              content: '  return { status, worktreeIsolated };',
            },
          ],
        },
      ],
    };
    params.callbacks.onDiffGenerated(generatedDiff);
    logNotification('item/completed', { item: fcItem });
  });

  const responseText =
    params.personality === 'pragmatic'
      ? `Completed in worktree \`${params.worktreeBranch}\` using **${params.model}**.\n\n- **Changes**: Patched \`${params.attachedFiles[0] || 'src/components/CenterThreadView.tsx'}\` (+28 -4) and verified zero TypeScript regressions.\n- **Review**: Inspect the hunk in the **Diff Review** panel on the right to comment, stage, or merge into \`main\`.`
      : `I've completed that update for you inside the isolated \`${params.worktreeBranch}\` worktree so your main checkout stays completely clean!\n\n- **What changed**: Updated \`${params.attachedFiles[0] || 'src/components/CenterThreadView.tsx'}\` (+28 -4) and ran \`npx tsc --noEmit\` to confirm everything compiles cleanly.\n- **Next step**: Feel free to inspect the live diff in the right-hand **Diff Review** panel, leave inline comments on any line, or test it directly in **Live Preview**.`;

  const chunks = responseText.match(/.{1,24}/g) || [responseText];

  schedule(2950, () => {
    const startMsg: TurnItem = {
      id: msgId,
      type: 'agentMessage',
      status: 'streaming',
      timestamp: nowTime(),
      text: '',
    };
    params.callbacks.onItemAdded(startMsg);
    logNotification('item/started', { itemId: msgId, type: 'agentMessage' });
  });

  chunks.forEach((chunk, index) => {
    schedule(3050 + index * 90, () => {
      params.callbacks.onItemUpdated(msgId, (prev) => ({
        ...prev,
        text: (prev.text || '') + chunk,
      }));
      if (index % 3 === 0) {
        logNotification('item/agentMessage/delta', { itemId: msgId, delta: chunk });
      }
    });
  });

  schedule(3150 + chunks.length * 90, () => {
    params.callbacks.onItemUpdated(msgId, (prev) => ({
      ...prev,
      status: 'completed',
    }));
    params.callbacks.onTurnStatusChange('completed');
    logNotification('turn/completed', {
      threadId: params.threadId,
      turnId: params.turnId,
      status: 'completed',
    });
  });

  return {
    interrupt: () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    },
  };
}
