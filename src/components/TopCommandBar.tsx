import React from 'react';
import {
  Terminal,
  GitBranch,
  Layers,
  Search,
  Activity,
  Cpu,
  ShieldCheck,
  Sparkles,
  Play,
  LayoutGrid,
  Columns,
  Maximize2,
  Code2,
  FolderGit2,
} from 'lucide-react';
import {
  CodexSurface,
  ProjectWorkspace,
  WorkspaceLayoutMode,
  WorktreeInfo,
} from '../types/codex';

interface TopCommandBarProps {
  surface: CodexSurface;
  onSurfaceChange: (surface: CodexSurface) => void;
  activeProject: ProjectWorkspace;
  projects: ProjectWorkspace[];
  onSelectProject: (projectId: string) => void;
  activeWorktree?: WorktreeInfo;
  runningThreadsCount: number;
  waitingApprovalCount: number;
  layoutMode: WorkspaceLayoutMode;
  onLayoutModeChange: (mode: WorkspaceLayoutMode) => void;
  appServerConnected: boolean;
  onOpenCommandPalette: () => void;
  onOpenRpcInspector: () => void;
  onSpawnParallelAgents: () => void;
  rpcLogCount: number;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  surface,
  onSurfaceChange,
  activeProject,
  projects,
  onSelectProject,
  activeWorktree,
  runningThreadsCount,
  waitingApprovalCount,
  layoutMode,
  onLayoutModeChange,
  appServerConnected,
  onOpenCommandPalette,
  onOpenRpcInspector,
  onSpawnParallelAgents,
  rpcLogCount,
}) => {
  return (
    <header className="h-12 bg-[#0E1017]/95 backdrop-blur-md border-b border-[#222736] px-3 flex items-center justify-between select-none app-drag-region shrink-0 z-30">
      {/* Left: macOS Traffic Lights Spacer + Brand & Surface Switcher */}
      <div className="flex items-center gap-3 app-no-drag">
        <div className="flex items-center gap-1.5 pl-1 pr-2">
          <span className="w-3 h-3 rounded-full bg-[#FF5F56]/90 border border-black/20 inline-block" />
          <span className="w-3 h-3 rounded-full bg-[#FFBD2E]/90 border border-black/20 inline-block" />
          <span className="w-3 h-3 rounded-full bg-[#27C93F]/90 border border-black/20 inline-block" />
        </div>

        <div className="flex items-center gap-2 pr-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-500/20">
            <Cpu className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">Codex</span>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Desktop
          </span>
        </div>

        {/* ChatGPT Desktop Unified Surface Toggle: Codex | Work | Chat */}
        <div className="flex items-center bg-[#090A0F] p-0.5 rounded-lg border border-[#222736]">
          {(['codex', 'work', 'chat'] as CodexSurface[]).map((item) => (
            <button
              key={item}
              onClick={() => onSurfaceChange(item)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                surface === item
                  ? 'bg-[#1D2230] text-white shadow-sm border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item === 'codex' ? 'Codex Agents' : item === 'work' ? 'Work' : 'Chat'}
            </button>
          ))}
        </div>

        {/* Project & Worktree Context Selector */}
        <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-[#222736]">
          <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={activeProject.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer hover:text-white"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#12151E] text-slate-100">
                {p.name}
              </option>
            ))}
          </select>

          {activeWorktree && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161B26] border border-[#262C3D] text-[11px] font-mono text-slate-300">
              <GitBranch className="w-3 h-3 text-emerald-400" />
              <span>{activeWorktree.branch}</span>
              {activeWorktree.isMain ? (
                <span className="text-[9px] px-1 rounded bg-slate-700/70 text-slate-300">main</span>
              ) : (
                <span className="text-[9px] px-1 rounded bg-indigo-500/20 text-indigo-300">worktree</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Command Palette Search Trigger (Cmd+K) */}
      <div className="flex items-center gap-2 app-no-drag">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#12151E] hover:bg-[#171B26] border border-[#222736] text-xs text-slate-400 hover:text-slate-200 transition-colors w-64 lg:w-80 justify-between"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span>Search threads, $skills, worktrees, or run command...</span>
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#090A0F] text-slate-400 rounded border border-slate-800 shrink-0">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onSpawnParallelAgents}
          title="Spawn 3 isolated Git worktree agents in parallel (Refactor + Tests + Docs)"
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 hover:from-emerald-500/25 hover:to-cyan-500/25 border border-emerald-500/30 text-xs font-medium text-emerald-300 transition-all"
        >
          <Play className="w-3 h-3 fill-emerald-400 text-emerald-400" />
          <span>Parallel 3-Agent Run</span>
        </button>
      </div>

      {/* Right: Live Telemetry, Layout Switcher & App-Server RPC Status */}
      <div className="flex items-center gap-2 app-no-drag">
        {/* Active Parallel Agents & Approvals Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#12151E] border border-[#222736] text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              runningThreadsCount > 0
                ? 'bg-emerald-400 animate-pulse'
                : waitingApprovalCount > 0
                ? 'bg-amber-400 animate-ping'
                : 'bg-slate-500'
            }`}
          />
          <span className="text-slate-300 font-medium">
            {runningThreadsCount > 0
              ? `${runningThreadsCount} Running`
              : 'Agents Idle'}
          </span>
          {waitingApprovalCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold">
              {waitingApprovalCount} Approval
            </span>
          )}
        </div>

        {/* Multi-Pane Workbench Layout Switcher (#33301) */}
        <div className="flex items-center bg-[#090A0F] p-0.5 rounded-lg border border-[#222736]">
          <button
            onClick={() => onLayoutModeChange('standard')}
            title="Standard 3-Pane Layout (Sidebar + Thread + Inspector)"
            className={`p-1.5 rounded-md transition-colors ${
              layoutMode === 'standard'
                ? 'bg-[#1D2230] text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onLayoutModeChange('tiled_4pane')}
            title="Tiled Multi-Pane Workbench (Chat + Diff + Live Preview + Terminal)"
            className={`p-1.5 rounded-md transition-colors ${
              layoutMode === 'tiled_4pane'
                ? 'bg-[#1D2230] text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onLayoutModeChange('focus_chat')}
            title="Focus Thread View"
            className={`p-1.5 rounded-md transition-colors ${
              layoutMode === 'focus_chat'
                ? 'bg-[#1D2230] text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onLayoutModeChange('review_zen')}
            title="Code Review & Diff Zen Mode"
            className={`p-1.5 rounded-md transition-colors ${
              layoutMode === 'review_zen'
                ? 'bg-[#1D2230] text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* JSON-RPC 2.0 Lite App-Server Protocol Stream Button */}
        <button
          onClick={onOpenRpcInspector}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#12151E] hover:bg-[#171B26] border border-[#222736] text-xs text-slate-300 transition-colors"
          title="Inspect live codex app-server JSON-RPC 2.0 Lite messages"
        >
          <Activity
            className={`w-3.5 h-3.5 ${
              appServerConnected ? 'text-emerald-400' : 'text-cyan-400'
            }`}
          />
          <span className="hidden sm:inline font-mono text-[11px]">app-server</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            {rpcLogCount}
          </span>
        </button>
      </div>
    </header>
  );
};
