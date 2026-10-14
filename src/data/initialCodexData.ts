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

export const INITIAL_PROJECTS: ProjectWorkspace[] = [
  {
    id: 'proj_codex_desktop',
    name: 'codex-desktop-app',
    repoPath: '/Users/zhangjinhui/Desktop/codex-test',
    defaultBranch: 'main',
    expanded: true,
  },
  {
    id: 'proj_voxel_velocity',
    name: 'voxel-velocity-3d',
    repoPath: '/Users/zhangjinhui/Desktop/codex-test/examples/voxel-velocity',
    defaultBranch: 'main',
    expanded: true,
  },
  {
    id: 'proj_gateway',
    name: 'app-server-harness',
    repoPath: '/Users/zhangjinhui/Desktop/codex-test/server',
    defaultBranch: 'main',
    expanded: false,
  },
];

export const INITIAL_WORKTREES: WorktreeInfo[] = [
  {
    id: 'wt_main',
    projectId: 'proj_codex_desktop',
    name: 'main (Primary Checkout)',
    branch: 'main',
    path: '/Users/zhangjinhui/Desktop/codex-test',
    headCommit: 'a8f4c21',
    isMain: true,
    status: 'modified',
    boundThreadId: 'thr_multi_pane',
    ahead: 2,
    behind: 0,
    changedFilesCount: 3,
    additions: 148,
    deletions: 24,
    createdAt: '2026-10-13T10:00:00Z',
  },
  {
    id: 'wt_rpc_protocol',
    projectId: 'proj_codex_desktop',
    name: 'wt/jsonrpc-app-server',
    branch: 'feat/jsonrpc-app-server',
    path: '/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/jsonrpc-app-server',
    headCommit: 'e91d04b',
    isMain: false,
    status: 'running',
    boundThreadId: 'thr_approval_demo',
    ahead: 4,
    behind: 0,
    changedFilesCount: 2,
    additions: 96,
    deletions: 12,
    createdAt: '2026-10-13T14:20:00Z',
  },
  {
    id: 'wt_dark_theme',
    projectId: 'proj_codex_desktop',
    name: 'wt/dark-glass-ui',
    branch: 'feat/dark-glass-ui',
    path: '/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/dark-glass-ui',
    headCommit: '7c3b910',
    isMain: false,
    status: 'clean',
    boundThreadId: 'thr_dark_mode',
    ahead: 1,
    behind: 0,
    changedFilesCount: 2,
    additions: 64,
    deletions: 19,
    createdAt: '2026-10-13T16:05:00Z',
  },
  {
    id: 'wt_voxel_racer',
    projectId: 'proj_voxel_velocity',
    name: 'wt/voxel-drift-boost',
    branch: 'feat/drift-boost-tiers',
    path: '/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/voxel-drift-boost',
    headCommit: '3f92a7c',
    isMain: false,
    status: 'modified',
    boundThreadId: 'thr_voxel_game',
    ahead: 5,
    behind: 0,
    changedFilesCount: 2,
    additions: 215,
    deletions: 18,
    createdAt: '2026-10-13T17:30:00Z',
  },
];

