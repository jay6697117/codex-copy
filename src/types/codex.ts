export type CodexSurface = 'codex' | 'work' | 'chat';

export type NavSection =
  | 'threads'
  | 'review_queue'
  | 'skills'
  | 'automations'
  | 'worktrees'
  | 'subagents'
  | 'sandbox';

export type RightPanelTab = 'diff' | 'files' | 'terminal' | 'preview' | 'worktrees';

export type WorkspaceLayoutMode =
  | 'standard'
  | 'tiled_4pane'
  | 'focus_chat'
  | 'review_zen';

export type ModelId =
  | 'gpt-6.1-sol'
  | 'gpt-6-luna'
  | 'gpt-5.3-codex'
  | 'o4-mini-high';

export type PersonalityMode = 'pragmatic' | 'empathetic';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'max';

export interface SubagentConfig {
  id: string;
  name: string; // e.g., 'default' | 'worker' | 'explorer'
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
  // userMessage / steerMessage / agentMessage
  text?: string;
  attachedFiles?: string[];
  invokedSkills?: string[];
  // reasoning
  durationSeconds?: number;
  reasoningSteps?: string[];
  // subagentRun
  subagentName?: string;
  subagentTask?: string;
  subagentTokens?: string;
  // commandExecution
  command?: string;
  cwd?: string;
  exitCode?: number;
  stdout?: string;
  // fileChange
  filePath?: string;
  changeType?: 'modified' | 'added' | 'deleted';
  additions?: number;
  deletions?: number;
  summary?: string;
  // approvalRequest
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
  projectId: string;
  title: string;
  pinned?: boolean;
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'archived';
  worktreeId: string;
  branch: string;
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
  category: 'Engineering' | 'Design & UI' | 'Project Ops' | 'Cloud & DevOps' | 'Creative & Games' | 'Documents';
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
  harnessMode: 'hybrid_simulator' | 'local_app_server_cli' | 'openai_compatible_api';
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
