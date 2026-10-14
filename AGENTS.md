# AGENTS.md — Codex Workspace Rules & Subagent Guidelines

## 1. Repository Overview
This repository (`codex-desktop-app`) implements the **OpenAI Codex Desktop App ("Command Center for Agents")** using Electron, React 19, TypeScript, Tailwind CSS, and a bidirectional JSON-RPC 2.0 Lite `app-server` harness.

## 2. Coding & Architecture Conventions
- **Type Safety**: Keep all JSON-RPC 2.0 Lite primitives (`Thread`, `Turn`, `TurnItem`, `WorktreeInfo`, `SkillDefinition`, `AutomationJob`, `ReviewQueueItem`) strictly typed in `src/types/codex.ts`.
- **Worktree Isolation**: Parallel agent threads must operate in isolated Git worktrees (`.codex/worktrees/<slug>`) whenever modifying overlapping files.
- **Verification**: Always run `npm run build` (`tsc -b && vite build`) and inspect unified/split diffs before marking a turn complete.
- **Sandbox & Approvals**: Commands requiring network access, package installation, or writes outside the active workspace/worktree must request user approval via `approvalRequest` items.

## 3. Subagent Routing
- **`explorer`**: Fast read-only codebase indexing, dependency mapping, and symbol search.
- **`worker`**: Isolated code implementation, test generation, and refactoring inside dedicated Git worktrees.
- **`default`**: Primary orchestrator that coordinates subagents, synthesizes diffs, and communicates with the developer.
