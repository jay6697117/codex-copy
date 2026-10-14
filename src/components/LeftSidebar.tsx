import React from 'react';
import {
  Plus,
  Pin,
  GitBranch,
  Clock,
  Sparkles,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  PanelLeftClose,
  SquarePen,
  Settings,
  Terminal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import {
  LocalCodexStatus,
  NavSection,
  ProjectWorkspace,
  Thread,
  WorktreeInfo,
} from '../types/codex';

interface LeftSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  projects: ProjectWorkspace[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onToggleProjectExpand: (projectId: string) => void;
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
  collapsed,
  onToggleCollapse,
  activeNav,
  onSelectNav,
  projects,
  activeProjectId,
  onSelectProject,
  onToggleProjectExpand,
  threads,
  activeThreadId,
  onSelectThread,
  onCreateNewThread,
  onOpenCommandPalette,
  pendingReviewCount,
  skillsCount,
  automationsCount,
  worktrees,
  localCodexStatus,
  onRefreshLocalStatus,
}) => {
  if (collapsed) {
    return null;
  }

  const pinnedThreads = threads.filter((t) => t.pinned);

  const renderThreadDot = (thread: Thread) => {
    if (thread.status === 'running') {
      return <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />;
    }
    if (thread.status === 'waiting_approval') {
      return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />;
    }
    if (thread.isLocalCliSession) {
      return <Terminal className="w-3 h-3 codex-text-muted shrink-0" />;
    }
    return <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 shrink-0" />;
  };

  const isLoggedIn = Boolean(localCodexStatus?.auth?.loggedIn);
  const displayName =
    localCodexStatus?.auth?.email ||
    localCodexStatus?.auth?.name ||
    'zhangjinhui';
  const authModeBadge = localCodexStatus?.auth?.authMode
    ? localCodexStatus.auth.authMode === 'chatgpt'
      ? localCodexStatus.auth.planType || 'ChatGPT Account'
      : `Auth: ${localCodexStatus.auth.authMode}`
    : localCodexStatus?.cli?.installed
    ? 'Codex CLI Ready'
    : 'Local Config';

  return (
    <aside className="w-[252px] codex-sidebar-bg border-r flex flex-col h-full shrink-0 select-none">
      {/* Top macOS Window Controls + Sidebar Actions */}
      <div className="h-11 px-3 flex items-center justify-between app-drag-region shrink-0">
        <div className="flex items-center gap-2 app-no-drag">
          <div className="flex items-center gap-1.5 pr-1">
            <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/15 inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/15 inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/15 inline-block" />
          </div>
          <button
            onClick={onToggleCollapse}
            title="Collapse sidebar (⌘B)"
            className="p-1.5 rounded-md codex-text-secondary codex-hover transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 app-no-drag">
          <button
            onClick={onOpenCommandPalette}
            title="Search threads, files, skills, or commands (⌘K)"
            className="p-1.5 rounded-md codex-text-secondary codex-hover transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => onCreateNewThread(activeProjectId, false)}
            title="New thread (⌘N)"
            className="p-1.5 rounded-md codex-text-secondary codex-hover transition-colors"
          >
            <SquarePen className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Official OpenAI Codex App Top Navigation Items: New thread, Automations, Skills */}
      <div className="px-2 pb-2 space-y-0.5 border-b codex-border">
        <button
          onClick={() => onCreateNewThread(activeProjectId, false)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium codex-text-primary codex-hover transition-colors group"
        >
          <span className="flex items-center gap-2.5">
            <SquarePen className="w-4 h-4 codex-text-secondary group-hover:codex-text-primary" />
            <span>New thread</span>
          </span>
          <kbd className="text-[10px] font-mono codex-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
            ⌘N
          </kbd>
        </button>

        <button
          onClick={() => onSelectNav('automations')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
            activeNav === 'automations'
              ? 'codex-active codex-text-primary'
              : 'codex-text-secondary codex-hover'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Clock className="w-4 h-4" />
            <span>Automations</span>
          </span>
          {automationsCount > 0 && (
            <span className="text-[11px] font-mono codex-text-muted">{automationsCount}</span>
          )}
        </button>

        <button
          onClick={() => onSelectNav('skills')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
            activeNav === 'skills'
              ? 'codex-active codex-text-primary'
              : 'codex-text-secondary codex-hover'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4" />
            <span>Skills</span>
          </span>
          <span className="text-[11px] font-mono codex-text-muted">{skillsCount}</span>
        </button>

        <button
          onClick={() => onSelectNav('review_queue')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
            activeNav === 'review_queue'
              ? 'codex-active codex-text-primary'
              : 'codex-text-secondary codex-hover'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Inbox className="w-4 h-4" />
            <span>Review queue</span>
          </span>
          {pendingReviewCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400">
              {pendingReviewCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectNav('worktrees')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
            activeNav === 'worktrees'
              ? 'codex-active codex-text-primary'
              : 'codex-text-secondary codex-hover'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <GitBranch className="w-4 h-4" />
            <span>Worktrees</span>
          </span>
          <span className="text-[11px] font-mono codex-text-muted">{worktrees.length}</span>
        </button>
      </div>

      {/* Scrollable Pinned & Project-Grouped Threads */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4">
        {/* Pinned Section */}
        {pinnedThreads.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-2.5 pb-1 text-[11px] font-medium codex-text-muted">
              <Pin className="w-3 h-3" />
              <span>Pinned</span>
            </div>
            <div className="space-y-0.5">
              {pinnedThreads.map((thread) => {
                const isSelected = activeNav === 'threads' && thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    onClick={() => {
                      onSelectNav('threads');
                      onSelectThread(thread.id);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'codex-active codex-text-primary font-medium'
                        : 'codex-text-secondary codex-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {renderThreadDot(thread)}
                      <span className="text-[13px] truncate">{thread.title}</span>
                    </div>
                    {(thread.diffSummary.additions > 0 || thread.diffSummary.deletions > 0) ? (
                      <span className="text-[10px] font-mono shrink-0 flex items-center gap-1">
                        <span className="text-emerald-500">+{thread.diffSummary.additions}</span>
                        <span className="text-rose-500">-{thread.diffSummary.deletions}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] codex-text-muted shrink-0">
                        {thread.updatedAt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Threads Grouped by Project */}
        <div>
          <div className="flex items-center justify-between px-2.5 pb-1 text-[11px] font-medium codex-text-muted">
            <span>Threads</span>
            <button
              onClick={onRefreshLocalStatus}
              title="Sync local ~/.codex sessions & git status"
              className="p-0.5 rounded codex-hover codex-text-muted hover:codex-text-primary"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1.5">
            {projects.map((project) => {
              const projectThreads = threads.filter((t) => t.projectId === project.id);
              const isCurrentProj = project.id === activeProjectId;
              return (
                <div key={project.id} className="space-y-0.5">
                  <div
                    className={`group flex items-center justify-between px-2 py-1 rounded-lg text-[13px] transition-colors ${
                      isCurrentProj ? 'codex-text-primary' : 'codex-text-secondary'
                    } codex-hover`}
                  >
                    <button
                      onClick={() => {
                        onSelectProject(project.id);
                        onToggleProjectExpand(project.id);
                      }}
                      className="flex items-center gap-1.5 flex-1 text-left font-medium truncate"
                    >
                      {project.expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 codex-text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 codex-text-muted shrink-0" />
                      )}
                      {project.expanded ? (
                        <FolderOpen className="w-3.5 h-3.5 codex-text-secondary shrink-0" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 codex-text-secondary shrink-0" />
                      )}
                      <span className="truncate">{project.name}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(project.id);
                        onCreateNewThread(project.id, false);
                      }}
                      title={`Start new thread in ${project.name}`}
                      className="p-1 opacity-0 group-hover:opacity-100 codex-text-muted hover:codex-text-primary rounded transition-opacity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {project.expanded && (
                    <div className="pl-3 space-y-0.5">
                      {projectThreads.map((thread) => {
                        const isSelected =
                          activeNav === 'threads' && thread.id === activeThreadId;
                        return (
                          <button
                            key={thread.id}
                            onClick={() => {
                              onSelectNav('threads');
                              onSelectThread(thread.id);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'codex-active codex-text-primary font-medium'
                                : 'codex-text-secondary codex-hover'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {renderThreadDot(thread)}
                              <span className="text-[12.5px] truncate">{thread.title}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {thread.isLocalCliSession && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded codex-card border codex-border codex-text-muted">
                                  CLI
                                </span>
                              )}
                              {thread.diffSummary.additions > 0 ||
                              thread.diffSummary.deletions > 0 ? (
                                <span className="text-[10px] font-mono flex items-center gap-0.5">
                                  <span className="text-emerald-500">
                                    +{thread.diffSummary.additions}
                                  </span>
                                  <span className="text-rose-500">
                                    -{thread.diffSummary.deletions}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[10px] codex-text-muted">
                                  {thread.updatedAt.split(',')[0]}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Local Codex Status & Settings Footer */}
      <div className="p-2 border-t codex-border space-y-1">
        <button
          onClick={() => onSelectNav('codex_config')}
          className={`w-full p-2 rounded-lg text-left transition-colors flex items-center justify-between gap-2 ${
            activeNav === 'codex_config' ? 'codex-active' : 'codex-hover'
          }`}
          title="View & edit local ~/.codex/auth.json, ~/.codex/config.toml, MCP servers, and CLI settings"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              {isLoggedIn ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium codex-text-primary truncate">
                {displayName}
              </div>
              <div className="text-[10px] codex-text-muted truncate flex items-center gap-1">
                <span>{authModeBadge}</span>
                {localCodexStatus?.config?.effective?.model && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-emerald-500">
                      {localCodexStatus.config.effective.model}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Settings className="w-4 h-4 codex-text-muted shrink-0" />
        </button>
      </div>
    </aside>
  );
};
