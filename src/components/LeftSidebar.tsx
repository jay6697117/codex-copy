import React, { useState } from 'react';
import { DEFAULT_USER_NAME } from '../services/runtimeConfig';
import {
  Clock,
  Compass,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Search,
  PanelLeft,
  SquarePen,
  Bell,
  Home,
  Files,
  MoreHorizontal,
  GitFork,
  LayoutGrid,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import {
  AppLanguage,
  LocalCodexStatus,
  NavSection,
  ProjectWorkspace,
  Thread,
  WorktreeInfo,
} from '../types/codex';
import { t } from '../i18n/translations';

interface LeftSidebarProps {
  lang: AppLanguage;
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  projects: ProjectWorkspace[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onToggleProjectExpand: (projectId: string) => void;
  onOpenWorkspaceModal: () => void;
  onRemoveProject?: (projectId: string) => void;
  threads: Thread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onCreateNewThread: (projectId?: string, quickChat?: boolean) => void;
  onOpenCommandPalette: () => void;
  pendingReviewCount: number;
  skillsCount: number;
  automationsCount: number;
  worktrees: WorktreeInfo[];
  localCodexStatus: LocalCodexStatus | null;
  onRefreshLocalStatus: () => void;
}

function normalizePath(p?: string): string {
  if (!p) return '';
  return p.trim().replace(/[\\/]+$/, '');
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  lang,
  collapsed,
  onToggleCollapse,
  activeNav,
  onSelectNav,
  projects,
  activeProjectId,
  onSelectProject,
  onToggleProjectExpand,
  onOpenWorkspaceModal,
  onRemoveProject,
  threads,
  activeThreadId,
  onSelectThread,
  onDeleteThread,
  onCreateNewThread,
  onOpenCommandPalette,
  localCodexStatus,
  onRefreshLocalStatus,
}) => {
  const i18n = t(lang);

  const [projectsSectionCollapsed, setProjectsSectionCollapsed] = useState(false);
  const [recentSectionCollapsed, setRecentSectionCollapsed] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Set of normalized repoPaths for workspaces registered in THIS Desktop App
  const registeredProjectPaths = new Set(
    projects.map((p) => normalizePath(p.repoPath)).filter(Boolean)
  );

  const assignedThreadIds = new Set<string>();
  const assignedTitlesByProject = new Map<string, Set<string>>();

  /**
   * Strictly match threads to a specific project by normalized `cwd === project.repoPath`
   * (or `projectId === project.id` ONLY when `th.cwd` is unset), preventing a prompt sent in
   * `/Users/zhangjinhui/Desktop/my-g4-app` from ever appearing under other directories!
   */
  const getProjectThreads = (project: ProjectWorkspace) => {
    const projPath = normalizePath(project.repoPath);
    if (!assignedTitlesByProject.has(project.id)) {
      assignedTitlesByProject.set(project.id, new Set());
    }
    const seenTitles = assignedTitlesByProject.get(project.id)!;

    return threads.filter((th) => {
      if (th.turns.length === 0) return false;
      const thPath = normalizePath(th.cwd);
      const matchesPath = thPath
        ? thPath === projPath
        : th.projectId === project.id;
      if (!matchesPath) return false;

      // Only show threads created/interacted with in this app under the project folder
      if (th.isLocalCliSession) return false;

      if (seenTitles.has(th.title)) return false;
      seenTitles.add(th.title);
      assignedThreadIds.add(th.id);
      return true;
    });
  };

  for (const p of projects) {
    getProjectThreads(p);
  }

  // Only include recent threads that belong to registered workspaces in this app
  // and are not already displayed under their expanded project folder.
  const recentThreads = (() => {
    const seenTitles = new Set<string>();
    return threads.filter((th) => {
      if (th.turns.length === 0) return false;
      if (assignedThreadIds.has(th.id)) return false;
      const thPath = normalizePath(th.cwd);
      if (thPath && !registeredProjectPaths.has(thPath)) return false;
      if (seenTitles.has(th.title)) return false;
      seenTitles.add(th.title);
      return true;
    });
  })();

  const visibleProjects = showAllProjects ? projects : projects.slice(0, 6);
  const visibleRecentThreads = showAllRecent
    ? recentThreads
    : recentThreads.slice(0, 5);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden shrink-0 select-none">
      {/* =====================================================================
          ROW 1: Unified Top Titlebar Row (`h-10`)
          - 74px native macOS Window Traffic Lights region
          - `←` (Back), `→` (Forward), and `[|]` (Sidebar Collapse Toggle)
         ===================================================================== */}
      <div
        className={`h-10 flex items-center app-drag-region shrink-0 border-r codex-border ${
          collapsed ? 'w-[46px] bg-[#141414]' : 'w-[274px] bg-[#161616]'
        }`}
      >
        <div className="w-[74px] h-full shrink-0" />

        {!collapsed && (
          <div className="flex items-center gap-1.5 app-no-drag">
            <button
              onClick={() => onSelectNav('threads')}
              className="p-1 rounded text-[#8E8E93] hover:text-white transition-colors"
              title="后退"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSelectNav('threads')}
              className="p-1 rounded text-[#8E8E93] hover:text-white transition-colors"
              title="前进"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggleCollapse}
              title={i18n.sidebar.collapseSidebar}
              className="p-1 rounded text-[#A1A1A6] hover:text-white transition-colors ml-0.5"
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          ROW 2: Dual-Column Body (`flex-1 min-h-0 overflow-hidden`)
         ===================================================================== */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Column 1: 46px Narrow Vertical Icon Rail */}
        <div className="w-[46px] h-full min-h-0 bg-[#141414] border-r border-white/[0.06] flex flex-col items-center justify-between pt-1 pb-3 shrink-0 z-30">
          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              onClick={() => {
                onSelectNav('threads');
                if (collapsed) onToggleCollapse();
              }}
              title={lang === 'zh-CN' ? '主页 / 会话' : 'Home'}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeNav === 'threads'
                  ? 'bg-[#2C2C2E] text-white'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Home className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSelectNav('review_queue')}
              title={i18n.sidebar.reviewQueue}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeNav === 'review_queue'
                  ? 'bg-[#2C2C2E] text-white'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Files className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSelectNav('automations')}
              title={i18n.sidebar.automations}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeNav === 'automations'
                  ? 'bg-[#2C2C2E] text-white'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Clock className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSelectNav('skills')}
              title={i18n.sidebar.skills}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeNav === 'skills'
                  ? 'bg-[#2C2C2E] text-white'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Compass className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenCommandPalette}
              title={i18n.sidebar.searchCommandPalette}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSelectNav('worktrees')}
              title={i18n.sidebar.worktrees}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeNav === 'worktrees'
                  ? 'bg-[#2C2C2E] text-white'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <GitFork className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSelectNav('codex_config')}
              title={i18n.sidebar.settingsAndLocalConfig}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeNav === 'codex_config'
                  ? 'bg-[#2C2C2E] text-white'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2.5 shrink-0">
            <button
              onClick={onRefreshLocalStatus}
              title={i18n.sidebar.syncLocalSessions}
              className="w-7 h-7 rounded-full bg-[#2B7FFF] hover:bg-[#1E6FEF] text-white flex items-center justify-center shadow-md transition-transform active:scale-95"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onSelectNav('codex_config')}
              title={`${
                localCodexStatus?.auth?.email ||
                localCodexStatus?.auth?.name ||
                DEFAULT_USER_NAME
              } · 点击打开设置`}
              className="w-7 h-7 rounded-full bg-[#9B7B2C] hover:opacity-90 text-white text-[10px] font-bold flex items-center justify-center shadow-sm"
            >
              XX
            </button>
          </div>
        </div>

        {/* Column 2: 228px `Codex` Sidebar */}
        {!collapsed && (
          <aside className="w-[228px] h-full min-h-0 codex-sidebar-bg border-r codex-border flex flex-col overflow-hidden shrink-0">
            <div className="h-9 px-3.5 flex items-center justify-between shrink-0">
              <button
                onClick={() => onSelectNav('codex_config')}
                className="flex items-center gap-1 text-[14px] font-semibold codex-text-primary hover:opacity-85 transition-opacity"
              >
                <span>Codex</span>
                <ChevronDown className="w-3.5 h-3.5 codex-text-muted" />
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelectNav('review_queue')}
                  title="通知与待审队列"
                  className="p-1 rounded-md codex-text-secondary codex-hover transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onOpenCommandPalette}
                  title={i18n.sidebar.searchCommandPalette}
                  className="p-1 rounded-md codex-text-secondary codex-hover transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Primary Action Items: `新聊天` + `灰太狼 6` */}
            <div className="px-2 pt-1 space-y-0.5 shrink-0">
              <button
                onClick={() => {
                  onSelectNav('threads');
                  onCreateNewThread(activeProjectId, false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] codex-text-primary codex-hover transition-colors"
              >
                <SquarePen className="w-4 h-4 codex-text-secondary shrink-0" />
                <span>{lang === 'zh-CN' ? '新聊天' : 'New chat'}</span>
              </button>

              <button
                onClick={() => onSelectNav('automations')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] codex-text-primary codex-hover transition-colors"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] shrink-0">
                    🦊
                  </span>
                  <span className="truncate">灰太狼</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-[#1B3254] text-[#4DA3FF]">
                  6
                </span>
              </button>
            </div>

            {/* Scrollable `项目` (Projects) & `最近` (Recents) — Both Collapsible! */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-4 pb-4 space-y-4">
              {/* Section 1: `项目` (Collapsible + New Workspace Button) */}
              <div>
                <div className="px-2 pb-1 flex items-center justify-between text-[11.5px] codex-text-muted font-medium">
                  <button
                    type="button"
                    onClick={() => setProjectsSectionCollapsed((v) => !v)}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {projectsSectionCollapsed ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    <span>
                      {lang === 'zh-CN' ? '项目' : 'Projects'} ({projects.length})
                    </span>
                  </button>

                  <button
                    onClick={onOpenWorkspaceModal}
                    title="新建或导入工作目录 / 工作空间"
                    className="p-0.5 rounded hover:bg-white/10 text-[#8E8E93] hover:text-white flex items-center gap-0.5 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {!projectsSectionCollapsed && (
                  <div className="space-y-0.5">
                    {visibleProjects.map((project) => {
                      const isActiveProj = project.id === activeProjectId;
                      const projThreads = getProjectThreads(project);
                      return (
                        <div key={project.id} className="space-y-0.5">
                          <div
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
                              isActiveProj
                                ? 'codex-text-primary font-medium bg-white/[0.05]'
                                : 'codex-text-secondary codex-hover'
                            }`}
                          >
                            <button
                              onClick={() => {
                                onSelectProject(project.id);
                                onToggleProjectExpand(project.id);
                              }}
                              title={project.repoPath}
                              className="flex items-center gap-2 flex-1 text-left truncate"
                            >
                              {project.expanded ? (
                                <FolderOpen className="w-4 h-4 codex-text-secondary shrink-0" />
                              ) : (
                                <Folder className="w-4 h-4 codex-text-secondary shrink-0" />
                              )}
                              <span className="truncate">{project.name}</span>
                            </button>

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectProject(project.id);
                                  onCreateNewThread(project.id, false);
                                }}
                                title={`在 ${project.name} 中新建聊天`}
                                className="p-0.5 codex-text-muted hover:codex-text-primary rounded"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              {projects.length > 1 && onRemoveProject && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveProject(project.id);
                                  }}
                                  title="从侧边栏移除此目录"
                                  className="p-0.5 codex-text-muted hover:text-rose-400 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {project.expanded && (
                            <div className="pl-6 space-y-0.5">
                              {projThreads.length === 0 ? (
                                <div className="px-2 py-1 text-[12px] codex-text-muted">
                                  {lang === 'zh-CN' ? '暂无聊天' : 'No chats yet'}
                                </div>
                              ) : (
                                projThreads.map((th) => {
                                  const isSelected =
                                    activeNav === 'threads' && th.id === activeThreadId;
                                  const isRunningTh = th.status === 'running';
                                  return (
                                    <div
                                      key={th.id}
                                      className={`group flex items-center justify-between px-2.5 py-1 rounded-lg text-[12.5px] transition-colors ${
                                        isSelected
                                          ? 'codex-active codex-text-primary font-medium'
                                          : 'codex-text-secondary codex-hover'
                                      }`}
                                    >
                                      <button
                                        onClick={() => {
                                          onSelectNav('threads');
                                          onSelectThread(th.id);
                                        }}
                                        className="flex-1 text-left truncate flex items-center gap-1.5"
                                      >
                                        {isRunningTh && (
                                          <Loader2 className="w-3 h-3 text-[#388BFD] animate-spin shrink-0" />
                                        )}
                                        <span className="truncate">{th.title}</span>
                                      </button>
                                      {onDeleteThread && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteThread(th.id);
                                          }}
                                          title="移除此会话"
                                          className="opacity-0 group-hover:opacity-100 p-0.5 codex-text-muted hover:text-rose-400 rounded"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {projects.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setShowAllProjects((v) => !v)}
                        className="w-full text-left px-2.5 py-1 text-[11.5px] text-[#8E8E93] hover:text-white transition-colors"
                      >
                        {showAllProjects
                          ? '收起多余项目目录'
                          : `展开全部 ${projects.length} 个项目...`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: `最近` (Collapsible + Show More/Less Toggle, Scoped to App Workspaces) */}
              {recentThreads.length > 0 && (
                <div>
                  <div className="px-2 pb-1 flex items-center justify-between text-[11.5px] codex-text-muted font-medium">
                    <button
                      type="button"
                      onClick={() => setRecentSectionCollapsed((v) => !v)}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      {recentSectionCollapsed ? (
                        <ChevronRight className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      <span>
                        {lang === 'zh-CN' ? '最近' : 'Recent'} ({recentThreads.length})
                      </span>
                    </button>

                    {recentThreads.length > 5 && !recentSectionCollapsed && (
                      <button
                        type="button"
                        onClick={() => setShowAllRecent((v) => !v)}
                        className="text-[11px] text-[#8E8E93] hover:text-white"
                      >
                        {showAllRecent ? '收起' : '全部'}
                      </button>
                    )}
                  </div>

                  {!recentSectionCollapsed && (
                    <div className="space-y-0.5">
                      {visibleRecentThreads.map((thread) => {
                        const isSelected =
                          activeNav === 'threads' && thread.id === activeThreadId;
                        return (
                          <div
                            key={thread.id}
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
                              isSelected
                                ? 'codex-active codex-text-primary font-medium'
                                : 'codex-text-secondary hover:codex-text-primary codex-hover'
                            }`}
                          >
                            <button
                              onClick={() => {
                                onSelectNav('threads');
                                onSelectThread(thread.id);
                              }}
                              className="flex-1 text-left truncate"
                            >
                              {thread.title}
                            </button>
                            {onDeleteThread && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteThread(thread.id);
                                }}
                                title="隐藏此会话"
                                className="opacity-0 group-hover:opacity-100 p-0.5 codex-text-muted hover:text-rose-400 rounded shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {recentThreads.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllRecent((v) => !v)}
                          className="w-full text-left px-2.5 py-1 text-[11.5px] text-[#8E8E93] hover:text-white transition-colors"
                        >
                          {showAllRecent
                            ? '收起较早会话'
                            : `展开更多 (${recentThreads.length - 5} 条)...`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
