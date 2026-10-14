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
  createWorkspaceDirectory,
  fetchGitStatus,
  fetchLocalCodexStatus,
  fetchWorkspaces,
  fetchWorkspaceFileTree,
  manageGitWorktree,
  openInExternalApp,
  pickNativeWorkspaceFolder,
  readWorkspaceFile,
  removeWorkspaceDirectory,
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
import {
  CommandPaletteModal,
  RpcInspectorModal,
  WorkspaceManagerModal,
} from './components/Modals';
import { t, SKIN_METAS } from './i18n/translations';
import {
  canUseLocalBridge,
  DEFAULT_HOME_PATH,
  DEFAULT_USER_NAME,
  IS_PUBLIC_SITE,
  setLocalBridgeAccess,
} from './services/runtimeConfig';

const VALID_SKINS: ThemeSkin[] = ['codex', 'wechat', 'qq', 'dingtalk'];
const VALID_LANGS: AppLanguage[] = ['zh-CN', 'en-US'];

export function App() {
  const [lang, setLang] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('codex_desktop_lang_v2') as AppLanguage | null;
    return saved && VALID_LANGS.includes(saved) ? saved : 'zh-CN';
  });

  const [skin, setSkin] = useState<ThemeSkin>(() => {
    const saved = localStorage.getItem('codex_desktop_skin_v3') as ThemeSkin | null;
    return saved && VALID_SKINS.includes(saved) ? saved : 'codex';
  });

  const i18n = t(lang);

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin);
    localStorage.setItem('codex_desktop_skin_v3', skin);
  }, [skin]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('codex_desktop_lang_v2', lang);
  }, [lang]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<NavSection>('threads');
  const [rightTab, setRightTab] = useState<RightPanelTab>('diff');
  const [layoutMode] = useState<WorkspaceLayoutMode>('standard');

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
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [bridgeConnecting, setBridgeConnecting] = useState(false);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeError, setBridgeError] = useState('');

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

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const activeThread = useMemo(
    () => threads.find((th) => th.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );

  // Sync Local Machine Codex Status, Workspaces, ~/.codex/sessions, ~/.codex/skills, and live Git diffs
  const syncLocalEnvironmentAndGit = async (overrideCwd?: string) => {
    if (!canUseLocalBridge()) return;
    const targetCwd = overrideCwd || activeProject?.repoPath;
    const [wsData, codexStatus, gitState, tree, agentsMd] = await Promise.all([
      fetchWorkspaces(),
      fetchLocalCodexStatus(targetCwd),
      fetchGitStatus(targetCwd),
      fetchWorkspaceFileTree(targetCwd),
      readWorkspaceFile('AGENTS.md', targetCwd),
    ]);

    const effectiveWorkspaces =
      wsData?.workspaces && wsData.workspaces.length > 0
        ? wsData.workspaces
        : projects;

    if (wsData?.workspaces && wsData.workspaces.length > 0) {
      setProjects(wsData.workspaces);
    }
    if (tree.length > 0) setFileTree(tree);
    if (agentsMd) setAgentsMdContent(agentsMd);

    if (codexStatus) {
      setLocalCodexStatus(codexStatus);

      if (Array.isArray(codexStatus.localSkills) && codexStatus.localSkills.length > 0) {
        setSkills((prev) => {
          const existingSlugs = new Set(prev.map((s) => s.slug));
          const added = codexStatus.localSkills.filter((s) => !existingSlugs.has(s.slug));
          return [...added, ...prev];
        });
      }

      if (Array.isArray(codexStatus.localSessions) && codexStatus.localSessions.length > 0) {
        const normPath = (p?: string) => (p || '').trim().replace(/[\\/]+$/, '');
        const workspaceByPath = new Map(
          effectiveWorkspaces.map((w) => [normPath(w.repoPath), w])
        );

        const importedThreads: Thread[] = codexStatus.localSessions
          .filter((sess) => workspaceByPath.has(normPath(sess.cwd)))
          .map((sess) => {
            const matchedProj = workspaceByPath.get(normPath(sess.cwd))!;
            return {
              id: sess.id,
              cliSessionId: sess.cliSessionId,
              projectId: matchedProj.id,
              title: sess.title,
              pinned: false,
              isLocalCliSession: true,
              status: 'completed',
              worktreeId: 'wt_main',
              branch: sess.branch || 'main',
              cwd: matchedProj.repoPath,
              environmentMode: 'local',
              permissionMode: 'full-access',
              model: sess.model || codexStatus.config.effective.model || 'gpt-6.1-sol',
              personality: 'pragmatic',
              reasoningEffort:
                (codexStatus.config.effective.reasoningEffort as any) || 'xhigh',
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
                        model:
                          sess.model || codexStatus.config.effective.model || 'gpt-6.1-sol',
                        personality: 'pragmatic',
                        reasoningEffort: 'xhigh',
                        items: sess.items,
                      },
                    ]
                  : [],
              changedFiles: [],
            };
          });

        setThreads((prev) => {
          const activeTitles = new Set(
            prev
              .filter((th) => !th.isLocalCliSession && th.turns.length > 0)
              .map((th) => th.title)
          );
          const importedMap = new Map(importedThreads.map((th) => [th.id, th]));
          const updatedPrev = prev
            .filter(
              (th) =>
                !th.isLocalCliSession ||
                workspaceByPath.has(normPath(th.cwd))
            )
            .map((th) => (importedMap.has(th.id) ? importedMap.get(th.id)! : th));
          const existingIds = new Set(updatedPrev.map((th) => th.id));
          const fresh = importedThreads.filter(
            (th) => !existingIds.has(th.id) && !activeTitles.has(th.title)
          );
          return [...updatedPrev, ...fresh];
        });
      }
    }

    if (gitState) {
      if (gitState.worktrees && gitState.worktrees.length > 0) {
        setWorktrees(gitState.worktrees);
      }
      if (gitState.changedFiles) {
        setThreads((prev) =>
          prev.map((th) =>
            th.id === activeThreadId
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
    if (IS_PUBLIC_SITE) return;
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

  const handleConnectLocalBridge = async () => {
    if (bridgeConnecting) return;
    setBridgeConnecting(true);
    setBridgeError('');
    setLocalBridgeAccess(true);
    try {
      const health = await checkAppServerHealth();
      if (!health.connected) {
        throw new Error('连接失败：请启动本机服务，并允许浏览器访问本地网络后重试。');
      }
      const workspaceData = await fetchWorkspaces();
      const workspace = workspaceData?.workspaces[0];
      if (!workspace) {
        throw new Error('本机服务尚未返回工作目录，请在本机应用中添加项目后重试。');
      }
      setProjects(workspaceData.workspaces);
      setActiveProjectId(workspace.id);
      setThreads((previous) => previous.map((thread) => ({
        ...thread,
        projectId: workspace.id,
        cwd: workspace.repoPath,
      })));
      await sendJsonRpcRequest('initialize', {
        clientInfo: { name: 'codex_web', title: 'Codex 工作台', version: '1.0.0' },
        capabilities: { experimentalApi: true },
      }, appendRpcLog);
      await syncLocalEnvironmentAndGit(workspace.repoPath);
      setBridgeConnected(true);
    } catch (error) {
      setLocalBridgeAccess(false);
      setBridgeError(error instanceof Error ? error.message : '无法连接本机服务。');
    } finally {
      setBridgeConnecting(false);
    }
  };

  // Switch active workspace project and sync its directory, file tree & git status
  const handleSelectProject = async (projectId: string) => {
    setActiveProjectId(projectId);
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    // Update current empty thread's cwd or switch to a thread in this project
    setThreads((prev) =>
      prev.map((th) =>
        th.id === activeThreadId && th.turns.length === 0
          ? { ...th, projectId: targetProj.id, cwd: targetProj.repoPath }
          : th
      )
    );

    await syncLocalEnvironmentAndGit(targetProj.repoPath);
    showToast(`已切换工作空间目录: ${targetProj.repoPath}`);
  };

  const handleCreateOrImportWorkspace = async (params: {
    parentDir?: string;
    folderName?: string;
    fullPath?: string;
    initGit?: boolean;
  }) => {
    const res = await createWorkspaceDirectory(params);
    if (res.ok && res.workspace) {
      if (res.workspaces) setProjects(res.workspaces);
      setActiveProjectId(res.workspace.id);
      if (res.tree) setFileTree(res.tree);
      // Create or bind a fresh thread in this new workspace
      const newThread: Thread = {
        id: `thr_${Date.now()}`,
        projectId: res.workspace.id,
        title: lang === 'zh-CN' ? '新聊天' : 'New chat',
        pinned: false,
        status: 'completed',
        worktreeId: 'wt_main',
        branch: res.git?.branch || 'main',
        cwd: res.workspace.repoPath,
        environmentMode: 'local',
        permissionMode: 'full-access',
        daybreakEnabled: false,
        model: activeThread?.model || 'gpt-6.1-sol',
        personality: 'pragmatic',
        reasoningEffort: activeThread?.reasoningEffort || 'xhigh',
        subagent: 'default',
        updatedAt: '刚刚',
        tokenUsage: '0 tokens',
        diffSummary: res.git?.diffSummary || { files: 0, additions: 0, deletions: 0 },
        turns: [],
        changedFiles: res.git?.changedFiles || [],
        goal: null,
      };
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
      setActiveNav('threads');
      showToast(`已创建并打开工作空间: ${res.workspace.repoPath}`);
    } else if (res.error) {
      showToast(`创建工作空间失败: ${res.error}`);
    }
  };

  const handlePickNativeFolder = async () => {
    const res = await pickNativeWorkspaceFolder();
    if (res.ok && res.workspace) {
      if (res.workspaces) setProjects(res.workspaces);
      setActiveProjectId(res.workspace.id);
      if (res.tree) setFileTree(res.tree);
      setThreads((prev) =>
        prev.map((th) =>
          th.id === activeThreadId && th.turns.length === 0
            ? { ...th, projectId: res.workspace!.id, cwd: res.workspace!.repoPath }
            : th
        )
      );
      await syncLocalEnvironmentAndGit(res.workspace.repoPath);
      showToast(`已导入并切换至工作目录: ${res.workspace.repoPath}`);
    }
  };

  const handleRemoveWorkspace = async (projectId: string) => {
    const res = await removeWorkspaceDirectory(projectId);
    if (res.ok && res.workspaces && res.workspaces.length > 0) {
      setProjects(res.workspaces);
      if (activeProjectId === projectId) {
        setActiveProjectId(res.workspaces[0].id);
      }
      showToast('已从工作空间列表移除');
    }
  };

  // Keyboard shortcuts
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
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setIsWorkspaceModalOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rightTab]);

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

  const startStreamingTurnOnThread = (
    targetThread: Thread,
    prompt: string,
    attachedFiles: string[] = [],
    invokedSkills: string[] = [],
    mode: ComposerMode = 'agent',
    goalObjective?: string
  ) => {
    if (!canUseLocalBridge() || (IS_PUBLIC_SITE && !bridgeConnected)) {
      showToast('请先点击顶部的“连接本机服务”，再发送任务。');
      return;
    }
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
      projectId: activeProject.id,
      cwd: th.cwd || activeProject.repoPath,
      title:
        th.turns.length === 0 ||
        th.title === 'New thread' ||
        th.title === '新建会话' ||
        th.title === '新聊天'
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
      daybreakEnabled: targetThread.daybreakEnabled,
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

  const handleCreateNewThread = (projectId?: string) => {
    const targetProjId = projectId || activeProject.id;
    const targetProj =
      projects.find((p) => p.id === targetProjId) || activeProject;
    const defaultModel =
      localCodexStatus?.config?.effective?.model || 'gpt-6.1-sol';
    const defaultEffort =
      (localCodexStatus?.config?.effective?.reasoningEffort as any) || 'xhigh';

    const newThread: Thread = {
      id: `thr_${Date.now()}`,
      projectId: targetProj.id,
      title: lang === 'zh-CN' ? '新聊天' : 'New chat',
      pinned: false,
      status: 'completed',
      worktreeId: 'wt_main',
      branch: activeThread?.branch || 'main',
      cwd: targetProj.repoPath,
      environmentMode: 'local',
      permissionMode: 'full-access',
      daybreakEnabled: false,
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
      { model: newThread.model, cwd: targetProj.repoPath },
      appendRpcLog
    );
  };

  const handleSendMessage = async (params: {
    prompt: string;
    attachedFiles: string[];
    invokedSkills: string[];
    createNewWorktree?: boolean;
    mode?: ComposerMode;
    goalObjective?: string;
  }) => {
    if (!canUseLocalBridge() || (IS_PUBLIC_SITE && !bridgeConnected)) {
      showToast('请先点击顶部的“连接本机服务”，再发送任务。');
      return;
    }
    let targetThread = {
      ...activeThread,
      projectId: activeProject.id,
      cwd: activeThread.cwd || activeProject.repoPath,
    };

    if (params.createNewWorktree && targetThread.worktreeId === 'wt_main') {
      const slug = Math.random().toString(36).slice(2, 6);
      const branch = `codex/task-${slug}`;
      const wtRes = await manageGitWorktree('create', branch, undefined, activeProject.repoPath);
      const wtId = `wt_${Date.now()}`;
      const wtPath =
        wtRes.worktreePath ||
        `${DEFAULT_HOME_PATH}/.codex/worktrees/${activeProject.name}/task-${slug}`;

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
        ...targetThread,
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
    <div className="h-screen w-screen overflow-hidden flex flex-col codex-app-bg">
      {IS_PUBLIC_SITE && (
        <aside className="shrink-0 border-b codex-border px-4 py-3 flex flex-wrap items-center gap-3 text-xs codex-text-primary">
          <div className="flex-1 min-w-0" role="status">
            <p className="font-semibold">{bridgeConnected ? '已连接你的本机 Codex 服务' : 'Codex 网页工作台'}</p>
            <p className="mt-1 codex-text-secondary">
              {bridgeError || (bridgeConnected
                ? '文件、终端和任务在你的电脑上运行。刷新页面会断开连接。'
                : '执行任务需连接你自己的电脑。请先安装桌面版APP，再连接本机服务。')}
            </p>
          </div>
          <button
            type="button"
            disabled={bridgeConnecting}
            onClick={() => {
              if (bridgeConnected) {
                setLocalBridgeAccess(false);
                window.location.reload();
              } else {
                void handleConnectLocalBridge();
              }
            }}
            className="shrink-0 rounded-lg px-3 py-2 codex-accent-btn text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {bridgeConnecting ? '正在连接…' : bridgeConnected ? '断开连接' : '连接本机服务'}
          </button>
        </aside>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-xl codex-elevated border codex-border text-xs font-medium codex-text-primary shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full codex-accent-btn animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left Sidebar (with fixed Red Box 1 & Red Box 2 layout + Multi-Workspace controls) */}
      <LeftSidebar
        lang={lang}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        projects={projects}
        activeProjectId={activeProject.id}
        onSelectProject={handleSelectProject}
        onToggleProjectExpand={(projId) =>
          setProjects((prev) =>
            prev.map((p) => (p.id === projId ? { ...p, expanded: !p.expanded } : p))
          )
        }
        onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        onRemoveProject={handleRemoveWorkspace}
        threads={threads}
        activeThreadId={activeThread.id}
        onSelectThread={(id) => {
          setActiveThreadId(id);
          const target = threads.find((th) => th.id === id);
          if (target?.changedFiles[0]) {
            setSelectedDiffFile(target.changedFiles[0].filePath);
          }
        }}
        onDeleteThread={(threadId) => {
          setThreads((prev) => {
            const next = prev.filter((th) => th.id !== threadId);
            if (activeThreadId === threadId && next[0]) {
              setActiveThreadId(next[0].id);
            }
            return next.length > 0 ? next : prev;
          });
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

      {activeNav === 'threads' ? (
        <div className="flex-1 flex min-w-0 h-full min-h-0 overflow-hidden">
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
            onSelectProject={handleSelectProject}
            onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
            onPickNativeFolder={handlePickNativeFolder}
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

          {rightDrawerOpen && (
            <RightInspectorPane
              lang={lang}
              activeTab={rightTab}
              onTabChange={setRightTab}
              onClose={() => setRightDrawerOpen(false)}
              onRefreshGit={() => syncLocalEnvironmentAndGit(activeProject.repoPath)}
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
                              author: localCodexStatus?.auth?.name || DEFAULT_USER_NAME,
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
                  f.comments.map((c) => `${f.filePath}:${c.lineNumber} - ${c.body}`)
                );
                const feedbackPrompt =
                  allComments.length > 0
                    ? `请根据以下行内代码审查意见修复代码：\n${allComments.join('\n')}`
                    : '请审查并优化当前未提交的代码变更。';
                startStreamingTurnOnThread(
                  activeThread,
                  feedbackPrompt,
                  [],
                  [],
                  'agent'
                );
              }}
              onCommitChanges={async (msg: string, push?: boolean) => {
                const res = await commitGitChanges(
                  msg,
                  !!push,
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
                    ? `${i18n.toasts.committedChanges}: "${msg}"`
                    : `${res.error || 'Done'}`
                );
              }}
              onCreateWorktree={async (branchName: string) => {
                const res = await manageGitWorktree(
                  'create',
                  branchName,
                  undefined,
                  activeProject.repoPath
                );
                if (res.git?.worktrees) {
                  setWorktrees(res.git.worktrees);
                }
                showToast(`${i18n.toasts.createdWorktree} ${branchName}`);
              }}
              onMergeWorktree={() => showToast(i18n.toasts.syncedWorktree)}
            />
          )}
        </div>
      ) : (
        <MainFeatureViews
          lang={lang}
          onSelectLang={(nextLang: AppLanguage) => {
            setLang(nextLang);
            showToast(
              `${i18n.toasts.switchedLang} ${
                nextLang === 'zh-CN' ? '简体中文' : 'English'
              }`
            );
          }}
          activeNav={activeNav}
          onBackToThreads={() => setActiveNav('threads')}
          skin={skin}
          onSelectSkin={(nextSkin: ThemeSkin) => {
            setSkin(nextSkin);
            const meta = SKIN_METAS.find((s) => s.id === nextSkin);
            showToast(
              `${i18n.toasts.switchedSkin} ${
                lang === 'zh-CN' ? meta?.nameZh : meta?.nameEn
              }`
            );
          }}
          localCodexStatus={localCodexStatus}
          onRefreshLocalStatus={() => syncLocalEnvironmentAndGit(activeProject.repoPath)}
          reviewQueue={reviewQueue}
          onApproveReviewItem={(id: string) => {
            setReviewQueue((prev) =>
              prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r))
            );
            showToast(i18n.toasts.approvedReview);
          }}
          onRejectReviewItem={(id: string) => {
            setReviewQueue((prev) =>
              prev.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r))
            );
            showToast(i18n.toasts.discardedReview);
          }}
          onOpenReviewInThread={(item: ReviewQueueItem) => {
            if (item.threadId) {
              setActiveThreadId(item.threadId);
            }
            setActiveNav('threads');
            setRightTab('diff');
            setRightDrawerOpen(true);
          }}
          skills={skills}
          onToggleSkill={(id: string) =>
            setSkills((prev) =>
              prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
            )
          }
          onSaveSkill={(updatedSkill: SkillDefinition) => {
            setSkills((prev) =>
              prev.map((s) => (s.id === updatedSkill.id ? updatedSkill : s))
            );
          }}
          onCreateSkill={(newSkill: Omit<SkillDefinition, 'id'>) => {
            const id = `skill_custom_${Date.now()}`;
            const content = `---\nname: ${newSkill.slug}\ndescription: ${newSkill.description}\n---\n\n# ${newSkill.name}\n\n${newSkill.description}\n`;
            setSkills((prev) => [
              {
                ...newSkill,
                id,
                author: localCodexStatus?.auth?.name || DEFAULT_USER_NAME,
                version: '1.0.0',
                enabled: true,
                builtIn: false,
                path: `.codex/skills/${newSkill.slug}/SKILL.md`,
                content,
              },
              ...prev,
            ]);
            writeWorkspaceFile(
              `.codex/skills/${newSkill.slug}/SKILL.md`,
              content,
              activeProject.repoPath
            );
          }}
          onLaunchSkillThread={(skill: SkillDefinition) => {
            setActiveNav('threads');
            startStreamingTurnOnThread(
              activeThread,
              skill.samplePrompt || `Use $${skill.slug} on this repository.`,
              [],
              [skill.slug],
              'agent'
            );
          }}
          automations={automations}
          onToggleAutomation={(id: string) =>
            setAutomations((prev) =>
              prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
            )
          }
          onRunAutomationNow={(id: string) => {
            const target = automations.find((a) => a.id === id);
            if (!target) return;
            setActiveNav('threads');
            startStreamingTurnOnThread(
              activeThread,
              target.prompt,
              [],
              target.skills,
              'agent'
            );
          }}
          onCreateAutomation={(auto) => {
            setAutomations((prev) => [
              {
                ...auto,
                id: `auto_${Date.now()}`,
                enabled: true,
                lastRunAt: '就绪',
                nextRunAt: '已计划',
                status: 'idle',
                totalRuns: 0,
              },
              ...prev,
            ]);
          }}
          worktrees={worktrees}
          onCreateWorktree={async (branch: string) => {
            const res = await manageGitWorktree(
              'create',
              branch,
              undefined,
              activeProject.repoPath
            );
            if (res.git?.worktrees) {
              setWorktrees(res.git.worktrees);
            }
            showToast(`${i18n.toasts.createdWorktree} ${branch}`);
          }}
          onMergeWorktree={() => showToast(i18n.toasts.syncedWorktree)}
          onDeleteWorktree={async (id: string) => {
            const target = worktrees.find((w) => w.id === id);
            if (target) {
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
              showToast(`${i18n.toasts.removedWorktree} ${target.branch}`);
            }
          }}
          onJumpToWorktreeThread={(wt: WorktreeInfo) => {
            if (wt.boundThreadId) {
              setActiveThreadId(wt.boundThreadId);
            }
            setActiveNav('threads');
          }}
          subagents={subagents}
          onSaveSubagent={(updated: SubagentConfig) =>
            setSubagents((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            )
          }
          onCreateSubagent={(sub: Omit<SubagentConfig, 'id'>) =>
            setSubagents((prev) => [
              ...prev,
              {
                ...sub,
                id: `sub_${Date.now()}`,
              },
            ])
          }
          sandboxPolicy={sandboxPolicy}
          onUpdateSandboxPolicy={(patch: Partial<SandboxPolicy>) =>
            setSandboxPolicy((prev) => ({ ...prev, ...patch }))
          }
          agentsMdContent={agentsMdContent}
          onSaveAgentsMd={async (content: string) => {
            setAgentsMdContent(content);
            await writeWorkspaceFile('AGENTS.md', content, activeProject.repoPath);
            showToast(i18n.inspector.saved);
          }}
        />
      )}

      {/* Workspace Manager Modal (Create / Import / Switch Working Directories) */}
      <WorkspaceManagerModal
        lang={lang}
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        projects={projects}
        activeProjectId={activeProject.id}
        onSelectProject={handleSelectProject}
        onCreateWorkspace={handleCreateOrImportWorkspace}
        onPickNativeFolder={handlePickNativeFolder}
        onRemoveWorkspace={handleRemoveWorkspace}
      />

      {/* Command Palette (`Cmd+K`) */}
      <CommandPaletteModal
        lang={lang}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        threads={threads}
        skills={skills}
        worktrees={worktrees}
        onSelectThread={setActiveThreadId}
        onSelectNav={setActiveNav}
        onCreateNewThread={() => handleCreateNewThread()}
        onSpawnParallelAgents={() => setActiveNav('codex_config')}
        onInvokeSkill={(slug) => {
          setActiveNav('threads');
          startStreamingTurnOnThread(
            activeThread,
            `Use $${slug} on this repository.`,
            [],
            [slug],
            'agent'
          );
        }}
      />

      {/* JSON-RPC 2.0 Protocol Inspector */}
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
    </div>
  );
}

export default App;
