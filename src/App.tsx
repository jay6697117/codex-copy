import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AutomationJob,
  ComposerMode,
  FileDiff,
  FileTreeNode,
  JsonRpcLogEntry,
  LocalCodexStatus,
  NavSection,
  ProjectWorkspace,
  ReviewQueueItem,
  RightPanelTab,
  SandboxPolicy,
  SkillDefinition,
  SubagentConfig,
  ThemeSkin,
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
  commitGitChanges,
  fetchGitStatus,
  fetchLocalCodexStatus,
  fetchWorkspaceFileTree,
  manageGitWorktree,
  openInExternalApp,
  readWorkspaceFile,
  revertGitFile,
  runInteractiveAgentTurn,
  sendJsonRpcRequest,
  stageGitFile,
  writeWorkspaceFile,
} from './services/appServerClient';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterThreadView } from './components/CenterThreadView';
import { RightInspectorPane } from './components/RightInspectorPane';
import { MainFeatureViews } from './components/MainFeatureViews';
import { CommandPaletteModal, RpcInspectorModal } from './components/Modals';

const SKIN_CYCLE: ThemeSkin[] = ['codex-dark', 'macos-light', 'aurora-midnight'];

export function App() {
  // 3-Skin One-Click Theme State
  const [skin, setSkin] = useState<ThemeSkin>(() => {
    const saved = localStorage.getItem('codex_desktop_skin') as ThemeSkin | null;
    return saved && SKIN_CYCLE.includes(saved) ? saved : 'codex-dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin);
    localStorage.setItem('codex_desktop_skin', skin);
  }, [skin]);

  const handleCycleSkin = () => {
    setSkin((prev) => {
      const nextIdx = (SKIN_CYCLE.indexOf(prev) + 1) % SKIN_CYCLE.length;
      return SKIN_CYCLE[nextIdx];
    });
  };

  // Layout & Navigation State
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<NavSection>('threads');
  const [rightTab, setRightTab] = useState<RightPanelTab>('diff');
  const [layoutMode] = useState<WorkspaceLayoutMode>('standard');

  // Workspace, Projects, Threads & Local Codex Environment State
  const [localCodexStatus, setLocalCodexStatus] = useState<LocalCodexStatus | null>(null);
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

  // Sync Local Machine Codex Status, ~/.codex/sessions, ~/.codex/skills, and live Git diffs
  const syncLocalEnvironmentAndGit = async () => {
    const [codexStatus, gitState, tree, agentsMd] = await Promise.all([
      fetchLocalCodexStatus(),
      fetchGitStatus(),
      fetchWorkspaceFileTree(),
      readWorkspaceFile('AGENTS.md'),
    ]);

    if (tree.length > 0) setFileTree(tree);
    if (agentsMd) setAgentsMdContent(agentsMd);

    if (codexStatus) {
      setLocalCodexStatus(codexStatus);

      // Merge real local skills from ~/.codex/skills & .codex/skills
      if (Array.isArray(codexStatus.localSkills) && codexStatus.localSkills.length > 0) {
        setSkills((prev) => {
          const existingSlugs = new Set(prev.map((s) => s.slug));
          const added = codexStatus.localSkills.filter((s) => !existingSlugs.has(s.slug));
          return [...added, ...prev];
        });
      }

      // Import real local Codex CLI sessions from ~/.codex/sessions & history.jsonl into Threads
      if (Array.isArray(codexStatus.localSessions) && codexStatus.localSessions.length > 0) {
        const importedThreads: Thread[] = codexStatus.localSessions.map((sess) => ({
          id: sess.id,
          cliSessionId: sess.cliSessionId,
          projectId: INITIAL_PROJECTS[0].id,
          title: sess.title,
          pinned: false,
          isLocalCliSession: true,
          status: 'completed',
          worktreeId: 'wt_main',
          branch: sess.branch || 'main',
          cwd: sess.cwd,
          environmentMode: 'local',
          permissionMode: 'workspace-write',
          model: sess.model || codexStatus.config.effective.model || 'gpt-5.4',
          personality: 'pragmatic',
          reasoningEffort:
            (codexStatus.config.effective.reasoningEffort as any) || 'high',
          subagent: 'default',
          updatedAt: sess.updatedAt,
          tokenUsage: 'Local CLI session',
          diffSummary: { files: 0, additions: 0, deletions: 0 },
          turns:
            sess.items.length > 0
              ? [
                  {
                    id: `turn_${sess.id}`,
                    threadId: sess.id,
                    status: 'completed',
                    startedAt: new Date(sess.mtimeMs).toISOString(),
                    model: sess.model || codexStatus.config.effective.model || 'gpt-5.4',
                    personality: 'pragmatic',
                    reasoningEffort: 'high',
                    items: sess.items,
                  },
                ]
              : [],
          changedFiles: [],
        }));

        setThreads((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const fresh = importedThreads.filter((t) => !existingIds.has(t.id));
          return [...prev, ...fresh];
        });
      }

      // Sync active thread model with local ~/.codex/config.toml default model
      const configuredModel = codexStatus.config?.effective?.model;
      if (configuredModel) {
        setThreads((prev) =>
          prev.map((t, idx) => (idx === 0 ? { ...t, model: configuredModel } : t))
        );
      }
    }

    if (gitState) {
      if (gitState.worktrees && gitState.worktrees.length > 0) {
        setWorktrees(gitState.worktrees);
      }
      if (gitState.changedFiles && gitState.changedFiles.length > 0) {
        setThreads((prev) =>
          prev.map((t, idx) =>
            idx === 0
              ? {
                  ...t,
                  branch: gitState.branch || t.branch,
                  changedFiles: gitState.changedFiles,
                  diffSummary: gitState.diffSummary,
                }
              : t
          )
        );
        if (!selectedDiffFile && gitState.changedFiles[0]) {
          setSelectedDiffFile(gitState.changedFiles[0].filePath);
        }
      }
    }
  };

  useEffect(() => {
    checkAppServerHealth().then(() => {
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

    syncLocalEnvironmentAndGit();
  }, []);

  // Keyboard shortcuts: Cmd+K (Command Palette), Cmd+B (Toggle Sidebar), Cmd+J (Toggle Terminal)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setRightTab('terminal');
        setRightDrawerOpen((v) => (rightTab === 'terminal' ? !v : true));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rightTab]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
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
          'server/codex-local-bridge.mjs',
        ];
  }, [fileTree]);

  const pendingReviewCount = reviewQueue.filter(
    (r) => r.status === 'pending_review'
  ).length;

  const updateThread = (threadId: string, updater: (t: Thread) => Thread) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? updater(t) : t)));
  };

  // Start a real streaming turn via the local Codex CLI bridge
  const startStreamingTurnOnThread = (
    targetThread: Thread,
    prompt: string,
    attachedFiles: string[] = [],
    invokedSkills: string[] = [],
    mode: ComposerMode = 'agent'
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
      title:
        t.turns.length === 0 || t.title === 'New thread'
          ? prompt.slice(0, 56)
          : t.title,
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
      cliSessionId: targetThread.cliSessionId,
      turnId,
      prompt,
      attachedFiles,
      invokedSkills,
      model: targetThread.model,
      personality: targetThread.personality,
      reasoningEffort: targetThread.reasoningEffort,
      subagent: targetThread.subagent,
      worktreeBranch: targetThread.branch,
      cwd: targetThread.cwd || activeProject.repoPath,
      mode,
      sandboxPolicy: {
        ...sandboxPolicy,
        mode: (targetThread.permissionMode as any) || sandboxPolicy.mode,
      },
      callbacks: {
        onCliThreadStarted: (cliSessionId) => {
          updateThread(targetThread.id, (t) => ({ ...t, cliSessionId }));
        },
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
            return {
              ...t,
              changedFiles: nextFiles,
              diffSummary: {
                files: nextFiles.length,
                additions: nextFiles.reduce((s, f) => s + f.additions, 0),
                deletions: nextFiles.reduce((s, f) => s + f.deletions, 0),
              },
            };
          });
          setSelectedDiffFile(fileDiff.filePath);
        },
        onGitStateUpdated: (gitState) => {
          if (gitState.worktrees?.length) {
            setWorktrees(gitState.worktrees);
          }
          if (gitState.changedFiles) {
            updateThread(targetThread.id, (t) => ({
              ...t,
              branch: gitState.branch || t.branch,
              changedFiles:
                gitState.changedFiles.length > 0 ? gitState.changedFiles : t.changedFiles,
              diffSummary:
                gitState.changedFiles.length > 0 ? gitState.diffSummary : t.diffSummary,
            }));
            if (gitState.changedFiles[0]) {
              setSelectedDiffFile(gitState.changedFiles[0].filePath);
            }
          }
        },
        onTurnStatusChange: (status, tokenUsageText) => {
          updateThread(targetThread.id, (t) => ({
            ...t,
            status:
              status === 'waiting_approval'
                ? 'waiting_approval'
                : status === 'in_progress'
                ? 'running'
                : 'completed',
            tokenUsage: tokenUsageText || t.tokenUsage,
            turns: t.turns.map((tr) => (tr.id === turnId ? { ...tr, status } : tr)),
          }));
        },
        onRpcLog: appendRpcLog,
      },
    });

    activeTurnInterruptRef.current[targetThread.id] = controller.interrupt;
  };

  // Start a clean new thread
  const handleCreateNewThread = (projectId?: string) => {
    const targetProjId = projectId || activeProject.id;
    const defaultModel =
      localCodexStatus?.config?.effective?.model || 'gpt-5.4';
    const defaultEffort =
      (localCodexStatus?.config?.effective?.reasoningEffort as any) || 'high';

    const newThread: Thread = {
      id: `thr_${Date.now()}`,
      projectId: targetProjId,
      title: 'New thread',
      pinned: false,
      status: 'completed',
      worktreeId: 'wt_main',
      branch: activeThread?.branch || 'main',
      cwd: activeProject.repoPath,
      environmentMode: 'local',
      permissionMode: 'workspace-write',
      model: defaultModel,
      personality: 'pragmatic',
      reasoningEffort: defaultEffort,
      subagent: 'default',
      updatedAt: 'Now',
      tokenUsage: '0 tokens',
      diffSummary: activeThread?.diffSummary || { files: 0, additions: 0, deletions: 0 },
      turns: [],
      changedFiles: activeThread?.changedFiles || [],
    };

    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setActiveNav('threads');
    sendJsonRpcRequest(
      'thread/start',
      { model: newThread.model, cwd: activeProject.repoPath },
      appendRpcLog
    );
  };

  // Send message from Composer
  const handleSendMessage = async (params: {
    prompt: string;
    attachedFiles: string[];
    invokedSkills: string[];
    createNewWorktree?: boolean;
    mode?: ComposerMode;
  }) => {
    let targetThread = activeThread;

    if (params.createNewWorktree && targetThread.worktreeId === 'wt_main') {
      const slug = Math.random().toString(36).slice(2, 6);
      const branch = `codex/task-${slug}`;
      const wtRes = await manageGitWorktree('create', branch, undefined, activeProject.repoPath);
      const wtId = `wt_${Date.now()}`;
      const wtPath =
        wtRes.worktreePath ||
        `/Users/zhangjinhui/.codex/worktrees/codex-test/task-${slug}`;

      if (wtRes.git?.worktrees) {
        setWorktrees(wtRes.git.worktrees);
      } else {
        setWorktrees((prev) => [
          {
            id: wtId,
            projectId: activeProject.id,
            name: branch,
            branch,
            path: wtPath,
            headCommit: 'HEAD',
            isMain: false,
            status: 'running',
            boundThreadId: activeThread.id,
            ahead: 0,
            behind: 0,
            changedFilesCount: 0,
            additions: 0,
            deletions: 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      targetThread = {
        ...activeThread,
        worktreeId: wtId,
        branch,
        cwd: wtPath,
        environmentMode: 'worktree',
      };
      updateThread(activeThread.id, (t) => ({
        ...t,
        worktreeId: wtId,
        branch,
        cwd: wtPath,
        environmentMode: 'worktree',
      }));
    }

    startStreamingTurnOnThread(
      targetThread,
      params.prompt,
      params.attachedFiles,
      params.invokedSkills,
      params.mode || 'agent'
    );
  };

  // Mid-Turn Steering
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

    startStreamingTurnOnThread(activeThread, steerText, [], [], 'agent');
  };

  // Interrupt active turn
  const handleInterruptTurn = () => {
    activeTurnInterruptRef.current[activeThread.id]?.();
    updateThread(activeThread.id, (t) => ({
      ...t,
      status: 'completed',
      turns: t.turns.map((tr, idx) =>
        idx === t.turns.length - 1 ? { ...tr, status: 'interrupted' } : tr
      ),
    }));
    showToast('Stopped active Codex turn');
  };

  // Respond to Sandbox Approval Request
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
        return {
          ...tr,
          status: 'completed',
          items: tr.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  status: decision === 'deny' ? ('denied' as const) : ('completed' as const),
                  decision,
                }
              : it
          ),
        };
      }),
    }));

    showToast(decision === 'deny' ? 'Command denied' : `Approved at ${nowTime}`);
  };

  const handleToggleRightDrawer = (tab?: RightPanelTab) => {
    if (tab) {
      if (rightDrawerOpen && rightTab === tab) {
        setRightDrawerOpen(false);
      } else {
        setRightTab(tab);
        setRightDrawerOpen(true);
      }
    } else {
      setRightDrawerOpen((v) => !v);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex codex-app-bg">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-xl codex-elevated border codex-border text-xs font-medium codex-text-primary shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left Sidebar (Official Codex App Structure) */}
      <LeftSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        projects={projects}
        activeProjectId={activeProject.id}
        onSelectProject={setActiveProjectId}
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
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        pendingReviewCount={pendingReviewCount}
        skillsCount={skills.length}
        automationsCount={automations.length}
        worktrees={worktrees}
        localCodexStatus={localCodexStatus}
        onRefreshLocalStatus={() => {
          syncLocalEnvironmentAndGit();
          showToast('Synced local ~/.codex status & git repository');
        }}
      />

      {/* Main Content Area: Either Active Thread View OR Secondary Feature View */}
      {activeNav === 'threads' ? (
        <div className="flex-1 flex min-w-0 h-full overflow-hidden">
          <CenterThreadView
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
            rightDrawerOpen={rightDrawerOpen}
            activeRightTab={rightTab}
            onToggleRightDrawer={handleToggleRightDrawer}
            skin={skin}
            onSelectSkin={(s) => {
              setSkin(s);
              showToast(`Switched theme skin to ${s}`);
            }}
            onCycleSkin={() => {
              handleCycleSkin();
            }}
            activeProject={activeProject}
            projects={projects}
            onSelectProject={setActiveProjectId}
            thread={activeThread}
            worktrees={worktrees}
            skills={skills}
            subagents={subagents}
            workspaceFiles={flatWorkspaceFiles}
            localCodexStatus={localCodexStatus}
            onOpenCodexConfig={() => setActiveNav('codex_config')}
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
              showToast('Forked thread');
            }}
            onRevertThread={(id) => {
              updateThread(id, (t) => ({
                ...t,
                turns: t.turns.length > 1 ? t.turns.slice(0, -1) : t.turns,
              }));
              showToast('Undid last turn');
            }}
            onOpenInEditor={async (appId = 'cursor') => {
              const res = await openInExternalApp(
                activeThread.cwd || activeProject.repoPath,
                appId
              );
              if (res.ok) {
                showToast(`Opened workspace in ${res.openedWith || appId}`);
              } else {
                showToast(`Opened ${activeProject.repoPath} (${appId})`);
              }
            }}
            onGitCommitAction={async (action, message) => {
              if (action === 'pr') {
                startStreamingTurnOnThread(
                  activeThread,
                  `Create a concise pull request title and summary for the changes on branch ${activeThread.branch}.`,
                  [],
                  [],
                  'agent'
                );
                return;
              }
              const commitMsg =
                message?.trim() || `Update via Codex Desktop (${activeThread.branch})`;
              const res = await commitGitChanges(
                commitMsg,
                action === 'push',
                activeThread.cwd || activeProject.repoPath
              );
              if (res.git) {
                updateThread(activeThread.id, (t) => ({
                  ...t,
                  changedFiles: res.git.changedFiles || [],
                  diffSummary: res.git.diffSummary || {
                    files: 0,
                    additions: 0,
                    deletions: 0,
                  },
                }));
              }
              showToast(
                res.ok
                  ? `Committed changes: "${commitMsg}"`
                  : `Git commit note: ${res.error || 'Done'}`
              );
            }}
            onSelectDiffFile={(filePath) => {
              setSelectedDiffFile(filePath);
              setRightTab('diff');
              setRightDrawerOpen(true);
            }}
            onUpdateThreadConfig={(id, patch) =>
              updateThread(id, (t) => ({ ...t, ...patch }))
            }
            onSendMessage={handleSendMessage}
            onSteerTurn={handleSteerTurn}
            onInterruptTurn={handleInterruptTurn}
            onRespondApproval={handleRespondApproval}
          />

          {/* Collapsible Right Review / Files / Terminal / Browser Drawer */}
          {rightDrawerOpen && (
            <RightInspectorPane
              activeTab={rightTab}
              onTabChange={setRightTab}
              onClose={() => setRightDrawerOpen(false)}
              onRefreshGit={syncLocalEnvironmentAndGit}
              layoutMode={layoutMode}
              thread={activeThread}
              selectedDiffFile={selectedDiffFile}
              onSelectDiffFile={setSelectedDiffFile}
              fileTree={fileTree}
              worktrees={worktrees}
              onToggleStageFile={async (filePath, currentStaged) => {
                const res = await stageGitFile(
                  filePath,
                  !currentStaged,
                  activeThread.cwd || activeProject.repoPath
                );
                if (res.git?.changedFiles) {
                  updateThread(activeThread.id, (t) => ({
                    ...t,
                    changedFiles: res.git.changedFiles,
                    diffSummary: res.git.diffSummary,
                  }));
                } else {
                  updateThread(activeThread.id, (t) => ({
                    ...t,
                    changedFiles: t.changedFiles.map((f) =>
                      f.filePath === filePath ? { ...f, staged: !f.staged } : f
                    ),
                  }));
                }
              }}
              onRevertFileDiff={async (filePath) => {
                const res = await revertGitFile(
                  filePath,
                  activeThread.cwd || activeProject.repoPath
                );
                if (res.git?.changedFiles) {
                  updateThread(activeThread.id, (t) => ({
                    ...t,
                    changedFiles: res.git.changedFiles,
                    diffSummary: res.git.diffSummary,
                  }));
                } else {
                  updateThread(activeThread.id, (t) => {
                    const remaining = t.changedFiles.filter((f) => f.filePath !== filePath);
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
                }
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
                              author: localCodexStatus?.auth?.name || 'zhangjinhui',
                              body,
                              createdAt: 'Just now',
                            },
                          ],
                        }
                      : f
                  ),
                }));
              }}
              onSubmitInlineReviewToAgent={() => {
                const allComments = activeThread.changedFiles.flatMap((f) =>
                  f.comments.map((c) => `[${c.filePath}:${c.lineNumber}] ${c.body}`)
                );
                if (allComments.length === 0) return;
                startStreamingTurnOnThread(
                  activeThread,
                  `Please address these inline code review comments:\n${allComments.join('\n')}`,
                  activeThread.changedFiles.map((f) => f.filePath),
                  [],
                  'agent'
                );
              }}
              onCommitChanges={async (message, push) => {
                const res = await commitGitChanges(
                  message,
                  Boolean(push),
                  activeThread.cwd || activeProject.repoPath
                );
                if (res.git) {
                  updateThread(activeThread.id, (t) => ({
                    ...t,
                    changedFiles: res.git.changedFiles || [],
                    diffSummary: res.git.diffSummary || {
                      files: 0,
                      additions: 0,
                      deletions: 0,
                    },
                  }));
                }
                showToast(`Committed to ${activeThread.branch}: "${message}"`);
              }}
              onCreateWorktree={async (branchName) => {
                const res = await manageGitWorktree(
                  'create',
                  branchName,
                  undefined,
                  activeProject.repoPath
                );
                if (res.git?.worktrees) {
                  setWorktrees(res.git.worktrees);
                } else {
                  setWorktrees((prev) => [
                    {
                      id: `wt_${Date.now()}`,
                      projectId: activeProject.id,
                      name: branchName,
                      branch: branchName,
                      path:
                        res.worktreePath ||
                        `/Users/zhangjinhui/.codex/worktrees/codex-test/${branchName}`,
                      headCommit: 'HEAD',
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
                }
                showToast(`Created worktree ${branchName}`);
              }}
              onMergeWorktree={(wtId) => {
                const wt = worktrees.find((w) => w.id === wtId);
                showToast(`Handed off worktree ${wt?.branch || wtId} to Local checkout`);
              }}
            />
          )}
        </div>
      ) : (
        <MainFeatureViews
          activeNav={activeNav}
          onBackToThreads={() => setActiveNav('threads')}
          skin={skin}
          onSelectSkin={(s) => {
            setSkin(s);
            showToast(`Switched theme skin to ${s}`);
          }}
          localCodexStatus={localCodexStatus}
          onRefreshLocalStatus={() => {
            syncLocalEnvironmentAndGit();
            showToast('Refreshed local ~/.codex configuration & CLI status');
          }}
          reviewQueue={reviewQueue}
          onApproveReviewItem={(id) => {
            setReviewQueue((prev) =>
              prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r))
            );
            showToast('Approved & merged review item');
          }}
          onRejectReviewItem={(id) => {
            setReviewQueue((prev) =>
              prev.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r))
            );
            showToast('Discarded review item');
          }}
          onOpenReviewInThread={(item) => {
            const newThread: Thread = {
              id: `thr_rq_${Date.now()}`,
              projectId: item.projectId,
              title: item.title,
              pinned: false,
              status: 'completed',
              worktreeId: 'wt_main',
              branch: item.worktreeBranch,
              cwd: activeProject.repoPath,
              environmentMode: 'worktree',
              permissionMode: 'workspace-write',
              model: localCodexStatus?.config?.effective?.model || 'gpt-5.4',
              personality: 'pragmatic',
              reasoningEffort: 'high',
              subagent: 'default',
              updatedAt: 'Just now',
              tokenUsage: '4.2k tokens',
              diffSummary: item.diffSummary,
              turns: [
                {
                  id: `turn_rq_${Date.now()}`,
                  threadId: `thr_rq_${Date.now()}`,
                  status: 'completed',
                  startedAt: new Date().toISOString(),
                  model: localCodexStatus?.config?.effective?.model || 'gpt-5.4',
                  personality: 'pragmatic',
                  reasoningEffort: 'high',
                  items: [
                    {
                      id: `item_rq_msg_${Date.now()}`,
                      type: 'agentMessage',
                      status: 'completed',
                      timestamp: 'Now',
                      text: `**${item.automationName}** completed on branch \`${item.worktreeBranch}\`:\n\n${item.summary}`,
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
            const created: SkillDefinition = { ...newSk, id: `sk_${Date.now()}` };
            setSkills((prev) => [created, ...prev]);
            showToast(`Created skill $${created.slug}`);
          }}
          onLaunchSkillThread={(skill) => {
            setActiveNav('threads');
            startStreamingTurnOnThread(
              activeThread,
              skill.samplePrompt,
              [],
              [skill.slug],
              'agent'
            );
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
            setActiveNav('threads');
            startStreamingTurnOnThread(
              activeThread,
              job.prompt,
              [],
              job.skills,
              'agent'
            );
            showToast(`Triggered automation "${job.name}" via local Codex`);
          }}
          onCreateAutomation={(newJob) => {
            const created: AutomationJob = {
              ...newJob,
              id: `auto_${Date.now()}`,
              lastRunAt: 'Never',
              nextRunAt: 'Scheduled',
              status: 'idle',
              totalRuns: 0,
            };
            setAutomations((prev) => [created, ...prev]);
            showToast(`Scheduled automation "${created.name}"`);
          }}
          worktrees={worktrees}
          onCreateWorktree={async (branch) => {
            const res = await manageGitWorktree(
              'create',
              branch,
              undefined,
              activeProject.repoPath
            );
            if (res.git?.worktrees) {
              setWorktrees(res.git.worktrees);
            }
            showToast(`Created worktree ${branch}`);
          }}
          onMergeWorktree={(id) => {
            const wt = worktrees.find((w) => w.id === id);
            showToast(`Handed off ${wt?.branch || id} to local checkout`);
          }}
          onDeleteWorktree={async (id) => {
            const wt = worktrees.find((w) => w.id === id);
            if (wt) {
              await manageGitWorktree('remove', wt.branch, wt.path, activeProject.repoPath);
            }
            setWorktrees((prev) => prev.filter((w) => w.id !== id));
            showToast('Removed worktree');
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
          onCreateSubagent={(newAg) =>
            setSubagents((prev) => [...prev, { ...newAg, id: `sub_${Date.now()}` }])
          }
          agentsMdContent={agentsMdContent}
          onSaveAgentsMd={(content) => {
            setAgentsMdContent(content);
            writeWorkspaceFile('AGENTS.md', content);
          }}
          sandboxPolicy={sandboxPolicy}
          onUpdateSandboxPolicy={(patch) =>
            setSandboxPolicy((prev) => ({ ...prev, ...patch }))
          }
        />
      )}

      {/* Command Palette Modal (Cmd+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        threads={threads}
        skills={skills}
        worktrees={worktrees}
        onSelectThread={(id) => {
          setActiveThreadId(id);
          setActiveNav('threads');
        }}
        onSelectNav={setActiveNav}
        onCreateNewThread={() => handleCreateNewThread(activeProject.id)}
        onSpawnParallelAgents={() => {
          setActiveNav('threads');
          handleCycleSkin();
        }}
        onInvokeSkill={(slug) => {
          const sk = skills.find((s) => s.slug === slug);
          if (sk) {
            setActiveNav('threads');
            startStreamingTurnOnThread(activeThread, sk.samplePrompt, [], [sk.slug], 'agent');
          }
        }}
      />

      {/* JSON-RPC 2.0 Lite Inspector Modal */}
      <RpcInspectorModal
        isOpen={isRpcInspectorOpen}
        onClose={() => setIsRpcInspectorOpen(false)}
        logs={rpcLogs}
        onClearLogs={() => setRpcLogs([])}
        onSendTestRpc={(method, params) => sendJsonRpcRequest(method, params, appendRpcLog)}
      />
    </div>
  );
}
export default App;
