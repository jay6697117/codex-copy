import React from 'react';
import {
  Plus,
  Zap,
  Pin,
  GitBranch,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  CalendarClock,
  Shield,
  Bot,
  Inbox,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Loader2,
  Layers,
} from 'lucide-react';
import {
  NavSection,
  ProjectWorkspace,
  Thread,
  WorktreeInfo,
} from '../types/codex';

interface LeftSidebarProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  projects: ProjectWorkspace[];
  onToggleProjectExpand: (projectId: string) => void;
  threads: Thread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: (projectId?: string, quickChat?: boolean) => void;
  onSpawnParallelAgents: () => void;
  pendingReviewCount: number;
  skillsCount: number;
  automationsCount: number;
  worktrees: WorktreeInfo[];
  subagentsCount: number;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeNav,
  onSelectNav,
  projects,
  onToggleProjectExpand,
  threads,
  activeThreadId,
  onSelectThread,
  onCreateNewThread,
  onSpawnParallelAgents,
  pendingReviewCount,
  skillsCount,
  automationsCount,
  worktrees,
  subagentsCount,
}) => {
  const pinnedThreads = threads.filter((t) => t.pinned);

  const renderStatusIcon = (status: Thread['status']) => {
    if (status === 'running') {
      return <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />;
    }
    if (status === 'waiting_approval') {
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />;
    }
    if (status === 'completed') {
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />;
    }
    return <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  };

  return (
    <aside className="w-68 bg-[#0E1017] border-r border-[#222736] flex flex-col h-full shrink-0 select-none">
      {/* Top Action Buttons: New Thread + Quick Chat */}
      <div className="p-3 space-y-2 border-b border-[#222736]/80">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onCreateNewThread(undefined, false)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm shadow-emerald-950/50 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Agent Thread</span>
          </button>
          <button
            onClick={() => onCreateNewThread(undefined, true)}
            title="Start Quick Chat (lightweight read-only query)"
            className="p-2 rounded-lg bg-[#171B26] hover:bg-[#1F2433] text-slate-300 hover:text-white border border-[#262C3D] transition-colors"
          >
            <Zap className="w-4 h-4 text-amber-400" />
          </button>
        </div>

        <button
          onClick={onSpawnParallelAgents}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1A2030] border border-[#242B3D] text-[11px] text-slate-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Batch Worktree Agents (3x)</span>
          </span>
          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded">
            Parallel
          </span>
        </button>
      </div>

      {/* Primary Command Center Navigation */}
      <div className="px-2 py-2.5 border-b border-[#222736]/80 space-y-0.5">
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Command Center
        </div>

        <button
          onClick={() => onSelectNav('threads')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNav === 'threads'
              ? 'bg-[#1A2030] text-white border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Agent Threads</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">{threads.length}</span>
        </button>

        <button
          onClick={() => onSelectNav('review_queue')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNav === 'review_queue'
              ? 'bg-[#1A2030] text-white border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Inbox className="w-3.5 h-3.5 text-amber-400" />
            <span>Review Queue</span>
          </span>
          {pendingReviewCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {pendingReviewCount}
            </span>
          ) : (
            <span className="text-[11px] font-mono text-slate-500">0</span>
          )}
        </button>

        <button
          onClick={() => onSelectNav('worktrees')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNav === 'worktrees'
              ? 'bg-[#1A2030] text-white border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <span className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            <span>Git Worktrees</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">{worktrees.length}</span>
        </button>

        <button
          onClick={() => onSelectNav('skills')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNav === 'skills'
              ? 'bg-[#1A2030] text-white border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Skills Library</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">{skillsCount}</span>
        </button>

        <button
          onClick={() => onSelectNav('automations')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNav === 'automations'
              ? 'bg-[#1A2030] text-white border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <span className="flex items-center gap-2">
            <CalendarClock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Automations</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">{automationsCount}</span>
        </button>

        <button
          onClick={() => onSelectNav('subagents')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNav === 'subagents'
              ? 'bg-[#1A2030] text-white border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-teal-400" />
            <span>Subagents & AGENTS.md</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">{subagentsCount}</span>
        </button>

        <button
          onClick={() => onSelectNav('sandbox')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNav === 'sandbox'
              ? 'bg-[#1A2030] text-white border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            <span>Sandbox & Security</span>
          </span>
          <span className="text-[10px] font-mono px-1.5 rounded bg-emerald-500/15 text-emerald-300">
            Strict
          </span>
        </button>
      </div>

      {/* Scrollable Pinned & Project Threads List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* Pinned / Active Threads */}
        {pinnedThreads.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Pin className="w-3 h-3" />
              <span>Pinned & Active</span>
            </div>
            <div className="space-y-1">
              {pinnedThreads.map((thread) => {
                const isSelected = activeNav === 'threads' && thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    onClick={() => {
                      onSelectNav('threads');
                      onSelectThread(thread.id);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition-all border ${
                      isSelected
                        ? 'bg-[#181D2B] border-emerald-500/40 text-white shadow-sm'
                        : 'border-transparent hover:bg-[#141822] text-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{renderStatusIcon(thread.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{thread.title}</div>
                        <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-400">
                          <span className="truncate max-w-[110px] text-indigo-300/90">
                            {thread.branch}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-emerald-400">+{thread.diffSummary.additions}</span>
                            <span className="text-rose-400">-{thread.diffSummary.deletions}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Projects & Their Threads */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Projects & Workspaces
          </div>
          <div className="space-y-2">
            {projects.map((project) => {
              const projectThreads = threads.filter((t) => t.projectId === project.id);
              return (
                <div key={project.id} className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-[#141822] text-xs text-slate-300">
                    <button
                      onClick={() => onToggleProjectExpand(project.id)}
                      className="flex items-center gap-1.5 flex-1 text-left font-medium truncate"
                    >
                      {project.expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <FolderOpen className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                      <span className="truncate">{project.name}</span>
                    </button>
                    <button
                      onClick={() => onCreateNewThread(project.id, false)}
                      title={`New thread in ${project.name}`}
                      className="p-0.5 text-slate-500 hover:text-white rounded"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {project.expanded && (
                    <div className="pl-3 space-y-0.5 border-l border-[#222736] ml-3">
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
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-all flex items-start gap-2 ${
                              isSelected
                                ? 'bg-[#181D2B] text-white border border-slate-700/70'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
                            }`}
                          >
                            <div className="mt-0.5">{renderStatusIcon(thread.status)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate">{thread.title}</div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                                <span>{thread.updatedAt}</span>
                                <span>{thread.subagent}</span>
                              </div>
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

      {/* Bottom Profile & Session Footer */}
      <div className="p-3 border-t border-[#222736] bg-[#0B0D13] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs shrink-0">
            ZJ
          </div>
          <div className="truncate">
            <div className="font-medium text-slate-200 truncate">zhangjinhui</div>
            <div className="text-[10px] text-emerald-400 font-mono">ChatGPT Pro · 2× Limits</div>
          </div>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          v0.160
        </span>
      </div>
    </aside>
  );
};
