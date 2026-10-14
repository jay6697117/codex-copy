import React, { useState, useRef, useEffect } from 'react';
import {
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
  Loader2,
  CheckCircle2,
  Plus,
  ArrowUp,
  PanelLeftOpen,
  PanelRight,
  Folder,
  Laptop,
  RotateCcw,
  Settings,
  Target,
  Edit3,
  Trash2,
  BrainCircuit,
  ListChecks,
  Zap,
  RotateCw,
  Mic,
  AlertCircle,
  ExternalLink,
  GitCommit,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import {
  AppLanguage,
  CodexModelInfo,
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
import { t } from '../i18n/translations';

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
        | 'daybreakEnabled'
        | 'goal'
      >
    >,
    syncToGlobalConfig?: boolean
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

// 1:1 Model Catalog from Screenshot 3 of the real local Codex Desktop App
const REAL_CODEX_MODELS: CodexModelInfo[] = [
  {
    slug: 'default',
    displayName: '默认',
    description: '推荐模型集',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: [],
  },
  {
    slug: 'gpt-6.1-sol',
    displayName: 'GPT-6.1 Sol',
    description: '',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: [],
  },
  {
    slug: 'gpt-6-astra',
    displayName: 'GPT-6 Astra',
    description: '',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: [],
  },
  {
    slug: 'gpt-6-sol',
    displayName: 'GPT-6 Sol',
    description: '',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: [],
  },
  {
    slug: 'gpt-6-luna',
    displayName: 'GPT-6 Luna',
    description: '',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: [],
  },
  {
    slug: 'gpt-5.6-sol',
    displayName: 'GPT-5.6 Sol',
    description: '',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: [],
  },
  {
    slug: 'gpt-5.6-terra',
    displayName: 'GPT-5.6 Terra',
    description: '',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: [],
  },
  {
    slug: 'gpt-5.6-luna',
    displayName: 'GPT-5.6 Luna',
    description: '',
    defaultReasoningLevel: 'xhigh',
    supportedReasoningLevels: [],
  },
];

// 6-Stop Slider Levels from Screenshot 2 of the real local Codex Desktop App
// Stop 0: 低, Stop 1: 中, Stop 2: 高, Stop 3: 极高 (thumb position in Screenshot 2!), Stop 4: 超高, Stop 5: 最大
const SLIDER_EFFORT_STOPS: Array<{
  id: ReasoningEffort;
  labelZh: string;
  labelEn: string;
}> = [
  { id: 'low', labelZh: '低', labelEn: 'Low' },
  { id: 'medium', labelZh: '中', labelEn: 'Medium' },
  { id: 'high', labelZh: '高', labelEn: 'High' },
  { id: 'xhigh', labelZh: '极高', labelEn: 'Extra High' },
  { id: 'uhigh', labelZh: '超高', labelEn: 'Ultra High' },
  { id: 'max', labelZh: '最大', labelEn: 'Max' },
];

export const CenterThreadView: React.FC<CenterThreadViewProps> = ({
  lang,
  sidebarCollapsed,
  onToggleSidebar,
  rightDrawerOpen,
  onToggleRightDrawer,
  activeProject,
  projects,
  onSelectProject,
  thread,
  skills,
  workspaceFiles,
  localCodexStatus,
  onOpenCodexConfig,
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
  const [showEffortPopover, setShowEffortPopover] = useState(false);
  const [showModelPopover, setShowModelPopover] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showPermMenu, setShowPermMenu] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(thread.goal?.objective || '');
  const [liveThinkingTick, setLiveThinkingTick] = useState(1);

  const scrollEndRef = useRef<HTMLDivElement>(null);

  const isRunning = thread.status === 'running';
  const envMode: ExecutionEnvironmentMode = thread.environmentMode || 'local';
  const permMode: PermissionMode = thread.permissionMode || 'full-access';
  const daybreakEnabled = Boolean(thread.daybreakEnabled);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.id, thread.turns.length]);

  useEffect(() => {
    setGoalDraft(thread.goal?.objective || '');
    if (thread.goal?.status === 'active') {
      setComposerMode('goal');
    }
  }, [thread.id, thread.goal?.objective, thread.goal?.status]);

  useEffect(() => {
    if (!isRunning) {
      setLiveThinkingTick(1);
      return;
    }
    const timer = setInterval(() => {
      setLiveThinkingTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  // Merge REAL_CODEX_MODELS with any extra server models
  const serverCatalog = localCodexStatus?.config?.effective?.modelCatalog || [];
  const mergedCatalogMap = new Map<string, CodexModelInfo>();
  for (const item of REAL_CODEX_MODELS) {
    mergedCatalogMap.set(item.slug, item);
  }
  for (const sItem of serverCatalog) {
    if (sItem?.slug && !mergedCatalogMap.has(sItem.slug)) {
      mergedCatalogMap.set(sItem.slug, sItem);
    }
  }
  const modelCatalog = Array.from(mergedCatalogMap.values());

  const activeModelSlug = thread.model || 'gpt-6.1-sol';
  const selectedModelMeta =
    modelCatalog.find((m) => m.slug === activeModelSlug) ||
    modelCatalog.find((m) => m.slug === 'gpt-6.1-sol') ||
    modelCatalog[1];

  const activeStopIndex = Math.max(
    0,
    SLIDER_EFFORT_STOPS.findIndex(
      (s) =>
        s.id ===
        (thread.reasoningEffort === 'minimal' ? 'low' : thread.reasoningEffort || 'xhigh')
    )
  );
  const currentStop =
    SLIDER_EFFORT_STOPS[activeStopIndex] || SLIDER_EFFORT_STOPS[3];
  const currentEffortLabel =
    lang === 'zh-CN' ? currentStop.labelZh : currentStop.labelEn;

  const toggleItemExpand = (itemId: string, currentlyOpen: boolean) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !currentlyOpen }));
  };

  const handleSaveGoal = (
    objectiveText: string,
    status: ThreadGoal['status'] = 'active'
  ) => {
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
        updatedAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
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

    setShowEffortPopover(false);
    setShowModelPopover(false);
    setShowPermMenu(false);
    setShowProjectPicker(false);

    if (trimmed === '/personality') {
      const nextMode: PersonalityMode =
        thread.personality === 'pragmatic' ? 'empathetic' : 'pragmatic';
      onUpdateThreadConfig(thread.id, { personality: nextMode });
      setComposerText('');
      return;
    }

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
                if (
                  para.startsWith('1. ') ||
                  para.startsWith('- ') ||
                  para.startsWith('* ')
                ) {
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

  const extractLatestHeadline = (steps?: string[]): string => {
    if (!steps || steps.length === 0) return '';
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = (steps[i] || '').trim();
      if (!step) continue;
      const boldMatch = step.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch[1].trim().length > 1) {
        return boldMatch[1].trim();
      }
      const lines = step
        .split('\n')
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length >= 2 &&
            !/^[{}[\](),.;:'"`_-]+$/.test(l) &&
            !l.startsWith('at ') &&
            !l.startsWith('Error: spawn') &&
            !l.startsWith('errno:') &&
            !l.startsWith('syscall:') &&
            !l.startsWith('spawnargs:')
        );
      if (lines.length > 0) {
        const candidate = lines[0];
        return candidate.length > 52 ? `${candidate.slice(0, 52)}...` : candidate;
      }
    }
    return '';
  };

  const renderTurnItem = (turnId: string, item: TurnItem) => {
    const isExpanded =
      expandedItems[item.id] !== undefined
        ? expandedItems[item.id]
        : item.status === 'streaming';

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

      case 'reasoning': {
        const stepsCount = item.reasoningSteps?.length || 0;
        const latestHeadline = extractLatestHeadline(item.reasoningSteps);
        const displaySeconds =
          item.status === 'streaming'
            ? Math.max(item.durationSeconds || 1, liveThinkingTick)
            : item.durationSeconds ?? 1;

        return (
          <div
            key={item.id}
            className="rounded-xl codex-card border codex-border overflow-hidden transition-all"
          >
            <button
              onClick={() => toggleItemExpand(item.id, isExpanded)}
              className="w-full px-3.5 py-2 flex items-center justify-between gap-2 text-xs codex-text-secondary codex-hover transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.status === 'streaming' ? (
                  <Loader2 className="w-3.5 h-3.5 codex-accent-text animate-spin shrink-0" />
                ) : (
                  <BrainCircuit className="w-3.5 h-3.5 codex-accent-text shrink-0" />
                )}
                <span className="font-medium codex-text-primary shrink-0">
                  {item.status === 'streaming'
                    ? `${i18n.thread.thinking} (${displaySeconds}s)...`
                    : `${i18n.thread.thoughtFor} ${displaySeconds}s`}
                </span>
                {latestHeadline && (
                  <span className="codex-text-muted truncate text-[11.5px]">
                    · {latestHeadline}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {stepsCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded codex-elevated border codex-border codex-text-muted">
                    {stepsCount} {i18n.thread.reasoningStepsUnit}
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 codex-text-muted" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 codex-text-muted" />
                )}
              </div>
            </button>

            {isExpanded && item.reasoningSteps && item.reasoningSteps.length > 0 && (
              <div className="px-3.5 py-2.5 border-t codex-border space-y-2 text-xs codex-text-secondary bg-black/[0.02]">
                {item.reasoningSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="pl-3 border-l-2 border-[var(--accent-primary)]/40 leading-relaxed space-y-1"
                  >
                    {step.split('\n').map((line, lIdx) => (
                      <div key={lIdx}>{renderInlineFormatting(line)}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'todoList':
        return (
          <div
            key={item.id}
            className="rounded-xl codex-card border codex-border p-3 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold codex-text-primary flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 codex-accent-text" />
                <span>{i18n.thread.todoChecklistTitle}</span>
              </span>
              <span className="text-[10px] font-mono codex-text-muted">
                {(item.todoItems || []).filter((tItem) => tItem.completed).length}/
                {(item.todoItems || []).length}
              </span>
            </div>
            <div className="space-y-1">
              {(item.todoItems || []).map((tItem, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                      tItem.completed
                        ? 'codex-accent-btn border-transparent'
                        : 'codex-border codex-elevated'
                    }`}
                  >
                    {tItem.completed && <Check className="w-2.5 h-2.5" />}
                  </span>
                  <span
                    className={
                      tItem.completed
                        ? 'line-through codex-text-muted'
                        : 'codex-text-primary'
                    }
                  >
                    {tItem.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'subagentRun':
        return (
          <div
            key={item.id}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg codex-card border codex-border text-xs codex-text-secondary"
          >
            <Cpu className="w-3.5 h-3.5 codex-accent-text shrink-0" />
            <span className="font-mono text-[11px] codex-text-primary">
              {item.subagentName}
            </span>
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
              onClick={() => toggleItemExpand(item.id, isExpanded)}
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
              <span className="text-xs font-mono text-emerald-500">
                +{item.additions ?? 1}
              </span>
              <span className="text-xs font-mono text-rose-500">
                -{item.deletions ?? 0}
              </span>
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
                    onRespondApproval(
                      turnId,
                      item.id,
                      'allow_always',
                      item.approvalCommand
                    )
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
    <section className="flex-1 flex flex-col h-full codex-app-bg min-w-[420px] overflow-hidden relative">
      {/* Top Window Bar (1:1 Match with Real Codex Desktop App Screenshot 1) */}
      <header className="h-9 px-3.5 flex items-center justify-between gap-2 shrink-0 select-none app-drag-region z-20">
        <div className="flex items-center gap-2 min-w-0 app-no-drag">
          {sidebarCollapsed && (
            <div className="flex items-center gap-1">
              <button className="p-1 rounded codex-text-muted hover:codex-text-primary">
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button className="p-1 rounded codex-text-muted hover:codex-text-primary">
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggleSidebar}
                title={i18n.header.expandSidebar}
                className="p-1 rounded codex-text-secondary codex-hover"
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {thread.turns.length > 0 && (
            <div className="flex items-center gap-2 text-xs codex-text-secondary truncate">
              <span className="font-medium codex-text-primary truncate max-w-[260px]">
                {thread.title}
              </span>
              <span className="codex-text-muted">·</span>
              <span className="font-mono text-[11px] codex-text-muted flex items-center gap-1">
                <GitBranch className="w-3 h-3 codex-accent-text" />
                {thread.branch}
              </span>
            </div>
          )}
        </div>

        {/* Top-Right Controls: IDE Open, Git Commit, Inspector Drawer Toggle, and the `[+]` Square Button from Screenshot 1 */}
        <div className="flex items-center gap-1.5 shrink-0 app-no-drag">
          {thread.turns.length > 0 && (
            <>
              <button
                onClick={() => onOpenInEditor('cursor')}
                title="在 Cursor / VS Code 中打开当前项目"
                className="px-2 py-1 rounded-md text-[11px] codex-text-secondary codex-hover flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="hidden sm:inline">Cursor</span>
              </button>
              <button
                onClick={() => onGitCommitAction('commit')}
                title="提交当前 Git 变更"
                className="px-2 py-1 rounded-md text-[11px] codex-text-secondary codex-hover flex items-center gap-1"
              >
                <GitCommit className="w-3 h-3" />
                <span className="hidden sm:inline">{i18n.header.commit}</span>
              </button>
              <button
                onClick={() => onToggleRightDrawer('diff')}
                title={i18n.header.toggleDiffPane}
                className={`p-1 rounded-md transition-colors ${
                  rightDrawerOpen
                    ? 'codex-active codex-text-primary'
                    : 'codex-text-secondary codex-hover'
                }`}
              >
                <PanelRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={onOpenCodexConfig}
            title={i18n.header.openSettings}
            className="p-1 rounded-md codex-text-muted hover:codex-text-primary transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Exact Top-Right Square `[+]` Button from Screenshot 1 */}
          <button
            onClick={() => onToggleRightDrawer('terminal')}
            title="展开/收起工作台面板 (终端 / 文件树 / 代码差异)"
            className="w-5 h-5 rounded-[5px] border border-white/25 hover:border-white/50 text-[#A1A1A6] hover:text-white flex items-center justify-center transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Main Conversation / Empty State Canvas */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col">
        {thread.turns.length === 0 ? (
          /* 1:1 Empty State from Screenshot 1: Scalloped Cloud Terminal Icon + `我们要构建什么？` */
          <div className="flex-1 flex flex-col items-center justify-center select-none pb-8">
            <div className="mb-5 text-[#6E6E73]">
              <svg
                width="54"
                height="54"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Scalloped 8-lobe OpenAI Codex emblem outline */}
                <path
                  d="M32 6C36.2 6 39.8 8.3 41.5 11.8C45.2 11.1 49.1 12.7 51.2 16C53.3 19.3 53.1 23.5 50.9 26.6C53.8 29.2 55 33.3 53.9 37.1C52.8 40.9 49.6 43.7 45.7 44.3C45.6 48.2 43.1 51.7 39.4 53C35.7 54.3 31.6 53.2 29.1 50.3C26.1 52.8 21.8 53.5 18.2 51.8C14.6 50.1 12.4 46.5 12.5 42.5C9.1 40.6 7.1 36.8 7.5 32.9C7.9 29 10.6 25.7 14.3 24.5C13.6 20.7 15.2 16.8 18.5 14.7C21.8 12.6 26 12.8 29.1 15C30 10 31.1 6 32 6Z"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* `>_` Terminal Prompt inside emblem */}
                <path
                  d="M23 26L30 32L23 38"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="33"
                  y1="38"
                  x2="41"
                  y2="38"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h2 className="text-[24px] font-medium tracking-tight codex-text-primary">
              {lang === 'zh-CN' ? '我们要构建什么？' : 'What should we build?'}
            </h2>
          </div>
        ) : (
          <div className="max-w-3xl w-full mx-auto space-y-5">
            {thread.turns.map((turn) => (
              <div key={turn.id} className="space-y-3">
                <div className="space-y-2.5">
                  {turn.items.map((item) => renderTurnItem(turn.id, item))}
                </div>

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
            ))}
            <div ref={scrollEndRef} />
          </div>
        )}
      </div>

      {/* =====================================================================
          Bottom Two-Tier Floating Composer (1:1 Match with Screenshots 1, 2, 3)
         ===================================================================== */}
      <div className="px-6 pb-5 pt-1 shrink-0">
        <div className="max-w-[660px] mx-auto relative">
          {/* Active Goal Banner (`/goal`) if set */}
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
                  <span className="text-xs font-medium codex-text-primary truncate">
                    {thread.goal.objective}
                  </span>
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
                    className="p-1 rounded codex-text-muted hover:codex-text-primary text-xs"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      onUpdateThreadConfig(thread.id, { goal: null });
                      setComposerMode('agent');
                    }}
                    className="p-1 rounded codex-text-muted hover:text-rose-500 text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              POPOVER 1: Screenshot 2 — 6-Stop Reasoning Effort Slider Popover
             ================================================================= */}
          {showEffortPopover && !showModelPopover && (
            <div className="absolute bottom-14 right-8 w-[276px] rounded-[22px] bg-[#262628] border border-white/[0.1] shadow-2xl p-4 z-40 select-none">
              {/* Top Row: Lightning `⚡` | Blue Effort Label (`极高`) | Reset `↻` */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateThreadConfig(thread.id, { reasoningEffort: 'low' }, true)
                  }
                  title="切换至快速轻量推理"
                  className="text-[#9A9A9E] hover:text-white transition-colors p-0.5"
                >
                  <Zap className="w-4 h-4" />
                </button>

                <span className="text-[15px] font-semibold text-[#3B82F6]">
                  {currentEffortLabel}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateThreadConfig(thread.id, { reasoningEffort: 'xhigh' }, true)
                  }
                  title="重置为默认推理强度 (极高)"
                  className="text-[#9A9A9E] hover:text-white transition-colors p-0.5"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {/* Second Row: Clickable Model Trigger `GPT-6.1 Sol >` (Opens Screenshot 3 Model Popover) */}
              <div className="flex justify-center mt-0.5 mb-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowModelPopover(true);
                  }}
                  className="inline-flex items-center gap-0.5 text-[13px] text-[#B4B4B8] hover:text-white transition-colors"
                >
                  <span>
                    {daybreakEnabled
                      ? 'Daybreak'
                      : selectedModelMeta.displayName || 'GPT-6.1 Sol'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>

              {/* Third Row: 6-Stop Capsule Slider (`低`, `中`, `高`, `极高`, `超高`, `最大`) */}
              <div className="relative h-8 rounded-full bg-[#3A3A3C] flex items-center px-1.5">
                {/* Active Blue Fill Bar up to current stop */}
                <div
                  style={{
                    width: `calc(${
                      (activeStopIndex / (SLIDER_EFFORT_STOPS.length - 1)) * 100
                    }% + ${activeStopIndex === 0 ? 28 : 14}px)`,
                  }}
                  className="absolute left-0 top-0 bottom-0 rounded-full bg-[#2B7FFF] transition-all duration-150 pointer-events-none"
                />

                {/* 6 Interactive Stop Positions */}
                <div className="relative z-10 w-full flex items-center justify-between px-1">
                  {SLIDER_EFFORT_STOPS.map((stop, idx) => {
                    const isThumb = idx === activeStopIndex;
                    const isLeftOfThumb = idx < activeStopIndex;
                    return (
                      <button
                        key={stop.id}
                        type="button"
                        onClick={() =>
                          onUpdateThreadConfig(
                            thread.id,
                            { reasoningEffort: stop.id },
                            true
                          )
                        }
                        title={lang === 'zh-CN' ? stop.labelZh : stop.labelEn}
                        className="w-7 h-7 flex items-center justify-center relative focus:outline-none"
                      >
                        {isThumb ? (
                          <span className="w-7 h-7 rounded-full bg-white shadow-md block transition-transform scale-105" />
                        ) : (
                          <span
                            className={`w-1.5 h-1.5 rounded-full block transition-colors ${
                              isLeftOfThumb ? 'bg-white/60' : 'bg-white/35'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              POPOVER 2: Screenshot 3 — `Daybreak` + `默认 (推荐模型集)` + `GPT-6.1 Sol` Model Menu
             ================================================================= */}
          {showModelPopover && (
            <div className="absolute bottom-14 right-8 w-[248px] rounded-[22px] bg-[#262628] border border-white/[0.1] shadow-2xl py-3 px-2 z-40 select-none">
              {/* Row 1: `Daybreak` Toggle Switch */}
              <div className="px-3 py-1 flex items-center justify-between">
                <span className="text-[14px] font-medium text-white">Daybreak</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateThreadConfig(thread.id, {
                      daybreakEnabled: !daybreakEnabled,
                    })
                  }
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                    daybreakEnabled ? 'bg-[#2B7FFF] justify-end' : 'bg-[#3A3A3C] justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-white/[0.08] my-2 mx-2" />

              {/* Section Header: `选择模型` */}
              <div className="px-3 py-1 text-[12px] font-medium text-[#8E8E93]">
                {lang === 'zh-CN' ? '选择模型' : 'Select model'}
              </div>

              {/* Model List Items */}
              <div className="max-h-72 overflow-y-auto space-y-0.5 mt-0.5">
                {modelCatalog.map((m) => {
                  const isSelected = activeModelSlug === m.slug && !daybreakEnabled;
                  return (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => {
                        onUpdateThreadConfig(
                          thread.id,
                          {
                            model: m.slug as ModelId,
                            daybreakEnabled: false,
                          },
                          true
                        );
                        setShowModelPopover(false);
                        setShowEffortPopover(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-white/[0.07] transition-colors flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-[13.5px] font-medium text-white leading-snug">
                          {m.displayName}
                        </div>
                        {m.slug === 'default' && (
                          <div className="text-[11.5px] text-[#8E8E93] leading-tight">
                            {lang === 'zh-CN' ? '推荐模型集' : 'Recommended model set'}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#D1D1D6] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Popover: Project Picker (`选择项目`) */}
          {showProjectPicker && (
            <div className="absolute bottom-full left-2 mb-2 w-64 rounded-xl bg-[#262628] border border-white/10 shadow-2xl p-1.5 z-30">
              <div className="px-2.5 py-1 text-[11px] text-[#8E8E93] flex items-center justify-between">
                <span>选择工作区项目</span>
                <button onClick={() => setShowProjectPicker(false)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p.id);
                    setShowProjectPicker(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Folder className="w-3.5 h-3.5 text-[#8E8E93]" />
                    <span>{p.name}</span>
                  </span>
                  {p.id === activeProject.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}

          {/* Popover: Permission Selector (`完全访问` / `默认权限` / `只读权限`) */}
          {showPermMenu && (
            <div className="absolute bottom-14 left-10 w-60 rounded-xl bg-[#262628] border border-white/10 shadow-2xl p-1.5 z-30">
              {[
                {
                  id: 'full-access' as PermissionMode,
                  label: '完全访问',
                  desc: '允许读写文件与执行终端命令 (免审批阻塞)',
                },
                {
                  id: 'workspace-write' as PermissionMode,
                  label: '默认权限 (工作区读写)',
                  desc: '自动在当前项目目录内执行代码读写',
                },
                {
                  id: 'read-only' as PermissionMode,
                  label: '只读权限',
                  desc: '仅分析代码与回答问题，不修改文件',
                },
              ].map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => {
                    onUpdateThreadConfig(thread.id, { permissionMode: pm.id });
                    setShowPermMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/10 flex items-start justify-between gap-2"
                >
                  <div>
                    <div
                      className={`text-xs font-medium ${
                        pm.id === 'full-access' ? 'text-[#FF7D45]' : 'text-white'
                      }`}
                    >
                      {pm.label}
                    </div>
                    <div className="text-[11px] text-[#8E8E93]">{pm.desc}</div>
                  </div>
                  {permMode === pm.id && (
                    <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Popover: `/` Slash Commands Menu */}
          {showSlashMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl bg-[#262628] border border-white/10 shadow-2xl p-1.5 z-30">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] flex items-center justify-between">
                <span>{i18n.thread.slashCommands}</span>
                <button onClick={() => setShowSlashMenu(false)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
              {[
                { cmd: '/goal', desc: i18n.thread.slashGoalDesc },
                { cmd: '/review', desc: i18n.thread.slashReviewDesc },
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
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-[#4DA3FF]">{item.cmd}</span>
                  <span className="text-[#8E8E93] text-[11px]">{item.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popover: `$skill` Picker */}
          {showSkillPicker && (
            <div className="absolute bottom-full left-0 mb-2 w-80 max-h-60 overflow-y-auto rounded-xl bg-[#262628] border border-white/10 shadow-2xl p-1.5 z-30">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] flex items-center justify-between">
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
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-[#4DA3FF]">${skill.slug}</span>
                    <span className="text-[10px] text-[#8E8E93] truncate max-w-[150px]">
                      {skill.path}
                    </span>
                  </button>
                ))}
            </div>
          )}

          {/* Popover: `@file` Picker */}
          {showFilePicker && (
            <div className="absolute bottom-full left-0 mb-2 w-80 max-h-60 overflow-y-auto rounded-xl bg-[#262628] border border-white/10 shadow-2xl p-1.5 z-30">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] flex items-center justify-between">
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
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-xs font-mono text-white truncate"
                >
                  @{file}
                </button>
              ))}
            </div>
          )}

          {/* =================================================================
              Tier 1 (Top Attachment Bar of Composer): `📁 选择项目` + `💻 此计算机`
              (1:1 Match with Screenshot 1)
             ================================================================= */}
          <div className="mx-2 px-3.5 py-2 rounded-t-2xl bg-[#1B1B1D] border border-b-0 border-white/[0.07] flex items-center justify-between text-[12px] text-[#9A9A9E] select-none">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowProjectPicker((v) => !v);
                  setShowEffortPopover(false);
                  setShowModelPopover(false);
                }}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <Folder className="w-3.5 h-3.5 text-[#8E8E93]" />
                <span>{lang === 'zh-CN' ? '选择项目' : activeProject.name}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateThreadConfig(thread.id, {
                    environmentMode: envMode === 'local' ? 'worktree' : 'local',
                  })
                }
                title="切换此计算机 (Local) / 独立工作树 (Worktree)"
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <Laptop className="w-3.5 h-3.5 text-[#8E8E93]" />
                <span>
                  {envMode === 'worktree'
                    ? lang === 'zh-CN'
                      ? '独立工作树'
                      : 'Worktree'
                    : lang === 'zh-CN'
                    ? '此计算机'
                    : 'This computer'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setComposerMode((m) => (m === 'goal' ? 'agent' : 'goal'))
                }
                className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors ${
                  composerMode === 'goal'
                    ? 'bg-[#2B7FFF]/20 text-[#4DA3FF]'
                    : 'hover:text-white'
                }`}
              >
                <Target className="w-3 h-3" />
                <span>/goal</span>
              </button>
            </div>
          </div>

          {/* =================================================================
              Tier 2 (Main Composer Card): `随心输入`, `+`, `(!) 完全访问`, `GPT-6.1 Sol 极高 ⌄`, Mic, Waveform/Send
              (1:1 Match with Screenshots 1, 2, 3)
             ================================================================= */}
          <form
            onSubmit={(e) => handleSubmit(e)}
            className="rounded-2xl codex-composer-bg border border-white/[0.09] shadow-2xl px-4 py-3 space-y-3"
          >
            {/* Attached `@file` and `$skill` chips */}
            {(attachedFiles.length > 0 || invokedSkills.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
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

            {/* Prompt Input Textarea (`随心输入`) */}
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
                  : lang === 'zh-CN'
                  ? '随心输入'
                  : 'Ask Codex anything...'
              }
              className="w-full bg-transparent text-[14px] codex-text-primary placeholder:text-[#6E6E73] focus:outline-none resize-none leading-relaxed font-sans"
            />

            {/* Bottom Control Row inside Composer */}
            <div className="flex items-center justify-between gap-2 pt-0.5 select-none">
              {/* Left: `+` and Orange `(!) 完全访问` */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowFilePicker((v) => !v);
                    setShowSkillPicker(false);
                    setShowEffortPopover(false);
                    setShowModelPopover(false);
                  }}
                  title={i18n.thread.attachContextTitle}
                  className="text-[#9A9A9E] hover:text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPermMenu((v) => !v);
                    setShowEffortPopover(false);
                    setShowModelPopover(false);
                  }}
                  className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-opacity hover:opacity-85 ${
                    permMode === 'full-access'
                      ? 'text-[#FF7D45]'
                      : permMode === 'read-only'
                      ? 'text-emerald-400'
                      : 'text-[#9A9A9E]'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>
                    {permMode === 'full-access'
                      ? lang === 'zh-CN'
                        ? '完全访问'
                        : 'Full access'
                      : permMode === 'read-only'
                      ? lang === 'zh-CN'
                        ? '只读模式'
                        : 'Read-only'
                      : lang === 'zh-CN'
                      ? '默认权限'
                      : 'Default'}
                  </span>
                </button>
              </div>

              {/* Right: `GPT-6.1 Sol 极高 ⌄` / `选择强度 ⌄` + Mic + White Waveform/Send Circle */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (showModelPopover) {
                      setShowModelPopover(false);
                      setShowEffortPopover(false);
                    } else {
                      setShowEffortPopover((v) => !v);
                    }
                    setShowFilePicker(false);
                    setShowPermMenu(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] transition-colors ${
                    showEffortPopover || showModelPopover
                      ? 'bg-white/[0.08] text-[#B4B4B8]'
                      : 'text-[#B4B4B8] hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {showEffortPopover && !showModelPopover ? (
                    <span className="text-[#9A9A9E]">
                      {lang === 'zh-CN' ? '选择强度' : 'Select effort'}
                    </span>
                  ) : (
                    <>
                      <span className="text-white font-medium">
                        {daybreakEnabled
                          ? 'Daybreak'
                          : selectedModelMeta.displayName || 'GPT-6.1 Sol'}
                      </span>
                      <span className="text-[#8E8E93]">{currentEffortLabel}</span>
                    </>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-[#8E8E93]" />
                </button>

                {/* Microphone Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (!composerText.trim()) {
                      setComposerText('检查当前项目代码结构并汇报状态');
                    }
                  }}
                  title="语音输入"
                  className="text-[#9A9A9E] hover:text-white transition-colors p-1"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* White Circle Waveform / Send / Stop Button (1:1 Match with Screenshots 1, 2, 3) */}
                {isRunning ? (
                  <button
                    type="button"
                    onClick={onInterruptTurn}
                    title={i18n.thread.stopTurn}
                    className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:opacity-90 transition-opacity"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    title={i18n.thread.sendPrompt}
                    className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
                  >
                    {composerText.trim().length > 0 ? (
                      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      /* 3-bar Voice Waveform Icon matching Screenshots 1, 2, 3 */
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <line
                          x1="3.5"
                          y1="5"
                          x2="3.5"
                          y2="11"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <line
                          x1="8"
                          y1="2.5"
                          x2="8"
                          y2="13.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <line
                          x1="12.5"
                          y1="5"
                          x2="12.5"
                          y2="11"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
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
