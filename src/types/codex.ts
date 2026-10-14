export type CodexSurface = 'codex' | 'work' | 'chat';

export type ThemeSkin = 'codex' | 'wechat' | 'qq' | 'dingtalk';

export type AppLanguage = 'zh-CN' | 'en-US';

export type NavSection =
  | 'threads'
  | 'automations'
  | 'skills'
  | 'review_queue'
  | 'worktrees'
  | 'codex_config';

export type RightPanelTab = 'diff' | 'files' | 'terminal' | 'preview' | 'worktrees';

export type WorkspaceLayoutMode = 'standard' | 'focus_chat';

export type ModelId = string;

export type PersonalityMode = 'pragmatic' | 'empathetic';

export type ReasoningEffort =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'uhigh'
  | 'max'
  | 'ultra';

export interface CodexReasoningLevelOption {
  effort: ReasoningEffort;
  description: string;
}

export interface CodexModelInfo {
  slug: string;
  displayName: string;
  description: string;
  defaultReasoningLevel: ReasoningEffort;
  supportedReasoningLevels: CodexReasoningLevelOption[];
  visibility?: 'list' | 'hide' | 'none';
  priority?: number;
}

export type ComposerMode = 'agent' | 'goal' | 'review';

export type ExecutionEnvironmentMode = 'local' | 'worktree';

export type PermissionMode = 'workspace-write' | 'read-only' | 'full-access';

export interface ThreadGoal {
  objective: string;
  status: 'active' | 'paused' | 'completed';
  updatedAt: string;
}

export interface LocalCodexSessionSummary {
  id: string;
  cliSessionId: string | null;
  title: string;
  cwd: string;
  projectName: string;
  branch: string;
  model: string;
  updatedAt: string;
  mtimeMs: number;
  items: TurnItem[];
}

export interface LocalCodexStatus {
  codexHome: string;
  realHome: string;
  workspaceRoot: string;
  cli: {
    installed: boolean;
    binaryPath: string | null;
    version: string | null;
    loginStatusText: string;
  };
  auth: {
    exists: boolean;
    path: string;
    authMode: string | null;
    loggedIn: boolean;
    email: string | null;
    name: string | null;
    planType: string | null;
    accountId: string | null;
    lastRefresh: string | null;
    hasApiKey: boolean;
    maskedApiKey: string | null;
    hasTokens: boolean;
  };
  config: {
    globalConfigPath: string;
    globalConfigExists: boolean;
    globalConfigRaw: string;
    projectConfigPath: string;
    projectConfigExists: boolean;
    projectConfigRaw: string;
    effective: {
      model: string;
      modelProvider: string;
      reasoningEffort: string;
      approvalPolicy: string;
      sandboxMode: string;
      personality: string;
      availableModels?: string[];
      modelCatalog?: CodexModelInfo[];
      modelProviders: Record<string, Record<string, unknown>>;
      mcpServers: Record<string, Record<string, unknown>>;
      projects: Record<string, Record<string, unknown>>;
      profiles: Record<string, Record<string, unknown>>;
    };
  };
  localSessions: LocalCodexSessionSummary[];
  localSkills: SkillDefinition[];
}

export interface SubagentConfig {
  id: string;
  name: string;
  description: string;
  model: ModelId;
  sandboxMode: 'read-only' | 'workspace-write' | 'full-access';
  developerInstructions: string;
  tomlPath: string;
  isBuiltIn: boolean;
  maxConcurrentThreads?: number;
}

export interface WorktreeInfo {
  id: string;
  projectId: string;
  name: string;
  branch: string;
  path: string;
  headCommit: string;
  isMain: boolean;
  status: 'clean' | 'modified' | 'running' | 'conflict';
  boundThreadId?: string;
  ahead: number;
  behind: number;
  changedFilesCount: number;
  additions: number;
  deletions: number;
  createdAt: string;
}

export interface InlineDiffComment {
  id: string;
  filePath: string;
  lineNumber: number;
  side: 'old' | 'new';
  author: string;
  body: string;
  createdAt: string;
  resolved?: boolean;
}

export interface DiffLine {
  type: 'context' | 'add' | 'del';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  id: string;
  header: string;
  staged: boolean;
  lines: DiffLine[];
}

export interface FileDiff {
  id: string;
  filePath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  staged: boolean;
  language: string;
  hunks: DiffHunk[];
  comments: InlineDiffComment[];
}

