import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AppLanguage,
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
  saveCodexModelPreferences,
  sendJsonRpcRequest,
  stageGitFile,
  writeWorkspaceFile,
} from './services/appServerClient';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterThreadView } from './components/CenterThreadView';
import { RightInspectorPane } from './components/RightInspectorPane';
import { MainFeatureViews } from './components/MainFeatureViews';
import { CommandPaletteModal, RpcInspectorModal } from './components/Modals';
import { t, SKIN_METAS } from './i18n/translations';

const VALID_SKINS: ThemeSkin[] = ['wechat', 'qq', 'dingtalk'];
const VALID_LANGS: AppLanguage[] = ['zh-CN', 'en-US'];

export function App() {
  // 1. Default Simplified Chinese (`zh-CN`), switchable to English (`en-US`) in Settings
  const [lang, setLang] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('codex_desktop_lang_v2') as AppLanguage | null;
    return saved && VALID_LANGS.includes(saved) ? saved : 'zh-CN';
  });

  // 2. Default WeChat Skin (`wechat`), switchable to QQ (`qq`) and DingTalk (`dingtalk`) in Settings
  const [skin, setSkin] = useState<ThemeSkin>(() => {
    const saved = localStorage.getItem('codex_desktop_skin_v2') as ThemeSkin | null;
    return saved && VALID_SKINS.includes(saved) ? saved : 'wechat';
  });

  const i18n = t(lang);

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin);
    localStorage.setItem('codex_desktop_skin_v2', skin);
  }, [skin]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('codex_desktop_lang_v2', lang);
  }, [lang]);

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
          const importedMap = new Map(importedThreads.map((th) => [th.id, th]));
          const updatedPrev = prev.map((th) =>
            importedMap.has(th.id) ? importedMap.get(th.id)! : th
          );
          const existingIds = new Set(updatedPrev.map((th) => th.id));
          const fresh = importedThreads.filter((th) => !existingIds.has(th.id));
          return [...updatedPrev, ...fresh];
        });
      }

      // Sync active thread model & reasoning effort with local ~/.codex/config.toml defaults
      const configuredModel = codexStatus.config?.effective?.model;
      const configuredEffort = codexStatus.config?.effective?.reasoningEffort as any;
      if (configuredModel || configuredEffort) {
        setThreads((prev) =>
          prev.map((th, idx) =>
            idx === 0
              ? {
                  ...th,
                  model: configuredModel || th.model,
                  reasoningEffort: configuredEffort || th.reasoningEffort,
                }
              : th
          )
        );
      }
    }

    if (gitState) {
      if (gitState.worktrees && gitState.worktrees.length > 0) {
        setWorktrees(gitState.worktrees);
      }
      if (gitState.changedFiles) {
        setThreads((prev) =>
          prev.map((th, idx) =>
            idx === 0
              ? {
                  ...th,
                  branch: gitState.branch || th.branch,
                  changedFiles: gitState.changedFiles,
                  diffSummary: gitState.diffSummary,
                }
              : th
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
    () => threads.find((th) => th.id === activeThreadId) || threads[0],
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

  const updateThread = (threadId: string, updater: (th: Thread) => Thread) => {
    setThreads((prev) => prev.map((th) => (th.id === threadId ? updater(th) : th)));
  };

  // Start a real streaming turn via the local Codex CLI bridge
  const startStreamingTurnOnThread = (
    targetThread: Thread,
    prompt: string,
    attachedFiles: string[] = [],
    invokedSkills: string[] = [],
    mode: ComposerMode = 'agent',
    goalObjective?: string
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

    updateThread(targetThread.id, (th) => ({
      ...th,
      title:
        th.turns.length === 0 || th.title === 'New thread' || th.title === '新建会话'
          ? prompt.slice(0, 56)
          : th.title,
      status: 'running',
      updatedAt: lang === 'zh-CN' ? '刚刚' : 'Just now',
      turns: [...th.turns, newTurn],
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

    const activeGoal =
      goalObjective ||
      (targetThread.goal?.status === 'active' ? targetThread.goal.objective : undefined);

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
      activeGoal,
      sandboxPolicy: {
        ...sandboxPolicy,
        mode: (targetThread.permissionMode as any) || sandboxPolicy.mode,
      },
      callbacks: {
        onCliThreadStarted: (cliSessionId) => {
          updateThread(targetThread.id, (th) => ({ ...th, cliSessionId }));
        },
        onItemAdded: (item) => {
          updateThread(targetThread.id, (th) => ({
            ...th,
            turns: th.turns.map((tr) =>
              tr.id === turnId ? { ...tr, items: [...tr.items, item] } : tr
            ),
          }));
        },
        onItemUpdated: (itemId, itemUpdater) => {
          updateThread(targetThread.id, (th) => ({
            ...th,
            turns: th.turns.map((tr) =>
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
          updateThread(targetThread.id, (th) => {
            const existingIdx = th.changedFiles.findIndex(
              (f) => f.filePath === fileDiff.filePath
            );
            const nextFiles =
              existingIdx >= 0
                ? th.changedFiles.map((f, idx) => (idx === existingIdx ? fileDiff : f))
                : [fileDiff, ...th.changedFiles];
            return {
              ...th,
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
            updateThread(targetThread.id, (th) => ({
              ...th,
              branch: gitState.branch || th.branch,
              changedFiles: gitState.changedFiles,
              diffSummary: gitState.diffSummary,
            }));
            if (gitState.changedFiles[0]) {
              setSelectedDiffFile(gitState.changedFiles[0].filePath);
            }
          }
        },
        onTurnStatusChange: (status, tokenUsageText) => {
          updateThread(targetThread.id, (th) => ({
            ...th,
            status:
              status === 'waiting_approval'
                ? 'waiting_approval'
                : status === 'in_progress'
                ? 'running'
                : 'completed',
            tokenUsage: tokenUsageText || th.tokenUsage,
            turns: th.turns.map((tr) => (tr.id === turnId ? { ...tr, status } : tr)),
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
      title: lang === 'zh-CN' ? '新建会话' : 'New thread',
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
      updatedAt: lang === 'zh-CN' ? '刚刚' : 'Now',
      tokenUsage: '0 tokens',
      diffSummary: activeThread?.diffSummary || { files: 0, additions: 0, deletions: 0 },
      turns: [],
      changedFiles: activeThread?.changedFiles || [],
      goal: null,
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
    goalObjective?: string;
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
      updateThread(activeThread.id, (th) => ({
        ...th,
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
      params.mode || 'agent',
      params.goalObjective
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

    updateThread(activeThread.id, (th) => {
      const lastTurn = th.turns[th.turns.length - 1];
      if (!lastTurn) return th;
      return {
        ...th,
        turns: th.turns.map((tr) =>
          tr.id === lastTurn.id ? { ...tr, items: [...tr.items, steerItem] } : tr
        ),
      };
    });

    startStreamingTurnOnThread(activeThread, steerText, [], [], 'agent');
  };

  // Interrupt active turn
  const handleInterruptTurn = () => {
    activeTurnInterruptRef.current[activeThread.id]?.();
    updateThread(activeThread.id, (th) => ({
      ...th,
      status: 'completed',
      turns: th.turns.map((tr, idx) =>
        idx === th.turns.length - 1 ? { ...tr, status: 'interrupted' } : tr
      ),
    }));
    showToast(i18n.toasts.stoppedTurn);
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

    updateThread(activeThread.id, (th) => ({
      ...th,
      status: 'completed',
      turns: th.turns.map((tr) => {
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

    showToast(
      decision === 'deny'
        ? i18n.toasts.commandDenied
        : `${i18n.toasts.approvedAt} ${nowTime}`
    );
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
          <span className="w-2 h-2 rounded-full codex-accent-btn animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left Sidebar (Official Codex App Structure) */}
      <LeftSidebar
        lang={lang}
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
          const target = threads.find((th) => th.id === id);
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
          showToast(i18n.toasts.syncedLocal);
        }}
      />

      {/* Main Content Area: Either Active Thread View OR Secondary Feature View */}
      {activeNav === 'threads' ? (
        <div className="flex-1 flex min-w-0 h-full overflow-hidden">
          <CenterThreadView
            lang={lang}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
            rightDrawerOpen={rightDrawerOpen}
            activeRightTab={rightTab}
            onToggleRightDrawer={handleToggleRightDrawer}
            skin={skin}
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
              updateThread(id, (th) => ({ ...th, pinned: !th.pinned }))
            }
            onForkThread={(id) => {
              const forked: Thread = {
                ...activeThread,
                id: `thr_fork_${Date.now()}`,
                title: `${activeThread.title} (Fork)`,
                branch: `${activeThread.branch}-fork`,
                updatedAt: lang === 'zh-CN' ? '刚刚' : 'Just now',
              };
              setThreads((prev) => [forked, ...prev]);
              setActiveThreadId(forked.id);
              sendJsonRpcRequest('thread/fork', { sourceThreadId: id }, appendRpcLog);
              showToast(i18n.toasts.forkedThread);
            }}
            onRevertThread={(id) => {
              updateThread(id, (th) => ({
                ...th,
                turns: th.turns.length > 1 ? th.turns.slice(0, -1) : th.turns,
              }));
              showToast(i18n.toasts.undidLastTurn);
            }}
            onOpenInEditor={async (appId = 'cursor') => {
              const res = await openInExternalApp(
                activeThread.cwd || activeProject.repoPath,
                appId
              );
              if (res.ok) {
                showToast(`${i18n.toasts.openedIn} ${res.openedWith || appId}`);
              } else {
                showToast(`${i18n.toasts.openedIn} ${appId}`);
              }
            }}
            onGitCommitAction={async (action, message) => {
              if (action === 'pr') {
                startStreamingTurnOnThread(
                  activeThread,
                  lang === 'zh-CN'
                    ? `请为分支 ${activeThread.branch} 上的变更生成简明规范的 Pull Request 标题与说明摘要。`
                    : `Create a concise pull request title and summary for the changes on branch ${activeThread.branch}.`,
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
                updateThread(activeThread.id, (th) => ({
                  ...th,
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
                  ? `${i18n.toasts.committedChanges}: "${commitMsg}"`
                  : `${res.error || 'Done'}`
              );
            }}
            onSelectDiffFile={(filePath) => {
              setSelectedDiffFile(filePath);
              setRightTab('diff');
              setRightDrawerOpen(true);
            }}
            onUpdateThreadConfig={async (id, patch, syncToGlobalConfig) => {
              updateThread(id, (th) => ({ ...th, ...patch }));
              if (syncToGlobalConfig && (patch.model || patch.reasoningEffort)) {
                const res = await saveCodexModelPreferences({
                  model: patch.model,
                  reasoningEffort: patch.reasoningEffort,
                });
                if (res.ok && res.status) {
                  setLocalCodexStatus(res.status);
                }
              }
            }}
            onSendMessage={handleSendMessage}
            onSteerTurn={handleSteerTurn}
            onInterruptTurn={handleInterruptTurn}
            onRespondApproval={handleRespondApproval}
          />

          {/* Collapsible Right Review / Files / Terminal / Browser Drawer */}
          {rightDrawerOpen && (
            <RightInspectorPane
              lang={lang}
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
                  updateThread(activeThread.id, (th) => ({
                    ...th,
                    changedFiles: res.git.changedFiles,
                    diffSummary: res.git.diffSummary,
                  }));
                } else {
                  updateThread(activeThread.id, (th) => ({
                    ...th,
                    changedFiles: th.changedFiles.map((f) =>
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
                  updateThread(activeThread.id, (th) => ({
                    ...th,
                    changedFiles: res.git.changedFiles,
                    diffSummary: res.git.diffSummary,
                  }));
                } else {
                  updateThread(activeThread.id, (th) => {
                    const remaining = th.changedFiles.filter((f) => f.filePath !== filePath);
                    return {
                      ...th,
                      changedFiles: remaining,
                      diffSummary: {
                        files: remaining.length,
                        additions: remaining.reduce((s, f) => s + f.additions, 0),
                        deletions: remaining.reduce((s, f) => s + f.deletions, 0),
                      },
                    };
                  });
                }
                showToast(`${i18n.toasts.revertedChanges}: ${filePath}`);
              }}
              onAddInlineComment={(filePath, lineNumber, body) => {
                updateThread(activeThread.id, (th) => ({
                  ...th,
                  changedFiles: th.changedFiles.map((f) =>
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
                              createdAt: lang === 'zh-CN' ? '刚刚' : 'Just now',
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
                  lang === 'zh-CN'
                    ? `请根据以下行级代码评审意见修改代码：\n${allComments.join('\n')}`
                    : `Please address these inline code review comments:\n${allComments.join('\n')}`,
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
                  updateThread(activeThread.id, (th) => ({
                    ...th,
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
                    ? `${i18n.toasts.committedChanges}: "${message}"`
                    : `${res.error || 'Done'}`
                );
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
                }
                showToast(`${i18n.toasts.createdWorktree}: ${branchName}`);
              }}
              onMergeWorktree={async (wtId) => {
                const target = worktrees.find((w) => w.id === wtId);
                if (!target) return;
                showToast(`${i18n.toasts.syncedWorktree}: ${target.branch}`);
              }}
            />
          )}
        </div>
      ) : (
        <MainFeatureViews
          lang={lang}
          onSelectLang={(nextLang) => {
            setLang(nextLang);
            showToast(
              `${t(nextLang).toasts.switchedLang} ${
                nextLang === 'zh-CN' ? '简体中文' : 'English'
              }`
            );
          }}
          activeNav={activeNav}
          onBackToThreads={() => setActiveNav('threads')}
          skin={skin}
          onSelectSkin={(nextSkin) => {
            setSkin(nextSkin);
            const meta = SKIN_METAS.find((m) => m.id === nextSkin);
            showToast(
              `${i18n.toasts.switchedSkin} ${
                lang === 'zh-CN' ? meta?.nameZh || nextSkin : meta?.nameEn || nextSkin
              }`
            );
          }}
          localCodexStatus={localCodexStatus}
          onRefreshLocalStatus={() => {
            syncLocalEnvironmentAndGit();
            showToast(i18n.toasts.syncedLocal);
          }}
          reviewQueue={reviewQueue}
          onApproveReviewItem={(id) => {
            setReviewQueue((prev) =>
              prev.map((item) => (item.id === id ? { ...item, status: 'approved' } : item))
            );
            showToast(i18n.toasts.approvedReview);
          }}
          onRejectReviewItem={(id) => {
            setReviewQueue((prev) =>
              prev.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item))
            );
            showToast(i18n.toasts.discardedReview);
          }}
          onOpenReviewInThread={(item) => {
            setActiveNav('threads');
            handleCreateNewThread(activeProject.id);
            showToast(item.title);
          }}
          skills={skills}
          onToggleSkill={(id) =>
            setSkills((prev) =>
              prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
            )
          }
          onSaveSkill={async (updated) => {
            setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            if (updated.path.startsWith('.codex/')) {
              await writeWorkspaceFile(updated.path, updated.content);
            }
          }}
          onCreateSkill={async (newSkill) => {
            const created: SkillDefinition = {
              ...newSkill,
              id: `sk_${Date.now()}`,
            };
            setSkills((prev) => [created, ...prev]);
            await writeWorkspaceFile(created.path, created.content);
            showToast(`$${created.slug}`);
          }}
          onLaunchSkillThread={(skill) => {
            setActiveNav('threads');
            startStreamingTurnOnThread(
              activeThread,
              lang === 'zh-CN'
                ? `运行技能 $${skill.slug}：${skill.description}`
                : `Run skill $${skill.slug}: ${skill.description}`,
              [],
              [skill.slug],
              'agent'
            );
          }}
          automations={automations}
          onToggleAutomation={(id) =>
            setAutomations((prev) =>
              prev.map((a) =>
                a.id === id
                  ? { ...a, enabled: !a.enabled }
                  : a
              )
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
            showToast(created.name);
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
            showToast(`${i18n.toasts.createdWorktree}: ${branch}`);
          }}
          onMergeWorktree={(id) => {
            const target = worktrees.find((w) => w.id === id);
            if (target) showToast(`${i18n.toasts.syncedWorktree}: ${target.branch}`);
          }}
          onDeleteWorktree={async (id) => {
            const target = worktrees.find((w) => w.id === id);
            if (!target) return;
            const res = await manageGitWorktree(
              'remove',
              target.branch,
              target.path,
              activeProject.repoPath
            );
            if (res.git?.worktrees) {
              setWorktrees(res.git.worktrees);
            } else {
              setWorktrees((prev) => prev.filter((w) => w.id !== id));
            }
            showToast(`${i18n.toasts.removedWorktree}: ${target.branch}`);
          }}
          onJumpToWorktreeThread={(wt) => {
            updateThread(activeThread.id, (th) => ({
              ...th,
              worktreeId: wt.id,
              branch: wt.branch,
              cwd: wt.path,
              environmentMode: wt.isMain ? 'local' : 'worktree',
            }));
            setActiveNav('threads');
            showToast(wt.branch);
          }}
          subagents={subagents}
          onSaveSubagent={(updated) =>
            setSubagents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
          }
          onCreateSubagent={(newAgent) =>
            setSubagents((prev) => [{ ...newAgent, id: `sub_${Date.now()}` }, ...prev])
          }
          agentsMdContent={agentsMdContent}
          onSaveAgentsMd={async (content) => {
            setAgentsMdContent(content);
            await writeWorkspaceFile('AGENTS.md', content);
            showToast('AGENTS.md');
          }}
          sandboxPolicy={sandboxPolicy}
          onUpdateSandboxPolicy={(patch) =>
            setSandboxPolicy((prev) => ({ ...prev, ...patch }))
          }
        />
      )}

      {/* Command Palette (Cmd+K) */}
      <CommandPaletteModal
        lang={lang}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        threads={threads}
        skills={skills}
        worktrees={worktrees}
        onSelectThread={setActiveThreadId}
        onSelectNav={setActiveNav}
        onCreateNewThread={() => handleCreateNewThread(activeProject.id)}
        onSpawnParallelAgents={() => setActiveNav('codex_config')}
        onInvokeSkill={(slug) => {
          setActiveNav('threads');
          startStreamingTurnOnThread(
            activeThread,
            `Run $${slug} on this repository.`,
            [],
            [slug],
            'agent'
          );
        }}
      />

      {/* JSON-RPC 2.0 Lite Inspector Modal */}
      <RpcInspectorModal
        lang={lang}
        isOpen={isRpcInspectorOpen}
        onClose={() => setIsRpcInspectorOpen(false)}
        logs={rpcLogs}
        onClearLogs={() => setRpcLogs([])}
        onSendTestRpc={(method, params) =>
          sendJsonRpcRequest(method, params, appendRpcLog)
        }
      />
    </div>
  );
}
export default App;
