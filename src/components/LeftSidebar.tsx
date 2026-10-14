import React from 'react';
import {
  Clock,
  Compass,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronDown,
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
  threads: Thread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: (projectId?: string, quickChat?: boolean) => void;
  onOpenCommandPalette: () => void;
  pendingReviewCount: number;
  skillsCount: number;
  automationsCount: number;
  worktrees: WorktreeInfo[];
  localCodexStatus: LocalCodexStatus | null;
  onRefreshLocalStatus: () => void;
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
  threads,
  activeThreadId,
  onSelectThread,
  onCreateNewThread,
  onOpenCommandPalette,
  localCodexStatus,
  onRefreshLocalStatus,
}) => {
  const i18n = t(lang);

  // Deduplicate active project threads and separate them from `最近` (Recents)
  const activeProjectThreadIds = new Set<string>();
  const activeProjectTitles = new Set<string>();

  const getProjectThreads = (project: ProjectWorkspace) => {
    const seen = new Set<string>();
    return threads.filter((th) => {
      if (th.isLocalCliSession) return false;
      if (th.turns.length === 0) return false;
      const matchesProj =
        th.projectId === project.id ||
        (th.cwd && th.cwd === project.repoPath);
      if (!matchesProj) return false;
      if (seen.has(th.title)) return false;
      seen.add(th.title);
      activeProjectThreadIds.add(th.id);
      activeProjectTitles.add(th.title);
      return true;
    });
  };

  // Pre-compute project thread sets so `最近` doesn't duplicate active project threads
  for (const p of projects) {
    getProjectThreads(p);
  }

  const recentThreads = (() => {
    const seenTitles = new Set<string>(activeProjectTitles);
    return threads.filter((th) => {
      if (th.id === 'thr_workspace_main' && th.turns.length === 0) return false;
      if (activeProjectThreadIds.has(th.id)) return false;
      const key = `${th.title}_${th.cliSessionId || ''}`;
      if (seenTitles.has(th.title) || seenTitles.has(key)) return false;
      seenTitles.add(th.title);
      seenTitles.add(key);
      return true;
    });
  })();

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden shrink-0 select-none">
      {/* =====================================================================
          ROW 1 (Fix for Red Box 1): Unified Top Titlebar Row (`h-10`)
          - Leftmost 74px is clean empty space for native macOS Window Traffic Lights
            (NO duplicate HTML traffic-light dots!)
          - Immediately to the right (`pl-[76px]`) on the exact same horizontal line:
            `←` (Back), `→` (Forward), and `[|]` (Sidebar Collapse Toggle)
         ===================================================================== */}
      <div
        className={`h-10 flex items-center app-drag-region shrink-0 border-r codex-border ${
          collapsed ? 'w-[46px] bg-[#141414]' : 'w-[274px] bg-[#161616]'
        }`}
      >
        {/* Native macOS Traffic Lights sit inside this 74px drag region */}
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
          ROW 2 (Fix for Red Box 1 & Red Box 2): Dual-Column Body (`flex-1 min-h-0 overflow-hidden`)
          - Column 1 (`w-[46px]`): `Home` icon at top aligns horizontally with `Codex ⌄`,
            and `↓` + `XX` sit flush at the bottom with zero height gap!
          - Column 2 (`w-[228px]`): `Codex ⌄` header at top, scrollable `项目` & `最近`
            constrained inside `min-h-0 overflow-y-auto` so it never overflows 100vh!
         ===================================================================== */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Column 1: 46px Narrow Vertical Icon Rail */}
        <div className="w-[46px] h-full min-h-0 bg-[#141414] border-r border-white/[0.06] flex flex-col items-center justify-between pt-1 pb-3 shrink-0 z-30">
          {/* Top 7 Navigation Icons (`Home` aligns horizontally with `Codex ⌄`) */}
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

          {/* Bottom Icons: Flush at the bottom of the 46px rail (Fix for Red Box 2) */}
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
                'zhangjinhui'
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
            {/* `Codex ⌄` Header Row — Horizontally aligned with `Home` icon in Column 1 */}
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

            {/* Scrollable `项目` (Projects) & `最近` (Recents) — Strictly constrained with `min-h-0` */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-4 pb-4 space-y-5">
              {/* Section: `项目` (with `+` New/Open Workspace Button!) */}
              <div>
                <div className="px-2.5 pb-1 flex items-center justify-between text-[11.5px] codex-text-muted font-medium">
                  <span>{lang === 'zh-CN' ? '项目' : 'Projects'}</span>
                  <button
                    onClick={onOpenWorkspaceModal}
                    title="新建或导入工作目录 / 工作空间"
                    className="p-0.5 rounded hover:bg-white/10 text-[#8E8E93] hover:text-white flex items-center gap-0.5 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  {projects.map((project) => {
                    const isActiveProj = project.id === activeProjectId;
                    const projThreads = getProjectThreads(project);
                    return (
                      <div key={project.id} className="space-y-0.5">
                        <div
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
                            isActiveProj
                              ? 'codex-text-primary font-medium bg-white/[0.04]'
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProject(project.id);
                              onCreateNewThread(project.id, false);
                            }}
                            title={`在 ${project.name} (${project.repoPath}) 中新建聊天`}
                            className="p-0.5 opacity-0 group-hover:opacity-100 codex-text-muted hover:codex-text-primary rounded transition-opacity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
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
                                return (
                                  <button
                                    key={th.id}
                                    onClick={() => {
                                      onSelectNav('threads');
                                      onSelectThread(th.id);
                                    }}
                                    className={`w-full text-left px-2.5 py-1 rounded-lg text-[12.5px] truncate transition-colors block ${
                                      isSelected
                                        ? 'codex-active codex-text-primary font-medium'
                                        : 'codex-text-secondary codex-hover'
                                    }`}
                                  >
                                    {th.title}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section: `最近` (Recents) */}
              <div>
                <div className="px-2.5 pb-1 text-[11.5px] codex-text-muted font-medium">
                  {lang === 'zh-CN' ? '最近' : 'Recent'}
                </div>
                <div className="space-y-0.5">
                  {recentThreads.map((thread) => {
                    const isSelected =
                      activeNav === 'threads' && thread.id === activeThreadId;
                    return (
                      <button
                        key={thread.id}
                        onClick={() => {
                          onSelectNav('threads');
                          onSelectThread(thread.id);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] truncate transition-colors block ${
                          isSelected
                            ? 'codex-active codex-text-primary font-medium'
                            : 'codex-text-secondary hover:codex-text-primary codex-hover'
                        }`}
                      >
                        {thread.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
