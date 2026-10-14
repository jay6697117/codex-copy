import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AutomationJob,
  CodexSurface,
  FileDiff,
  FileTreeNode,
  JsonRpcLogEntry,
  NavSection,
  ProjectWorkspace,
  ReviewQueueItem,
  RightPanelTab,
  SandboxPolicy,
  SkillDefinition,
  SubagentConfig,
  Thread,
  Turn,
  TurnItem,
  WorkspaceLayoutMode,
  WorktreeInfo,
} from './types/codex';
import {
  INITIAL_AUTOMATIONS,
  INITIAL_PROJECTS,
  INITIAL_REVIEW_QUEUE,
  INITIAL_RPC_LOGS,
  INITIAL_SANDBOX_POLICY,
  INITIAL_SKILLS,
  INITIAL_SUBAGENTS,
  INITIAL_THREADS,
  INITIAL_WORKTREES,
} from './data/initialCodexData';
import {
  checkAppServerHealth,
  fetchWorkspaceFileTree,
  readWorkspaceFile,
  runInteractiveAgentTurn,
  sendJsonRpcRequest,
} from './services/appServerClient';
import { TopCommandBar } from './components/TopCommandBar';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterThreadView } from './components/CenterThreadView';
import { RightInspectorPane } from './components/RightInspectorPane';
import { MainFeatureViews } from './components/MainFeatureViews';
import { CommandPaletteModal, RpcInspectorModal } from './components/Modals';