export type TurnItemType =
  | 'userMessage'
  | 'reasoning'
  | 'todoList'
  | 'subagentRun'
  | 'commandExecution'
  | 'fileChange'
  | 'approvalRequest'
  | 'steerMessage'
  | 'agentMessage';

export type TurnItemStatus =
  | 'started'
  | 'streaming'
  | 'waiting_approval'
  | 'completed'
  | 'denied'
  | 'failed';

export interface TurnItem {
  id: string;
  type: TurnItemType;
  status: TurnItemStatus;
  timestamp: string;
  text?: string;
  attachedFiles?: string[];
  invokedSkills?: string[];
  durationSeconds?: number;
  reasoningSteps?: string[];
  todoItems?: Array<{ text: string; completed: boolean }>;
  subagentName?: string;
  subagentTask?: string;
  subagentTokens?: string;
  command?: string;
  cwd?: string;
  exitCode?: number;
  stdout?: string;
  filePath?: string;
  changeType?: 'modified' | 'added' | 'deleted';
  additions?: number;
  deletions?: number;
  summary?: string;
  approvalId?: string;
  approvalCommand?: string;
  approvalReason?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  sandboxRuleTriggered?: string;
  decision?: 'allow_once' | 'allow_always' | 'deny';
}

export interface Turn {
  id: string;
  threadId: string;
  status: 'in_progress' | 'waiting_approval' | 'completed' | 'interrupted';
  startedAt: string;
  completedAt?: string;
  model: ModelId;
  personality: PersonalityMode;
  reasoningEffort: ReasoningEffort;
  items: TurnItem[];
}

export interface Thread {
  id: string;
  cliSessionId?: string | null;
  projectId: string;
  title: string;
  pinned?: boolean;
  isLocalCliSession?: boolean;
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'archived';
  worktreeId: string;
  branch: string;
  cwd?: string;
  environmentMode?: ExecutionEnvironmentMode;
  permissionMode?: PermissionMode;
  daybreakEnabled?: boolean;
  goal?: ThreadGoal | null;
  model: ModelId;
  personality: PersonalityMode;
  reasoningEffort: ReasoningEffort;
  subagent: string;
  updatedAt: string;
  tokenUsage: string;
  diffSummary: {
    files: number;
    additions: number;
    deletions: number;
  };
  turns: Turn[];
  changedFiles: FileDiff[];
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  repoPath: string;
  defaultBranch: string;
  expanded: boolean;
}

export interface SkillDefinition {
  id: string;
  slug: string;
  name: string;
  category:
    | 'Local User Skill'
    | 'Engineering'
    | 'Design & UI'
    | 'Project Ops'
    | 'Cloud & DevOps'
    | 'Creative & Games'
    | 'Documents';
  description: string;
  author: string;
  version: string;
  enabled: boolean;
  builtIn: boolean;
  path: string;
  content: string;
  samplePrompt: string;
  tags: string[];
}

export interface AutomationJob {
  id: string;
  name: string;
  projectId: string;
  scheduleCron: string;
  scheduleLabel: string;
  prompt: string;
  skills: string[];
  worktreeStrategy: 'isolated_worktree' | 'read_only_main';
  enabled: boolean;
  lastRunAt: string;
  nextRunAt: string;
  status: 'idle' | 'running' | 'succeeded';
  totalRuns: number;
}

export interface ReviewQueueItem {
  id: string;
  automationId?: string;
  automationName: string;
  projectId: string;
  threadId?: string;
  worktreeBranch: string;
  title: string;
  summary: string;
  createdAt: string;
  status: 'pending_review' | 'approved' | 'rejected';
  diffSummary: {
    files: number;
    additions: number;
    deletions: number;
  };
  files: FileDiff[];
}

export interface SandboxPolicy {
  mode: 'workspace-write' | 'worktree-isolated' | 'read-only' | 'full-access';
  networkAccess: 'disabled' | 'cached-web' | 'enabled';
  approvalPolicy: 'on-risk' | 'always-ask' | 'auto-allow-safe' | 'never';
  allowedCommands: string[];
  harnessMode: 'local_app_server_cli' | 'hybrid_simulator' | 'openai_compatible_api';
  apiEndpoint: string;
  apiKey: string;
  appServerPort: number;
}

export interface JsonRpcLogEntry {
  id: string;
  timestamp: string;
  direction: 'client->server' | 'server->client' | 'server-notification' | 'server-request';
  method: string;
  payload: unknown;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}
