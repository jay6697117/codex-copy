import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Check,
  X,
  MessageSquare,
  Sparkles,
  Plus,
  Save,
  Play,
  CalendarClock,
  GitBranch,
  GitMerge,
  Trash2,
  Bot,
  Shield,
  Terminal,
  CheckCircle2,
  Sliders,
  RefreshCw,
  Palette,
  ArrowLeft,
  KeyRound,
  FolderGit2,
  Server,
} from 'lucide-react';
import {
  AutomationJob,
  LocalCodexStatus,
  NavSection,
  ReviewQueueItem,
  SandboxPolicy,
  SkillDefinition,
  SubagentConfig,
  ThemeSkin,
  WorktreeInfo,
} from '../types/codex';
import {
  saveLocalCodexConfig,
  writeWorkspaceFile,
} from '../services/appServerClient';

interface MainFeatureViewsProps {
  activeNav: Exclude<NavSection, 'threads'>;
  onBackToThreads: () => void;
  skin: ThemeSkin;
  onSelectSkin: (skin: ThemeSkin) => void;
  localCodexStatus: LocalCodexStatus | null;
  onRefreshLocalStatus: () => void;
  reviewQueue: ReviewQueueItem[];
  onApproveReviewItem: (id: string) => void;
  onRejectReviewItem: (id: string) => void;
  onOpenReviewInThread: (item: ReviewQueueItem) => void;
  skills: SkillDefinition[];
  onToggleSkill: (id: string) => void;
  onSaveSkill: (skill: SkillDefinition) => void;
  onCreateSkill: (skill: Omit<SkillDefinition, 'id'>) => void;
  onLaunchSkillThread: (skill: SkillDefinition) => void;
  automations: AutomationJob[];
  onToggleAutomation: (id: string) => void;
  onRunAutomationNow: (id: string) => void;
  onCreateAutomation: (
    job: Omit<AutomationJob, 'id' | 'lastRunAt' | 'nextRunAt' | 'status' | 'totalRuns'>
  ) => void;
  worktrees: WorktreeInfo[];
  onCreateWorktree: (branch: string) => void;
  onMergeWorktree: (id: string) => void;
  onDeleteWorktree: (id: string) => void;
  onJumpToWorktreeThread: (worktree: WorktreeInfo) => void;
  subagents: SubagentConfig[];
  onSaveSubagent: (agent: SubagentConfig) => void;
  onCreateSubagent: (agent: Omit<SubagentConfig, 'id'>) => void;
  agentsMdContent: string;
  onSaveAgentsMd: (content: string) => void;
  sandboxPolicy: SandboxPolicy;
  onUpdateSandboxPolicy: (patch: Partial<SandboxPolicy>) => void;
}

const SKIN_CARDS: Array<{
  id: ThemeSkin;
  name: string;
  subtitle: string;
  previewBg: string;
  previewSidebar: string;
  previewAccent: string;
}> = [
  {
    id: 'codex-dark',
    name: '官方极夜黑 (Codex Dark)',
    subtitle: 'OpenAI Codex macOS 官方深色磨砂外观 (#0D0D0D)',
    previewBg: '#0D0D0D',
    previewSidebar: '#141414',
    previewAccent: '#10A37F',
  },
  {
    id: 'macos-light',
    name: '原生昼白 (macOS Daylight)',
    subtitle: 'macOS 原生纯净浅色模式，高对比阅读体验 (#FFFFFF)',
    previewBg: '#FFFFFF',
    previewSidebar: '#F3F4F6',
    previewAccent: '#0D9488',
  },
  {
    id: 'aurora-midnight',
    name: '极光深空 (Aurora Slate)',
    subtitle: '极客深海蓝紫与极光青高亮工作台 (#070B14)',
    previewBg: '#070B14',
    previewSidebar: '#050811',
    previewAccent: '#38BDF8',
  },
];

