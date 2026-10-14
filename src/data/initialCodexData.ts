import {
  ProjectWorkspace,
  WorktreeInfo,
  Thread,
  SkillDefinition,
  AutomationJob,
  ReviewQueueItem,
  SubagentConfig,
  SandboxPolicy,
  JsonRpcLogEntry,
} from '../types/codex';
import { DEFAULT_WORKSPACE_PATH, IS_PUBLIC_SITE } from '../services/runtimeConfig';

export const INITIAL_PROJECTS: ProjectWorkspace[] = [
  {
    id: 'proj_codex_desktop',
    name: 'codex-test',
    repoPath: DEFAULT_WORKSPACE_PATH,
    defaultBranch: 'main',
    expanded: true,
  },
];

export const INITIAL_WORKTREES: WorktreeInfo[] = [
  {
    id: 'wt_main',
    projectId: 'proj_codex_desktop',
    name: 'codex-test (Local)',
    branch: 'main',
    path: DEFAULT_WORKSPACE_PATH,
    headCommit: 'HEAD',
    isMain: true,
    status: 'clean',
    boundThreadId: 'thr_workspace_main',
    ahead: 0,
    behind: 0,
    changedFilesCount: 0,
    additions: 0,
    deletions: 0,
    createdAt: new Date().toISOString(),
  },
];

const RECENT_TITLES: string[] = IS_PUBLIC_SITE ? [] : [
  '部署 Sites 并公开访问',
  '新聊天',
  '确保所有人可见',
  '解决配音问题',
  '确认配置冲突是否解决',
  '确认问题是否已解决',
  '同步一下版本',
  'https://github.com/Pluviobyte/dot2ap',
  '创建一个 HTML，内容是 SVG 绘制一个',
  '详细检查代码库',
  '对比 DeepSeek 会员人民币价格',
  '解释这是什么',
  '识别霞浦海边的红色物体',
  '制定微信分享对象',
  'Clarify Chinese question',
  '解释 Claude Code 的 iOS 功能',
  '查询各国 OpenAI 100 美元价格',
  '修复移动端颜色异常',
  '查看实际访问人数',
  '审计并优化项目性能',
];

export const INITIAL_THREADS: Thread[] = [
  {
    id: 'thr_workspace_main',
    projectId: 'proj_codex_desktop',
    title: '新聊天',
    pinned: false,
    status: 'completed',
    worktreeId: 'wt_main',
    branch: 'main',
    cwd: DEFAULT_WORKSPACE_PATH,
    environmentMode: 'local',
    permissionMode: 'full-access',
    daybreakEnabled: false,
    goal: null,
    model: 'gpt-6.1-sol',
    personality: 'pragmatic',
    reasoningEffort: 'xhigh',
    subagent: 'default',
    updatedAt: '刚刚',
    tokenUsage: '0 tokens',
    diffSummary: {
      files: 0,
      additions: 0,
      deletions: 0,
    },
    turns: [],
    changedFiles: [],
  },
  ...RECENT_TITLES.map((title, idx) => ({
    id: `thr_recent_${idx}`,
    projectId: 'proj_codex_desktop',
    title,
    pinned: false,
    isLocalCliSession: true,
    status: 'completed' as const,
    worktreeId: 'wt_main',
    branch: 'main',
    cwd: DEFAULT_WORKSPACE_PATH,
    environmentMode: 'local' as const,
    permissionMode: 'full-access' as const,
    daybreakEnabled: false,
    goal: null,
    model: 'gpt-6.1-sol',
    personality: 'pragmatic' as const,
    reasoningEffort: 'xhigh' as const,
    subagent: 'default',
    updatedAt: '最近',
    tokenUsage: 'Local CLI session',
    diffSummary: {
      files: 0,
      additions: 0,
      deletions: 0,
    },
    turns:
      title === '新聊天'
        ? []
        : [
            {
              id: `turn_recent_${idx}`,
              threadId: `thr_recent_${idx}`,
              status: 'completed' as const,
              startedAt: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
              model: 'gpt-6.1-sol',
              personality: 'pragmatic' as const,
              reasoningEffort: 'xhigh' as const,
              items: [
                {
                  id: `item_usr_recent_${idx}`,
                  type: 'userMessage' as const,
                  status: 'completed' as const,
                  timestamp: '10:00:00',
                  text: title,
                },
              ],
            },
          ],
    changedFiles: [],
  })),
];

