import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  MessageSquare,
  Sparkles,
  GitBranch,
  Activity,
  Palette,
  Inbox,
  Send,
  Plus,
  Settings,
  FolderPlus,
  FolderOpen,
  Folder,
  ArrowUp,
  Check,
  Trash2,
} from 'lucide-react';
import {
  AppLanguage,
  JsonRpcLogEntry,
  NavSection,
  ProjectWorkspace,
  SkillDefinition,
  Thread,
  WorktreeInfo,
} from '../types/codex';
import {
  fetchDirectorySubfolders,
  SubfolderEntry,
} from '../services/appServerClient';
import { t } from '../i18n/translations';
import { DEFAULT_DESKTOP_PATH, DEFAULT_HOME_PATH, IS_PUBLIC_SITE } from '../services/runtimeConfig';

interface WorkspaceManagerModalProps {
  lang: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectWorkspace[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateWorkspace: (params: {
    parentDir?: string;
    folderName?: string;
    fullPath?: string;
    initGit?: boolean;
  }) => Promise<void>;
  onPickNativeFolder: () => Promise<void>;
  onRemoveWorkspace: (projectId: string) => Promise<void>;
}

export const WorkspaceManagerModal: React.FC<WorkspaceManagerModalProps> = ({
  lang,
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateWorkspace,
  onPickNativeFolder,
  onRemoveWorkspace,
}) => {
  const [tab, setTab] = useState<'create' | 'browse' | 'manage'>('create');
  const [parentDir, setParentDir] = useState(DEFAULT_DESKTOP_PATH);
  const [folderName, setFolderName] = useState('');
  const [initGit, setInitGit] = useState(true);
  const [browseDir, setBrowseDir] = useState(DEFAULT_DESKTOP_PATH);
  const [browseParentDir, setBrowseParentDir] = useState(DEFAULT_HOME_PATH);
  const [subfolders, setSubfolders] = useState<SubfolderEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchDirectorySubfolders(browseDir).then((res) => {
      if (res) {
        setBrowseDir(res.currentDir);
        setBrowseParentDir(res.parentDir);
        setSubfolders(res.folders);
        setParentDir((previous) => previous || res.currentDir);
      }
    });
  }, [isOpen, browseDir]);

  if (!isOpen) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setLoading(true);
    try {
      await onCreateWorkspace({
        parentDir: parentDir.trim() || undefined,
        folderName: folderName.trim(),
        initGit,
      });
      setFolderName('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#1E1E20] border border-white/10 shadow-2xl overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-4 h-4 text-[#2B7FFF]" />
            <h3 className="text-sm font-semibold">
              {lang === 'zh-CN'
                ? '工作空间与项目目录管理 (新建 / 导入 / 切换)'
                : 'Workspace & Working Directory Manager'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-[#8E8E93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs + Native Finder Button */}
        <div className="px-5 py-2.5 bg-[#18181A] border-b border-white/[0.08] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === 'create'
                  ? 'bg-[#2B7FFF] text-white'
                  : 'text-[#A1A1A6] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              + 新建工作目录
            </button>
            <button
              type="button"
              onClick={() => setTab('browse')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === 'browse'
                  ? 'bg-[#2B7FFF] text-white'
                  : 'text-[#A1A1A6] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              浏览本机目录导入
            </button>
            <button
              type="button"
              onClick={() => setTab('manage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === 'manage'
                  ? 'bg-[#2B7FFF] text-white'
                  : 'text-[#A1A1A6] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              已连接项目 ({projects.length})
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              try {
                await onPickNativeFolder();
                onClose();
              } finally {
                setLoading(false);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#4DA3FF]" />
            <span>打开系统 Finder 选择/新建文件夹...</span>
          </button>
        </div>

        {/* Tab 1: Create New Working Directory */}
        {tab === 'create' && (
          <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#A1A1A6]">
                父级目录路径 (Parent Directory)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={parentDir}
                  onChange={(e) => setParentDir(e.target.value)}
                  placeholder={DEFAULT_DESKTOP_PATH || '连接本机服务后选择目录'}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#141416] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#2B7FFF]"
                />
                <button
                  type="button"
                  onClick={() => setParentDir(DEFAULT_DESKTOP_PATH || browseDir)}
                  className="px-2.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-xs text-[#A1A1A6] hover:text-white"
                >
                  {IS_PUBLIC_SITE ? '当前目录' : '桌面 (Desktop)'}
                </button>
                <button
                  type="button"
                  onClick={() => setParentDir(DEFAULT_HOME_PATH || browseParentDir)}
                  className="px-2.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-xs text-[#A1A1A6] hover:text-white"
                >
                  {IS_PUBLIC_SITE ? '上级目录' : '主目录 (~)'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#A1A1A6]">
                新工作空间 / 文件夹名称 (New Workspace Folder Name)
              </label>
              <input
                type="text"
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="例如: my-codex-app 或 ai-agent-demo"
                className="w-full px-3 py-2 rounded-xl bg-[#141416] border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-[#2B7FFF]"
              />
              <div className="text-[11px] font-mono text-[#6E6E73]">
                完整创建路径: {parentDir.replace(/\/$/, '')}/
                {folderName.trim() || '<新文件夹名称>'}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#A1A1A6] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={initGit}
                onChange={(e) => setInitGit(e.target.checked)}
              />
              <span>自动初始化 Git 仓库 (`git init`)，支持代码差异审查与工作树隔离</span>
            </label>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs text-[#A1A1A6] hover:text-white hover:bg-white/[0.06]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!folderName.trim() || loading}
                className="px-4 py-2 rounded-xl bg-[#2B7FFF] hover:bg-[#1E6FEF] disabled:opacity-40 text-xs font-medium text-white flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>立即创建并切换到该工作目录</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Browse Local Directories to Import */}
        {tab === 'browse' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 bg-[#141416] px-3 py-2 rounded-xl border border-white/10">
              <div className="text-xs font-mono text-[#A1A1A6] truncate">
                当前浏览: <span className="text-white">{browseDir}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setBrowseDir(browseParentDir)}
                  className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-xs flex items-center gap-1"
                >
                  <ArrowUp className="w-3 h-3" />
                  <span>上级目录</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onCreateWorkspace({ fullPath: browseDir, initGit: false });
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#2B7FFF] text-white text-xs font-medium"
                >
                  直接选用此目录
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {subfolders.map((folder) => {
                const isAlreadyAdded = projects.some((p) => p.repoPath === folder.path);
                return (
                  <div
                    key={folder.path}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#18181A] hover:bg-white/[0.06] border border-white/[0.05] text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setBrowseDir(folder.path)}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                    >
                      <Folder className="w-4 h-4 text-[#4DA3FF] shrink-0" />
                      <span className="font-medium text-white truncate">
                        {folder.name}
                      </span>
                      {folder.isGitRepo && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 shrink-0">
                          Git
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await onCreateWorkspace({
                          fullPath: folder.path,
                          initGit: false,
                        });
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-[#2B7FFF] text-white text-[11px] font-medium shrink-0 transition-colors"
                    >
                      {isAlreadyAdded ? '切换至此项目' : '导入并打开'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Manage Connected Projects */}
        {tab === 'manage' && (
          <div className="p-5 max-h-80 overflow-y-auto space-y-2">
            {projects.map((p) => {
              const isActive = p.id === activeProjectId;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${
                    isActive
                      ? 'bg-[#2B7FFF]/15 border-[#2B7FFF]/40'
                      : 'bg-[#18181A] border-white/[0.07]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(p.id);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                  >
                    <Folder className="w-4 h-4 text-[#4DA3FF] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-white flex items-center gap-2">
                        <span>{p.name}</span>
                        {isActive && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#2B7FFF] text-white">
                            当前工作空间
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#8E8E93] truncate">
                        {p.repoPath}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(p.id);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/15 text-white text-[11px]"
                      >
                        切换
                      </button>
                    )}
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveWorkspace(p.id)}
                        title="从列表移除"
                        className="p-1.5 rounded-lg text-[#8E8E93] hover:text-rose-400 hover:bg-white/[0.06]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface CommandPaletteModalProps {
  lang: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  threads: Thread[];
  skills: SkillDefinition[];
  worktrees: WorktreeInfo[];
  onSelectThread: (threadId: string) => void;
  onSelectNav: (nav: NavSection) => void;
  onCreateNewThread: () => void;
  onSpawnParallelAgents: () => void;
  onInvokeSkill: (slug: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  lang,
  isOpen,
  onClose,
  threads,
  skills,
  worktrees,
  onSelectThread,
  onSelectNav,
  onCreateNewThread,
  onSpawnParallelAgents,
  onInvokeSkill,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const i18n = t(lang);
  const q = query.toLowerCase().trim();

  const matchingThreads = threads.filter(
    (th) => th.title.toLowerCase().includes(q) || th.branch.toLowerCase().includes(q)
  );
  const matchingSkills = skills.filter(
    (s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
  );
  const matchingWorktrees = worktrees.filter(
    (w) => w.branch.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl codex-elevated border codex-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3.5 border-b codex-border flex items-center gap-3">
          <Search className="w-4 h-4 codex-accent-text" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={i18n.modals.searchPlaceholder}
            className="flex-1 bg-transparent text-sm codex-text-primary placeholder:codex-text-muted focus:outline-none font-sans"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg codex-hover codex-text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2 space-y-4">
          <div>
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider codex-text-muted">
              {i18n.modals.actions}
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  onCreateNewThread();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl codex-hover text-xs codex-text-primary"
              >
                <span className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 codex-accent-text" />
                  <span>{i18n.modals.newThread}</span>
                </span>
                <kbd className="text-[10px] font-mono codex-text-muted">⌘N</kbd>
              </button>

              <button
                onClick={() => {
                  onSpawnParallelAgents();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl codex-hover text-xs codex-text-primary"
              >
                <span className="flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 codex-accent-text" />
                  <span>{i18n.modals.switchSkinInSettings}</span>
                </span>
                <span className="text-[10px] font-mono codex-text-muted">Skin</span>
              </button>

              <button
                onClick={() => {
                  onSelectNav('codex_config');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl codex-hover text-xs codex-text-primary"
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 codex-accent-text" />
                  <span>{i18n.modals.openLocalSettings}</span>
                </span>
                <span className="text-[10px] font-mono codex-text-muted">~/.codex</span>
              </button>

              <button
                onClick={() => {
                  onSelectNav('review_queue');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl codex-hover text-xs codex-text-primary"
              >
                <span className="flex items-center gap-2">
                  <Inbox className="w-3.5 h-3.5 text-amber-500" />
                  <span>{i18n.modals.openReviewQueue}</span>
                </span>
                <span className="text-[10px] font-mono codex-text-muted">Queue</span>
              </button>
            </div>
          </div>

          {matchingThreads.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider codex-text-muted">
                {i18n.sidebar.threads}
              </div>
              <div className="space-y-0.5">
                {matchingThreads.map((th) => (
                  <button
                    key={th.id}
                    onClick={() => {
                      onSelectNav('threads');
                      onSelectThread(th.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl codex-hover text-xs codex-text-primary"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-3.5 h-3.5 codex-accent-text shrink-0" />
                      <span className="truncate">{th.title}</span>
                    </span>
                    <span className="text-[10px] font-mono codex-text-muted shrink-0 ml-2">
                      {th.branch}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingSkills.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider codex-text-muted">
                {i18n.sidebar.skills}
              </div>
              <div className="space-y-0.5">
                {matchingSkills.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onInvokeSkill(s.slug);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl codex-hover text-xs codex-text-primary"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 codex-accent-text" />
                      <span className="font-mono codex-accent-text">${s.slug}</span>
                      <span className="codex-text-secondary">— {s.name}</span>
                    </span>
                    <span className="text-[10px] font-mono codex-text-muted">Run</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingWorktrees.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider codex-text-muted">
                {i18n.sidebar.worktrees}
              </div>
              <div className="space-y-0.5">
                {matchingWorktrees.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      onSelectNav('worktrees');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl codex-hover text-xs codex-text-primary"
                  >
                    <span className="flex items-center gap-2 font-mono">
                      <GitBranch className="w-3.5 h-3.5 codex-accent-text" />
                      <span>{w.branch}</span>
                    </span>
                    <span className="text-[10px] font-mono codex-text-muted">
                      {w.headCommit}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface RpcInspectorModalProps {
  lang: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  logs: JsonRpcLogEntry[];
  onClearLogs: () => void;
  onSendTestRpc: (method: string, params: Record<string, unknown>) => Promise<unknown>;
}

export const RpcInspectorModal: React.FC<RpcInspectorModalProps> = ({
  lang,
  isOpen,
  onClose,
  logs,
  onClearLogs,
  onSendTestRpc,
}) => {
  const [rpcMethod, setRpcMethod] = useState('model/list');
  const [rpcParams, setRpcParams] = useState('{}');

  if (!isOpen) return null;
  const i18n = t(lang);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[75vh] rounded-2xl codex-elevated border codex-border shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b codex-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 codex-accent-text" />
            <h3 className="text-sm font-semibold codex-text-primary">
              {i18n.modals.rpcInspectorTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClearLogs}
              className="px-2 py-1 rounded codex-card border codex-border text-xs codex-text-secondary"
            >
              {i18n.modals.clear}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg codex-hover codex-text-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-xs codex-app-bg">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border codex-border codex-card p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="px-2 py-0.5 rounded font-semibold codex-accent-soft">
                  {entry.direction} · {entry.method}
                </span>
                <span className="codex-text-muted">{entry.timestamp}</span>
              </div>
              <pre className="text-[11px] codex-text-secondary overflow-x-auto leading-relaxed">
                {JSON.stringify(entry.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>

        <div className="p-3 border-t codex-border flex flex-wrap items-center gap-2">
          <select
            value={rpcMethod}
            onChange={(e) => setRpcMethod(e.target.value)}
            className="codex-card border codex-border rounded-lg px-2.5 py-1.5 text-xs font-mono codex-text-primary"
          >
            <option value="model/list">model/list</option>
            <option value="thread/start">thread/start</option>
            <option value="turn/start">turn/start</option>
            <option value="initialize">initialize</option>
          </select>
          <input
            type="text"
            value={rpcParams}
            onChange={(e) => setRpcParams(e.target.value)}
            placeholder='{"model":"gpt-6.1-sol"}'
            className="flex-1 codex-card border codex-border rounded-lg px-3 py-1.5 text-xs font-mono codex-text-primary"
          />
          <button
            onClick={() => {
              try {
                const parsed = JSON.parse(rpcParams || '{}');
                onSendTestRpc(rpcMethod, parsed);
              } catch {
                onSendTestRpc(rpcMethod, {});
              }
            }}
            className="px-3.5 py-1.5 rounded-lg codex-accent-btn text-xs font-medium flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{i18n.modals.sendRpc}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