export const INITIAL_THREADS: Thread[] = [
  {
    id: 'thr_multi_pane',
    projectId: 'proj_codex_desktop',
    title: 'Implement tiled multi-pane workspace & inline diff review',
    pinned: true,
    status: 'completed',
    worktreeId: 'wt_main',
    branch: 'main',
    model: 'gpt-6.1-sol',
    personality: 'pragmatic',
    reasoningEffort: 'high',
    subagent: 'default',
    updatedAt: '4m ago',
    tokenUsage: '48.2k tokens',
    diffSummary: {
      files: 3,
      additions: 148,
      deletions: 24,
    },
    turns: [
      {
        id: 'turn_101',
        threadId: 'thr_multi_pane',
        status: 'completed',
        startedAt: '2026-10-13T19:15:00Z',
        completedAt: '2026-10-13T19:15:18Z',
        model: 'gpt-6.1-sol',
        personality: 'pragmatic',
        reasoningEffort: 'high',
        items: [
          {
            id: 'item_1',
            type: 'userMessage',
            status: 'completed',
            timestamp: '19:15:00',
            text: 'Add a tiled multi-pane workbench so Chat, Diff Review, Live UI Preview, and Integrated Terminal can stay visible side by side (#33301), and wire up line-level inline diff comments.',
            attachedFiles: ['src/types/codex.ts', 'AGENTS.md'],
            invokedSkills: ['figma-design-to-code'],
          },
          {
            id: 'item_2',
            type: 'reasoning',
            status: 'completed',
            timestamp: '19:15:02',
            durationSeconds: 7,
            reasoningSteps: [
              'Analyzed GitHub Issue #33301 requirements for dockable/resizable multi-pane workspace layouts in Codex Desktop.',
              'Delegated codebase structure scan to `explorer` subagent to map existing right-inspector tabs (`diff`, `files`, `terminal`, `preview`, `worktrees`).',
              'Designed unified & split side-by-side diff viewer with per-line comment anchoring (`InlineDiffComment`) and one-click "Submit Review to Agent" turn dispatch.',
            ],
          },
          {
            id: 'item_3',
            type: 'subagentRun',
            status: 'completed',
            timestamp: '19:15:05',
            subagentName: 'explorer',
            subagentTask: 'Scan workspace layout state & diff viewer components across src/',
            subagentTokens: '6.4k tokens',
          },
          {
            id: 'item_4',
            type: 'commandExecution',
            status: 'completed',
            timestamp: '19:15:09',
            command: 'git status --short && npx tsc --noEmit',
            cwd: '/Users/zhangjinhui/Desktop/codex-test',
            exitCode: 0,
            stdout: 'M src/components/RightInspectorPane.tsx\nM src/components/TopCommandBar.tsx\nM src/types/codex.ts\nTypecheck passed (0 errors).',
          },
          {
            id: 'item_5',
            type: 'fileChange',
            status: 'completed',
            timestamp: '19:15:12',
            filePath: 'src/components/RightInspectorPane.tsx',
            changeType: 'modified',
            additions: 92,
            deletions: 14,
            summary: 'Added Unified/Split Diff toggle, inline line comment composer, hunk stage/revert controls, and 4-pane tiled grid mode.',
          },
          {
            id: 'item_6',
            type: 'fileChange',
            status: 'completed',
            timestamp: '19:15:14',
            filePath: 'src/components/TopCommandBar.tsx',
            changeType: 'modified',
            additions: 38,
            deletions: 6,
            summary: 'Added workspace layout switcher (Standard 3-Pane, Tiled 4-Pane, Focus Chat, Review Zen) and active parallel agents badge.',
          },
          {
            id: 'item_7',
            type: 'fileChange',
            status: 'completed',
            timestamp: '19:15:15',
            filePath: 'server/app-server.mjs',
            changeType: 'modified',
            additions: 18,
            deletions: 4,
            summary: 'Exposed JSON-RPC 2.0 Lite `turn/steer` and `thread/start` notifications over stdio and HTTP bridge.',
          },
          {
            id: 'item_8',
            type: 'agentMessage',
            status: 'completed',
            timestamp: '19:15:18',
            text: 'I have implemented the **Tiled Multi-Pane Workbench** and **Inline Diff Review** flow:\n\n1. **Multi-Pane Layout Modes**: Switch between **Standard 3-Pane**, **Tiled 4-Pane Workbench** (simultaneous Diff + Live Preview + Terminal + Source), **Focus Chat**, and **Review Zen** directly from the top command bar.\n2. **Unified & Split Diff Reviewer**: Click any line in the diff viewer to attach an inline review comment, stage/revert individual hunks, or click **Submit Review to Agent** to dispatch all line comments into a follow-up fix turn.\n3. **Worktree Isolation**: Active changes are tracked on `main` and isolated worktrees under `.codex/worktrees/`.',
          },
        ],
      },
    ],
    changedFiles: [
      {
        id: 'diff_inspector',
        filePath: 'src/components/RightInspectorPane.tsx',
        status: 'modified',
        additions: 92,
        deletions: 14,
        staged: true,
        language: 'tsx',
        comments: [
          {
            id: 'cmt_1',
            filePath: 'src/components/RightInspectorPane.tsx',
            lineNumber: 44,
            side: 'new',
            author: 'zhangjinhui',
            body: 'Let’s make sure keyboard shortcut Cmd+Shift+D also toggles between Unified and Split diff view.',
            createdAt: '2m ago',
          },
        ],
        hunks: [
          {
            id: 'hunk_1',
            header: '@@ -38,9 +38,19 @@ export function RightInspectorPane({ layoutMode, activeThread }) {',
            staged: true,
            lines: [
              { type: 'context', oldLineNumber: 38, newLineNumber: 38, content: '  const [diffViewMode, setDiffViewMode] = useState<"unified" | "split">("unified");' },
              { type: 'del', oldLineNumber: 39, content: '  const [selectedFile, setSelectedFile] = useState<string | null>(null);' },
              { type: 'add', newLineNumber: 39, content: '  const [selectedFile, setSelectedFile] = useState<string>(changedFiles[0]?.filePath || "");' },
              { type: 'add', newLineNumber: 40, content: '  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);' },
              { type: 'context', oldLineNumber: 40, newLineNumber: 41, content: '' },
              { type: 'add', newLineNumber: 42, content: '  // Support tiled 2x2 workbench for simultaneous Diff + Preview + Terminal + Files' },
              { type: 'add', newLineNumber: 43, content: '  const isTiledWorkbench = layoutMode === "tiled_4pane";' },
              { type: 'add', newLineNumber: 44, content: '  const pendingCommentsCount = changedFiles.reduce((acc, f) => acc + f.comments.length, 0);' },
              { type: 'context', oldLineNumber: 41, newLineNumber: 45, content: '  return (' },
            ],
          },
          {
            id: 'hunk_2',
            header: '@@ -112,6 +122,16 @@ export function RightInspectorPane({ layoutMode, activeThread }) {',
            staged: false,
            lines: [
              { type: 'context', oldLineNumber: 112, newLineNumber: 122, content: '      <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2">' },
              { type: 'del', oldLineNumber: 113, content: '        <span className="text-xs text-slate-400">Changed Files</span>' },
              { type: 'add', newLineNumber: 123, content: '        <span className="text-xs font-medium text-emerald-400">' },
              { type: 'add', newLineNumber: 124, content: '          {changedFiles.length} Changed Files (+{totalAdd} -{totalDel})' },
              { type: 'add', newLineNumber: 125, content: '        </span>' },
              { type: 'add', newLineNumber: 126, content: '        <button onClick={onSendReviewComments} className="btn-codex-primary">' },
              { type: 'add', newLineNumber: 127, content: '          Submit Review ({pendingCommentsCount})' },
              { type: 'add', newLineNumber: 128, content: '        </button>' },
              { type: 'context', oldLineNumber: 114, newLineNumber: 129, content: '      </div>' },
            ],
          },
        ],
      },
      {
        id: 'diff_topbar',
        filePath: 'src/components/TopCommandBar.tsx',
        status: 'modified',
        additions: 38,
        deletions: 6,
        staged: true,
        language: 'tsx',
        comments: [],
        hunks: [
          {
            id: 'hunk_top_1',
            header: '@@ -14,7 +14,15 @@ export function TopCommandBar({ surface, onSurfaceChange }) {',
            staged: true,
            lines: [
              { type: 'context', oldLineNumber: 14, newLineNumber: 14, content: '  return (' },
              { type: 'del', oldLineNumber: 15, content: '    <header className="h-11 bg-[#0E1017] border-b border-slate-800">' },
              { type: 'add', newLineNumber: 15, content: '    <header className="h-11 bg-[#0E1017]/95 backdrop-blur border-b border-slate-800/80 app-drag-region">' },
              { type: 'add', newLineNumber: 16, content: '      <SurfaceToggle active={surface} onChange={onSurfaceChange} />' },
              { type: 'add', newLineNumber: 17, content: '      <WorktreeIndicator branch={activeWorktree.branch} status={activeWorktree.status} />' },
              { type: 'context', oldLineNumber: 16, newLineNumber: 18, content: '    </header>' },
            ],
          },
        ],
      },
      {
        id: 'diff_app_server',
        filePath: 'server/app-server.mjs',
        status: 'modified',
        additions: 18,
        deletions: 4,
        staged: false,
        language: 'javascript',
        comments: [],
        hunks: [
          {
            id: 'hunk_srv_1',
            header: '@@ -88,6 +88,14 @@ async function handleJsonRpcMessage(msg) {',
            staged: false,
            lines: [
              { type: 'context', oldLineNumber: 88, newLineNumber: 88, content: '  if (method === "turn/steer") {' },
              { type: 'add', newLineNumber: 89, content: '    return {' },
              { type: 'add', newLineNumber: 90, content: '      id,' },
              { type: 'add', newLineNumber: 91, content: '      result: { steered: true, threadId: params.threadId, turnId: params.turnId },' },
              { type: 'add', newLineNumber: 92, content: '    };' },
              { type: 'context', oldLineNumber: 89, newLineNumber: 93, content: '  }' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'thr_approval_demo',
    projectId: 'proj_codex_desktop',
    title: 'Wire WebSocket capability-token auth & remote Code Mode host',
    pinned: true,
    status: 'waiting_approval',
    worktreeId: 'wt_rpc_protocol',
    branch: 'feat/jsonrpc-app-server',
    model: 'gpt-6.1-sol',
    personality: 'pragmatic',
    reasoningEffort: 'max',
    subagent: 'worker',
    updatedAt: 'Just now',
    tokenUsage: '31.7k tokens',
    diffSummary: {
      files: 2,
      additions: 96,
      deletions: 12,
    },
    turns: [
      {
        id: 'turn_201',
        threadId: 'thr_approval_demo',
        status: 'waiting_approval',
        startedAt: '2026-10-13T19:38:00Z',
        model: 'gpt-6.1-sol',
        personality: 'pragmatic',
        reasoningEffort: 'max',
        items: [
          {
            id: 'item_201_1',
            type: 'userMessage',
            status: 'completed',
            timestamp: '19:38:00',
            text: 'Add `--ws-auth capability-token` verification to `server/app-server.mjs` and run an integration test against `ws://127.0.0.1:4500`.',
            attachedFiles: ['server/app-server.mjs'],
            invokedSkills: [],
          },
          {
            id: 'item_201_2',
            type: 'reasoning',
            status: 'completed',
            timestamp: '19:38:03',
            durationSeconds: 5,
            reasoningSteps: [
              'Checked Codex App Server protocol specification for `--ws-auth capability-token` and SHA-256 token verification before `initialize` handshake.',
              'Patched `server/app-server.mjs` in isolated worktree `wt/jsonrpc-app-server` to enforce `Authorization: Bearer <token>` on WebSocket upgrades.',
              'Preparing to bind local port 4500 and run live WebSocket handshake probe — requires sandbox approval because network listener binding is restricted under `workspace-write` policy.',
            ],
          },
          {
            id: 'item_201_3',
            type: 'fileChange',
            status: 'completed',
            timestamp: '19:38:07',
            filePath: 'server/app-server.mjs',
            changeType: 'modified',
            additions: 96,
            deletions: 12,
            summary: 'Added capability-token SHA-256 verification and JSON-RPC `-32001` overload backpressure queue.',
          },
          {
            id: 'item_201_4',
            type: 'approvalRequest',
            status: 'waiting_approval',
            timestamp: '19:38:09',
            approvalId: 'appr_ws_probe_01',
            approvalCommand: 'node server/app-server.mjs --listen ws://127.0.0.1:4500 --ws-auth capability-token',
            approvalReason: 'Agent wants to bind a local TCP/WebSocket listener on 127.0.0.1:4500 and run an external handshake probe.',
            riskLevel: 'medium',
            sandboxRuleTriggered: 'network_access = false (requires elevated local socket bind permission)',
          },
        ],
      },
    ],
    changedFiles: [
      {
        id: 'diff_ws_auth',
        filePath: 'server/app-server.mjs',
        status: 'modified',
        additions: 96,
        deletions: 12,
        staged: false,
        language: 'javascript',
        comments: [],
        hunks: [
          {
            id: 'hunk_ws_1',
            header: '@@ -24,6 +24,18 @@ const serverState = {',
            staged: false,
            lines: [
              { type: 'context', oldLineNumber: 24, newLineNumber: 24, content: 'const serverState = {' },
              { type: 'add', newLineNumber: 25, content: '  wsAuthMode: "capability-token",' },
              { type: 'add', newLineNumber: 26, content: '  maxIngressQueueDepth: 64,' },
              { type: 'add', newLineNumber: 27, content: '  verifyBearerToken(header) {' },
              { type: 'add', newLineNumber: 28, content: '    return typeof header === "string" && header.startsWith("Bearer codex_cap_");' },
              { type: 'add', newLineNumber: 29, content: '  },' },
              { type: 'context', oldLineNumber: 25, newLineNumber: 30, content: '  initialized: false,' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'thr_voxel_game',
    projectId: 'proj_voxel_velocity',
    title: 'Build Voxel Velocity 3D Kart Racer with drift-charge boost tiers',
    pinned: false,
    status: 'completed',
    worktreeId: 'wt_voxel_racer',
    branch: 'feat/drift-boost-tiers',
    model: 'gpt-6.1-sol',
    personality: 'empathetic',
    reasoningEffort: 'max',
    subagent: 'default',
    updatedAt: '18m ago',
    tokenUsage: '142.8k tokens',
    diffSummary: {
      files: 2,
      additions: 215,
      deletions: 18,
    },
    turns: [
      {
        id: 'turn_301',
        threadId: 'thr_voxel_game',
        status: 'completed',
        startedAt: '2026-10-13T18:50:00Z',
        completedAt: '2026-10-13T18:52:10Z',
        model: 'gpt-6.1-sol',
        personality: 'empathetic',
        reasoningEffort: 'max',
        items: [
          {
            id: 'item_301_1',
            type: 'userMessage',
            status: 'completed',
            timestamp: '18:50:00',
            text: 'Use $develop-web-game to build Voxel Velocity as an arcade 3D kart racer in Single Race mode (3 laps, 8 racers, 8 tracks, drift-charge system with Tier 1 0.7s / Tier 2 1.1s / Tier 3 1.5s boosts, and item slots) and wire it into the Live Preview panel so we can playtest it directly inside Codex Desktop.',
            attachedFiles: ['.codex/skills/develop-web-game/SKILL.md'],
            invokedSkills: ['develop-web-game'],
          },
          {
            id: 'item_301_2',
            type: 'reasoning',
            status: 'completed',
            timestamp: '18:50:08',
            durationSeconds: 11,
            reasoningSteps: [
              'Loaded `$develop-web-game` skill instructions and designed a responsive pseudo-3D / voxel projection kart engine in HTML5 Canvas.',
              'Implemented 3-tier drift charge physics (Tier 1: 0.7s cyan spark, Tier 2: 1.1s amber flame, Tier 3: 1.5s magenta ultra-boost) and 50% off-road penalty reduction while boosting.',
              'Added 8 selectable tracks, 8 character builds, live minimap, lap/split HUD, and CPU AI pack racing splines.',
            ],
          },
          {
            id: 'item_301_3',
            type: 'fileChange',
            status: 'completed',
            timestamp: '18:51:40',
            filePath: 'src/components/RightInspectorPane.tsx',
            changeType: 'modified',
            additions: 195,
            deletions: 12,
            summary: 'Embedded playable Voxel Velocity 3D Kart Racer canvas inside the In-App Live Browser Preview pane.',
          },
          {
            id: 'item_301_4',
            type: 'agentMessage',
            status: 'completed',
            timestamp: '18:52:10',
            text: 'I have built **Voxel Velocity 3D Kart Racer** using `$develop-web-game` and mounted it directly inside the **Live Preview** tab on the right panel!\n\nYou can switch the right inspector to **Preview -> Voxel Velocity 3D (Playable)** right now to select your track/character, drive with **Arrow Keys / WASD**, hold **Shift** while steering to charge **Tier 1 / 2 / 3 Drift Boosts**, and press **Space** to fire items.',
          },
        ],
      },
    ],
    changedFiles: [
      {
        id: 'diff_voxel_1',
        filePath: 'examples/voxel-velocity/engine.ts',
        status: 'added',
        additions: 215,
        deletions: 18,
        staged: true,
        language: 'typescript',
        comments: [],
        hunks: [
          {
            id: 'hunk_vx_1',
            header: '@@ -1,4 +1,18 @@ // Voxel Velocity Arcade Drift Engine',
            staged: true,
            lines: [
              { type: 'add', newLineNumber: 1, content: 'export const DRIFT_BOOST_TIERS = {' },
              { type: 'add', newLineNumber: 2, content: '  tier1: { chargeSeconds: 0.6, duration: 0.7, speedMultiplier: 1.28, color: "#22d3ee" },' },
              { type: 'add', newLineNumber: 3, content: '  tier2: { chargeSeconds: 1.3, duration: 1.1, speedMultiplier: 1.45, color: "#f59e0b" },' },
              { type: 'add', newLineNumber: 4, content: '  tier3: { chargeSeconds: 2.1, duration: 1.5, speedMultiplier: 1.68, color: "#ec4899" },' },
              { type: 'add', newLineNumber: 5, content: '};' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'thr_dark_mode',
    projectId: 'proj_codex_desktop',
    title: 'Refine macOS traffic-light header & Cmd+K command palette shortcuts',
    pinned: false,
    status: 'completed',
    worktreeId: 'wt_dark_theme',
    branch: 'feat/dark-glass-ui',
    model: 'gpt-6-luna',
    personality: 'pragmatic',
    reasoningEffort: 'medium',
    subagent: 'worker',
    updatedAt: '2h ago',
    tokenUsage: '19.4k tokens',
    diffSummary: {
      files: 2,
      additions: 64,
      deletions: 19,
    },
    turns: [
      {
        id: 'turn_401',
        threadId: 'thr_dark_mode',
        status: 'completed',
        startedAt: '2026-10-13T17:10:00Z',
        completedAt: '2026-10-13T17:10:12Z',
        model: 'gpt-6-luna',
        personality: 'pragmatic',
        reasoningEffort: 'medium',
        items: [
          {
            id: 'item_401_1',
            type: 'userMessage',
            status: 'completed',
            timestamp: '17:10:00',
            text: 'Polish the dark glassmorphism sidebar and add Cmd+K global command palette navigation.',
          },
          {
            id: 'item_401_2',
            type: 'reasoning',
            status: 'completed',
            timestamp: '17:10:02',
            durationSeconds: 3,
            reasoningSteps: [
              'Configured keyboard listener for `Meta+K` / `Ctrl+K` to toggle CommandPaletteModal.',
              'Aligned border contrast (`#222736`) and surface elevation (`#090A0F` -> `#0E1017` -> `#12151E`).',
            ],
          },
          {
            id: 'item_401_3',
            type: 'agentMessage',
            status: 'completed',
            timestamp: '17:10:12',
            text: 'Updated the header drag regions and bound `Cmd+K` (`Ctrl+K`) to open the quick command & thread switcher.',
          },
        ],
      },
    ],
    changedFiles: [],
  },
];

export const INITIAL_SKILLS: SkillDefinition[] = [
  {
    id: 'skill_web_game',
    slug: 'develop-web-game',
    name: 'Develop Web Game',
    category: 'Creative & Games',
    description: 'Autonomous 3D/2D WebGL & Canvas game development with arcade physics, drift mechanics, HUD, audio loop, and automated playtest QA.',
    author: 'OpenAI Codex Team',
    version: '2.4.0',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/develop-web-game/SKILL.md',
    samplePrompt: 'Use $develop-web-game to add a new Rainbow Cyber Circuit track and lightning item to Voxel Velocity.',
    tags: ['Three.js', 'WebGL', 'Game Loop', 'Playtest QA'],
    content: `---
name: develop-web-game
description: Autonomous end-to-end 3D/2D WebGL & Three.js game development skill with physics, drift mechanics, HUD, audio loop, and automated playtest verification.
---
# Develop Web Game Skill ($develop-web-game)

## Instructions
1. Scaffold a deterministic 60FPS requestAnimationFrame game loop with responsive controls.
2. Implement arcade drift-charge boost tiers (Tier 1 0.7s, Tier 2 1.1s, Tier 3 1.5s) and forgiving wall collisions.
3. Launch the Codex Live Preview browser to playtest and verify HUD telemetry before completing the turn.`,
  },
  {
    id: 'skill_figma_ui',
    slug: 'figma-design-to-code',
    name: 'Figma Design to Code',
    category: 'Design & UI',
    description: 'Fetch design context, auto-layout tokens, assets, and screenshots from Figma and translate them into production React + Tailwind code with 1:1 visual parity.',
    author: 'OpenAI Codex Team',
    version: '1.9.2',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/figma-design-to-code/SKILL.md',
    samplePrompt: 'Use $figma-design-to-code to convert the new Workbench Inspector Figma frame into responsive React components.',
    tags: ['Figma', 'React 19', 'Tailwind', '1:1 Parity'],
    content: `---
name: figma-design-to-code
description: Fetch Figma design tokens, auto-layout frames, and vector assets to generate pixel-accurate React + Tailwind CSS components.
---
# Figma Design to Code ($figma-design-to-code)

## Instructions
1. Inspect node hierarchy, spacing tokens, and typography scales.
2. Synthesize accessible React + Tailwind components with hover/focus/active states.
3. Verify visual parity in the Live Preview viewport across Desktop and Mobile breakpoints.`,
  },
  {
    id: 'skill_linear_triage',
    slug: 'linear-triage',
    name: 'Linear Issue Triage & Fix',
    category: 'Project Ops',
    description: 'Triage bug backlogs, localize root causes with the explorer subagent, track releases, and spawn isolated Git worktrees for automated PR fixes.',
    author: 'OpenAI Codex Team',
    version: '1.6.0',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/linear-triage/SKILL.md',
    samplePrompt: 'Use $linear-triage to scan open P0/P1 regressions, localize root causes, and prepare worktree patches.',
    tags: ['Linear', 'Bug Triage', 'Worktrees', 'Release Ops'],
    content: `---
name: linear-triage
description: Automated issue triage, root-cause localization, severity labeling, and worktree fix generation connected to Linear team backlogs.
---
# Linear Issue Triage & Fix ($linear-triage)

## Instructions
1. Query open Linear issues and reproduce stack traces using the \`explorer\` subagent.
2. Create an isolated Git worktree (\`wt/linear-<id>\`) for each verified bug and assign a \`worker\` subagent.
3. Push completed diffs to the Codex Review Queue with root-cause notes.`,
  },
  {
    id: 'skill_cloud_deploy',
    slug: 'cloud-deploy',
    name: 'Deploy to Cloud Hosts',
    category: 'Cloud & DevOps',
    description: 'Run build preflight checks, request sandbox network approval, and deploy web apps to Vercel, Cloudflare Pages, Netlify, or Render.',
    author: 'OpenAI Codex Team',
    version: '2.1.0',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/cloud-deploy/SKILL.md',
    samplePrompt: 'Use $cloud-deploy to run production build verification and deploy a preview environment to Cloudflare Pages.',
    tags: ['Vercel', 'Cloudflare', 'Netlify', 'Render'],
    content: `---
name: cloud-deploy
description: Build verification, environment preflight check, and zero-downtime preview deployment to Vercel, Cloudflare, Netlify, or Render.
---
# Cloud Deploy ($cloud-deploy)

## Instructions
1. Execute \`npm run build\` and verify zero TypeScript or bundler errors.
2. Request explicit user approval for outbound deployment CLI network access.
3. Return the verified preview URL and build artifact metrics.`,
  },
  {
    id: 'skill_openai_docs',
    slug: 'openai-api-docs',
    name: 'Build with OpenAI APIs & App-Server',
    category: 'Engineering',
    description: 'Reference up-to-date OpenAI Responses API, Agents SDK, GPT-6.1 Sol, and Codex app-server JSON-RPC 2.0 schemas when writing integration code.',
    author: 'OpenAI Codex Team',
    version: '3.0.1',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/openai-api-docs/SKILL.md',
    samplePrompt: 'Use $openai-api-docs to generate TypeScript bindings for `codex app-server` thread/start and turn/steer methods.',
    tags: ['Responses API', 'App-Server', 'JSON-RPC', 'GPT-6.1 Sol'],
    content: `---
name: openai-api-docs
description: Reference authoritative OpenAI API, Responses API, and Codex app-server protocol specifications.
---
# Build with OpenAI APIs ($openai-api-docs)

## Instructions
1. Validate JSON-RPC 2.0 Lite message schemas (omitting "jsonrpc":"2.0" header over stdio JSONL).
2. Enforce \`initialize\` -> \`initialized\` handshake before \`thread/start\` and \`turn/start\`.`,
  },
  {
    id: 'skill_doc_suite',
    slug: 'doc-sheet-generator',
    name: 'Create Documents, Sheets & Decks',
    category: 'Documents',
    description: 'Read, synthesize, and generate structured PDF reports, XLSX financial/tracker spreadsheets, and DOCX architecture specifications.',
    author: 'OpenAI Codex Team',
    version: '1.4.5',
    enabled: true,
    builtIn: true,
    path: '.codex/skills/doc-sheet-generator/SKILL.md',
    samplePrompt: 'Use $doc-sheet-generator to compile our weekly release readiness brief and benchmark scorecard.',
    tags: ['PDF', 'XLSX', 'DOCX', 'Architecture PRD'],
    content: `---
name: doc-sheet-generator
description: Read, create, and edit PDF, spreadsheet, and docx files with professional formatting and layouts.
---
# Document & Spreadsheet Suite ($doc-sheet-generator)

## Instructions
1. Gather repository metrics, changelog commits, and test coverage statistics.
2. Produce clean executive tables and export formatted deliverables.`,
  },
];

export const INITIAL_AUTOMATIONS: AutomationJob[] = [
  {
    id: 'auto_ci_triage',
    name: 'Daily CI Failure Triage & Patch Proposal',
    projectId: 'proj_codex_desktop',
    scheduleCron: '0 8 * * 1-5',
    scheduleLabel: 'Weekdays at 08:00 AM',
    prompt: 'Scan recent failed CI runs, localize flaky or broken tests using the explorer subagent, create an isolated worktree fix, and send the diff to the Review Queue.',
    skills: ['linear-triage'],
    worktreeStrategy: 'isolated_worktree',
    enabled: true,
    lastRunAt: 'Today, 08:00 AM',
    nextRunAt: 'Tomorrow, 08:00 AM',
    status: 'succeeded',
    totalRuns: 42,
  },
  {
    id: 'auto_release_brief',
    name: 'Morning Release Readiness & PR Review Brief',
    projectId: 'proj_codex_desktop',
    scheduleCron: '30 8 * * *',
    scheduleLabel: 'Daily at 08:30 AM',
    prompt: 'Summarize all merged commits, open worktrees, backward-compatibility risks, and pending security approvals across the repo.',
    skills: ['doc-sheet-generator'],
    worktreeStrategy: 'read_only_main',
    enabled: true,
    lastRunAt: 'Today, 08:30 AM',
    nextRunAt: 'Tomorrow, 08:30 AM',
    status: 'succeeded',
    totalRuns: 67,
  },
  {
    id: 'auto_security_scan',
    name: 'Nightly Codex Security & Sandbox Policy Audit',
    projectId: 'proj_codex_desktop',
    scheduleCron: '0 2 * * *',
    scheduleLabel: 'Daily at 02:00 AM',
    prompt: 'Audit server/app-server.mjs and electron/main.cjs for path traversal, unauthenticated WebSocket upgrades, or overly permissive sandbox rules.',
    skills: ['openai-api-docs'],
    worktreeStrategy: 'isolated_worktree',
    enabled: true,
    lastRunAt: 'Today, 02:00 AM',
    nextRunAt: 'Tomorrow, 02:00 AM',
    status: 'succeeded',
    totalRuns: 19,
  },
];

export const INITIAL_REVIEW_QUEUE: ReviewQueueItem[] = [
  {
    id: 'rq_1',
    automationId: 'auto_ci_triage',
    automationName: 'Daily CI Failure Triage & Patch Proposal',
    projectId: 'proj_codex_desktop',
    worktreeBranch: 'wt/auto-ci-fix-oct13',
    title: 'Fix race condition in WebSocket reconnect backoff & add unit test',
    summary: 'Detected intermittent timeout in `appServerClient.ts` when `app-server` returns `-32001 Server overloaded`. Added exponential backoff with jitter (`200ms * 2^attempt + jitter`) and verified with 50 concurrent replay turns.',
    createdAt: 'Today, 08:04 AM',
    status: 'pending_review',
    diffSummary: {
      files: 2,
      additions: 44,
      deletions: 9,
    },
    files: [
      {
        id: 'rq_diff_1',
        filePath: 'src/services/appServerClient.ts',
        status: 'modified',
        additions: 44,
        deletions: 9,
        staged: true,
        language: 'typescript',
        comments: [],
        hunks: [
          {
            id: 'rq_hunk_1',
            header: '@@ -52,7 +52,18 @@ export async function sendRpcWithBackoff(payload: unknown, retries = 3) {',
            staged: true,
            lines: [
              { type: 'context', oldLineNumber: 52, newLineNumber: 52, content: '  for (let attempt = 0; attempt <= retries; attempt++) {' },
              { type: 'del', oldLineNumber: 53, content: '    const res = await postRpc(payload);' },
              { type: 'add', newLineNumber: 53, content: '    const res = await postRpc(payload);' },
              { type: 'add', newLineNumber: 54, content: '    if (res?.error?.code === -32001 && attempt < retries) {' },
              { type: 'add', newLineNumber: 55, content: '      const delayMs = 200 * Math.pow(2, attempt) + Math.floor(Math.random() * 80);' },
              { type: 'add', newLineNumber: 56, content: '      await new Promise((r) => setTimeout(r, delayMs));' },
              { type: 'add', newLineNumber: 57, content: '      continue;' },
              { type: 'add', newLineNumber: 58, content: '    }' },
              { type: 'context', oldLineNumber: 54, newLineNumber: 59, content: '    return res;' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'rq_2',
    automationId: 'auto_security_scan',
    automationName: 'Nightly Codex Security & Sandbox Policy Audit',
    projectId: 'proj_codex_desktop',
    worktreeBranch: 'wt/auto-sec-hardening',
    title: 'Harden /healthz Origin header validation & workspace path normalization',
    summary: 'Verified that `/healthz` rejects cross-origin browser probes with `403 Forbidden` and enforced `path.resolve` prefix checks on `/api/fs/read` and `/api/fs/write`.',
    createdAt: 'Today, 02:03 AM',
    status: 'pending_review',
    diffSummary: {
      files: 1,
      additions: 28,
      deletions: 4,
    },
    files: [
      {
        id: 'rq_diff_2',
        filePath: 'server/app-server.mjs',
        status: 'modified',
        additions: 28,
        deletions: 4,
        staged: true,
        language: 'javascript',
        comments: [],
        hunks: [
          {
            id: 'rq_hunk_2',
            header: '@@ -154,6 +154,12 @@ if (req.method === "GET" && url.pathname === "/healthz") {',
            staged: true,
            lines: [
              { type: 'add', newLineNumber: 154, content: '  if (req.headers.origin) {' },
              { type: 'add', newLineNumber: 155, content: '    res.writeHead(403, { "Content-Type": "text/plain" });' },
              { type: 'add', newLineNumber: 156, content: '    res.end("403 Forbidden: Origin header not permitted on /healthz");' },
              { type: 'add', newLineNumber: 157, content: '    return;' },
              { type: 'add', newLineNumber: 158, content: '    return;' },
            ],
          },
        ],
      },
    ],
  },
];

export const INITIAL_SUBAGENTS: SubagentConfig[] = [
  {
    id: 'sub_default',
    name: 'default',
    description: 'Primary orchestrator agent that plans tasks, coordinates worker/explorer subagents, edits code, and manages human-in-the-loop approvals.',
    model: 'gpt-6.1-sol',
    sandboxMode: 'workspace-write',
    tomlPath: '.codex/agents/default.toml',
    isBuiltIn: true,
    maxConcurrentThreads: 6,
    developerInstructions:
      'You are the primary Codex orchestrator agent. Break complex engineering goals into verifiable steps, delegate read-heavy discovery to `explorer` and isolated implementation subtasks to `worker` subagents, and present clean diffs for review.',
  },
  {
    id: 'sub_worker',
    name: 'worker',
    description: 'Execution-focused implementation subagent that writes code, refactors modules, and runs unit tests in an isolated Git worktree.',
    model: 'gpt-6.1-sol',
    sandboxMode: 'workspace-write',
    tomlPath: '.codex/agents/worker.toml',
    isBuiltIn: true,
    maxConcurrentThreads: 4,
    developerInstructions:
      'Focus on surgical code changes and test execution within your assigned worktree. Minimize prose and return verified file diffs.',
  },
  {
    id: 'sub_explorer',
    name: 'explorer',
    description: 'High-speed read-only codebase reconnaissance subagent for tracing call graphs, searching symbols, and auditing dependencies.',
    model: 'gpt-6-luna',
    sandboxMode: 'read-only',
    tomlPath: '.codex/agents/explorer.toml',
    isBuiltIn: true,
    maxConcurrentThreads: 8,
    developerInstructions:
      'Rapidly scan files, grep symbols, and summarize architectural findings without modifying any files.',
  },
  {
    id: 'sub_security',
    name: 'security-auditor',
    description: 'Specialized Codex Security subagent for threat modeling, sandbox boundary verification, and dependency vulnerability triage.',
    model: 'gpt-6.1-sol',
    sandboxMode: 'read-only',
    tomlPath: '.codex/agents/security-auditor.toml',
    isBuiltIn: false,
    maxConcurrentThreads: 2,
    developerInstructions:
      'Perform deep security review across IPC bridges, shell execution endpoints, and authentication handlers. Flag any CWE/OWASP findings with minimal PoC and remediation diff.',
  },
];

export const INITIAL_SANDBOX_POLICY: SandboxPolicy = {
  mode: 'workspace-write',
  networkAccess: 'disabled',
  approvalPolicy: 'on-risk',
  allowedCommands: [
    'git status',
    'git diff',
    'git log -n 5',
    'git worktree list',
    'npm run build',
    'npx tsc --noEmit',
  ],
  harnessMode: 'hybrid_simulator',
  apiEndpoint: 'https://api.openai.com/v1',
  apiKey: '',
  appServerPort: 4500,
};

export const INITIAL_RPC_LOGS: JsonRpcLogEntry[] = [
  {
    id: 'rpc_1',
    timestamp: '19:14:58.102',
    direction: 'client->server',
    method: 'initialize',
    payload: {
      method: 'initialize',
      id: 0,
      params: {
        clientInfo: {
          name: 'codex_desktop',
          title: 'OpenAI Codex Desktop App',
          version: '1.0.0',
        },
        capabilities: {
          experimentalApi: true,
          optOutNotificationMethods: [],
        },
      },
    },
  },
  {
    id: 'rpc_2',
    timestamp: '19:14:58.118',
    direction: 'server->client',
    method: 'initialize:result',
    payload: {
      id: 0,
      result: {
        userAgent: 'codex_desktop/1.0.0 (Mac OS 26.2.0; arm64) codex-app-server/0.160.0',
        platformFamily: 'unix',
        platformOs: 'macos',
      },
    },
  },
  {
    id: 'rpc_3',
    timestamp: '19:14:58.120',
    direction: 'client->server',
    method: 'initialized',
    payload: {
      method: 'initialized',
      params: {},
    },
  },
  {
    id: 'rpc_4',
    timestamp: '19:38:00.210',
    direction: 'client->server',
    method: 'turn/start',
    payload: {
      method: 'turn/start',
      id: 14,
      params: {
        threadId: 'thr_approval_demo',
        model: 'gpt-6.1-sol',
        personality: 'pragmatic',
        cwd: '/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/jsonrpc-app-server',
        input: [
          {
            type: 'text',
            text: 'Add --ws-auth capability-token verification to server/app-server.mjs and run an integration test.',
          },
        ],
      },
    },
  },
  {
    id: 'rpc_5',
    timestamp: '19:38:09.405',
    direction: 'server-request',
    method: 'approval/request',
    payload: {
      id: 901,
      method: 'approval/request',
      params: {
        threadId: 'thr_approval_demo',
        turnId: 'turn_201',
        itemId: 'item_201_4',
        command: 'node server/app-server.mjs --listen ws://127.0.0.1:4500 --ws-auth capability-token',
        reason: 'Requires local TCP/WebSocket listener bind outside default sandbox policy',
      },
    },
  },
];
