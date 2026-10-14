import React, { useState } from 'react';
import {
  Search,
  X,
  MessageSquare,
  Sparkles,
  GitBranch,
  Activity,
  Play,
  Shield,
  CalendarClock,
  Inbox,
  Send,
  Layers,
} from 'lucide-react';
import {
  JsonRpcLogEntry,
  NavSection,
  SkillDefinition,
  Thread,
  WorkspaceLayoutMode,
  WorktreeInfo,
} from '../types/codex';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  threads: Thread[];
  skills: SkillDefinition[];
  worktrees: WorktreeInfo[];
  onSelectThread: (threadId: string) => void;
  onSelectNav: (nav: NavSection) => void;
  onLaunchSkillThread: (skill: SkillDefinition) => void;
  onSpawnParallelAgents: () => void;
  onSetLayoutMode: (mode: WorkspaceLayoutMode) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  threads,
  skills,
  worktrees,
  onSelectThread,
  onSelectNav,
  onLaunchSkillThread,
  onSpawnParallelAgents,
  onSetLayoutMode,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const matchingThreads = threads.filter(
    (t) => t.title.toLowerCase().includes(q) || t.branch.toLowerCase().includes(q)
  );
  const matchingSkills = skills.filter(
    (s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
  );
  const matchingWorktrees = worktrees.filter(
    (w) => w.branch.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#121622] border border-[#2A334B] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3.5 border-b border-[#222736] flex items-center gap-3">
          <Search className="w-4 h-4 text-emerald-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, jump to a thread, invoke a $skill, or switch worktree..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2 space-y-4">
          {/* Quick Actions */}
          <div>
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Quick Orchestration Actions
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  onSpawnParallelAgents();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1B2234] text-xs text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Spawn 3 Parallel Worktree Agents (Refactor + Tests + Docs)</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-300">Batch Run</span>
              </button>

              <button
                onClick={() => {
                  onSetLayoutMode('tiled_4pane');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1B2234] text-xs text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Switch to Tiled 4-Pane Workbench (Chat + Diff + Preview + Terminal)</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-300">Layout #33301</span>
              </button>

              <button
                onClick={() => {
                  onSelectNav('review_queue');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1B2234] text-xs text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <Inbox className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open Central Review Queue</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Navigation</span>
              </button>
            </div>
          </div>

          {/* Matching Threads */}
          {matchingThreads.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Agent Threads
              </div>
              <div className="space-y-1">
                {matchingThreads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSelectNav('threads');
                      onSelectThread(t.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1B2234] text-xs text-slate-200"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </span>
                    <span className="text-[10px] font-mono text-indigo-300 shrink-0 ml-2">
                      {t.branch}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Skills */}
          {matchingSkills.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Skills Library
              </div>
              <div className="space-y-1">
                {matchingSkills.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onLaunchSkillThread(s);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1B2234] text-xs text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span className="font-mono text-purple-300">${s.slug}</span>
                      <span className="text-slate-400">— {s.name}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Run Skill</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Worktrees */}
          {matchingWorktrees.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Git Worktrees
              </div>
              <div className="space-y-1">
                {matchingWorktrees.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      onSelectNav('worktrees');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1B2234] text-xs text-slate-200"
                  >
                    <span className="flex items-center gap-2 font-mono">
                      <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{w.branch}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{w.headCommit}</span>
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
  isOpen: boolean;
  onClose: () => void;
  logs: JsonRpcLogEntry[];
  appServerConnected: boolean;
  onSendCustomRpc: (method: string, paramsJson: string) => void;
}

export const RpcInspectorModal: React.FC<RpcInspectorModalProps> = ({
  isOpen,
  onClose,
  logs,
  appServerConnected,
  onSendCustomRpc,
}) => {
  const [rpcMethod, setRpcMethod] = useState('model/list');
  const [rpcParams, setRpcParams] = useState('{}');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[75vh] rounded-2xl bg-[#0D1017] border border-[#2A334B] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#222736] flex items-center justify-between bg-[#121622]">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">
              Codex App-Server · Bidirectional JSON-RPC 2.0 Lite Inspector (`stdio` / `ws://`)
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                appServerConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              {appServerConnected
                ? 'Connected to http://127.0.0.1:4500'
                : 'Embedded Harness Active'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stream Log Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-xs bg-[#080A0F]">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-[#1E2434] bg-[#0E121B] p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded font-semibold ${
                    entry.direction === 'client->server'
                      ? 'bg-cyan-500/15 text-cyan-300'
                      : entry.direction === 'server-request'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {entry.direction} · {entry.method}
                </span>
                <span className="text-slate-500">{entry.timestamp}</span>
              </div>
              <pre className="text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                {JSON.stringify(entry.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>

        {/* Bottom Interactive JSON-RPC Dispatcher */}
        <div className="p-3 border-t border-[#222736] bg-[#111520] flex flex-wrap items-center gap-2">
          <select
            value={rpcMethod}
            onChange={(e) => setRpcMethod(e.target.value)}
            className="bg-[#090B10] border border-[#262E42] rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-300"
          >
            <option value="model/list">model/list</option>
            <option value="thread/start">thread/start</option>
            <option value="turn/start">turn/start</option>
            <option value="turn/steer">turn/steer</option>
            <option value="initialize">initialize</option>
          </select>
          <input
            type="text"
            value={rpcParams}
            onChange={(e) => setRpcParams(e.target.value)}
            placeholder='{"model":"gpt-6.1-sol"}'
            className="flex-1 bg-[#090B10] border border-[#262E42] rounded-lg px-3 py-1.5 text-xs font-mono text-white"
          />
          <button
            onClick={() => onSendCustomRpc(rpcMethod, rpcParams)}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send JSON-RPC</span>
          </button>
        </div>
      </div>
    </div>
  );
};
