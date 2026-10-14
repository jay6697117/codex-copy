import React, { useState, useRef, useEffect } from 'react';
import {
  Pin,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Terminal,
  FileCode2,
  ShieldAlert,
  Check,
  X,
  Square,
  Compass,
  Cpu,
  Gauge,
  Loader2,
  CheckCircle2,
  Plus,
  ArrowUp,
  PanelLeftOpen,
  PanelRight,
  FolderTree,
  Globe,
  ExternalLink,
  GitCommit,
  Shield,
  Laptop,
  RotateCcw,
  GitFork,
  Settings,
  Target,
  Pause,
  Play,
  Edit3,
  Trash2,
} from 'lucide-react';
import {
  AppLanguage,
  ComposerMode,
  ExecutionEnvironmentMode,
  LocalCodexStatus,
  ModelId,
  PermissionMode,
  PersonalityMode,
  ProjectWorkspace,
  ReasoningEffort,
  RightPanelTab,
  SkillDefinition,
  SubagentConfig,
  ThemeSkin,
  Thread,
  ThreadGoal,
  TurnItem,
  WorktreeInfo,
} from '../types/codex';
import { t, SKIN_METAS } from '../i18n/translations';

interface CenterThreadViewProps {
  lang: AppLanguage;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  rightDrawerOpen: boolean;
  activeRightTab: RightPanelTab;
  onToggleRightDrawer: (tab?: RightPanelTab) => void;
  skin: ThemeSkin;
  activeProject: ProjectWorkspace;
  projects: ProjectWorkspace[];
  onSelectProject: (projectId: string) => void;
  thread: Thread;
  worktrees: WorktreeInfo[];
  skills: SkillDefinition[];
  subagents: SubagentConfig[];
  workspaceFiles: string[];
  localCodexStatus: LocalCodexStatus | null;
  onOpenCodexConfig: () => void;
  onTogglePin: (threadId: string) => void;
  onForkThread: (threadId: string) => void;
  onRevertThread: (threadId: string) => void;
  onOpenInEditor: (appId?: string) => void;
  onGitCommitAction: (action: 'commit' | 'push' | 'pr', message?: string) => void;
  onSelectDiffFile: (filePath: string) => void;
  onUpdateThreadConfig: (
    threadId: string,
    patch: Partial<
      Pick<
        Thread,
        | 'model'
        | 'personality'
        | 'reasoningEffort'
        | 'subagent'
        | 'worktreeId'
        | 'branch'
        | 'environmentMode'
        | 'permissionMode'
        | 'goal'
      >
    >
  ) => void;
  onSendMessage: (params: {
    prompt: string;
    attachedFiles: string[];
    invokedSkills: string[];
    createNewWorktree?: boolean;
    mode?: ComposerMode;
    goalObjective?: string;
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

const IDE_APPS = [
  { id: 'cursor', label: 'Cursor' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'zed', label: 'Zed' },
  { id: 'ghostty', label: 'Ghostty' },
  { id: 'iterm', label: 'iTerm2' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'finder', label: 'Finder' },
];

export const CenterThreadView: React.FC<CenterThreadViewProps> = ({
  lang,
  sidebarCollapsed,
  onToggleSidebar,
  rightDrawerOpen,
  activeRightTab,
  onToggleRightDrawer,
  skin,
  activeProject,
  projects,
  onSelectProject,
  thread,
  skills,
  workspaceFiles,
  localCodexStatus,
  onOpenCodexConfig,
  onTogglePin,
  onForkThread,
  onRevertThread,
  onOpenInEditor,
  onGitCommitAction,
  onSelectDiffFile,
  onUpdateThreadConfig,
  onSendMessage,
  onSteerTurn,
  onInterruptTurn,
  onRespondApproval,
}) => {
  const i18n = t(lang);
  const currentSkinMeta = SKIN_METAS.find((s) => s.id === skin) || SKIN_METAS[0];

  const [composerText, setComposerText] = useState('');
  const [composerMode, setComposerMode] = useState<ComposerMode>(
    thread.goal?.status === 'active' ? 'goal' : 'agent'
  );
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [invokedSkills, setInvokedSkills] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [selectedIde, setSelectedIde] = useState<string>('cursor');
  const [showIdeMenu, setShowIdeMenu] = useState(false);
  const [showCommitMenu, setShowCommitMenu] = useState(false);
  const [quickCommitMsg, setQuickCommitMsg] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(thread.goal?.objective || '');

  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.id, thread.turns.length]);

  useEffect(() => {
    setGoalDraft(thread.goal?.objective || '');
    if (thread.goal?.status === 'active') {
      setComposerMode('goal');
    }
  }, [thread.id, thread.goal?.objective, thread.goal?.status]);

  const isRunning = thread.status === 'running';
  const envMode: ExecutionEnvironmentMode = thread.environmentMode || 'local';
  const permMode: PermissionMode = thread.permissionMode || 'workspace-write';

  const configuredModel = localCodexStatus?.config?.effective?.model;
  const availableModels = Array.from(
    new Set(
      [
        configuredModel,
        'gpt-5.4',
        'gpt-5.3-codex',
        'gpt-6-astra',
        'o3',
        'o4-mini',
      ].filter(Boolean) as string[]
    )
  );

  const toggleItemExpand = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleSaveGoal = (objectiveText: string, status: ThreadGoal['status'] = 'active') => {
    const cleaned = objectiveText.trim();
    if (!cleaned) {
      onUpdateThreadConfig(thread.id, { goal: null });
      setEditingGoal(false);
      return;
    }
    onUpdateThreadConfig(thread.id, {
      goal: {
        objective: cleaned,
        status,
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    });
    setGoalDraft(cleaned);
    setEditingGoal(false);
    if (status === 'active') {
      setComposerMode('goal');
    }
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
    } else if (val === '/' || val.startsWith('/goal')) {
      setShowSlashMenu(val === '/');
      setShowSkillPicker(false);
      setShowFilePicker(false);
    } else {
      setShowSkillPicker(false);
      setShowFilePicker(false);
      setShowSlashMenu(false);
    }
  };

  const handleSubmit = (
    e?: React.FormEvent,
    overridePrompt?: string,
    overrideMode?: ComposerMode
  ) => {
    e?.preventDefault();
    const trimmed = (overridePrompt ?? composerText).trim();
    if (!trimmed) return;

    if (trimmed === '/personality') {
      const nextMode: PersonalityMode =
        thread.personality === 'pragmatic' ? 'empathetic' : 'pragmatic';
      onUpdateThreadConfig(thread.id, { personality: nextMode });
      setComposerText('');
      return;
    }

    // Handle `/goal` commands per OpenAI Codex Desktop Goal mode specification
    if (trimmed === '/goal' || trimmed.startsWith('/goal ')) {
      const arg = trimmed.slice(5).trim();
      if (!arg || arg === 'status') {
        setComposerMode('goal');
        if (!thread.goal) {
          setEditingGoal(true);
        }
        setComposerText('');
        return;
      }
      if (arg === 'edit') {
        setComposerMode('goal');
        setEditingGoal(true);
        setComposerText('');
        return;
      }
      if (arg === 'pause' && thread.goal) {
        handleSaveGoal(thread.goal.objective, 'paused');
        setComposerText('');
        return;
      }
      if (arg === 'resume' && thread.goal) {
        handleSaveGoal(thread.goal.objective, 'active');
        setComposerText('');
        return;
      }
      if (arg === 'clear') {
        onUpdateThreadConfig(thread.id, { goal: null });
        setComposerMode('agent');
        setComposerText('');
        return;
      }
      // `/goal <objective>`: set persistent goal and immediately start working toward it
      handleSaveGoal(arg, 'active');
      onSendMessage({
        prompt: arg,
        attachedFiles,
        invokedSkills,
        createNewWorktree: envMode === 'worktree',
        mode: 'goal',
        goalObjective: arg,
      });
      setComposerText('');
      setAttachedFiles([]);
      setInvokedSkills([]);
      return;
    }

    if (trimmed === '/review') {
      onSendMessage({
        prompt:
          lang === 'zh-CN'
            ? '审查当前仓库未提交的 Git 变更，检查潜在缺陷、回归问题及缺失的验证测试。'
            : 'Review uncommitted git changes in this repository for bugs, regressions, and missing tests.',
        attachedFiles,
        invokedSkills,
        createNewWorktree: false,
        mode: 'review',
      });
      setComposerText('');
      return;
    }

    if (isRunning && !overridePrompt) {
      onSteerTurn(trimmed);
      setComposerText('');
      return;
    }

    const effectiveMode = overrideMode || composerMode;
    let activeObjective = thread.goal?.objective;
    if (effectiveMode === 'goal' && !activeObjective) {
      handleSaveGoal(trimmed, 'active');
      activeObjective = trimmed;
    }

    onSendMessage({
      prompt: trimmed,
      attachedFiles,
      invokedSkills,
      createNewWorktree: envMode === 'worktree',
      mode: effectiveMode,
      goalObjective: effectiveMode === 'goal' ? activeObjective : undefined,
    });
    if (!overridePrompt) {
      setComposerText('');
      setAttachedFiles([]);
      setInvokedSkills([]);
    }
  };

  const renderFormattedMarkdown = (text?: string) => {
    if (!text) return null;
    const blocks = text.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-3 text-[13.5px] leading-relaxed codex-text-primary">
        {blocks.map((block, idx) => {
          if (block.startsWith('```') && block.endsWith('```')) {
            const lines = block.slice(3, -3).trim().split('\n');
            const firstLine = lines[0]?.trim() || '';
            const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
            const codeContent = hasLang ? lines.slice(1).join('\n') : lines.join('\n');
            return (
              <pre
                key={idx}
                className="p-3.5 rounded-xl codex-card border codex-border font-mono text-xs overflow-x-auto leading-relaxed"
              >
                <code>{codeContent}</code>
              </pre>
            );
          }

          const paragraphs = block.trim().split('\n\n').filter(Boolean);
          return (
            <div key={idx} className="space-y-2.5">
              {paragraphs.map((para, pIdx) => {
                if (para.startsWith('1. ') || para.startsWith('- ') || para.startsWith('* ')) {
                  const listLines = para.split('\n');
                  return (
                    <ul key={pIdx} className="space-y-1.5 pl-4 list-disc">
                      {listLines.map((li, lIdx) => (
                        <li key={lIdx}>
                          {renderInlineFormatting(li.replace(/^(\d+\.|-|\*)\s+/, ''))}
                        </li>
                      ))}
                    </ul>
                  );
                }
                return <p key={pIdx}>{renderInlineFormatting(para)}</p>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderInlineFormatting = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold codex-text-primary">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 mx-0.5 rounded codex-card border codex-border font-mono text-xs codex-accent-text"
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
          <div key={item.id} className="flex justify-end pt-2">
            <div
              style={{
                backgroundColor: 'var(--user-bubble-bg)',
                color: 'var(--user-bubble-text)',
                borderColor: 'var(--user-bubble-border)',
              }}
              className="max-w-[82%] rounded-2xl border px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm"
            >
              {(item.attachedFiles?.length || item.invokedSkills?.length) ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {item.invokedSkills?.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/15 text-current text-xs font-mono"
                    >
                      <Sparkles className="w-3 h-3" />${skill}
                    </span>
                  ))}
                  {item.attachedFiles?.map((file) => (
                    <span
                      key={file}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/15 text-current text-xs font-mono"
                    >
                      <FileCode2 className="w-3 h-3" />@{file}
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
            <div className="max-w-lg rounded-xl codex-accent-soft px-3.5 py-2 text-xs flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 codex-accent-text shrink-0" />
              <div>
                <span className="font-mono text-[10px] codex-accent-text block">
                  {i18n.thread.steeredMidTurn}
                </span>
                <span className="codex-text-primary">{item.text}</span>
              </div>
            </div>
          </div>
        );

      case 'reasoning':
        return (
          <div key={item.id} className="py-0.5">
            <button
              onClick={() => toggleItemExpand(item.id)}
              className="inline-flex items-center gap-1.5 text-xs codex-text-muted hover:codex-text-primary transition-colors"
            >
              {item.status === 'streaming' ? (
                <Loader2 className="w-3.5 h-3.5 codex-accent-text animate-spin" />
              ) : (
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              )}
              <span className="font-medium">
                {item.status === 'streaming'
                  ? i18n.thread.thinking
                  : `${i18n.thread.thoughtFor} ${item.durationSeconds ?? 1}s`}
              </span>
            </button>
            {isExpanded && item.reasoningSteps && (
              <div className="mt-1.5 pl-4 border-l-2 codex-border space-y-1 text-xs codex-text-secondary font-mono">
                {item.reasoningSteps.map((step, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {step}
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
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg codex-card border codex-border text-xs codex-text-secondary"
          >
            <Cpu className="w-3.5 h-3.5 codex-accent-text shrink-0" />
            <span className="font-mono text-[11px] codex-text-primary">{item.subagentName}</span>
            <span className="truncate max-w-md">{item.subagentTask}</span>
          </div>
        );

      case 'commandExecution':
        return (
          <div
            key={item.id}
            className="rounded-xl codex-card border codex-border overflow-hidden text-xs font-mono"
          >
            <button
              onClick={() => toggleItemExpand(item.id)}
              className="w-full px-3 py-2 flex items-center justify-between codex-text-secondary codex-hover transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                {item.status === 'streaming' ? (
                  <Loader2 className="w-3.5 h-3.5 codex-accent-text animate-spin shrink-0" />
                ) : (
                  <Terminal className="w-3.5 h-3.5 codex-text-muted shrink-0" />
                )}
                <span className="codex-text-muted">{i18n.thread.ran}</span>
                <span className="truncate codex-text-primary">{item.command}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {item.status !== 'streaming' && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                      (item.exitCode ?? 0) === 0
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-rose-500/15 text-rose-500'
                    }`}
                  >
                    exit {item.exitCode ?? 0}
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 codex-text-muted" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 codex-text-muted" />
                )}
              </span>
            </button>
            {isExpanded && item.stdout && (
              <pre className="p-3 border-t codex-border text-[11px] codex-text-secondary overflow-x-auto leading-relaxed max-h-60">
                {item.stdout}
              </pre>
            )}
          </div>
        );

      case 'fileChange':
        return (
          <div
            key={item.id}
            onClick={() => {
              if (item.filePath) {
                onSelectDiffFile(item.filePath);
                if (!rightDrawerOpen) onToggleRightDrawer('diff');
              }
            }}
            className="group cursor-pointer rounded-xl codex-card border codex-border codex-hover px-3.5 py-2 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCode2 className="w-4 h-4 codex-accent-text shrink-0" />
              <span className="text-xs codex-text-muted">{i18n.thread.edited}</span>
              <span className="text-xs font-medium codex-text-primary font-mono truncate">
                {item.filePath}
              </span>
              <span className="text-xs font-mono text-emerald-500">+{item.additions ?? 1}</span>
              <span className="text-xs font-mono text-rose-500">-{item.deletions ?? 0}</span>
            </div>
            <span className="text-xs codex-text-secondary group-hover:codex-text-primary flex items-center gap-1 shrink-0 ml-2">
              <span>{i18n.thread.review}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        );

      case 'approvalRequest':
        return (
          <div
            key={item.id}
            className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-amber-500">
                  {i18n.thread.askForApproval}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-500">
                {item.sandboxRuleTriggered || i18n.thread.sandboxPermission}
              </span>
            </div>
            <div className="p-2.5 rounded-lg codex-card border codex-border font-mono text-xs codex-accent-text overflow-x-auto">
              $ {item.approvalCommand}
            </div>
            <p className="text-xs codex-text-secondary">{item.approvalReason}</p>
            {item.status === 'waiting_approval' && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() =>
                    onRespondApproval(turnId, item.id, 'allow_once', item.approvalCommand)
                  }
                  className="px-3 py-1.5 rounded-lg codex-accent-btn text-xs font-medium flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{i18n.thread.allowOnce}</span>
                </button>
                <button
                  onClick={() =>
                    onRespondApproval(turnId, item.id, 'allow_always', item.approvalCommand)
                  }
                  className="px-3 py-1.5 rounded-lg codex-card border codex-border codex-text-primary text-xs font-medium"
                >
                  {i18n.thread.alwaysAllow}
                </button>
                <button
                  onClick={() =>
                    onRespondApproval(turnId, item.id, 'deny', item.approvalCommand)
                  }
                  className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-500 text-xs font-medium flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{i18n.thread.deny}</span>
                </button>
              </div>
            )}
          </div>
        );

      case 'agentMessage':
        return (
          <div key={item.id} className="pt-1 pb-2">
            <div
              style={{
                backgroundColor: 'var(--agent-bubble-bg)',
                color: 'var(--agent-bubble-text)',
              }}
              className="rounded-2xl border codex-border px-4 py-3 shadow-sm"
            >
              {renderFormattedMarkdown(item.text)}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="flex-1 flex flex-col h-full codex-app-bg min-w-[420px] overflow-hidden">
      {/* Official OpenAI Codex Desktop App Integrated Top Header Bar */}
      <header className="h-11 px-3 border-b codex-border codex-header-bg backdrop-blur-md flex items-center justify-between gap-2 shrink-0 select-none z-20">
        {/* Left: Sidebar Toggle (if collapsed) + Project & Thread Title + Branch/Worktree */}
        <div className="flex items-center gap-2 min-w-0">
          {sidebarCollapsed && (
            <div className="flex items-center gap-1.5 pr-1">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56] inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F] inline-block" />
              <button
                onClick={onToggleSidebar}
                title={i18n.header.expandSidebar}
                className="p-1.5 rounded-md codex-text-secondary codex-hover ml-1"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Project Selector */}
          <select
            value={activeProject.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-transparent text-xs font-medium codex-text-secondary hover:codex-text-primary focus:outline-none cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-neutral-900 text-white">
                {p.name}
              </option>
            ))}
          </select>

          <span className="codex-text-muted text-xs">/</span>

          <h1 className="text-[13px] font-medium codex-text-primary truncate max-w-[260px]">
            {thread.title}
          </h1>

          <button
            onClick={() => onTogglePin(thread.id)}
            title={thread.pinned ? i18n.header.unpinThread : i18n.header.pinThread}
            className={`p-1 rounded-md transition-colors ${
              thread.pinned ? 'text-amber-500' : 'codex-text-muted codex-hover'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Branch & Local/Worktree Hand off Pill */}
          <button
            onClick={() =>
              onUpdateThreadConfig(thread.id, {
                environmentMode: envMode === 'local' ? 'worktree' : 'local',
              })
            }
            title={i18n.header.switchLocalWorktree}
            className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md codex-card border codex-border text-[11px] font-mono codex-text-secondary codex-hover"
          >
            <GitBranch className="w-3 h-3 codex-accent-text" />
            <span>{thread.branch}</span>
            <span className="text-[10px] px-1 rounded codex-active">
              {envMode === 'worktree' ? i18n.header.worktree : i18n.header.local}
            </span>
          </button>
        </div>

        {/* Right: Open in IDE + Commit/PR + Diff Counter + Panel Toggles + Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Official `Open` Split Button (Cursor / VS Code / Ghostty / Finder) */}
          <div className="relative flex items-center codex-card border codex-border rounded-lg">
            <button
              onClick={() => onOpenInEditor(selectedIde)}
              className="px-2.5 py-1 text-xs font-medium codex-text-primary codex-hover rounded-l-lg flex items-center gap-1.5"
              title={`${i18n.header.openIn} ${selectedIde}: ${activeProject.repoPath}`}
            >
              <ExternalLink className="w-3.5 h-3.5 codex-text-secondary" />
              <span className="hidden sm:inline">
                {i18n.header.openIn}{' '}
                {IDE_APPS.find((a) => a.id === selectedIde)?.label || 'Cursor'}
              </span>
            </button>
            <button
              onClick={() => {
                setShowIdeMenu((v) => !v);
                setShowCommitMenu(false);
              }}
              className="px-1.5 py-1 border-l codex-border codex-text-secondary codex-hover rounded-r-lg"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showIdeMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl codex-elevated border codex-border shadow-2xl py-1 z-50">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider codex-text-muted">
                  {i18n.header.openWorkspaceIn}
                </div>
                {IDE_APPS.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => {
                      setSelectedIde(app.id);
                      setShowIdeMenu(false);
                      onOpenInEditor(app.id);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs codex-text-primary codex-hover flex items-center justify-between"
                  >
                    <span>{app.label}</span>
                    {selectedIde === app.id && <Check className="w-3.5 h-3.5 codex-accent-text" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Official `Commit` Split Dropdown (Commit / Push / Create PR) */}
          <div className="relative flex items-center codex-card border codex-border rounded-lg">
            <button
              onClick={() => {
                setShowCommitMenu((v) => !v);
                setShowIdeMenu(false);
              }}
              className="px-2.5 py-1 text-xs font-medium codex-text-primary codex-hover rounded-lg flex items-center gap-1.5"
            >
              <GitCommit className="w-3.5 h-3.5 codex-accent-text" />
              <span className="hidden sm:inline">{i18n.header.commit}</span>
              <ChevronDown className="w-3 h-3 codex-text-muted" />
            </button>

            {showCommitMenu && (
              <div className="absolute right-0 top-full mt-1 w-72 rounded-xl codex-elevated border codex-border shadow-2xl p-3 space-y-2.5 z-50">
                <div className="text-xs font-semibold codex-text-primary">
                  {i18n.header.gitCommitAndPr} ({thread.branch})
                </div>
                <input
                  type="text"
                  value={quickCommitMsg}
                  onChange={(e) => setQuickCommitMsg(e.target.value)}
                  placeholder={i18n.header.commitPlaceholder}
                  className="w-full px-2.5 py-1.5 rounded-lg codex-card border codex-border text-xs codex-text-primary focus:outline-none"
                />
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      onGitCommitAction('commit', quickCommitMsg);
                      setQuickCommitMsg('');
                      setShowCommitMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium codex-accent-btn flex items-center justify-between"
                  >
                    <span>{i18n.header.commitChanges}</span>
                    <span className="font-mono text-[10px]">git commit</span>
                  </button>
                  <button
                    onClick={() => {
                      onGitCommitAction('push', quickCommitMsg);
                      setQuickCommitMsg('');
                      setShowCommitMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs codex-text-primary codex-hover flex items-center justify-between"
                  >
                    <span>{i18n.header.commitAndPush}</span>
                    <span className="font-mono text-[10px] codex-text-muted">git push</span>
                  </button>
                  <button
                    onClick={() => {
                      onGitCommitAction('pr', quickCommitMsg);
                      setShowCommitMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs codex-text-primary codex-hover flex items-center justify-between"
                  >
                    <span>{i18n.header.createPr}</span>
                    <span className="font-mono text-[10px] codex-text-muted">gh pr create</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clickable Diff Counter Pill (+add -del) that toggles the Right Review Drawer */}
          <button
            onClick={() => onToggleRightDrawer('diff')}
            title={i18n.header.toggleDiffPane}
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors ${
              rightDrawerOpen && activeRightTab === 'diff'
                ? 'codex-active codex-accent-soft'
                : 'codex-card codex-border codex-hover'
            }`}
          >
            <span className="text-emerald-500">+{thread.diffSummary.additions}</span>
            <span className="text-rose-500">-{thread.diffSummary.deletions}</span>
          </button>

          {/* Integrated Terminal / Files / Browser Drawer Toggles */}
          <div className="flex items-center codex-card border codex-border rounded-lg p-0.5">
            <button
              onClick={() => onToggleRightDrawer('terminal')}
              title={i18n.header.toggleTerminal}
              className={`p-1.5 rounded-md transition-colors ${
                rightDrawerOpen && activeRightTab === 'terminal'
                  ? 'codex-active codex-accent-text'
                  : 'codex-text-secondary codex-hover'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggleRightDrawer('files')}
              title={i18n.header.toggleFiles}
              className={`p-1.5 rounded-md transition-colors ${
                rightDrawerOpen && activeRightTab === 'files'
                  ? 'codex-active codex-accent-text'
                  : 'codex-text-secondary codex-hover'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggleRightDrawer('preview')}
              title={i18n.header.toggleBrowser}
              className={`p-1.5 rounded-md transition-colors ${
                rightDrawerOpen && activeRightTab === 'preview'
                  ? 'codex-active codex-accent-text'
                  : 'codex-text-secondary codex-hover'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggleRightDrawer()}
              title={rightDrawerOpen ? i18n.header.closeInspector : i18n.header.openInspector}
              className={`p-1.5 rounded-md transition-colors ${
                rightDrawerOpen
                  ? 'codex-active codex-text-primary'
                  : 'codex-text-secondary codex-hover'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Settings Button (for switching WeChat / QQ / DingTalk skins & Chinese / English) */}
          <button
            onClick={onOpenCodexConfig}
            title={i18n.header.openSettings}
            className="px-2 py-1 rounded-lg codex-card border codex-border codex-hover flex items-center gap-1.5 text-xs codex-text-secondary hover:codex-text-primary transition-colors"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentSkinMeta.accentHex }}
            />
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Scrollable Thread Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {thread.turns.length === 0 ? (
            <div className="py-16 text-center space-y-5">
              <div className="w-12 h-12 rounded-2xl codex-card border codex-border flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-6 h-6 codex-accent-text" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold codex-text-primary">
                  {i18n.thread.emptyTitle}
                </h2>
                <p className="text-xs codex-text-secondary max-w-md mx-auto">
                  {i18n.thread.emptySubtitlePrefix}{' '}
                  <span className="font-mono codex-text-primary">{activeProject.name}</span> (
                  <span className="font-mono codex-accent-text">{thread.branch}</span>
                  ){i18n.thread.emptySubtitleSuffix}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-xl mx-auto text-left pt-2">
                <button
                  onClick={() =>
                    handleSubmit(
                      undefined,
                      lang === 'zh-CN'
                        ? '检查当前仓库目录结构，并汇总最近未提交的 Git 变更。'
                        : 'Inspect this repository and summarize any uncommitted changes or recent commits.'
                    )
                  }
                  className="p-3 rounded-xl codex-card border codex-border codex-hover transition-all space-y-1"
                >
                  <div className="text-xs font-medium codex-text-primary">
                    {i18n.thread.cardInspectTitle}
                  </div>
                  <div className="text-[11px] codex-text-muted">
                    {i18n.thread.cardInspectDesc}
                  </div>
                </button>
                <button
                  onClick={() => handleSubmit(undefined, '/review', 'review')}
                  className="p-3 rounded-xl codex-card border codex-border codex-hover transition-all space-y-1"
                >
                  <div className="text-xs font-medium codex-text-primary">
                    {i18n.thread.cardReviewTitle}
                  </div>
                  <div className="text-[11px] codex-text-muted">
                    {i18n.thread.cardReviewDesc}
                  </div>
                </button>
                <button
                  onClick={() => {
                    setComposerMode('goal');
                    setEditingGoal(true);
                  }}
                  className="p-3 rounded-xl codex-card border codex-border codex-hover transition-all space-y-1"
                >
                  <div className="text-xs font-medium codex-text-primary flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 codex-accent-text" />
                    <span>{i18n.thread.cardGoalTitle}</span>
                  </div>
                  <div className="text-[11px] codex-text-muted">
                    {i18n.thread.cardGoalDesc}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            thread.turns.map((turn) => (
              <div key={turn.id} className="space-y-3">
                <div className="space-y-2.5">
                  {turn.items.map((item) => renderTurnItem(turn.id, item))}
                </div>

                {/* Turn Footer Summary Pill: files changed + Undo + Review changes */}
                {turn.status === 'completed' && thread.changedFiles.length > 0 && (
                  <div className="pt-2">
                    <div className="rounded-xl codex-card border codex-border px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs">
                        <CheckCircle2 className="w-4 h-4 codex-accent-text" />
                        <span className="font-medium codex-text-primary">
                          {thread.diffSummary.files} {i18n.thread.filesChanged}
                        </span>
                        <span className="font-mono text-emerald-500">
                          +{thread.diffSummary.additions}
                        </span>
                        <span className="font-mono text-rose-500">
                          -{thread.diffSummary.deletions}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onRevertThread(thread.id)}
                          className="px-2.5 py-1 rounded-lg text-xs codex-text-secondary codex-hover flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{i18n.thread.undo}</span>
                        </button>
                        <button
                          onClick={() => onToggleRightDrawer('diff')}
                          className="px-3 py-1 rounded-lg codex-active border codex-border text-xs font-medium codex-text-primary"
                        >
                          {i18n.thread.reviewChanges}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={scrollEndRef} />
        </div>
      </div>

      {/* Official OpenAI Codex App Floating Rounded Composer Pill at Bottom */}
      <div className="px-6 pb-4 pt-1 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          {/* OpenAI Codex Desktop Goal Progress Row (`/goal`) */}
          {(thread.goal || composerMode === 'goal' || editingGoal) && (
            <div className="mb-2 rounded-xl codex-card border codex-border px-3.5 py-2 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md codex-accent-soft text-[11px] font-semibold shrink-0">
                  <Target className="w-3 h-3" />
                  <span>{i18n.thread.goalActiveLabel}</span>
                </span>

                {editingGoal ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="text"
                      value={goalDraft}
                      onChange={(e) => setGoalDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveGoal(goalDraft, 'active');
                        } else if (e.key === 'Escape') {
                          setEditingGoal(false);
                        }
                      }}
                      placeholder={i18n.thread.goalSetPlaceholder}
                      className="flex-1 px-2.5 py-1 rounded-lg codex-app-bg border codex-border text-xs codex-text-primary focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveGoal(goalDraft, 'active')}
                      className="px-2.5 py-1 rounded-lg codex-accent-btn text-xs font-medium shrink-0"
                    >
                      {i18n.thread.goalSave}
                    </button>
                    <button
                      onClick={() => setEditingGoal(false)}
                      className="px-2 py-1 rounded-lg text-xs codex-text-muted codex-hover shrink-0"
                    >
                      {i18n.thread.goalCancel}
                    </button>
                  </div>
                ) : thread.goal ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-medium codex-text-primary truncate">
                      {thread.goal.objective}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0 ${
                        thread.goal.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-amber-500/15 text-amber-500'
                      }`}
                    >
                      {thread.goal.status === 'active'
                        ? i18n.thread.goalStatusActive
                        : i18n.thread.goalStatusPaused}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingGoal(true)}
                    className="text-xs codex-text-muted hover:codex-text-primary truncate text-left flex-1"
                  >
                    {i18n.thread.goalSetPlaceholder}
                  </button>
                )}
              </div>

              {!editingGoal && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setGoalDraft(thread.goal?.objective || '');
                      setEditingGoal(true);
                    }}
                    title="/goal edit"
                    className="p-1 rounded codex-text-muted hover:codex-text-primary codex-hover text-xs flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span className="hidden sm:inline text-[11px]">{i18n.thread.goalEdit}</span>
                  </button>
                  {thread.goal && (
                    <>
                      <button
                        onClick={() =>
                          handleSaveGoal(
                            thread.goal!.objective,
                            thread.goal!.status === 'active' ? 'paused' : 'active'
                          )
                        }
                        title={thread.goal.status === 'active' ? '/goal pause' : '/goal resume'}
                        className="p-1 rounded codex-text-muted hover:codex-text-primary codex-hover text-xs flex items-center gap-1"
                      >
                        {thread.goal.status === 'active' ? (
                          <>
                            <Pause className="w-3 h-3" />
                            <span className="hidden sm:inline text-[11px]">
                              {i18n.thread.goalPause}
                            </span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span className="hidden sm:inline text-[11px]">
                              {i18n.thread.goalResume}
                            </span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          onUpdateThreadConfig(thread.id, { goal: null });
                          setComposerMode('agent');
                        }}
                        title="/goal clear"
                        className="p-1 rounded codex-text-muted hover:text-rose-500 codex-hover text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="hidden sm:inline text-[11px]">
                          {i18n.thread.goalClear}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Popover: `/` Slash Commands Menu */}
          {showSlashMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl codex-elevated border codex-border shadow-2xl p-1.5 z-30">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider codex-text-muted flex items-center justify-between">
                <span>{i18n.thread.slashCommands}</span>
                <button onClick={() => setShowSlashMenu(false)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
              {[
                {
                  cmd: '/goal',
                  desc: i18n.thread.slashGoalDesc,
                },
                {
                  cmd: '/review',
                  desc: i18n.thread.slashReviewDesc,
                },
                {
                  cmd: '/personality',
                  desc: `${i18n.thread.slashPersonalityDesc} (${thread.personality})`,
                },
              ].map((item) => (
                <button
                  key={item.cmd}
                  onClick={() => {
                    setShowSlashMenu(false);
                    if (item.cmd === '/goal') {
                      setComposerMode('goal');
                      setEditingGoal(true);
                      setComposerText('');
                    } else {
                      handleSubmit(undefined, item.cmd);
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg codex-hover flex items-center justify-between text-xs"
                >
                  <span className="font-mono codex-accent-text">{item.cmd}</span>
                  <span className="codex-text-muted text-[11px]">{item.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popover: `$skill` Picker */}
          {showSkillPicker && (
            <div className="absolute bottom-full left-0 mb-2 w-80 max-h-60 overflow-y-auto rounded-xl codex-elevated border codex-border shadow-2xl p-1.5 z-30">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider codex-text-muted flex items-center justify-between">
                <span>{i18n.thread.attachSkill}</span>
                <button onClick={() => setShowSkillPicker(false)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
              {skills
                .filter((s) => s.enabled)
                .map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      if (!invokedSkills.includes(skill.slug)) {
                        setInvokedSkills([...invokedSkills, skill.slug]);
                      }
                      setComposerText((prev) => prev.replace(/\$$/, ''));
                      setShowSkillPicker(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg codex-hover flex items-center justify-between text-xs"
                  >
                    <span className="font-mono codex-accent-text">${skill.slug}</span>
                    <span className="text-[10px] codex-text-muted truncate max-w-[150px]">
                      {skill.scope}
                    </span>
                  </button>
                ))}
            </div>
          )}

          {/* Popover: `@file` Picker */}
          {showFilePicker && (
            <div className="absolute bottom-full left-0 mb-2 w-80 max-h-60 overflow-y-auto rounded-xl codex-elevated border codex-border shadow-2xl p-1.5 z-30">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider codex-text-muted flex items-center justify-between">
                <span>{i18n.thread.attachFile}</span>
                <button onClick={() => setShowFilePicker(false)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
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
                  className="w-full text-left px-2.5 py-1.5 rounded-lg codex-hover text-xs font-mono codex-text-primary truncate"
                >
                  @{file}
                </button>
              ))}
            </div>
          )}

          {/* Main Composer Container */}
          <form
            onSubmit={(e) => handleSubmit(e)}
            className="rounded-2xl codex-composer-bg border codex-border transition-all p-3 space-y-2.5"
          >
            {/* Attached `@file` and `$skill` chips */}
            {(attachedFiles.length > 0 || invokedSkills.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {invokedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md codex-accent-soft text-xs font-mono"
                  >
                    <Sparkles className="w-3 h-3" />${skill}
                    <button
                      type="button"
                      onClick={() =>
                        setInvokedSkills(invokedSkills.filter((s) => s !== skill))
                      }
                    >
                      <X className="w-3 h-3 ml-0.5" />
                    </button>
                  </span>
                ))}
                {attachedFiles.map((file) => (
                  <span
                    key={file}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md codex-card border codex-border codex-text-primary text-xs font-mono"
                  >
                    <FileCode2 className="w-3 h-3 codex-accent-text" />@{file}
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedFiles(attachedFiles.filter((f) => f !== file))
                      }
                    >
                      <X className="w-3 h-3 ml-0.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Prompt Textarea */}
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
                  ? i18n.thread.composerRunningPlaceholder
                  : composerMode === 'goal'
                  ? i18n.thread.composerGoalPlaceholder
                  : i18n.thread.composerDefaultPlaceholder
              }
              className="w-full bg-transparent text-[13.5px] codex-text-primary placeholder:codex-text-muted focus:outline-none resize-none leading-relaxed"
            />

            {/* Official Codex Bottom Control Row: `+`, `Goal` (`/goal`), Model, Effort, Local/Worktree, Permissions, Branch, Send */}
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* `+` Attach File / Skill Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFilePicker((v) => !v);
                    setShowSkillPicker(false);
                  }}
                  title={i18n.thread.attachContextTitle}
                  className="p-1.5 rounded-lg codex-text-secondary codex-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Goal Mode Toggle Pill (`/goal` replaces legacy `Plan`) */}
                <button
                  type="button"
                  onClick={() =>
                    setComposerMode((m) => (m === 'goal' ? 'agent' : 'goal'))
                  }
                  title={i18n.thread.goalButtonTitle}
                  className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                    composerMode === 'goal'
                      ? 'codex-accent-soft'
                      : 'codex-text-secondary codex-hover'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>{i18n.thread.goalMode}</span>
                </button>

                {/* Model Selector */}
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg codex-text-secondary codex-hover text-xs">
                  <select
                    value={thread.model}
                    onChange={(e) =>
                      onUpdateThreadConfig(thread.id, { model: e.target.value as ModelId })
                    }
                    className="bg-transparent text-xs font-medium codex-text-secondary hover:codex-text-primary focus:outline-none cursor-pointer"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m} className="bg-neutral-900 text-white">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reasoning Effort Selector */}
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg codex-text-secondary codex-hover text-xs">
                  <Gauge className="w-3.5 h-3.5 codex-text-muted" />
                  <select
                    value={thread.reasoningEffort}
                    onChange={(e) =>
                      onUpdateThreadConfig(thread.id, {
                        reasoningEffort: e.target.value as ReasoningEffort,
                      })
                    }
                    className="bg-transparent text-xs codex-text-secondary hover:codex-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="low" className="bg-neutral-900 text-white">
                      {i18n.thread.effortLow}
                    </option>
                    <option value="medium" className="bg-neutral-900 text-white">
                      {i18n.thread.effortMedium}
                    </option>
                    <option value="high" className="bg-neutral-900 text-white">
                      {i18n.thread.effortHigh}
                    </option>
                    <option value="xhigh" className="bg-neutral-900 text-white">
                      {i18n.thread.effortExtraHigh}
                    </option>
                  </select>
                </div>

                {/* Execution Target Selector: Local vs Worktree */}
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg codex-text-secondary codex-hover text-xs">
                  <Laptop className="w-3.5 h-3.5 codex-text-muted" />
                  <select
                    value={envMode}
                    onChange={(e) =>
                      onUpdateThreadConfig(thread.id, {
                        environmentMode: e.target.value as ExecutionEnvironmentMode,
                      })
                    }
                    className="bg-transparent text-xs codex-text-secondary hover:codex-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="local" className="bg-neutral-900 text-white">
                      {i18n.header.local}
                    </option>
                    <option value="worktree" className="bg-neutral-900 text-white">
                      {i18n.header.worktree}
                    </option>
                  </select>
                </div>

                {/* Permission Mode Selector */}
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg codex-text-secondary codex-hover text-xs">
                  <Shield className="w-3.5 h-3.5 codex-text-muted" />
                  <select
                    value={permMode}
                    onChange={(e) =>
                      onUpdateThreadConfig(thread.id, {
                        permissionMode: e.target.value as PermissionMode,
                      })
                    }
                    className="bg-transparent text-xs codex-text-secondary hover:codex-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="workspace-write" className="bg-neutral-900 text-white">
                      {i18n.thread.permDefault}
                    </option>
                    <option value="read-only" className="bg-neutral-900 text-white">
                      {i18n.thread.permReadOnly}
                    </option>
                    <option value="full-access" className="bg-neutral-900 text-white">
                      {i18n.thread.permFullAccess}
                    </option>
                  </select>
                </div>
              </div>

              {/* Right Side: Branch indicator, Fork, and Circular Send / Stop Button */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-mono codex-text-muted">
                  <GitBranch className="w-3 h-3" />
                  <span>{thread.branch}</span>
                </span>

                <button
                  type="button"
                  onClick={() => onForkThread(thread.id)}
                  title={i18n.thread.forkThread}
                  className="p-1.5 rounded-lg codex-text-muted hover:codex-text-primary codex-hover"
                >
                  <GitFork className="w-3.5 h-3.5" />
                </button>

                {isRunning && !composerText.trim() ? (
                  <button
                    type="button"
                    onClick={onInterruptTurn}
                    title={i18n.thread.stopTurn}
                    className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!composerText.trim()}
                    title={isRunning ? i18n.thread.steerActiveTurn : i18n.thread.sendPrompt}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      composerText.trim()
                        ? 'codex-accent-btn shadow-sm'
                        : 'codex-card codex-text-muted opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
