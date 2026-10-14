# OpenAI Codex Desktop PC 桌面端复刻：深度调研报告与架构实施计划

## 一、 广泛深入调研总结（Product & Architecture Deep Dive）

### 1. 产品定位与核心演进
OpenAI 于 2026 年 2 月 2 日正式发布 **Codex App**（最初支持 macOS，3 月至 5 月扩展至 Windows，7 月起与 ChatGPT Desktop 深度融合并支持独立 Codex 视图，8 月推出 Linux 预览版）（参考：[Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)、[IntuitionLabs Report](https://intuitionlabs.ai/articles/openai-codex-app-ai-coding-agents)、[Vibecoding Review](https://vibecoding.app/blog/openai-codex-app-review)）。
不同于 Cursor 等 IDE 内嵌式补全工具或纯终端交互的 Claude Code / Codex CLI，Codex Desktop 的核心定位是 **“多智能体指挥中心（A Command Center for Agents）”**：
- **从单线程对话转向多智能体并行编排（Multi-Agent Orchestration）**：支持在多个项目（Projects）下同时运行多个独立的智能体线程（Threads）及子智能体（Subagents：`default`、`worker`、`explorer`）。
- **基于 Git Worktree 的无冲突隔离**：每个并行 Agent 线程可绑定独立的 Git Worktree 工作树目录，共享底层 `.git` 对象库但拥有独立工作区，避免多 Agent 同时改代码时污染本地当前分支（参考：[Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)）。
- **人机协同审查闭环（Human-in-the-Loop Review）**：内置文件变更 Diff 审查面板、行级评论、一键在外部编辑器打开、沙箱命令审批（Allow / Deny）以及自动化任务的 **Review Queue（审查队列）**。

---

### 2. 官方底层技术栈剖析
根据 OpenAI 工程博客与桌面端审计报告（参考：[Unlocking the Codex harness: how we built the App Server](https://openai.com/index/unlocking-the-codex-harness/)、[Codex App Server Docs](https://learn.chatgpt.com/docs/app-server)、[Famous Electron Apps 2026 Audit](https://codenote.net/en/posts/famous-electron-apps-2026-research/)）：

| 层级 | 官方实现方案 | 核心职责与设计考量 |
| :--- | :--- | :--- |
| **桌面外壳 (Desktop Host)** | **Electron** (macOS / Windows) | 负责窗口生命周期管理、原生菜单、文件系统桥接、子进程管理（启动并守护 `codex app-server`）、终端 PTY 进程与系统级通知。 |
| **前端视图层 (Renderer UI)** | **React + TypeScript** | 与 [Codex VS Code Extension](https://learn.chatgpt.com/docs/codex/ide) 高度共享 UI 组件库，实现多栏工作台（Sidebar + Thread Stream + Diff/Browser/Terminal 分屏面板）。 |
| **通信协议 (Transport Protocol)** | **JSON-RPC 2.0 Lite** (`stdio` JSONL / `ws://`) | 双向异步通信（省略 `"jsonrpc": "2.0"` 头），支持客户端发起请求、服务端流式推送通知（Notifications）以及服务端反向发起审批请求（Server-initiated Requests）。 |
| **核心引擎 (Agent Harness)** | **`codex app-server`** (Rust, [openai/codex](https://github.com/openai/codex)) | 包含 4 大模块：`stdio reader`、`Codex message processor`、`thread manager` 与 `core threads`，负责会话持久化、Git worktree 管理、MCP 与 Skills 挂载及沙箱命令执行。 |

---

### 3. 核心协议原语（Conversation Primitives）
`codex app-server` 将复杂的 Agent 循环抽象为三个具有严格生命周期的核心原语（参考：[Unlocking the Codex harness](https://openai.com/index/unlocking-the-codex-harness/)、[Codex App Server Docs](https://learn.chatgpt.com/docs/app-server)）：

1. **握手阶段（Handshake）**
   - 客户端连接后首先发送 `initialize`（携带 `clientInfo` 与 `capabilities.experimentalApi`），收到响应后发送 `initialized` 通知。
2. **Thread（会话线程）**
   - 持久化容器，对应一个具体的开发任务或分支工作区。
   - 核心方法：`thread/start`（新建）、`thread/resume`（恢复历史）、`thread/fork`（从某节点分支）、`thread/read`（读取历史 Turn 分页）、`thread/revert`（回滚）、`thread/archived`（归档）。
3. **Turn（单轮交互与执行周期）**
   - 由用户输入触发的一次完整 Agent 执行闭环。
   - 核心方法与通知：`turn/start`（启动，可指定 `model`、`personality`、`cwd`、`sandbox`）、`turn/steer`（在运行中追加指令动态纠偏）、`turn/interrupt`（中断执行）、`turn/started`、`turn/completed`。
4. **Item（原子输入/输出流单元）**
   - 每个 Turn 内部由一系列强类型的 Item 组成，包括：`userMessage`、`agentMessage`、`reasoning`（思考耗时与摘要）、`commandExecution`（Shell 命令执行）、`fileChange`（文件增删改与 Diff）、`approvalRequest`（权限审批请求）。
   - 统一生命周期事件：`item/started` $\rightarrow$ `item/*/delta`（如 `item/agentMessage/delta` 流式增量输出） $\rightarrow$ `item/completed`。
   - **双向审批挂起机制**：当 Agent 需要越权执行命令（如联网或写工作区外文件）时，服务端向客户端发送审批请求并挂起当前 Turn，等待客户端返回 `allow` 或 `deny` 后继续。

---

### 4. 核心 UI/UX 交互与功能全景（Workbench Layout）
综合官方文档与社区高频工作流（参考：[ChatGPT desktop app Docs](https://learn.chatgpt.com/docs/app)、[Codex Desktop Issue #33301](https://github.com/openai/codex/issues/33301)、[Vibecoding Review](https://vibecoding.app/blog/openai-codex-app-review)），Codex Desktop 采用 **三栏式 + 可平铺多面板工作台（Multi-Pane Workbench）** 设计：

```
+--------------------------------------------------------------------------------------------------+
| [macOS/Win Titlebar]  Codex  |  Project: codex-test (worktree: feat/ui)  |  [Layout] [Settings]  |
+----------------------+-------------------------------------------+-------------------------------+
| 左侧导航栏 (Sidebar)  | 中央主工作区 (Agent Thread & Composer)     | 右侧多维审查与工具面板 (Right) |
|                      |                                           | [Diff] [Files] [Term] [Preview]|
| [Mode: Codex | Work] | Thread Header: Implement dark mode        | ----------------------------- |
| [+ New Chat] [Quick] | Badges: [Worktree: wt-dark-mode] [Running]| Changed Files (3)   [+21 -11] |
|                      | ----------------------------------------- |  M src/hero.tsx       +16 -6  |
| > Pinned / Running   | [User] Create a launch hero...            |  M scripts/build.py    +5 -5  |
|   * New app launch   |                                           | ----------------------------- |
|   * Implement dark   | [Thought 7s] (可折叠推理过程)              | Unified / Split Diff Viewer:  |
|                      | [Tool] Explored 2 files                   |  @@ -12,6 +12,16 @@           |
| > Projects           | [Diff Card] Edited hero.tsx (+16 -6)      |  - <div className="old">      |
|   v codex-test       | [Diff Card] Edited build.py (+5 -5)       |  + <div className="hero-new"> |
|     - Thread #1      |                                           |  [Add Comment] [Revert Hunk]  |
|     - Thread #2 (wt) | +---------------------------------------+ | ----------------------------- |
|                      | | [!] Approval Required                 | | Bottom / Docked Terminal:     |
| > Navigation         | | Run `npm test --watch=false`?         | | $ git status                  |
|   - Review Queue (2) | | [Allow Once] [Always Allow] [Deny]    | | $ npm run build               |
|   - Skills Library   | +---------------------------------------+ |                               |
|   - Automations      |                                           | [Commit Changes] [Open in IDE]|
|   - Subagents        | ----------------------------------------- |                               |
|   - Sandbox Rules    | Composer:                                 |                               |
|                      | [Input: Ask Codex, type / or $skill...]   |                               |
|                      | [Model: GPT-6.1 Sol] [Worktree] [Send/Steer]|                             |
+----------------------+-------------------------------------------+-------------------------------+
```

---

## 二、 复刻架构与分阶段实施计划（Implementation Plan）

为了让复刻项目在 `/Users/zhangjinhui/Desktop/codex-test` 中具备工业级完成度与可扩展性，我们规划了 **5 个核心阶段（Phases）**：

### Phase 1：项目脚手架与跨平台桌面基座搭建
- **目标**：在 `/Users/zhangjinhui/Desktop/codex-test` 初始化桌面端工程，配置现代化深色玻璃拟态（Dark Glassmorphism）主题系统与全局状态管理。
- **关键产出**：
  - 桌面端宿主层（Electron Main/Preload 或 Tauri/Web 宿主桥接）与 React 19 + TypeScript + Tailwind CSS + Lucide Icons 渲染层。
  - 完整的数据模型与类型定义（严格对齐 `codex app-server` 的 `Thread`、`Turn`、`Item`、`Worktree`、`Skill`、`Automation`、`ApprovalRequest` Schema）。

### Phase 2：`codex app-server` 双模通信引擎（Dual-Mode Harness Bridge）
- **目标**：实现与官方 JSON-RPC 2.0 Lite 协议 100% 兼容的通信层，支持 **真实连接模式** 与 **内置高保真沙箱模拟模式** 无缝切换。
- **关键产出**：
  - **Real CLI / API Bridge**：自动检测本机 `codex app-server` 进程（通过 `stdio` JSONL 或 WebSocket 连接），或者直接接入 OpenAI / Anthropic / 自定义兼容 API 执行真实文件读写与命令。
  - **Built-in Interactive Harness Simulator**：当未安装外部 CLI 或处于演示模式时，提供完整的流式 `item/started` $\rightarrow$ `item/agentMessage/delta` $\rightarrow$ `item/completed` 事件流模拟、Mid-turn Steering（运行中插话纠偏）、以及真实的本地 Git / 文件扫描联动。

### Phase 3：核心三栏工作台与多智能体会话流（Core Workbench & Threads）
- **目标**：复刻 Codex Desktop 标志性的多任务并行体验。
- **关键产出**：
  - **左侧导航栏**：Codex / Work 模式切换、项目（Projects）分组、并行运行状态指示器（Spinner/Badge）、Pinned 任务、搜索过滤（`Cmd+K`）。
  - **中央会话流（Thread View）**：
    - 思考折叠卡片（`Thought N s` 实时计时与推理链展示）。
    - 工具执行时间线卡片（文件读取、目录检索、编辑统计 `+lines -lines`、终端命令输出）。
    - **内联权限审批卡片（Inline Approval Card）**：当触及敏感命令或联网操作时挂起当前 Turn，支持 `Allow Once`、`Allow for Session`、`Deny`。
    - **多功能 Composer**：支持 `@file` 引用、`$skill` 技能唤醒、`/personality`（Pragmatic / Empathetic 风格切换）、`/agent` 子智能体切换、模型选择（`GPT-6.1 Sol` / `GPT-6 Luna` 等）及运行中 `Steer`（动态追加指令）。

### Phase 4：Git Worktree 隔离管理与右侧多维审查工作台（Diff, Terminal, Preview）
- **目标**：复刻 Codex Desktop 最核心的工程审查与多面板能力。
- **关键产出**：
  - **Git Worktree 管理器**：支持为每个 Thread 创建/切换/清理 Git Worktree（调用真实 `git worktree` 或管理工作区快照），展示分支状态。
  - **右侧可平铺/可拖拽分屏面板（Tiled Multi-Pane Inspector）**：
    1. **Code Review & Diff 视图**：展示变更文件树、增删行数、Unified / Split 雙视图语法高亮 Diff、行级批注（Inline Comments，可一键发送给 Agent 修改）、Stage / Revert / Commit 操作。
    2. **Source File Explorer**：浏览工作区目录树与源码预览。
    3. **Integrated Terminal**：内置可交互终端面板，支持执行快捷命令与查看日志。
    4. **Live Web Preview**：内置浏览器预览面板，支持实时预览前端/游戏构建产物。

### Phase 5：Skills 技能中心、Automations 定时自动化与 Review Queue 审查队列
- **目标**：补齐 Codex Desktop 超越传统 IDE 的平台级功能。
- **关键产出**：
  - **Skills 技能管理中心**：内置官方精选技能模板（Figma Design-to-Code、Linear Triage、Cloud Deploy、Web Game Builder、Doc/Sheet Generator），支持可视化创建、编辑 `SKILL.md` 并在 Composer 中通过 `$skill-name` 调用。
  - **Automations 与 Review Queue**：支持配置 Cron / 周期性后台 Agent 任务（如每日 CI 故障汇总、Issue 分诊、安全扫描），运行完成后自动进入 **Review Queue（待审队列）**，供开发者集中审查 Diff 并一键合并或打回重做。
  - **安全与沙箱配置中心（Sandbox & Rules）**：可视化配置读写边界（Workspace-only vs Full Read）、网络访问开关、自动放行命令白名单与自定义 Subagents（`default`、`worker`、`explorer`）。
