import React, { useState, useRef, useEffect } from 'react';
import {
  Pin,
  GitBranch,
  GitFork,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Terminal,
  FileCode2,
  ShieldAlert,
  Check,
  X,
  Send,
  Square,
  Compass,
  Bot,
  Paperclip,
  Cpu,
  Gauge,
  Sliders,
  Loader2,
  CornerDownRight,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import {
  ModelId,
  PersonalityMode,
  ReasoningEffort,
  SkillDefinition,
  SubagentConfig,
  Thread,
  TurnItem,
  WorktreeInfo,
} from '../types/codex';

interface CenterThreadViewProps {
  thread: Thread;
  worktrees: WorktreeInfo[];
  skills: SkillDefinition[];
  subagents: SubagentConfig[];
  workspaceFiles: string[];
  onTogglePin: (threadId: string) => void;
  onForkThread: (threadId: string) => void;
  onRevertThread: (threadId: string) => void;
  onOpenInEditor: (filePath?: string) => void;
  onSelectDiffFile: (filePath: string) => void;
  onUpdateThreadConfig: (
    threadId: string,
    patch: Partial<Pick<Thread, 'model' | 'personality' | 'reasoningEffort' | 'subagent' | 'worktreeId' | 'branch'>>
  ) => void;
  onSendMessage: (params: {
    prompt: string;
    attachedFiles: string[];
    invokedSkills: string[];
    createNewWorktree?: boolean;
  }) => void;
  onSteerTurn: (steerText: string) => void;
  onInterruptTurn: () => void;
  onRespondApproval: (
    turnId: string,
    itemId: string,
    decision: 'allow_once' | 'allow_always' | 'deny',
    command?: string
  ) => void;
}

export const CenterThreadView: React.FC<CenterThreadViewProps> = ({
  thread,
  worktrees,
  skills,
  subagents,
  workspaceFiles,
  onTogglePin,
  onForkThread,
  onRevertThread,
  onOpenInEditor,
  onSelectDiffFile,
  onUpdateThreadConfig,
  onSendMessage,
  onSteerTurn,
  onInterruptTurn,
  onRespondApproval,
}) => {
  const [composerText, setComposerText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [invokedSkills, setInvokedSkills] = useState<string[]>([]);
  const [createNewWorktree, setCreateNewWorktree] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    item_2: true,
    item_201_2: true,
  });
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);

  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.id, thread.turns.length]);

  const isRunning = thread.status === 'running';
  const isWaitingApproval = thread.status === 'waiting_approval';

  const toggleItemExpand = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleInputChange = (val: string) => {
    setComposerText(val);
    if (val.endsWith('$')) {
      setShowSkillPicker(true);
      setShowFilePicker(false);
      setShowSlashMenu(false);
    } else if (val.endsWith('@')) {
      setShowFilePicker(true);
      setShowSkillPicker(false);
      setShowSlashMenu(false);
    } else if (val === '/') {
      setShowSlashMenu(true);
      setShowSkillPicker(false);
      setShowFilePicker(false);
    } else {
      setShowSkillPicker(false);
      setShowFilePicker(false);
      setShowSlashMenu(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = composerText.trim();
    if (!trimmed) return;

    // Handle quick slash commands
    if (trimmed.startsWith('/personality')) {
      const nextMode: PersonalityMode =
        thread.personality === 'pragmatic' ? 'empathetic' : 'pragmatic';
      onUpdateThreadConfig(thread.id, { personality: nextMode });
      setComposerText('');
      return;
    }

    if (isRunning) {
      onSteerTurn(trimmed);
      setComposerText('');
      return;
    }

    onSendMessage({
      prompt: trimmed,
      attachedFiles,
      invokedSkills,
      createNewWorktree,
    });
    setComposerText('');
    setAttachedFiles([]);
    setInvokedSkills([]);
    setCreateNewWorktree(false);
  };

  const renderFormattedMarkdown = (text?: string) => {
    if (!text) return null;
    const paragraphs = text.split('\n\n');
    return (
      <div className="space-y-2.5 text-sm leading-relaxed text-slate-200">
        {paragraphs.map((para, i) => {
          if (para.startsWith('1. ') || para.startsWith('- ')) {
            const lines = para.split('\n');
            return (
              <ul key={i} className="space-y-1.5 pl-4 list-disc marker:text-emerald-400">
                {lines.map((line, j) => {
                  const cleaned = line.replace(/^(\d+\.|-)\s+/, '');
                  return (
                    <li key={j} className="text-slate-200">
                      {renderInlineFormatting(cleaned)}
                    </li>
                  );
                })}
              </ul>
            );
          }
          return <p key={i}>{renderInlineFormatting(para)}</p>;
        })}
      </div>
    );
  };

  const renderInlineFormatting = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-[#181D2C] text-emerald-300 font-mono text-xs border border-slate-700/70"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const renderTurnItem = (turnId: string, item: TurnItem) => {
    const isExpanded = !!expandedItems[item.id];

    switch (item.type) {
      case 'userMessage':
        return (
          <div key={item.id} className="flex justify-end">
            <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-[#192030] border border-[#28324B] px-4 py-3 text-sm text-slate-100 shadow-sm">
              {(item.attachedFiles?.length || item.invokedSkills?.length) ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {item.invokedSkills?.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono"
                    >
                      <Sparkles className="w-3 h-3" />${skill}
                    </span>
                  ))}
                  {item.attachedFiles?.map((file) => (
                    <span
                      key={file}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono"
                    >
                      <FileCode2 className="w-3 h-3 text-cyan-400" />@{file}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="whitespace-pre-wrap">{item.text}</div>
            </div>
          </div>
        );

      case 'steerMessage':
        return (
          <div key={item.id} className="flex justify-end">
            <div className="max-w-xl rounded-xl bg-cyan-950/40 border border-cyan-500/40 px-3.5 py-2 text-xs text-cyan-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="font-mono uppercase text-[10px] text-cyan-400 block">
                  Mid-Turn Steer (turn/steer)
                </span>
                <span>{item.text}</span>
              </div>
            </div>
          </div>
        );

      case 'reasoning':
        return (
          <div
            key={item.id}
            className="rounded-xl bg-[#11141E] border border-[#222736] overflow-hidden"
          >
            <button
              onClick={() => toggleItemExpand(item.id)}
              className="w-full px-3.5 py-2 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                {item.status === 'streaming' ? (
                  <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                ) : (
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="font-medium text-slate-300">
                  Thought {item.durationSeconds ?? 1}s
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  ({item.reasoningSteps?.length || 1} reasoning steps)
                </span>
              </span>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            {isExpanded && item.reasoningSteps && (
              <div className="px-4 pb-3 pt-1 border-t border-[#1C202E] space-y-1.5 text-xs text-slate-400 font-mono">
                {item.reasoningSteps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-slate-600 select-none">{idx + 1}.</span>
                    <span className="text-slate-300/90 leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'subagentRun':
        return (
          <div
            key={item.id}
            className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#121622] border border-teal-500/25 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 font-mono text-[11px] flex items-center gap-1 shrink-0">
                <Bot className="w-3 h-3" />
                subagent:{item.subagentName}
              </span>
              <span className="text-slate-300 truncate">{item.subagentTask}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 shrink-0 ml-2">
              {item.subagentTokens}
            </span>
          </div>
        );

      case 'commandExecution':
        return (
          <div
            key={item.id}
            className="rounded-xl bg-[#0D1017] border border-[#222736] overflow-hidden text-xs font-mono"
          >
            <button
              onClick={() => toggleItemExpand(item.id)}
              className="w-full px-3.5 py-2 flex items-center justify-between text-slate-300 hover:bg-[#131722] transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-slate-400">$</span>
                <span className="truncate text-slate-200">{item.command}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                    item.exitCode === 0
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  exit {item.exitCode ?? 0}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
              </span>
            </button>
            {isExpanded && item.stdout && (
              <pre className="p-3 bg-[#080A0E] border-t border-[#1B202E] text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                {item.stdout}
              </pre>
            )}
          </div>
        );

      case 'fileChange':
        return (
          <div
            key={item.id}
            onClick={() => item.filePath && onSelectDiffFile(item.filePath)}
            className="group cursor-pointer rounded-xl bg-[#121621] hover:bg-[#171C2B] border border-[#242B3D] hover:border-emerald-500/40 px-3.5 py-2.5 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white font-mono truncate">
                    Edited {item.filePath}
                  </span>
                  <span className="text-xs font-mono text-emerald-400">+{item.additions}</span>
                  <span className="text-xs font-mono text-rose-400">-{item.deletions}</span>
                </div>
                {item.summary && (
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.summary}</div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-emerald-400 opacity-80 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-2">
              <span>Inspect Diff</span>
              <CornerDownRight className="w-3 h-3" />
            </span>
          </div>
        );

      case 'approvalRequest':
        return (
          <div
            key={item.id}
            className={`rounded-xl border p-4 space-y-3 ${
              item.status === 'waiting_approval'
                ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-950/20'
                : item.status === 'completed'
                ? 'bg-emerald-950/15 border-emerald-500/30'
                : 'bg-rose-950/15 border-rose-500/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  {item.status === 'waiting_approval'
                    ? 'Ask for Approval · Sandbox Guardrail'
                    : item.decision === 'deny'
                    ? 'Command Denied by User'
                    : 'Command Approved'}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-200 border border-amber-500/30">
                Risk: {item.riskLevel || 'medium'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#090B10] border border-[#222736] font-mono text-xs text-emerald-300 overflow-x-auto">
              $ {item.approvalCommand}
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <p>{item.approvalReason}</p>
              {item.sandboxRuleTriggered && (
                <p className="text-[11px] font-mono text-slate-400">
                  Policy triggered: {item.sandboxRuleTriggered}
                </p>
              )}
            </div>

            {item.status === 'waiting_approval' && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() =>
                    onRespondApproval(turnId, item.id, 'allow_once', item.approvalCommand)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Allow Once</span>
                </button>
                <button
                  onClick={() =>
                    onRespondApproval(turnId, item.id, 'allow_always', item.approvalCommand)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C2232] hover:bg-[#252D42] text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Always Allow in Worktree</span>
                </button>
                <button
                  onClick={() =>
                    onRespondApproval(turnId, item.id, 'deny', item.approvalCommand)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Deny & Continue</span>
                </button>
              </div>
            )}
          </div>
        );

      case 'agentMessage':
        return (
          <div
            key={item.id}
            className="rounded-2xl bg-[#12151E] border border-[#222736] p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#1C202E]">
              <span className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
                <span>Codex ({thread.model})</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                  {thread.personality}
                </span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">{item.timestamp}</span>
            </div>
            {renderFormattedMarkdown(item.text)}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="flex-1 flex flex-col h-full bg-[#090A0F] min-w-0">
      {/* Thread Header Bar */}
      <div className="h-12 px-4 border-b border-[#222736] bg-[#0D0F16] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => onTogglePin(thread.id)}
            title={thread.pinned ? 'Unpin thread' : 'Pin thread'}
            className={`p-1.5 rounded-lg border transition-colors ${
              thread.pinned
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-[#141822] border-[#222736] text-slate-400 hover:text-white'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{thread.title}</h1>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-indigo-300">
                <GitBranch className="w-3 h-3" />
                {thread.branch}
              </span>
              <span>·</span>
              <span>{thread.tokenUsage}</span>
              <span>·</span>
              <span className="text-emerald-400">+{thread.diffSummary.additions}</span>
              <span className="text-rose-400">-{thread.diffSummary.deletions}</span>
            </div>
          </div>
        </div>

        {/* Thread Lifecycle Actions: Fork, Revert, Open in IDE */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onForkThread(thread.id)}
            title="Fork thread history into a new parallel thread (thread/fork)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141822] hover:bg-[#1B2130] border border-[#222736] text-xs text-slate-300 transition-colors"
          >
            <GitFork className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Fork</span>
          </button>
          <button
            onClick={() => onRevertThread(thread.id)}
            title="Revert latest turn changes (thread/revert)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141822] hover:bg-[#1B2130] border border-[#222736] text-xs text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Revert</span>
          </button>
          <button
            onClick={() => onOpenInEditor()}
            title="Open worktree in VS Code / Cursor"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141822] hover:bg-[#1B2130] border border-[#222736] text-xs text-slate-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Open in Editor</span>
          </button>
        </div>
      </div>

      {/* Scrollable Turn & Item Stream */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-6">
        {thread.turns.map((turn) => (
          <div key={turn.id} className="space-y-3">
            {turn.items.map((item) => renderTurnItem(turn.id, item))}
          </div>
        ))}
        <div ref={scrollEndRef} />
      </div>

      {/* Bottom Multi-Function Codex Composer */}
      <div className="p-3.5 border-t border-[#222736] bg-[#0C0E15] relative">
        {/* Autocomplete Popover: $skills */}
        {showSkillPicker && (
          <div className="absolute bottom-full left-4 mb-2 w-80 rounded-xl bg-[#141824] border border-[#283147] shadow-2xl p-2 z-40">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
              Invoke Codex Skill ($skill-name)
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {skills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => {
                    if (!invokedSkills.includes(skill.slug)) {
                      setInvokedSkills([...invokedSkills, skill.slug]);
                    }
                    setComposerText((prev) => prev.replace(/\$$/, ''));
                    setShowSkillPicker(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#1E2538] transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-mono text-purple-300">${skill.slug}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                      {skill.description}
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {skill.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Autocomplete Popover: @files */}
        {showFilePicker && (
          <div className="absolute bottom-full left-4 mb-2 w-80 rounded-xl bg-[#141824] border border-[#283147] shadow-2xl p-2 z-40">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
              Attach Workspace File (@file)
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {workspaceFiles.map((file) => (
                <button
                  key={file}
                  onClick={() => {
                    if (!attachedFiles.includes(file)) {
                      setAttachedFiles([...attachedFiles, file]);
                    }
                    setComposerText((prev) => prev.replace(/@$/, ''));
                    setShowFilePicker(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#1E2538] text-xs font-mono text-cyan-300 flex items-center gap-2"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span className="truncate">{file}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Autocomplete Popover: /slash commands */}
        {showSlashMenu && (
          <div className="absolute bottom-full left-4 mb-2 w-80 rounded-xl bg-[#141824] border border-[#283147] shadow-2xl p-2 z-40">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
              Codex Slash Commands
            </div>
            {[
              {
                cmd: '/personality',
                desc: 'Switch between Terse/Pragmatic and Conversational/Empathetic style',
              },
              {
                cmd: '/worktree',
                desc: 'Isolate this task inside a fresh Git worktree checkout',
              },
              {
                cmd: '/agent explorer',
                desc: 'Delegate next turn to the high-speed read-only Explorer subagent',
              },
              {
                cmd: '/review',
                desc: 'Run automated backward-compatibility and security diff review',
              },
            ].map((item) => (
              <button
                key={item.cmd}
                onClick={() => {
                  if (item.cmd === '/personality') {
                    onUpdateThreadConfig(thread.id, {
                      personality:
                        thread.personality === 'pragmatic' ? 'empathetic' : 'pragmatic',
                    });
                    setComposerText('');
                  } else if (item.cmd === '/worktree') {
                    setCreateNewWorktree(true);
                    setComposerText('');
                  } else {
                    setComposerText(item.cmd + ' ');
                  }
                  setShowSlashMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#1E2538] transition-colors"
              >
                <div className="text-xs font-mono text-emerald-400">{item.cmd}</div>
                <div className="text-[11px] text-slate-400">{item.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Composer Box */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#131722] border border-[#262E42] focus-within:border-emerald-500/60 transition-colors p-3 space-y-2.5 shadow-inner"
        >
          {/* Active Attachments & Invoked Skills Row */}
          {(attachedFiles.length > 0 || invokedSkills.length > 0 || createNewWorktree) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {createNewWorktree && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-mono">
                  <GitBranch className="w-3 h-3" />
                  + Isolated Git Worktree
                  <button
                    type="button"
                    onClick={() => setCreateNewWorktree(false)}
                    className="ml-1 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              )}
              {invokedSkills.map((slug) => (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono"
                >
                  <Sparkles className="w-3 h-3" />${slug}
                  <button
                    type="button"
                    onClick={() => setInvokedSkills(invokedSkills.filter((s) => s !== slug))}
                    className="ml-1 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
              {attachedFiles.map((file) => (
                <span
                  key={file}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700 text-xs font-mono"
                >
                  <FileCode2 className="w-3 h-3" />@{file}
                  <button
                    type="button"
                    onClick={() => setAttachedFiles(attachedFiles.filter((f) => f !== file))}
                    className="ml-1 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            rows={2}
            value={composerText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              isRunning
                ? 'Agent is working... Type here and press Enter to steer mid-turn (turn/steer) without stopping...'
                : isWaitingApproval
                ? 'Waiting for your sandbox approval above (or type instructions to steer)...'
                : 'Ask Codex to build, refactor, or review... Type $ for skills, @ for files, / for commands'
            }
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
          />

          {/* Bottom Composer Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#1E2434] text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Model Selector */}
              <select
                value={thread.model}
                onChange={(e) =>
                  onUpdateThreadConfig(thread.id, { model: e.target.value as ModelId })
                }
                className="bg-[#1A2030] hover:bg-[#22293D] text-slate-200 border border-[#2C354D] rounded-lg px-2 py-1 text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="gpt-6.1-sol">GPT-6.1 Sol (Frontier)</option>
                <option value="gpt-6-luna">GPT-6 Luna (Fast)</option>
                <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
                <option value="o4-mini-high">o4-mini-high</option>
              </select>

              {/* Reasoning Effort */}
              <div className="flex items-center gap-1 bg-[#1A2030] border border-[#2C354D] rounded-lg px-2 py-1">
                <Gauge className="w-3 h-3 text-emerald-400" />
                <select
                  value={thread.reasoningEffort}
                  onChange={(e) =>
                    onUpdateThreadConfig(thread.id, {
                      reasoningEffort: e.target.value as ReasoningEffort,
                    })
                  }
                  className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="low" className="bg-[#141824]">Effort: Low</option>
                  <option value="medium" className="bg-[#141824]">Effort: Medium</option>
                  <option value="high" className="bg-[#141824]">Effort: High</option>
                  <option value="max" className="bg-[#141824]">Effort: Max</option>
                </select>
              </div>

              {/* Subagent Picker */}
              <div className="flex items-center gap-1 bg-[#1A2030] border border-[#2C354D] rounded-lg px-2 py-1">
                <Bot className="w-3 h-3 text-teal-400" />
                <select
                  value={thread.subagent}
                  onChange={(e) =>
                    onUpdateThreadConfig(thread.id, { subagent: e.target.value })
                  }
                  className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
                >
                  {subagents.map((sa) => (
                    <option key={sa.id} value={sa.name} className="bg-[#141824]">
                      Agent: {sa.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Personality Toggle (/personality) */}
              <button
                type="button"
                onClick={() =>
                  onUpdateThreadConfig(thread.id, {
                    personality:
                      thread.personality === 'pragmatic' ? 'empathetic' : 'pragmatic',
                  })
                }
                title="Switch /personality between Terse/Pragmatic and Conversational/Empathetic"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1A2030] hover:bg-[#22293D] border border-[#2C354D] text-slate-300 transition-colors"
              >
                <Sliders className="w-3 h-3 text-purple-400" />
                <span className="capitalize">{thread.personality}</span>
              </button>

              {/* Quick Skill & File Attach Buttons */}
              <button
                type="button"
                onClick={() => setShowSkillPicker((v) => !v)}
                className="px-2 py-1 rounded-lg bg-[#1A2030] hover:bg-[#22293D] border border-[#2C354D] text-purple-300 font-mono text-[11px]"
              >
                $skill
              </button>
              <button
                type="button"
                onClick={() => setShowFilePicker((v) => !v)}
                className="px-2 py-1 rounded-lg bg-[#1A2030] hover:bg-[#22293D] border border-[#2C354D] text-cyan-300 font-mono text-[11px] flex items-center gap-1"
              >
                <Paperclip className="w-3 h-3" />
                <span>@file</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateNewWorktree((v) => !v)}
                className={`px-2 py-1 rounded-lg border font-mono text-[11px] flex items-center gap-1 transition-colors ${
                  createNewWorktree
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-[#1A2030] hover:bg-[#22293D] border-[#2C354D] text-slate-400'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>Worktree</span>
              </button>
            </div>

            {/* Right Submit / Steer / Interrupt Controls */}
            <div className="flex items-center gap-2">
              {isRunning && (
                <button
                  type="button"
                  onClick={onInterruptTurn}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-medium transition-colors"
                >
                  <Square className="w-3 h-3 fill-rose-400" />
                  <span>Stop</span>
                </button>
              )}
              <button
                type="submit"
                disabled={!composerText.trim()}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  composerText.trim()
                    ? isRunning
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    : 'bg-[#1C2130] text-slate-500 cursor-not-allowed'
                }`}
              >
                {isRunning ? (
                  <>
                    <Compass className="w-3.5 h-3.5" />
                    <span>Steer Turn</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Run Agent</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};