export const MainFeatureViews: React.FC<MainFeatureViewsProps> = ({
  activeNav,
  onBackToThreads,
  skin,
  onSelectSkin,
  localCodexStatus,
  onRefreshLocalStatus,
  reviewQueue,
  onApproveReviewItem,
  onRejectReviewItem,
  onOpenReviewInThread,
  skills,
  onToggleSkill,
  onSaveSkill,
  onCreateSkill,
  onLaunchSkillThread,
  automations,
  onToggleAutomation,
  onRunAutomationNow,
  onCreateAutomation,
  worktrees,
  onCreateWorktree,
  onMergeWorktree,
  onDeleteWorktree,
  onJumpToWorktreeThread,
  agentsMdContent,
  onSaveAgentsMd,
}) => {
  // Skill Studio state
  const [selectedSkillId, setSelectedSkillId] = useState<string>(skills[0]?.id || '');
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<string>('All');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [skillSavedToast, setSkillSavedToast] = useState(false);

  // Automations state
  const [newAutoName, setNewAutoName] = useState('');
  const [newAutoCron, setNewAutoCron] = useState('0 9 * * 1-5');
  const [newAutoPrompt, setNewAutoPrompt] = useState('');
  const [newAutoSkill, setNewAutoSkill] = useState('linear-triage');

  // Worktrees state
  const [wtBranchInput, setWtBranchInput] = useState('');

  // Local Codex Config editor state
  const [configScope, setConfigScope] = useState<'global' | 'project'>('global');
  const [globalTomlDraft, setGlobalTomlDraft] = useState<string>(
    localCodexStatus?.config?.globalConfigRaw || ''
  );
  const [projectTomlDraft, setProjectTomlDraft] = useState<string>(
    localCodexStatus?.config?.projectConfigRaw || ''
  );
  const [agentsMdDraft, setAgentsMdDraft] = useState<string>(agentsMdContent);
  const [configSaveNotice, setConfigSaveNotice] = useState<string>('');

  useEffect(() => {
    if (localCodexStatus?.config?.globalConfigRaw !== undefined) {
      setGlobalTomlDraft(localCodexStatus.config.globalConfigRaw);
    }
    if (localCodexStatus?.config?.projectConfigRaw !== undefined) {
      setProjectTomlDraft(localCodexStatus.config.projectConfigRaw);
    }
  }, [localCodexStatus]);

  useEffect(() => {
    setAgentsMdDraft(agentsMdContent);
  }, [agentsMdContent]);

  const renderTopSubHeader = (title: string, subtitle: string) => (
    <div className="h-12 px-6 border-b codex-border codex-header-bg flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onBackToThreads}
          className="px-2.5 py-1 rounded-lg codex-card border codex-border text-xs codex-text-secondary hover:codex-text-primary flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to thread</span>
        </button>
        <div>
          <h2 className="text-sm font-semibold codex-text-primary">{title}</h2>
          <p className="text-[11px] codex-text-muted hidden sm:block">{subtitle}</p>
        </div>
      </div>

      {/* 1-Click Skin Switcher in Feature Header */}
      <div className="flex items-center gap-1 codex-card border codex-border rounded-lg p-0.5">
        {SKIN_CARDS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectSkin(s.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              skin === s.id
                ? 'codex-active codex-text-primary'
                : 'codex-text-muted hover:codex-text-primary'
            }`}
          >
            {s.name.split(' ')[0]}
          </button>
        ))}
      </div>
    </div>
  );

  // ==========================================================================
  // 0. LOCAL MACHINE CODEX CONFIG, AUTH & SKIN CENTER (`codex_config`)
  // ==========================================================================
  if (activeNav === 'codex_config' || activeNav === 'sandbox' || activeNav === 'subagents') {
    const mcpServers = Object.entries(localCodexStatus?.config?.effective?.mcpServers || {});
    const modelProviders = Object.entries(
      localCodexStatus?.config?.effective?.modelProviders || {}
    );

    return (
      <div className="flex-1 flex flex-col h-full codex-app-bg overflow-hidden">
        {renderTopSubHeader(
          'Local Codex CLI, Auth & Appearance Settings',
          'Directly linked to your local ~/.codex/auth.json, ~/.codex/config.toml, and codex CLI binary'
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Section 1: One-Click 3-Skin Selector */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold codex-text-primary">
                    一键换肤 · Appearance &amp; Theme Skins (3 Curated Skins)
                  </h3>
                </div>
                <span className="text-xs font-mono codex-text-muted">Active: {skin}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SKIN_CARDS.map((card) => {
                  const active = skin === card.id;
                  return (
                    <button
                      key={card.id}
                      onClick={() => onSelectSkin(card.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all space-y-2.5 ${
                        active
                          ? 'border-emerald-500 ring-1 ring-emerald-500/40 codex-elevated'
                          : 'codex-border codex-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            style={{ backgroundColor: card.previewBg }}
                            className="w-4 h-4 rounded-full border border-neutral-500/40 inline-block"
                          />
                          <span
                            style={{ backgroundColor: card.previewSidebar }}
                            className="w-4 h-4 rounded-full border border-neutral-500/40 inline-block"
                          />
                          <span
                            style={{ backgroundColor: card.previewAccent }}
                            className="w-4 h-4 rounded-full inline-block"
                          />
                        </div>
                        {active && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
                            当前使用
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold codex-text-primary">{card.name}</div>
                      <div className="text-[11px] codex-text-muted leading-relaxed">
                        {card.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Real Local Machine Codex CLI & Authentication Status */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold codex-text-primary">
                    本机 Codex CLI 与登录状态 (`~/.codex/auth.json` &amp; `codex login status`)
                  </h3>
                </div>
                <button
                  onClick={onRefreshLocalStatus}
                  className="px-2.5 py-1 rounded-lg codex-elevated border codex-border text-xs codex-text-primary codex-hover flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重新检测本机状态</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl codex-elevated border codex-border space-y-1">
                  <div className="codex-text-muted text-[11px]">Codex CLI Binary</div>
                  <div className="font-mono font-semibold codex-text-primary truncate">
                    {localCodexStatus?.cli?.version ||
                      (localCodexStatus?.cli?.installed ? 'Detected' : 'Not found in PATH')}
                  </div>
                  <div className="font-mono text-[11px] codex-text-muted truncate">
                    {localCodexStatus?.cli?.binaryPath || 'Checked /opt/homebrew/bin, ~/.nvm, etc.'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl codex-elevated border codex-border space-y-1">
                  <div className="codex-text-muted text-[11px]">Authentication Status</div>
                  <div className="font-semibold text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {localCodexStatus?.auth?.loggedIn
                        ? `Logged In (${localCodexStatus.auth.authMode})`
                        : localCodexStatus?.cli?.loginStatusText || 'Not logged in'}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] codex-text-muted truncate">
                    {localCodexStatus?.auth?.email ||
                      localCodexStatus?.auth?.maskedApiKey ||
                      localCodexStatus?.auth?.path ||
                      '~/.codex/auth.json'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl codex-elevated border codex-border space-y-1">
                  <div className="codex-text-muted text-[11px]">Effective Model &amp; Provider</div>
                  <div className="font-mono font-semibold codex-text-primary">
                    {localCodexStatus?.config?.effective?.model || 'gpt-5.4'} (
                    {localCodexStatus?.config?.effective?.reasoningEffort || 'high'})
                  </div>
                  <div className="font-mono text-[11px] codex-text-muted truncate">
                    Provider: {localCodexStatus?.config?.effective?.modelProvider || 'openai'} ·
                    Sandbox: {localCodexStatus?.config?.effective?.sandboxMode || 'workspace-write'}
                  </div>
                </div>
              </div>

              {(modelProviders.length > 0 || mcpServers.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl codex-elevated border codex-border space-y-1.5">
                    <div className="text-xs font-medium codex-text-primary flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Configured Model Providers ({modelProviders.length})</span>
                    </div>
                    {modelProviders.length === 0 ? (
                      <div className="text-[11px] codex-text-muted">Default OpenAI provider</div>
                    ) : (
                      modelProviders.map(([name, cfg]) => (
                        <div
                          key={name}
                          className="text-[11px] font-mono codex-text-secondary flex items-center justify-between"
                        >
                          <span className="codex-text-primary">{name}</span>
                          <span className="truncate max-w-[200px]">
                            {String((cfg as any)?.base_url || 'default')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3 rounded-xl codex-elevated border codex-border space-y-1.5">
                    <div className="text-xs font-medium codex-text-primary flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span>Configured MCP Servers ({mcpServers.length})</span>
                    </div>
                    {mcpServers.length === 0 ? (
                      <div className="text-[11px] codex-text-muted">
                        No custom MCP servers in config.toml
                      </div>
                    ) : (
                      mcpServers.map(([name, cfg]) => (
                        <div
                          key={name}
                          className="text-[11px] font-mono codex-text-secondary flex items-center justify-between"
                        >
                          <span className="codex-text-primary">{name}</span>
                          <span className="truncate max-w-[200px]">
                            {String((cfg as any)?.command || (cfg as any)?.url || 'stdio')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Direct Editor for ~/.codex/config.toml & Project .codex/config.toml */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold codex-text-primary">
                    Codex Configuration File (`config.toml`)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center codex-elevated border codex-border rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setConfigScope('global')}
                      className={`px-2.5 py-1 rounded-md font-mono text-[11px] ${
                        configScope === 'global'
                          ? 'codex-active codex-text-primary'
                          : 'codex-text-muted'
                      }`}
                    >
                      ~/.codex/config.toml (Global)
                    </button>
                    <button
                      onClick={() => setConfigScope('project')}
                      className={`px-2.5 py-1 rounded-md font-mono text-[11px] ${
                        configScope === 'project'
                          ? 'codex-active codex-text-primary'
                          : 'codex-text-muted'
                      }`}
                    >
                      .codex/config.toml (Project)
                    </button>
                  </div>

                  {configSaveNotice && (
                    <span className="text-xs font-mono text-emerald-500">{configSaveNotice}</span>
                  )}

                  <button
                    onClick={async () => {
                      const content =
                        configScope === 'global' ? globalTomlDraft : projectTomlDraft;
                      const res = await saveLocalCodexConfig(configScope, content);
                      if (res.ok) {
                        setConfigSaveNotice('Saved ✓');
                        onRefreshLocalStatus();
                      } else {
                        setConfigSaveNotice('Save failed');
                      }
                      setTimeout(() => setConfigSaveNotice(''), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save config.toml</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono codex-text-muted">
                Path:{' '}
                {configScope === 'global'
                  ? localCodexStatus?.config?.globalConfigPath || '~/.codex/config.toml'
                  : localCodexStatus?.config?.projectConfigPath || '.codex/config.toml'}
              </div>

              <textarea
                rows={12}
                value={configScope === 'global' ? globalTomlDraft : projectTomlDraft}
                onChange={(e) =>
                  configScope === 'global'
                    ? setGlobalTomlDraft(e.target.value)
                    : setProjectTomlDraft(e.target.value)
                }
                spellCheck={false}
                placeholder="# Configure model, model_provider, model_reasoning_effort, sandbox_mode, or [mcp_servers]..."
                className="w-full rounded-xl codex-elevated border codex-border p-3.5 font-mono text-xs codex-text-primary focus:outline-none leading-relaxed"
              />
            </div>

            {/* Section 4: Project Instructions (AGENTS.md) */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold codex-text-primary">
                    Project Instructions (`AGENTS.md`)
                  </h3>
                </div>
                <button
                  onClick={() => {
                    onSaveAgentsMd(agentsMdDraft);
                    setConfigSaveNotice('Saved AGENTS.md ✓');
                    setTimeout(() => setConfigSaveNotice(''), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg codex-elevated border codex-border text-xs font-medium codex-text-primary codex-hover flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save AGENTS.md</span>
                </button>
              </div>
              <textarea
                rows={7}
                value={agentsMdDraft}
                onChange={(e) => setAgentsMdDraft(e.target.value)}
                spellCheck={false}
                className="w-full rounded-xl codex-elevated border codex-border p-3.5 font-mono text-xs codex-text-primary focus:outline-none leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 1. REVIEW QUEUE VIEW
  // ==========================================================================
  if (activeNav === 'review_queue') {
    return (
      <div className="flex-1 flex flex-col h-full codex-app-bg overflow-hidden">
        {renderTopSubHeader(
          'Review queue',
          'Inspect and approve changes produced by background Automations and parallel worktree agents'
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {reviewQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl codex-card border codex-border p-5 space-y-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                          item.status === 'pending_review'
                            ? 'bg-amber-500/15 text-amber-400'
                            : item.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-mono codex-text-secondary">
                        {item.automationName}
                      </span>
                      <span className="text-xs codex-text-muted">· {item.createdAt}</span>
                    </div>
                    <h3 className="text-base font-semibold codex-text-primary">{item.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg codex-elevated border codex-border text-xs font-mono codex-text-secondary flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-emerald-500" />
                      {item.worktreeBranch}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg codex-elevated border codex-border text-xs font-mono">
                      <span className="text-emerald-500">+{item.diffSummary.additions}</span>{' '}
                      <span className="text-rose-500">-{item.diffSummary.deletions}</span>
                    </span>
                  </div>
                </div>

                <p className="text-xs codex-text-secondary leading-relaxed">{item.summary}</p>

                {item.files.map((file) => (
                  <div
                    key={file.id}
                    className="rounded-xl border codex-border codex-elevated overflow-hidden font-mono text-xs"
                  >
                    <div className="px-3 py-1.5 border-b codex-border flex items-center justify-between codex-text-secondary">
                      <span>{file.filePath}</span>
                      <span>
                        <span className="text-emerald-500">+{file.additions}</span>{' '}
                        <span className="text-rose-500">-{file.deletions}</span>
                      </span>
                    </div>
                    <div className="p-2 space-y-0.5">
                      {file.hunks[0]?.lines.map((l, idx) => (
                        <div
                          key={idx}
                          className={`px-2 py-0.5 rounded ${
                            l.type === 'add'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : l.type === 'del'
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'codex-text-muted'
                          }`}
                        >
                          {l.type === 'add' ? '+ ' : l.type === 'del' ? '- ' : '  '}
                          {l.content}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t codex-border">
                  <button
                    onClick={() => onOpenReviewInThread(item)}
                    className="px-3 py-1.5 rounded-lg codex-elevated border codex-border codex-text-primary text-xs font-medium flex items-center gap-1.5 codex-hover"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Open in thread</span>
                  </button>
                  {item.status === 'pending_review' && (
                    <>
                      <button
                        onClick={() => onRejectReviewItem(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-medium flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Discard</span>
                      </button>
                      <button
                        onClick={() => onApproveReviewItem(item.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve &amp; merge</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 2. SKILLS VIEW
  // ==========================================================================
  if (activeNav === 'skills') {
    const selectedSkill = skills.find((s) => s.id === selectedSkillId) || skills[0];
    const categories = [
      'All',
      'Local User Skill',
      'Engineering',
      'Design & UI',
      'Project Ops',
      'Cloud & DevOps',
      'Creative & Games',
      'Documents',
    ];
    const filteredSkills =
      skillCategoryFilter === 'All'
        ? skills
        : skills.filter((s) => s.category === skillCategoryFilter);

    return (
      <div className="flex-1 flex flex-col h-full codex-app-bg overflow-hidden">
        {renderTopSubHeader(
          'Skills',
          'Reusable workflows bundled with instructions, scripts, and resources (~/.codex/skills & .codex/skills)'
        )}

        <div className="flex-1 grid grid-cols-12 min-h-0 divide-x codex-border overflow-hidden">
          <div className="col-span-5 flex flex-col h-full overflow-hidden">
            <div className="p-3.5 border-b codex-border flex flex-wrap gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSkillCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    skillCategoryFilter === cat
                      ? 'codex-active codex-text-primary'
                      : 'codex-text-muted hover:codex-text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  onClick={() => setSelectedSkillId(skill.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedSkill?.id === skill.id
                      ? 'codex-active border-emerald-500/40'
                      : 'codex-card codex-border codex-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-emerald-500">
                      ${skill.slug}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded codex-elevated codex-text-muted">
                        {skill.category}
                      </span>
                      <input
                        type="checkbox"
                        checked={skill.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSkill(skill.id);
                        }}
                        className="accent-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="text-xs font-semibold codex-text-primary mt-1">{skill.name}</div>
                  <p className="text-[11px] codex-text-muted mt-0.5 line-clamp-2">
                    {skill.description}
                  </p>
                </div>
              ))}

              <div className="p-3 rounded-xl codex-card border border-dashed codex-border space-y-2 mt-3">
                <div className="text-xs font-medium codex-text-primary flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  <span>New skill (`.codex/skills/`)</span>
                </div>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="Skill slug (e.g., pr-review-check)"
                  className="w-full codex-elevated border codex-border rounded-lg px-2.5 py-1.5 text-xs codex-text-primary"
                />
                <input
                  type="text"
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  placeholder="Description..."
                  className="w-full codex-elevated border codex-border rounded-lg px-2.5 py-1.5 text-xs codex-text-primary"
                />
                <button
                  onClick={() => {
                    if (!newSkillName.trim()) return;
                    const slug = newSkillName
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9-_]/g, '-');
                    onCreateSkill({
                      slug,
                      name: newSkillName.trim(),
                      category: 'Engineering',
                      description: newSkillDesc.trim() || 'Custom project skill',
                      author: 'local',
                      version: '1.0.0',
                      enabled: true,
                      builtIn: false,
                      path: `.codex/skills/${slug}/SKILL.md`,
                      samplePrompt: `Use $${slug} on this repository.`,
                      tags: ['Custom'],
                      content: `---\nname: ${slug}\ndescription: ${
                        newSkillDesc.trim() || 'Custom skill'
                      }\n---\n# ${newSkillName.trim()}\n\n1. Inspect repository files.\n2. Execute workflow and verify output.`,
                    });
                    setNewSkillName('');
                    setNewSkillDesc('');
                  }}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                >
                  Create SKILL.md
                </button>
              </div>
            </div>
          </div>

          {selectedSkill && (
            <div className="col-span-7 flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b codex-border flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold codex-text-primary">
                      {selectedSkill.name}
                    </h3>
                    <span className="text-xs font-mono text-emerald-500">
                      ${selectedSkill.slug}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono codex-text-muted mt-0.5">
                    {selectedSkill.path}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {skillSavedToast && (
                    <span className="text-xs font-mono text-emerald-500">Saved ✓</span>
                  )}
                  <button
                    onClick={async () => {
                      onSaveSkill(selectedSkill);
                      await writeWorkspaceFile(selectedSkill.path, selectedSkill.content);
                      setSkillSavedToast(true);
                      setTimeout(() => setSkillSavedToast(false), 1800);
                    }}
                    className="px-3 py-1.5 rounded-lg codex-card border codex-border text-xs font-medium codex-text-primary codex-hover flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => onLaunchSkillThread(selectedSkill)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Try skill in thread</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col p-4 min-h-0">
                <textarea
                  value={selectedSkill.content}
                  onChange={(e) =>
                    onSaveSkill({ ...selectedSkill, content: e.target.value })
                  }
                  spellCheck={false}
                  className="flex-1 w-full rounded-xl codex-card border codex-border p-4 font-mono text-xs codex-text-primary focus:outline-none leading-relaxed resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 3. AUTOMATIONS VIEW
  // ==========================================================================
  if (activeNav === 'automations') {
    return (
      <div className="flex-1 flex flex-col h-full codex-app-bg overflow-hidden">
        {renderTopSubHeader(
          'Automations',
          'Schedule background Codex tasks with instructions and skills; completed runs land in the Review queue'
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-3">
              <div className="text-xs font-semibold codex-text-primary flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" />
                <span>Create automation</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newAutoName}
                  onChange={(e) => setNewAutoName(e.target.value)}
                  placeholder="Name (e.g., Daily CI Failure Summary)"
                  className="codex-elevated border codex-border rounded-lg px-3 py-2 text-xs codex-text-primary"
                />
                <input
                  type="text"
                  value={newAutoCron}
                  onChange={(e) => setNewAutoCron(e.target.value)}
                  placeholder="Schedule cron (0 9 * * 1-5)"
                  className="codex-elevated border codex-border rounded-lg px-3 py-2 text-xs font-mono codex-text-primary"
                />
                <select
                  value={newAutoSkill}
                  onChange={(e) => setNewAutoSkill(e.target.value)}
                  className="codex-elevated border codex-border rounded-lg px-3 py-2 text-xs font-mono codex-text-primary"
                >
                  {skills.map((s) => (
                    <option key={s.id} value={s.slug} className="bg-neutral-900 text-white">
                      Skill: ${s.slug}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newAutoPrompt}
                  onChange={(e) => setNewAutoPrompt(e.target.value)}
                  placeholder="Prompt instructions for Codex to run on schedule..."
                  className="flex-1 codex-elevated border codex-border rounded-lg px-3 py-2 text-xs codex-text-primary"
                />
                <button
                  onClick={() => {
                    if (!newAutoName.trim() || !newAutoPrompt.trim()) return;
                    onCreateAutomation({
                      name: newAutoName.trim(),
                      projectId: 'proj_codex_desktop',
                      scheduleCron: newAutoCron.trim(),
                      scheduleLabel: `Cron (${newAutoCron.trim()})`,
                      prompt: newAutoPrompt.trim(),
                      skills: [newAutoSkill],
                      worktreeStrategy: 'isolated_worktree',
                      enabled: true,
                    });
                    setNewAutoName('');
                    setNewAutoPrompt('');
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shrink-0"
                >
                  Save automation
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {automations.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl codex-card border codex-border p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={job.enabled}
                        onChange={() => onToggleAutomation(job.id)}
                        className="accent-emerald-500"
                      />
                      <span className="text-sm font-semibold codex-text-primary">
                        {job.name}
                      </span>
                      <span className="px-2 py-0.5 rounded codex-elevated border codex-border text-[11px] font-mono codex-text-secondary">
                        {job.scheduleLabel}
                      </span>
                      {job.skills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 text-[11px] font-mono"
                        >
                          ${sk}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs codex-text-secondary">{job.prompt}</p>
                    <div className="flex items-center gap-4 text-[11px] font-mono codex-text-muted">
                      <span>Last run: {job.lastRunAt}</span>
                      <span>Next: {job.nextRunAt}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onRunAutomationNow(job.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Run now</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 4. WORKTREES VIEW
  // ==========================================================================
  return (
    <div className="flex-1 flex flex-col h-full codex-app-bg overflow-hidden">
      {renderTopSubHeader(
        'Git Worktrees',
        'Run parallel Codex tasks in isolated worktree directories ($CODEX_HOME/worktrees) without branch conflicts'
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={wtBranchInput}
              onChange={(e) => setWtBranchInput(e.target.value)}
              placeholder="New worktree branch name (e.g., codex/feat-auth)..."
              className="flex-1 codex-card border codex-border rounded-xl px-3.5 py-2 text-xs font-mono codex-text-primary"
            />
            <button
              onClick={() => {
                if (wtBranchInput.trim()) {
                  onCreateWorktree(wtBranchInput.trim());
                  setWtBranchInput('');
                }
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Git Worktree</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {worktrees.map((wt) => (
              <div
                key={wt.id}
                className="rounded-2xl codex-card border codex-border p-4 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-semibold font-mono codex-text-primary">
                        {wt.branch}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded codex-elevated codex-text-secondary">
                        {wt.isMain ? 'Local checkout' : 'Managed worktree'}
                      </span>
                    </div>
                    <span className="text-xs font-mono codex-text-muted">{wt.headCommit}</span>
                  </div>
                  <div className="text-[11px] font-mono codex-text-muted codex-elevated p-2 rounded-lg truncate">
                    {wt.path}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t codex-border">
                  <button
                    onClick={() => onJumpToWorktreeThread(wt)}
                    className="px-3 py-1.5 rounded-lg codex-elevated border codex-border text-xs font-medium codex-text-primary codex-hover"
                  >
                    Open thread
                  </button>
                  {!wt.isMain && (
                    <>
                      <button
                        onClick={() => onMergeWorktree(wt.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Hand off to Local</span>
                      </button>
                      <button
                        onClick={() => onDeleteWorktree(wt.id)}
                        className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400"
                        title="Remove worktree"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
