import React, { useState, useEffect } from 'react';
import {
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
  Terminal,
  CheckCircle2,
  Sliders,
  RefreshCw,
  Palette,
  ArrowLeft,
  KeyRound,
  Server,
  Languages,
} from 'lucide-react';
import {
  AppLanguage,
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
import { saveLocalCodexConfig } from '../services/appServerClient';
import { t, SKIN_METAS } from '../i18n/translations';

interface MainFeatureViewsProps {
  lang: AppLanguage;
  onSelectLang: (lang: AppLanguage) => void;
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

export const MainFeatureViews: React.FC<MainFeatureViewsProps> = ({
  lang,
  onSelectLang,
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
  const i18n = t(lang);

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
          <span>{i18n.settings.backToThread}</span>
        </button>
        <div>
          <h2 className="text-sm font-semibold codex-text-primary">{title}</h2>
          <p className="text-[11px] codex-text-muted hidden sm:block">{subtitle}</p>
        </div>
      </div>

      {/* Quick Language & Skin Status Badge in Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center codex-card border codex-border rounded-lg p-0.5 text-xs">
          <button
            onClick={() => onSelectLang('zh-CN')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
              lang === 'zh-CN'
                ? 'codex-active codex-text-primary'
                : 'codex-text-muted hover:codex-text-primary'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => onSelectLang('en-US')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
              lang === 'en-US'
                ? 'codex-active codex-text-primary'
                : 'codex-text-muted hover:codex-text-primary'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );

  // ==========================================================================
  // 0. SETTINGS: LANGUAGE (`zh-CN` / `en-US`), 3 SKINS (`wechat` / `qq` / `dingtalk`), & LOCAL CODEX CONFIG (`codex_config`)
  // ==========================================================================
  if (activeNav === 'codex_config') {
    const mcpServers = Object.entries(localCodexStatus?.config?.effective?.mcpServers || {});
    const modelProviders = Object.entries(
      localCodexStatus?.config?.effective?.modelProviders || {}
    );

    return (
      <div className="flex-1 flex flex-col h-full codex-app-bg overflow-hidden">
        {renderTopSubHeader(i18n.settings.pageTitle, i18n.settings.pageSubtitle)}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Section 1: UI Language Switcher (Default Simplified Chinese, Switchable to English) */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 codex-accent-text" />
                  <div>
                    <h3 className="text-sm font-semibold codex-text-primary">
                      {i18n.settings.languageSectionTitle}
                    </h3>
                    <p className="text-[11px] codex-text-muted mt-0.5">
                      {i18n.settings.languageSectionDesc}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono codex-accent-soft px-2 py-0.5 rounded-md">
                  {lang === 'zh-CN' ? '简体中文' : 'English'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => onSelectLang('zh-CN')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    lang === 'zh-CN'
                      ? 'codex-active ring-2 ring-[var(--accent-color)] codex-elevated'
                      : 'codex-border codex-hover'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold codex-text-primary">
                      {i18n.settings.langZh}
                    </div>
                    <div className="text-[11px] codex-text-muted mt-0.5">
                      zh-CN · 默认界面语言 (Simplified Chinese)
                    </div>
                  </div>
                  {lang === 'zh-CN' && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded codex-accent-soft">
                      {i18n.settings.activeBadge}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onSelectLang('en-US')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    lang === 'en-US'
                      ? 'codex-active ring-2 ring-[var(--accent-color)] codex-elevated'
                      : 'codex-border codex-hover'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold codex-text-primary">
                      {i18n.settings.langEn}
                    </div>
                    <div className="text-[11px] codex-text-muted mt-0.5">
                      en-US · English Interface
                    </div>
                  </div>
                  {lang === 'en-US' && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded codex-accent-soft">
                      {i18n.settings.activeBadge}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Section 2: 3 IM Brand Skins (WeChat Default, QQ, DingTalk) */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 codex-accent-text" />
                  <div>
                    <h3 className="text-sm font-semibold codex-text-primary">
                      {i18n.settings.skinSectionTitle}
                    </h3>
                    <p className="text-[11px] codex-text-muted mt-0.5">
                      {i18n.settings.skinSectionDesc}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono codex-accent-soft px-2 py-0.5 rounded-md">
                  {skin}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {SKIN_METAS.map((meta) => {
                  const active = skin === meta.id;
                  const title = lang === 'zh-CN' ? meta.nameZh : meta.nameEn;
                  const desc = lang === 'zh-CN' ? meta.descZh : meta.descEn;
                  const badge = lang === 'zh-CN' ? meta.badgeZh : meta.badgeEn;

                  return (
                    <button
                      key={meta.id}
                      onClick={() => onSelectSkin(meta.id)}
                      className={`p-4 rounded-xl border text-left transition-all space-y-3 flex flex-col justify-between ${
                        active
                          ? 'codex-active ring-2 ring-[var(--accent-color)] codex-elevated shadow-md'
                          : 'codex-border codex-hover'
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Visual Mini Theme Preview Swatch */}
                        <div
                          className="h-14 rounded-lg border border-black/15 overflow-hidden flex"
                          style={{ backgroundColor: meta.canvasHex }}
                        >
                          <div
                            className="w-1/4 h-full border-r border-black/10 flex flex-col gap-1 p-1.5"
                            style={{ backgroundColor: meta.sidebarHex }}
                          >
                            <span
                              className="w-full h-1.5 rounded-sm opacity-80"
                              style={{ backgroundColor: meta.accentHex }}
                            />
                            <span className="w-3/4 h-1 rounded-sm bg-neutral-400/40" />
                            <span className="w-2/3 h-1 rounded-sm bg-neutral-400/40" />
                          </div>
                          <div className="flex-1 p-2 flex flex-col justify-between">
                            <div className="w-2/3 h-2 rounded bg-neutral-400/30" />
                            <div
                              className="self-end px-2 py-0.5 rounded-md text-[9px] font-mono font-semibold"
                              style={{
                                backgroundColor: meta.bubbleHex,
                                color: meta.id === 'wechat' ? '#111111' : '#FFFFFF',
                              }}
                            >
                              {meta.accentHex}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold codex-text-primary">
                            {title}
                          </span>
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${meta.accentHex}20`,
                              color: meta.accentHex,
                            }}
                          >
                            {active ? i18n.settings.activeBadge : badge}
                          </span>
                        </div>

                        <p className="text-[11px] codex-text-muted leading-relaxed">{desc}</p>
                      </div>

                      {/* Color Token Swatches */}
                      <div className="pt-2 border-t codex-border flex items-center justify-between text-[10px] font-mono codex-text-muted">
                        <div className="flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 inline-block"
                            style={{ backgroundColor: meta.canvasHex }}
                            title={`Canvas: ${meta.canvasHex}`}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 inline-block"
                            style={{ backgroundColor: meta.sidebarHex }}
                            title={`Sidebar: ${meta.sidebarHex}`}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 inline-block"
                            style={{ backgroundColor: meta.accentHex }}
                            title={`Brand Accent: ${meta.accentHex}`}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 inline-block"
                            style={{ backgroundColor: meta.bubbleHex }}
                            title={`Chat Bubble: ${meta.bubbleHex}`}
                          />
                        </div>
                        <span>{meta.accentHex}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Real Local Machine Codex CLI & Authentication Status */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 codex-accent-text" />
                  <h3 className="text-sm font-semibold codex-text-primary">
                    {i18n.settings.localStatusTitle}
                  </h3>
                </div>
                <button
                  onClick={onRefreshLocalStatus}
                  className="px-2.5 py-1 rounded-lg codex-elevated border codex-border text-xs codex-text-primary codex-hover flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{i18n.settings.rescanStatus}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl codex-elevated border codex-border space-y-1">
                  <div className="codex-text-muted text-[11px]">{i18n.settings.cliBinary}</div>
                  <div className="font-mono font-semibold codex-text-primary truncate">
                    {localCodexStatus?.cli?.version ||
                      (localCodexStatus?.cli?.installed ? 'Detected' : 'Not found in PATH')}
                  </div>
                  <div className="font-mono text-[11px] codex-text-muted truncate">
                    {localCodexStatus?.cli?.binaryPath || '~/.nvm / /opt/homebrew/bin'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl codex-elevated border codex-border space-y-1">
                  <div className="codex-text-muted text-[11px]">{i18n.settings.authStatus}</div>
                  <div className="font-semibold codex-accent-text flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {localCodexStatus?.auth?.loggedIn
                        ? `${i18n.settings.loggedIn} (${localCodexStatus.auth.authMode})`
                        : localCodexStatus?.cli?.loginStatusText || i18n.settings.notLoggedIn}
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
                  <div className="codex-text-muted text-[11px]">
                    {i18n.settings.effectiveModel}
                  </div>
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
                      <Server className="w-3.5 h-3.5 codex-accent-text" />
                      <span>
                        {i18n.settings.modelProviders} ({modelProviders.length})
                      </span>
                    </div>
                    {modelProviders.map(([name, cfg]) => (
                      <div
                        key={name}
                        className="text-[11px] font-mono codex-text-secondary flex items-center justify-between"
                      >
                        <span className="codex-text-primary">{name}</span>
                        <span className="truncate max-w-[200px]">
                          {String((cfg as any)?.base_url || 'default')}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl codex-elevated border codex-border space-y-1.5">
                    <div className="text-xs font-medium codex-text-primary flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 codex-accent-text" />
                      <span>
                        {i18n.settings.mcpServers} ({mcpServers.length})
                      </span>
                    </div>
                    {mcpServers.map(([name, cfg]) => (
                      <div
                        key={name}
                        className="text-[11px] font-mono codex-text-secondary flex items-center justify-between"
                      >
                        <span className="codex-text-primary">{name}</span>
                        <span className="truncate max-w-[200px]">
                          {String((cfg as any)?.command || (cfg as any)?.url || 'stdio')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Direct Editor for ~/.codex/config.toml & Project .codex/config.toml */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 codex-accent-text" />
                  <h3 className="text-sm font-semibold codex-text-primary">
                    {i18n.settings.configFileTitle}
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
                      {i18n.settings.globalConfig}
                    </button>
                    <button
                      onClick={() => setConfigScope('project')}
                      className={`px-2.5 py-1 rounded-md font-mono text-[11px] ${
                        configScope === 'project'
                          ? 'codex-active codex-text-primary'
                          : 'codex-text-muted'
                      }`}
                    >
                      {i18n.settings.projectConfig}
                    </button>
                  </div>

                  {configSaveNotice && (
                    <span className="text-xs font-mono codex-accent-text">
                      {configSaveNotice}
                    </span>
                  )}

                  <button
                    onClick={async () => {
                      const content =
                        configScope === 'global' ? globalTomlDraft : projectTomlDraft;
                      const res = await saveLocalCodexConfig(configScope, content);
                      if (res.ok) {
                        setConfigSaveNotice(i18n.inspector.saved);
                        onRefreshLocalStatus();
                      } else {
                        setConfigSaveNotice('Error');
                      }
                      setTimeout(() => setConfigSaveNotice(''), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg codex-accent-btn text-xs font-medium flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{i18n.settings.saveConfig}</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono codex-text-muted">
                {configScope === 'global'
                  ? localCodexStatus?.config?.globalConfigPath || '~/.codex/config.toml'
                  : localCodexStatus?.config?.projectConfigPath || '.codex/config.toml'}
              </div>

              <textarea
                rows={10}
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

            {/* Section 5: Project Instructions (AGENTS.md) */}
            <div className="rounded-2xl codex-card border codex-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 codex-accent-text" />
                  <h3 className="text-sm font-semibold codex-text-primary">
                    {i18n.settings.projectInstructionsTitle}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    onSaveAgentsMd(agentsMdDraft);
                    setConfigSaveNotice(i18n.inspector.saved);
                    setTimeout(() => setConfigSaveNotice(''), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg codex-elevated border codex-border text-xs font-medium codex-text-primary codex-hover flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{i18n.settings.saveAgentsMd}</span>
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
        {renderTopSubHeader(i18n.features.reviewQueueTitle, i18n.features.reviewQueueSubtitle)}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {reviewQueue.length === 0 ? (
              <div className="rounded-2xl codex-card border codex-border p-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 codex-accent-text mx-auto opacity-70" />
                <div className="text-sm font-medium codex-text-primary">
                  {i18n.inspector.noUncommittedChanges}
                </div>
              </div>
            ) : (
              reviewQueue.map((item) => (
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
                              ? 'bg-amber-500/15 text-amber-500'
                              : item.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-rose-500/15 text-rose-500'
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
                        <GitBranch className="w-3.5 h-3.5 codex-accent-text" />
                        {item.worktreeBranch}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg codex-elevated border codex-border text-xs font-mono">
                        <span className="text-emerald-500">+{item.diffSummary.additions}</span>{' '}
                        <span className="text-rose-500">-{item.diffSummary.deletions}</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-xs codex-text-secondary leading-relaxed">{item.summary}</p>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t codex-border">
                    <button
                      onClick={() => onOpenReviewInThread(item)}
                      className="px-3 py-1.5 rounded-lg codex-elevated border codex-border codex-text-primary text-xs font-medium flex items-center gap-1.5 codex-hover"
                    >
                      <MessageSquare className="w-3.5 h-3.5 codex-accent-text" />
                      <span>{i18n.features.openInThread}</span>
                    </button>
                    {item.status === 'pending_review' && (
                      <>
                        <button
                          onClick={() => onRejectReviewItem(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-500 text-xs font-medium flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{i18n.features.discard}</span>
                        </button>
                        <button
                          onClick={() => onApproveReviewItem(item.id)}
                          className="px-3.5 py-1.5 rounded-lg codex-accent-btn text-xs font-medium flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{i18n.features.approveMerge}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
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
    ];
    const filteredSkills =
      skillCategoryFilter === 'All'
        ? skills
        : skills.filter((s) => s.category === skillCategoryFilter);

    return (
      <div className="flex-1 flex flex-col h-full codex-app-bg overflow-hidden">
        {renderTopSubHeader(i18n.features.skillsTitle, i18n.features.skillsSubtitle)}

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
                      ? 'codex-active codex-accent-soft'
                      : 'codex-card codex-border codex-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold codex-accent-text">
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
                  <Plus className="w-3.5 h-3.5 codex-accent-text" />
                  <span>{i18n.features.newSkill}</span>
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
                    const slug = newSkillName.trim().toLowerCase().replace(/\s+/g, '-');
                    onCreateSkill({
                      name: newSkillName.trim(),
                      slug,
                      category: 'Engineering',
                      path: `.codex/skills/${slug}/SKILL.md`,
                      description: newSkillDesc.trim() || 'Custom repository skill',
                      author: 'local',
                      version: '1.0.0',
                      enabled: true,
                      builtIn: false,
                      content: `---\nname: ${slug}\ndescription: ${newSkillDesc.trim()}\n---\n\n# ${newSkillName.trim()}\n`,
                      samplePrompt: `Use $${slug}`,
                      tags: [slug],
                    });
                    setNewSkillName('');
                    setNewSkillDesc('');
                  }}
                  className="w-full py-1.5 rounded-lg codex-accent-btn text-xs font-medium"
                >
                  {i18n.features.createSkill}
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-7 flex flex-col h-full overflow-hidden p-5 space-y-4">
            {selectedSkill && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold codex-accent-text">
                        ${selectedSkill.slug}
                      </span>
                      <span className="text-xs font-mono codex-text-muted">
                        {selectedSkill.path}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold codex-text-primary mt-1">
                      {selectedSkill.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {skillSavedToast && (
                      <span className="text-xs font-mono codex-accent-text">
                        {i18n.inspector.saved}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        onSaveSkill(selectedSkill);
                        setSkillSavedToast(true);
                        setTimeout(() => setSkillSavedToast(false), 1800);
                      }}
                      className="px-3 py-1.5 rounded-lg codex-elevated border codex-border codex-text-primary text-xs font-medium flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{i18n.inspector.save}</span>
                    </button>
                    <button
                      onClick={() => onLaunchSkillThread(selectedSkill)}
                      className="px-3 py-1.5 rounded-lg codex-accent-btn text-xs font-medium flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {i18n.features.useSkill} ${selectedSkill.slug}
                      </span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={selectedSkill.content}
                  onChange={(e) =>
                    onSaveSkill({ ...selectedSkill, content: e.target.value })
                  }
                  spellCheck={false}
                  className="flex-1 w-full rounded-xl codex-card border codex-border p-4 font-mono text-xs codex-text-primary focus:outline-none resize-none leading-relaxed"
                />
              </>
            )}
          </div>
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
        {renderTopSubHeader(i18n.features.automationsTitle, i18n.features.automationsSubtitle)}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="grid grid-cols-1 gap-3">
              {automations.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl codex-card border codex-border p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 codex-accent-text" />
                      <span className="text-sm font-semibold codex-text-primary">{job.name}</span>
                      <span className="px-2 py-0.5 rounded codex-elevated text-[11px] font-mono codex-accent-text">
                        {job.scheduleLabel} ({job.scheduleCron})
                      </span>
                      {job.skills[0] && (
                        <span className="px-2 py-0.5 rounded codex-accent-soft text-[11px] font-mono">
                          ${job.skills[0]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs codex-text-secondary">{job.prompt}</p>
                    <div className="text-[11px] codex-text-muted font-mono">
                      Last: {job.lastRunAt} · Next: {job.nextRunAt} · Strategy: {job.worktreeStrategy}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRunAutomationNow(job.id)}
                      className="px-3 py-1.5 rounded-lg codex-accent-btn text-xs font-medium flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{i18n.features.runNow}</span>
                    </button>
                    <button
                      onClick={() => onToggleAutomation(job.id)}
                      className="px-3 py-1.5 rounded-lg codex-elevated border codex-border text-xs codex-text-secondary"
                    >
                      {job.enabled ? i18n.features.Active : i18n.features.Paused}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl codex-card border codex-border p-5 space-y-3">
              <h3 className="text-sm font-semibold codex-text-primary">
                {i18n.features.newAutomation}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newAutoName}
                  onChange={(e) => setNewAutoName(e.target.value)}
                  placeholder="Automation name..."
                  className="codex-elevated border codex-border rounded-lg px-3 py-1.5 text-xs codex-text-primary"
                />
                <input
                  type="text"
                  value={newAutoCron}
                  onChange={(e) => setNewAutoCron(e.target.value)}
                  placeholder="Cron (e.g. 0 9 * * 1-5)"
                  className="codex-elevated border codex-border rounded-lg px-3 py-1.5 text-xs font-mono codex-text-primary"
                />
                <input
                  type="text"
                  value={newAutoSkill}
                  onChange={(e) => setNewAutoSkill(e.target.value)}
                  placeholder="Skill slug"
                  className="codex-elevated border codex-border rounded-lg px-3 py-1.5 text-xs font-mono codex-text-primary"
                />
              </div>
              <textarea
                rows={2}
                value={newAutoPrompt}
                onChange={(e) => setNewAutoPrompt(e.target.value)}
                placeholder="Background prompt instructions..."
                className="w-full codex-elevated border codex-border rounded-lg p-3 text-xs codex-text-primary"
              />
              <button
                onClick={() => {
                  if (!newAutoName.trim()) return;
                  onCreateAutomation({
                    name: newAutoName.trim(),
                    projectId: 'proj_codex_desktop',
                    scheduleCron: newAutoCron.trim(),
                    scheduleLabel: 'Custom schedule',
                    skills: [newAutoSkill.trim()].filter(Boolean),
                    worktreeStrategy: 'isolated_worktree',
                    enabled: true,
                    prompt: newAutoPrompt.trim() || 'Run scheduled check.',
                  });
                  setNewAutoName('');
                  setNewAutoPrompt('');
                }}
                className="px-4 py-1.5 rounded-lg codex-accent-btn text-xs font-medium"
              >
                {i18n.features.createAutomation}
              </button>
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
      {renderTopSubHeader(i18n.features.worktreesTitle, i18n.features.worktreesSubtitle)}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={wtBranchInput}
              onChange={(e) => setWtBranchInput(e.target.value)}
              placeholder="codex/feature-branch..."
              className="flex-1 codex-card border codex-border rounded-xl px-3.5 py-2 text-xs font-mono codex-text-primary"
            />
            <button
              onClick={() => {
                if (wtBranchInput.trim()) {
                  onCreateWorktree(wtBranchInput.trim());
                  setWtBranchInput('');
                }
              }}
              className="px-4 py-2 rounded-xl codex-accent-btn text-xs font-medium flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{i18n.features.createWorktree}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {worktrees.map((wt) => (
              <div
                key={wt.id}
                className="rounded-2xl codex-card border codex-border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold codex-accent-text flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    {wt.branch}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded codex-elevated codex-text-muted">
                    HEAD {wt.headCommit}
                  </span>
                </div>
                <div className="text-xs font-mono codex-text-secondary truncate">{wt.path}</div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t codex-border">
                  <button
                    onClick={() => onJumpToWorktreeThread(wt)}
                    className="px-2.5 py-1 rounded-lg codex-elevated border codex-border text-xs codex-text-primary codex-hover"
                  >
                    {i18n.features.openThread}
                  </button>
                  {wt.branch !== 'main' && wt.branch !== 'master' && (
                    <>
                      <button
                        onClick={() => onMergeWorktree(wt.id)}
                        className="px-2.5 py-1 rounded-lg codex-accent-soft text-xs flex items-center gap-1"
                      >
                        <GitMerge className="w-3 h-3" />
                        <span>{i18n.inspector.syncMerge}</span>
                      </button>
                      <button
                        onClick={() => onDeleteWorktree(wt.id)}
                        className="p-1 rounded-lg bg-rose-500/15 text-rose-500"
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
