import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  AppLanguage,
  JsonRpcLogEntry,
  NavSection,
  SkillDefinition,
  Thread,
  WorktreeInfo,
} from '../types/codex';
import { t } from '../i18n/translations';

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
          {/* Quick Actions */}
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

          {/* Matching Threads */}
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

          {/* Matching Skills */}
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

          {/* Matching Worktrees */}
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
                    <span className="text-[10px] font-mono codex-text-muted">{w.headCommit}</span>
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
            placeholder='{"model":"gpt-5.4"}'
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
