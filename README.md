# OpenAI Codex Desktop App — Multi-Agent Command Center (Full Replication)

A complete, production-grade desktop replication of the **OpenAI Codex Desktop App ("A Command Center for Agents")**, built with **Electron + React 19 + TypeScript + Tailwind CSS** and a bidirectional **JSON-RPC 2.0 Lite `codex app-server`** backend.

## Architecture & Completed Modules (Phases 1–5)

### Phase 1: Desktop Host, Config & Protocol Primitives
- **Electron Desktop Host** (`electron/main.cjs`, `electron/preload.cjs`): macOS/Windows native window with traffic-light header integration (`hiddenInset`), external editor launcher (`VS Code` / `Cursor`), and child-process `codex app-server` stdio bridge.
- **Repository Configuration (`.codex/` & `AGENTS.md`)**:
  - `.codex/config.toml`: Model (`gpt-6.1-sol`), personality (`pragmatic` / `empathetic`), reasoning effort, and OS sandbox policy.
  - `.codex/agents/*.toml`: Built-in subagent profiles (`default`, `worker`, `explorer`).
  - `.codex/skills/*/SKILL.md`: Pre-bundled OpenAI skills (`$develop-web-game`, `$figma-design-to-code`, `$linear-triage`, `$cloud-deploy`).
  - `AGENTS.md`: Project-level instructions loaded into every agent turn.

### Phase 2: Bidirectional JSON-RPC 2.0 Lite `app-server` & Hybrid Harness
- **Standalone & Embedded App-Server (`server/app-server.mjs`)**:
  - Supports `--listen stdio://` (JSONL over stdin/stdout) and HTTP/REST/JSON-RPC bridge on `http://127.0.0.1:4500` (`/readyz`, `/healthz` with strict Origin check, `/api/rpc`, `/api/fs/tree`, `/api/fs/read`, `/api/fs/write`, `/api/terminal/exec`).
  - Implements OpenAI's conversation primitives: **Handshake** (`initialize` $\rightarrow$ `initialized`), **Thread** (`thread/start`, `thread/fork`, `thread/revert`), **Turn** (`turn/start`, `turn/steer`, `turn/interrupt`), and **Item** (`item/started` $\rightarrow$ `item/agentMessage/delta` $\rightarrow$ `item/completed`, plus server-initiated `approval/request`).
- **Live JSON-RPC Protocol Inspector**: Click `app-server` in the top command bar to inspect real-time JSON-RPC payloads or dispatch custom RPC methods.

### Phase 3: Three-Column Workbench, Parallel Threads & Multi-Function Composer
- **Top Command Bar (`src/components/TopCommandBar.tsx`)**:
  - Surface switcher (`Codex Agents` | `Work` | `Chat`), active Project & Git Worktree pill, live running agents & pending approval counter, layout mode switcher (`Standard 3-Pane`, `Tiled 4-Pane Workbench`, `Focus Chat`, `Review Zen`), and `⌘K` Command Palette trigger.
- **Left Sidebar (`src/components/LeftSidebar.tsx`)**:
  - `+ New Agent Thread`, `Quick Chat` (`GPT-6 Luna`), and **Batch Worktree Agents (3x Parallel Run)** (launches 3 concurrent agents across isolated Git worktrees for Refactor, Tests, and Docs).
  - Navigation across `Agent Threads`, `Review Queue`, `Git Worktrees`, `Skills Library`, `Automations`, `Subagents & AGENTS.md`, and `Sandbox & Security`.
- **Center Thread View (`src/components/CenterThreadView.tsx`)**:
  - Streaming turns with collapsible `Thought Ns` reasoning chains, delegated `subagent:*` cards, expandable command execution logs, clickable file-change cards, and interactive **Sandbox Approval Cards (`Allow Once` / `Always Allow in Worktree` / `Deny & Continue`)**.
  - **Mid-Turn Steering (`turn/steer`)**: Type in the composer while an agent is running to dynamically steer the active turn without interrupting it.
  - **Autocomplete Composer**: Type `$` for Skills, `@` for Workspace Files, or `/` for Slash Commands (`/personality`, `/worktree`, `/agent`, `/review`).

### Phase 4: Git Worktree Isolation & Right Tiled Multi-Pane Inspector
- **Right Inspector (`src/components/RightInspectorPane.tsx`)**:
  - Supports both **Tabbed Mode** and **2×2 Tiled 4-Pane Workbench Mode** (simultaneous Diff Review + Live Preview + Source Files + Terminal, implementing GitHub Issue #33301).
  - **Unified & Split Diff Reviewer**: Per-file staging, hunk revert, **Line-Level Inline Review Comments** (click any diff line to add a comment, then click **Submit Review** to dispatch a follow-up agent turn), and one-click commit.
  - **Playable Voxel Velocity 3D Kart Racer (`src/components/VoxelVelocityGame.tsx`)**: Built into the **Live Preview** tab — features 8 tracks, 8 racers, 3-tier drift-charge boost physics, Spacebar items, and an automated **Codex QA Bot** autopilot mode.
  - **Workspace File Explorer & Live Editor** + **Multi-Tab Sandboxed Terminal**.

### Phase 5: Skills Studio, Scheduled Automations, Review Queue & Sandbox Governance
- **Central Review Queue**: Inspect diffs produced by background Automations and approve/merge into `main`, open in a thread to steer, or reject.
- **Skills Studio**: Browse, filter, create, and live-edit `SKILL.md` bundles and launch any skill in a new thread.
- **Scheduled Automations**: Create cron-scheduled background jobs bound to `$skills` and trigger immediate test runs into the Review Queue.
- **Subagents & Sandbox Governance**: Visual and TOML editors for `.codex/agents/*.toml`, `AGENTS.md`, and `.codex/config.toml`.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build and verify TypeScript + Vite production bundle
npm run build

# 3. Start both the local Codex app-server (port 4500) and Vite Workbench (port 5173)
npm start

# Or run individually:
npm run server   # Starts server/app-server.mjs on http://127.0.0.1:4500
npm run dev      # Starts Vite dev server on http://localhost:5173
```