export function App() {
  const [surface, setSurface] = useState<CodexSurface>('codex');
  const [activeNav, setActiveNav] = useState<NavSection>('threads');
  const [rightTab, setRightTab] = useState<RightPanelTab>('diff');
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>('standard');

  const [projects, setProjects] = useState<ProjectWorkspace[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_PROJECTS[0].id);
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>(INITIAL_WORKTREES);
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [activeThreadId, setActiveThreadId] = useState<string>(INITIAL_THREADS[0].id);

  const [skills, setSkills] = useState<SkillDefinition[]>(INITIAL_SKILLS);
  const [automations, setAutomations] = useState<AutomationJob[]>(INITIAL_AUTOMATIONS);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(INITIAL_REVIEW_QUEUE);
  const [subagents, setSubagents] = useState<SubagentConfig[]>(INITIAL_SUBAGENTS);
  const [sandboxPolicy, setSandboxPolicy] = useState<SandboxPolicy>(INITIAL_SANDBOX_POLICY);
  const [rpcLogs, setRpcLogs] = useState<JsonRpcLogEntry[]>(INITIAL_RPC_LOGS);

  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [agentsMdContent, setAgentsMdContent] = useState<string>('');
  const [selectedDiffFile, setSelectedDiffFile] = useState<string>(
    INITIAL_THREADS[0].changedFiles[0]?.filePath || ''
  );

  const [appServerConnected, setAppServerConnected] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isRpcInspectorOpen, setIsRpcInspectorOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeTurnInterruptRef = useRef<Record<string, () => void>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const appendRpcLog = (entry: JsonRpcLogEntry) => {
    setRpcLogs((prev) => [entry, ...prev.slice(0, 120)]);
  };

  // Initial handshake & workspace discovery
  useEffect(() => {
    checkAppServerHealth().then((status) => {
      setAppServerConnected(status.connected);
      sendJsonRpcRequest(
        'initialize',
        {
          clientInfo: {
            name: 'codex_desktop',
            title: 'OpenAI Codex Desktop App',
            version: '1.0.0',
          },
          capabilities: { experimentalApi: true },
        },
        appendRpcLog
      );
    });

    fetchWorkspaceFileTree().then(setFileTree);
    readWorkspaceFile('AGENTS.md').then(setAgentsMdContent);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );

  const activeWorktree = useMemo(
    () => worktrees.find((w) => w.id === activeThread.worktreeId) || worktrees[0],
    [worktrees, activeThread]
  );

  const flatWorkspaceFiles = useMemo(() => {
    const list: string[] = [];
    const walk = (nodes: FileTreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'file') list.push(n.path);
        else if (n.children) walk(n.children);
      }
    };
    walk(fileTree);
    return list.length > 0
      ? list
      : [
          'AGENTS.md',
          '.codex/config.toml',
          'src/App.tsx',
          'src/components/CenterThreadView.tsx',
          'src/components/RightInspectorPane.tsx',
          'server/app-server.mjs',
        ];
  }, [fileTree]);

  const runningThreadsCount = threads.filter((t) => t.status === 'running').length;
  const waitingApprovalCount = threads.filter(
    (t) => t.status === 'waiting_approval'
  ).length;
  const pendingReviewCount = reviewQueue.filter(
    (r) => r.status === 'pending_review'
  ).length;

  // Helper to mutate a specific thread
  const updateThread = (threadId: string, updater: (t: Thread) => Thread) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? updater(t) : t)));
  };

  // Start a streaming turn on a given thread
  const startStreamingTurnOnThread = (
    targetThread: Thread,
    prompt: string,
    attachedFiles: string[] = [],
    invokedSkills: string[] = []
  ) => {
    const turnId = `turn_${Date.now().toString(36)}`;
    const nowTime = new Date().toTimeString().split(' ')[0];

    const userItem: TurnItem = {
      id: `item_usr_${Date.now()}`,
      type: 'userMessage',
      status: 'completed',
      timestamp: nowTime,
      text: prompt,
      attachedFiles,
      invokedSkills,
    };

    const newTurn: Turn = {
      id: turnId,
      threadId: targetThread.id,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      model: targetThread.model,
      personality: targetThread.personality,
      reasoningEffort: targetThread.reasoningEffort,
      items: [userItem],
    };

    updateThread(targetThread.id, (t) => ({
      ...t,
      status: 'running',
      updatedAt: 'Just now',
      turns: [...t.turns, newTurn],
    }));

    sendJsonRpcRequest(
      'turn/start',
      {
        threadId: targetThread.id,
        model: targetThread.model,
        personality: targetThread.personality,
        input: [{ type: 'text', text: prompt }],
      },
      appendRpcLog
    );

    const controller = runInteractiveAgentTurn({
      threadId: targetThread.id,
      turnId,
      prompt,
      attachedFiles,
      invokedSkills,
      model: targetThread.model,
      personality: targetThread.personality,
      reasoningEffort: targetThread.reasoningEffort,
      subagent: targetThread.subagent,
      worktreeBranch: targetThread.branch,
      sandboxPolicy,
      callbacks: {
        onItemAdded: (item) => {
          updateThread(targetThread.id, (t) => ({
            ...t,
            turns: t.turns.map((tr) =>
              tr.id === turnId ? { ...tr, items: [...tr.items, item] } : tr
            ),
          }));
        },
        onItemUpdated: (itemId, itemUpdater) => {
          updateThread(targetThread.id, (t) => ({
            ...t,
            turns: t.turns.map((tr) =>
              tr.id === turnId
                ? {
                    ...tr,
                    items: tr.items.map((it) => (it.id === itemId ? itemUpdater(it) : it)),
                  }
                : tr
            ),
          }));
        },
        onDiffGenerated: (fileDiff) => {
          updateThread(targetThread.id, (t) => {
            const existingIdx = t.changedFiles.findIndex(
              (f) => f.filePath === fileDiff.filePath
            );
            const nextFiles =
              existingIdx >= 0
                ? t.changedFiles.map((f, idx) => (idx === existingIdx ? fileDiff : f))
                : [fileDiff, ...t.changedFiles];
            const totalAdd = nextFiles.reduce((s, f) => s + f.additions, 0);
            const totalDel = nextFiles.reduce((s, f) => s + f.deletions, 0);
            return {
              ...t,
              changedFiles: nextFiles,
              diffSummary: {
                files: nextFiles.length,
                additions: totalAdd,
                deletions: totalDel,
              },
            };
          });
          setSelectedDiffFile(fileDiff.filePath);
        },
        onTurnStatusChange: (status) => {
          updateThread(targetThread.id, (t) => ({
            ...t,
            status:
              status === 'waiting_approval'
                ? 'waiting_approval'
                : status === 'in_progress'
                ? 'running'
                : 'completed',
            turns: t.turns.map((tr) => (tr.id === turnId ? { ...tr, status } : tr)),
          }));
        },
        onRpcLog: appendRpcLog,
      },
    });

    activeTurnInterruptRef.current[targetThread.id] = controller.interrupt;
  };

  // Create a new thread (optionally isolated in a new Git worktree)
  const handleCreateNewThread = (projectId?: string, quickChat = false) => {
    const targetProjId = projectId || activeProject.id;
    const slug = Math.random().toString(36).slice(2, 6);
    const branchName = quickChat ? 'main' : `feat/agent-task-${slug}`;
    const wtId = `wt_${Date.now()}`;

    if (!quickChat) {
      const newWt: WorktreeInfo = {
        id: wtId,
        projectId: targetProjId,
        name: `wt/agent-task-${slug}`,
        branch: branchName,
        path: `/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/agent-task-${slug}`,
        headCommit: 'a8f4c21',
        isMain: false,
        status: 'clean',
        ahead: 0,
        behind: 0,
        changedFilesCount: 0,
        additions: 0,
        deletions: 0,
        createdAt: new Date().toISOString(),
      };
      setWorktrees((prev) => [newWt, ...prev]);
    }

    const newThread: Thread = {
      id: `thr_${Date.now()}`,
      projectId: targetProjId,
      title: quickChat ? 'Quick Chat Session' : `Agent Task (${branchName})`,
      pinned: false,
      status: 'completed',
      worktreeId: quickChat ? 'wt_main' : wtId,
      branch: branchName,
      model: quickChat ? 'gpt-6-luna' : 'gpt-6.1-sol',
      personality: 'pragmatic',
      reasoningEffort: quickChat ? 'low' : 'high',
      subagent: quickChat ? 'explorer' : 'default',
      updatedAt: 'Just now',
      tokenUsage: '0.4k tokens',
      diffSummary: { files: 0, additions: 0, deletions: 0 },
      turns: [],
      changedFiles: [],
    };

    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setActiveNav('threads');
    sendJsonRpcRequest(
      'thread/start',
      { model: newThread.model, cwd: '/Users/zhangjinhui/Desktop/codex-test' },
      appendRpcLog
    );
    showToast(
      quickChat
        ? 'Started Quick Chat thread (GPT-6 Luna)'
        : `Created thread with isolated worktree ${branchName}`
    );
  };

  // Batch Spawn 3 Parallel Agents in Isolated Worktrees!
  const handleSpawnParallelAgents = () => {
    const specs = [
      {
        title: 'Agent A: Refactor JSON-RPC transport & backpressure queue',
        branch: 'wt/parallel-refactor-rpc',
        subagent: 'worker',
        prompt: 'Refactor server/app-server.mjs JSON-RPC ingress queue and add typed error codes.',
        file: 'server/app-server.mjs',
      },
      {
        title: 'Agent B: Generate unit & replay tests for thread/fork',
        branch: 'wt/parallel-tests-fork',
        subagent: 'worker',
        prompt: 'Write comprehensive unit tests for thread/fork and turn/steer lifecycle events.',
        file: 'src/services/appServerClient.ts',
      },
      {
        title: 'Agent C: Audit AGENTS.md & update architecture docs',
        branch: 'wt/parallel-docs-sync',
        subagent: 'explorer',
        prompt: 'Audit repository documentation and update AGENTS.md with new worktree guidelines.',
        file: 'AGENTS.md',
      },
    ];

    const createdThreads: Thread[] = [];
    const createdWorktrees: WorktreeInfo[] = [];

    specs.forEach((spec, idx) => {
      const wtId = `wt_par_${Date.now()}_${idx}`;
      const thrId = `thr_par_${Date.now()}_${idx}`;
      createdWorktrees.push({
        id: wtId,
        projectId: activeProject.id,
        name: spec.branch,
        branch: spec.branch,
        path: `/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/${spec.branch.replace('wt/', '')}`,
        headCommit: 'a8f4c21',
        isMain: false,
        status: 'running',
        boundThreadId: thrId,
        ahead: 1,
        behind: 0,
        changedFilesCount: 1,
        additions: 28,
        deletions: 4,
        createdAt: new Date().toISOString(),
      });

      createdThreads.push({
        id: thrId,
        projectId: activeProject.id,
        title: spec.title,
        pinned: true,
        status: 'running',
        worktreeId: wtId,
        branch: spec.branch,
        model: 'gpt-6.1-sol',
        personality: 'pragmatic',
        reasoningEffort: 'high',
        subagent: spec.subagent,
        updatedAt: 'Running now',
        tokenUsage: '8.1k tokens',
        diffSummary: { files: 0, additions: 0, deletions: 0 },
        turns: [],
        changedFiles: [],
      });
    });

    setWorktrees((prev) => [...createdWorktrees, ...prev]);
    setThreads((prev) => [...createdThreads, ...prev]);
    setActiveNav('threads');
    setActiveThreadId(createdThreads[0].id);

    // Kick off all 3 agent turns in parallel
    createdThreads.forEach((thr, idx) => {
      setTimeout(() => {
        startStreamingTurnOnThread(thr, specs[idx].prompt, [specs[idx].file], []);
      }, idx * 220);
    });

    showToast('Launched 3 parallel Codex agents in isolated Git worktrees!');
  };

  // Send message from CenterThreadView composer
  const handleSendMessage = (params: {
    prompt: string;
    attachedFiles: string[];
    invokedSkills: string[];
    createNewWorktree?: boolean;
  }) => {
    let targetThread = activeThread;
    if (params.createNewWorktree) {
      const slug = Math.random().toString(36).slice(2, 6);
      const branch = `feat/wt-${slug}`;
      const wtId = `wt_${Date.now()}`;
      setWorktrees((prev) => [
        {
          id: wtId,
          projectId: activeProject.id,
          name: `wt/${branch}`,
          branch,
          path: `/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/wt-${slug}`,
          headCommit: 'a8f4c21',
          isMain: false,
          status: 'running',
          boundThreadId: activeThread.id,
          ahead: 1,
          behind: 0,
          changedFilesCount: 1,
          additions: 0,
          deletions: 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      targetThread = { ...activeThread, worktreeId: wtId, branch };
      updateThread(activeThread.id, (t) => ({ ...t, worktreeId: wtId, branch }));
    }

    startStreamingTurnOnThread(
      targetThread,
      params.prompt,
      params.attachedFiles,
      params.invokedSkills
    );
  };

  // Mid-Turn Steering (turn/steer)
  const handleSteerTurn = (steerText: string) => {
    const nowTime = new Date().toTimeString().split(' ')[0];
    const steerItem: TurnItem = {
      id: `item_steer_${Date.now()}`,
      type: 'steerMessage',
      status: 'completed',
      timestamp: nowTime,
      text: steerText,
    };

    updateThread(activeThread.id, (t) => {
      const lastTurn = t.turns[t.turns.length - 1];
      if (!lastTurn) return t;
      return {
        ...t,
        turns: t.turns.map((tr) =>
          tr.id === lastTurn.id ? { ...tr, items: [...tr.items, steerItem] } : tr
        ),
      };
    });

    sendJsonRpcRequest(
      'turn/steer',
      {
        threadId: activeThread.id,
        input: [{ type: 'text', text: steerText }],
      },
      appendRpcLog
    );
    showToast('Injected mid-turn steering instruction (turn/steer)');
  };

  // Interrupt active turn (turn/interrupt)
  const handleInterruptTurn = () => {
    activeTurnInterruptRef.current[activeThread.id]?.();
    updateThread(activeThread.id, (t) => ({
      ...t,
      status: 'completed',
      turns: t.turns.map((tr, idx) =>
        idx === t.turns.length - 1 ? { ...tr, status: 'interrupted' } : tr
      ),
    }));
    sendJsonRpcRequest('turn/interrupt', { threadId: activeThread.id }, appendRpcLog);
    showToast('Interrupted active turn (turn/interrupt)');
  };

  // Respond to Server-Initiated Approval Request (Allow Once / Always Allow / Deny)
  const handleRespondApproval = (
    turnId: string,
    itemId: string,
    decision: 'allow_once' | 'allow_always' | 'deny',
    command?: string
  ) => {
    const nowTime = new Date().toTimeString().split(' ')[0];

    if (decision === 'allow_always' && command) {
      setSandboxPolicy((prev) => ({
        ...prev,
        allowedCommands: Array.from(new Set([...prev.allowedCommands, command])),
      }));
    }

    updateThread(activeThread.id, (t) => ({
      ...t,
      status: 'completed',
      turns: t.turns.map((tr) => {
        if (tr.id !== turnId) return tr;
        const updatedItems = tr.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                status: decision === 'deny' ? ('denied' as const) : ('completed' as const),
                decision,
              }
            : it
        );

        const followUpItems: TurnItem[] =
          decision === 'deny'
            ? [
                {
                  id: `item_post_appr_${Date.now()}`,
                  type: 'agentMessage',
                  status: 'completed',
                  timestamp: nowTime,
                  text: 'Understood — I skipped the restricted command and kept all changes strictly within the local worktree.',
                },
              ]
            : [
                {
                  id: `item_cmd_appr_${Date.now()}`,
                  type: 'commandExecution',
                  status: 'completed',
                  timestamp: nowTime,
                  command: command || 'node server/app-server.mjs --listen ws://127.0.0.1:4500',
                  exitCode: 0,
                  stdout:
                    '[codex app-server] capability-token verified (SHA-256 match).\nGET /readyz -> 200 OK\nGET /healthz -> 200 OK\nAll 14 WebSocket JSON-RPC handshake assertions passed.',
                },
                {
                  id: `item_msg_appr_${Date.now()}`,
                  type: 'agentMessage',
                  status: 'completed',
                  timestamp: nowTime,
                  text: 'Approval received! Executed the WebSocket capability-token probe against `ws://127.0.0.1:4500` — all 14 handshake and backpressure assertions passed. Diffs are ready for review in the right panel.',
                },
              ];

        return {
          ...tr,
          status: 'completed',
          completedAt: new Date().toISOString(),
          items: [...updatedItems, ...followUpItems],
        };
      }),
    }));

    sendJsonRpcRequest(
      'approval/respond',
      { threadId: activeThread.id, turnId, itemId, decision },
      appendRpcLog
    );
    showToast(
      decision === 'deny'
        ? 'Command denied; agent continued safely in sandbox'
        : 'Command approved and executed in sandbox'
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#090A0F] text-[#ECECF1]">
      {/* Top macOS/Windows Command Header */}
      <TopCommandBar
        surface={surface}
        onSurfaceChange={(s) => {
          setSurface(s);
          showToast(`Switched surface view to ${s.toUpperCase()}`);
        }}
        activeProject={activeProject}
        projects={projects}
        onSelectProject={setActiveProjectId}
        activeWorktree={activeWorktree}
        runningThreadsCount={runningThreadsCount}
        waitingApprovalCount={waitingApprovalCount}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        appServerConnected={appServerConnected}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenRpcInspector={() => setIsRpcInspectorOpen(true)}
        onSpawnParallelAgents={handleSpawnParallelAgents}
        rpcLogCount={rpcLogs.length}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-[#161C2C] border border-emerald-500/50 text-xs font-medium text-emerald-200 shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Workbench Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Navigation & Threads Sidebar */}
        {layoutMode !== 'review_zen' && (
          <LeftSidebar
            activeNav={activeNav}
            onSelectNav={setActiveNav}
            projects={projects}
            onToggleProjectExpand={(projId) =>
              setProjects((prev) =>
                prev.map((p) => (p.id === projId ? { ...p, expanded: !p.expanded } : p))
              )
            }
            threads={threads}
            activeThreadId={activeThread.id}
            onSelectThread={(id) => {
              setActiveThreadId(id);
              const target = threads.find((t) => t.id === id);
              if (target?.changedFiles[0]) {
                setSelectedDiffFile(target.changedFiles[0].filePath);
              }
            }}
            onCreateNewThread={handleCreateNewThread}
            onSpawnParallelAgents={handleSpawnParallelAgents}
            pendingReviewCount={pendingReviewCount}
            skillsCount={skills.length}
            automationsCount={automations.length}
            worktrees={worktrees}
            subagentsCount={subagents.length}
          />
        )}

        {/* Center + Right Area: Either Active Thread Workbench OR Platform Feature Views */}
        {activeNav === 'threads' ? (
          <>
            <CenterThreadView
              thread={activeThread}
              worktrees={worktrees}
              skills={skills}
              subagents={subagents}
              workspaceFiles={flatWorkspaceFiles}
              onTogglePin={(id) =>
                updateThread(id, (t) => ({ ...t, pinned: !t.pinned }))
              }
              onForkThread={(id) => {
                const forked: Thread = {
                  ...activeThread,
                  id: `thr_fork_${Date.now()}`,
                  title: `${activeThread.title} (Fork)`,
                  branch: `${activeThread.branch}-fork`,
                  updatedAt: 'Just now',
                };
                setThreads((prev) => [forked, ...prev]);
                setActiveThreadId(forked.id);
                sendJsonRpcRequest('thread/fork', { sourceThreadId: id }, appendRpcLog);
                showToast('Forked conversation into a new branch thread (thread/fork)');
              }}
              onRevertThread={(id) => {
                updateThread(id, (t) => ({
                  ...t,
                  turns: t.turns.length > 1 ? t.turns.slice(0, -1) : t.turns,
                }));
                sendJsonRpcRequest('thread/revert', { threadId: id }, appendRpcLog);
                showToast('Reverted latest turn via thread/revert');
              }}
              onOpenInEditor={() => {
                const electronBridge = (window as unknown as { codexElectron?: { openInEditor?: (p: string) => void } }).codexElectron;
                if (electronBridge?.openInEditor) {
                  electronBridge.openInEditor(activeProject.repoPath);
                }
                showToast(`Opened ${activeProject.repoPath} in external editor`);
              }}
              onSelectDiffFile={(filePath) => {
                setSelectedDiffFile(filePath);
                setRightTab('diff');
                if (layoutMode === 'focus_chat') setLayoutMode('standard');
              }}
              onUpdateThreadConfig={(id, patch) =>
                updateThread(id, (t) => ({ ...t, ...patch }))
              }
              onSendMessage={handleSendMessage}
              onSteerTurn={handleSteerTurn}
              onInterruptTurn={handleInterruptTurn}
              onRespondApproval={handleRespondApproval}
            />

            {layoutMode !== 'focus_chat' && (
              <RightInspectorPane
                activeTab={rightTab}
                onTabChange={setRightTab}
                layoutMode={layoutMode}
                thread={activeThread}
                selectedDiffFile={selectedDiffFile}
                onSelectDiffFile={setSelectedDiffFile}
                fileTree={fileTree}
                worktrees={worktrees}
                onToggleStageFile={(filePath) =>
                  updateThread(activeThread.id, (t) => ({
                    ...t,
                    changedFiles: t.changedFiles.map((f) =>
                      f.filePath === filePath ? { ...f, staged: !f.staged } : f
                    ),
                  }))
                }
                onRevertFileDiff={(filePath) => {
                  updateThread(activeThread.id, (t) => {
                    const remaining = t.changedFiles.filter(
                      (f) => f.filePath !== filePath
                    );
                    return {
                      ...t,
                      changedFiles: remaining,
                      diffSummary: {
                        files: remaining.length,
                        additions: remaining.reduce((s, f) => s + f.additions, 0),
                        deletions: remaining.reduce((s, f) => s + f.deletions, 0),
                      },
                    };
                  });
                  showToast(`Reverted changes in ${filePath}`);
                }}
                onAddInlineComment={(filePath, lineNumber, body) => {
                  updateThread(activeThread.id, (t) => ({
                    ...t,
                    changedFiles: t.changedFiles.map((f) =>
                      f.filePath === filePath
                        ? {
                            ...f,
                            comments: [
                              ...f.comments,
                              {
                                id: `cmt_${Date.now()}`,
                                filePath,
                                lineNumber,
                                side: 'new',
                                author: 'zhangjinhui',
                                body,
                                createdAt: 'Just now',
                              },
                            ],
                          }
                        : f
                    ),
                  }));
                  showToast(`Added inline diff comment on ${filePath}:${lineNumber}`);
                }}
                onSubmitInlineReviewToAgent={() => {
                  const allComments = activeThread.changedFiles.flatMap((f) =>
                    f.comments.map((c) => `[${c.filePath}:${c.lineNumber}] ${c.body}`)
                  );
                  if (allComments.length === 0) return;
                  startStreamingTurnOnThread(
                    activeThread,
                    `Please address my inline code review comments:\n${allComments.join('\n')}`,
                    activeThread.changedFiles.map((f) => f.filePath),
                    []
                  );
                }}
                onCommitChanges={(message) => {
                  updateThread(activeThread.id, (t) => ({
                    ...t,
                    changedFiles: [],
                    diffSummary: { files: 0, additions: 0, deletions: 0 },
                  }));
                  showToast(`Committed to ${activeThread.branch}: "${message}"`);
                }}
                onCreateWorktree={(branchName) => {
                  const newWt: WorktreeInfo = {
                    id: `wt_${Date.now()}`,
                    projectId: activeProject.id,
                    name: `wt/${branchName}`,
                    branch: branchName,
                    path: `/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/${branchName.replace(/\//g, '-')}`,
                    headCommit: 'a8f4c21',
                    isMain: false,
                    status: 'clean',
                    ahead: 0,
                    behind: 0,
                    changedFilesCount: 0,
                    additions: 0,
                    deletions: 0,
                    createdAt: new Date().toISOString(),
                  };
                  setWorktrees((prev) => [newWt, ...prev]);
                  showToast(`Created isolated Git worktree ${branchName}`);
                }}
                onMergeWorktree={(wtId) => {
                  const wt = worktrees.find((w) => w.id === wtId);
                  setWorktrees((prev) =>
                    prev.map((w) =>
                      w.id === wtId
                        ? { ...w, status: 'clean', changedFilesCount: 0, ahead: 0 }
                        : w
                    )
                  );
                  showToast(`Merged worktree ${wt?.branch} into main`);
                }}
              />
            )}
          </>
        ) : (
          <MainFeatureViews
            activeNav={activeNav}
            reviewQueue={reviewQueue}
            onApproveReviewItem={(id) => {
              setReviewQueue((prev) =>
                prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r))
              );
              showToast('Approved & merged automation worktree diff into main!');
            }}
            onRejectReviewItem={(id) => {
              setReviewQueue((prev) =>
                prev.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r))
              );
              showToast('Rejected review item and discarded worktree');
            }}
            onOpenReviewInThread={(item) => {
              const newThread: Thread = {
                id: `thr_rq_${Date.now()}`,
                projectId: item.projectId,
                title: `[Review Queue] ${item.title}`,
                pinned: true,
                status: 'completed',
                worktreeId: 'wt_main',
                branch: item.worktreeBranch,
                model: 'gpt-6.1-sol',
                personality: 'pragmatic',
                reasoningEffort: 'high',
                subagent: 'default',
                updatedAt: 'Just now',
                tokenUsage: '12.4k tokens',
                diffSummary: item.diffSummary,
                turns: [
                  {
                    id: `turn_rq_${Date.now()}`,
                    threadId: `thr_rq_${Date.now()}`,
                    status: 'completed',
                    startedAt: new Date().toISOString(),
                    model: 'gpt-6.1-sol',
                    personality: 'pragmatic',
                    reasoningEffort: 'high',
                    items: [
                      {
                        id: `item_rq_msg_${Date.now()}`,
                        type: 'agentMessage',
                        status: 'completed',
                        timestamp: 'Now',
                        text: `**Automation Run Summary (${item.automationName})**:\n\n${item.summary}`,
                      },
                    ],
                  },
                ],
                changedFiles: item.files,
              };
              setThreads((prev) => [newThread, ...prev]);
              setActiveThreadId(newThread.id);
              setActiveNav('threads');
            }}
            skills={skills}
            onToggleSkill={(id) =>
              setSkills((prev) =>
                prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
              )
            }
            onSaveSkill={(updated) =>
              setSkills((prev) =>
                prev.map((s) => (s.id === updated.id ? updated : s))
              )
            }
            onCreateSkill={(newSk) => {
              const created: SkillDefinition = { ...newSk, id: `skill_${Date.now()}` };
              setSkills((prev) => [created, ...prev]);
              showToast(`Created skill $${created.slug}`);
            }}
            onLaunchSkillThread={(skill) => {
              const thr: Thread = {
                id: `thr_sk_${Date.now()}`,
                projectId: activeProject.id,
                title: `[Skill $${skill.slug}] ${skill.name}`,
                pinned: false,
                status: 'running',
                worktreeId: 'wt_main',
                branch: `feat/skill-${skill.slug}`,
                model: 'gpt-6.1-sol',
                personality: 'pragmatic',
                reasoningEffort: 'high',
                subagent: 'default',
                updatedAt: 'Just now',
                tokenUsage: '2.1k tokens',
                diffSummary: { files: 0, additions: 0, deletions: 0 },
                turns: [],
                changedFiles: [],
              };
              setThreads((prev) => [thr, ...prev]);
              setActiveThreadId(thr.id);
              setActiveNav('threads');
              setTimeout(() => {
                startStreamingTurnOnThread(thr, skill.samplePrompt, [skill.path], [
                  skill.slug,
                ]);
              }, 120);
            }}
            automations={automations}
            onToggleAutomation={(id) =>
              setAutomations((prev) =>
                prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
              )
            }
            onRunAutomationNow={(id) => {
              const job = automations.find((a) => a.id === id);
              if (!job) return;
              const newRq: ReviewQueueItem = {
                id: `rq_${Date.now()}`,
                automationId: job.id,
                automationName: job.name,
                projectId: job.projectId,
                worktreeBranch: `wt/auto-${Date.now().toString(36)}`,
                title: `[Automated Run] ${job.name}`,
                summary: `Executed scheduled prompt: "${job.prompt}" using $${job.skills.join(', $')}. Generated clean patch in isolated worktree.`,
                createdAt: 'Just now',
                status: 'pending_review',
                diffSummary: { files: 1, additions: 19, deletions: 3 },
                files: [
                  {
                    id: `rq_file_${Date.now()}`,
                    filePath: 'src/services/appServerClient.ts',
                    status: 'modified',
                    additions: 19,
                    deletions: 3,
                    staged: true,
                    language: 'typescript',
                    comments: [],
                    hunks: [
                      {
                        id: `rq_h_${Date.now()}`,
                        header: '@@ -18,4 +18,10 @@ // Automated Codex Run Patch',
                        staged: true,
                        lines: [
                          {
                            type: 'add',
                            newLineNumber: 18,
                            content: `// Verified by Automation: ${job.name}`,
                          },
                          {
                            type: 'add',
                            newLineNumber: 19,
                            content: 'export const AUTOMATION_HEALTH_CHECK = true;',
                          },
                        ],
                      },
                    ],
                  },
                ],
              };
              setReviewQueue((prev) => [newRq, ...prev]);
              setAutomations((prev) =>
                prev.map((a) =>
                  a.id === id
                    ? { ...a, lastRunAt: 'Just now', totalRuns: a.totalRuns + 1 }
                    : a
                )
              );
              setActiveNav('review_queue');
              showToast(`Automation "${job.name}" completed → pushed to Review Queue!`);
            }}
            onCreateAutomation={(newJob) => {
              setAutomations((prev) => [
                {
                  ...newJob,
                  id: `auto_${Date.now()}`,
                  lastRunAt: 'Never',
                  nextRunAt: 'Scheduled',
                  status: 'idle',
                  totalRuns: 0,
                },
                ...prev,
              ]);
              showToast(`Scheduled new automation "${newJob.name}"`);
            }}
            worktrees={worktrees}
            onCreateWorktree={(branch) => {
              setWorktrees((prev) => [
                {
                  id: `wt_${Date.now()}`,
                  projectId: activeProject.id,
                  name: `wt/${branch}`,
                  branch,
                  path: `/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/${branch.replace(/\//g, '-')}`,
                  headCommit: 'a8f4c21',
                  isMain: false,
                  status: 'clean',
                  ahead: 0,
                  behind: 0,
                  changedFilesCount: 0,
                  additions: 0,
                  deletions: 0,
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ]);
              showToast(`Created isolated Git worktree: ${branch}`);
            }}
            onMergeWorktree={(id) => {
              setWorktrees((prev) =>
                prev.map((w) =>
                  w.id === id ? { ...w, status: 'clean', changedFilesCount: 0, ahead: 0 } : w
                )
              );
              showToast('Merged worktree changes cleanly into main');
            }}
            onDeleteWorktree={(id) => {
              setWorktrees((prev) => prev.filter((w) => w.id !== id));
              showToast('Pruned isolated Git worktree');
            }}
            onJumpToWorktreeThread={(wt) => {
              if (wt.boundThreadId) {
                setActiveThreadId(wt.boundThreadId);
              }
              setActiveNav('threads');
            }}
            subagents={subagents}
            onSaveSubagent={(updated) =>
              setSubagents((prev) =>
                prev.map((s) => (s.id === updated.id ? updated : s))
              )
            }
            onCreateSubagent={(newSa) =>
              setSubagents((prev) => [...prev, { ...newSa, id: `sub_${Date.now()}` }])
            }
            agentsMdContent={agentsMdContent}
            onSaveAgentsMd={setAgentsMdContent}
            sandboxPolicy={sandboxPolicy}
            onUpdateSandboxPolicy={(patch) =>
              setSandboxPolicy((prev) => ({ ...prev, ...patch }))
            }
          />
        )}
      </div>

      {/* Cmd+K Command Palette Modal */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        threads={threads}
        skills={skills}
        worktrees={worktrees}
        onSelectThread={setActiveThreadId}
        onSelectNav={setActiveNav}
        onLaunchSkillThread={(skill) => {
          setActiveNav('threads');
          startStreamingTurnOnThread(activeThread, skill.samplePrompt, [skill.path], [
            skill.slug,
          ]);
        }}
        onSpawnParallelAgents={handleSpawnParallelAgents}
        onSetLayoutMode={setLayoutMode}
      />

      {/* JSON-RPC 2.0 Lite App-Server Protocol Stream Inspector Modal */}
      <RpcInspectorModal
        isOpen={isRpcInspectorOpen}
        onClose={() => setIsRpcInspectorOpen(false)}
        logs={rpcLogs}
        appServerConnected={appServerConnected}
        onSendCustomRpc={(method, paramsJson) => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(paramsJson);
          } catch {
            parsed = { raw: paramsJson };
          }
          sendJsonRpcRequest(method, parsed, appendRpcLog);
        }}
      />
    </div>
  );
}

export default App;