export const INITIAL_SKILLS: SkillDefinition[] = [
  {
    id: 'skill_figma_ui',
    slug: 'figma-design-to-code',
    name: 'Figma 设计稿转代码 (Design to Code)',
    category: 'Design & UI',
    description:
      '提取 Figma 设计规范、Auto-Layout 布局与视觉 Token，生成 1:1 还原的 React + Tailwind CSS 组件代码。',
    author: 'OpenAI Codex',
    version: '1.9.2',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/figma-design-to-code/SKILL.md',
    samplePrompt: '使用 $figma-design-to-code 检查并优化当前工作区组件的响应式布局与主题样式。',
    tags: ['Figma', 'React 19', 'Tailwind'],
    content: `---
name: figma-design-to-code
description: 提取设计规范与布局层级，生成高还原度 React + Tailwind CSS 组件。
---
# Figma Design to Code ($figma-design-to-code)

## 执行步骤
1. 检查目标组件的布局层级、间距与色彩变量。
2. 生成语义化 React + Tailwind CSS 代码并保持主题变量兼容。
3. 运行构建校验确保无类型与样式错误。`,
  },
  {
    id: 'skill_linear_triage',
    slug: 'linear-triage',
    name: '缺陷排查与自动修复 (Issue Triage)',
    category: 'Project Ops',
    description:
      '自动定位代码仓库中的异常堆栈与潜在缺陷，在独立 Git Worktree 中生成修复补丁并运行构建验证。',
    author: 'OpenAI Codex',
    version: '1.6.0',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/linear-triage/SKILL.md',
    samplePrompt: '使用 $linear-triage 扫描当前仓库潜在的 TypeScript 类型风险并生成修复方案。',
    tags: ['Bug Triage', 'Worktrees', 'TypeScript'],
    content: `---
name: linear-triage
description: 自动定位缺陷根因、编写修复代码并执行编译验证。
---
# Issue Triage & Fix ($linear-triage)

## 执行步骤
1. 检索关联源码文件并分析问题根因。
2. 实施最小化代码修复并运行 \`npm run build\` 验证。`,
  },
  {
    id: 'skill_cloud_deploy',
    slug: 'cloud-deploy',
    name: '构建预检与云端部署 (Cloud Deploy)',
    category: 'Cloud & DevOps',
    description:
      '执行生产环境构建检查（tsc -b && vite build），验证产物完整性并准备部署配置。',
    author: 'OpenAI Codex',
    version: '2.1.0',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/cloud-deploy/SKILL.md',
    samplePrompt: '使用 $cloud-deploy 执行完整的生产环境构建检查并输出构建体积报告。',
    tags: ['Build', 'Deploy', 'Verification'],
    content: `---
name: cloud-deploy
description: 生产环境构建校验与部署预检技能。
---
# Cloud Deploy ($cloud-deploy)

## 执行步骤
1. 运行 \`npm run build\` 验证 TypeScript 编译与前端打包。
2. 检查产物目录 \`dist/\` 并输出构建结果报告。`,
  },
];

export const INITIAL_AUTOMATIONS: AutomationJob[] = [
  {
    id: 'auto_ci_triage',
    name: '灰太狼 · 自动化巡检与构建守护',
    projectId: 'proj_codex_desktop',
    scheduleCron: '0 9 * * 1-5',
    scheduleLabel: '工作日 09:00',
    prompt:
      '运行 npx tsc --noEmit 检查代码库是否存在类型错误，汇总未提交的 Git 改动并生成简要报告。',
    skills: ['linear-triage'],
    worktreeStrategy: 'isolated_worktree',
    enabled: true,
    lastRunAt: '就绪',
    nextRunAt: '明日 09:00',
    status: 'idle',
    totalRuns: 6,
  },
];

export const INITIAL_REVIEW_QUEUE: ReviewQueueItem[] = [];

export const INITIAL_SUBAGENTS: SubagentConfig[] = [
  {
    id: 'sub_default',
    name: 'default',
    description: '主协调智能体，负责代码规划、读写实现与命令验证。',
    model: 'gpt-6.1-sol',
    sandboxMode: 'full-access',
    developerInstructions: '遵循 AGENTS.md 规范，修改后执行验证。',
    tomlPath: '.codex/agents/default.toml',
    isBuiltIn: true,
    maxConcurrentThreads: 6,
  },
];

export const INITIAL_SANDBOX_POLICY: SandboxPolicy = {
  mode: 'full-access',
  networkAccess: 'enabled',
  approvalPolicy: 'never',
  allowedCommands: [
    'git status',
    'git diff',
    'git log',
    'git worktree list',
    'npm test',
    'npm run build',
    'npx tsc --noEmit',
  ],
  harnessMode: 'local_app_server_cli',
  apiEndpoint: 'https://api.openai.com/v1',
  apiKey: '',
  appServerPort: 4500,
};

export const INITIAL_RPC_LOGS: JsonRpcLogEntry[] = [];
