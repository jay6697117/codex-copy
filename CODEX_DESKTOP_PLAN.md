# OpenAI Codex Desktop (macOS) 深度调研与 1:1 还原及本机 Codex 接入方案

## 一、 深度调研：官方 OpenAI Codex Desktop App 真实 UI 与交互解剖

通过对 OpenAI 官方发布文档（[Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)、[ChatGPT desktop app Docs](https://learn.chatgpt.com/docs/app)、[Codex IDE & Desktop Docs](https://learn.chatgpt.com/docs/codex/ide)、[Non-interactive mode `codex exec --json`](https://learn.chatgpt.com/docs/non-interactive-mode)）以及多位开发者实测拆解（[Flavio Copes: How to use the Codex desktop app](https://flaviocopes.com/codex/)、[Zun-Beho: Codex Mac App UI Configuration](https://note.com/akikito/n/nf91346061592?hl=en)、[Ryo: Trying out the Codex desktop app](https://note.com/biwakonbu/n/n9b7f377cada9?hl=en)、[VibeiDE: Codex worktrees in the Codex app](https://vibeide.dev/blog/codex-worktree/)、[Takopi: `codex exec --json` event cheatsheet](https://takopi.dev/reference/runners/codex/exec-json-cheatsheet/)）的交叉比对，我们梳理出旧版页面存在的核心差距与官方真实 UI 规范：

### 1. 旧版页面痛点诊断（结合截图分析）
1. **三栏比例严重失衡（中间对话区被挤压成细条）**：旧版左侧栏过宽（且堆砌了大量非官方菜单项），右侧审查面板常驻占满近半屏，导致最核心的 **中央 Thread 与 Composer 输入框被挤压到不足 180px**，按钮全部竖向折行。
2. **顶部导航栏不符合官方设计**：官方 Codex App 采用极简的 **macOS 原生一体式 Header（NavigationSplitView 风格）**，左上方仅保留红黄绿窗口控制点与侧栏收起按钮，主工作区顶部直接展示 **当前项目/会话标题 + 右侧工具栏（`Open in` 编辑器下拉菜单、`Commit / Push / Create PR` 按钮、`+N -M` Diff 统计开关、终端按钮）**，而非塞满花哨胶囊的独立厚重顶栏。
3. **左侧边栏（Sidebar）结构与官方不一致**：
   - 官方左侧栏顶部非常干净，依次是：
     - **`New thread`**（新建线程，悬停支持快速对话）
     - **`Automations`**（定时自动化任务与待审结果）
     - **`Skills`**（技能库管理与安装）
   - 下方是 **`Pinned`**（置顶会话）与 **`Threads`（按 Project 文件夹分组的会话列表）**：每个项目文件夹（如 `codex-test`）右侧悬停可点击 `+` 新建该项目的 Thread；子项展示状态圆点/旋转图标、任务标题、简短时间或 `+add -del` 行数。
   - 底部是 **本机登录账号状态 + `Settings`（设置与配置入口）**。
4. **底部输入框（Composer）还原度不足**：
   - 官方 Composer 居中于主对话区底部（最大宽度 `768px`），默认占位符为：
     - 新会话：`Ask Codex anything, @ to add files, / for commands, $ for skills`
     - 已有会话：`Ask for follow-up changes`
   - Composer 底部控制栏左起依次为：
     1. **`+` 附件/上下文按钮**（添加文件 `@`、图片或技能 `$`）
     2. **模式切换**（默认 Agent / `Plan` 计划模式 `/plan` / `Goal` 目标模式 `/goal`）
     3. **模型选择器**（直接读取本机 `~/.codex/config.toml` 配置的模型与官方模型列表，如 `gpt-5.4`、`gpt-5.3-codex`、`gpt-6.1-sol`、`gpt-6-luna`、`o3`、`o4-mini`）
     4. **推理强度（Reasoning Effort）**（`Low` / `Medium` / `High` / `Extra high`）
     5. **工作区隔离模式**：**`Local`**（直接在当前本地检出目录操作） vs **`Worktree`**（在 `$CODEX_HOME/worktrees` 创建独立 Git Worktree）
     6. **权限与沙箱级别**：**`Default permissions`**（`workspace-write`） vs **`Read only`** vs **`Full access`**（`danger-full-access`）
     7. **当前 Git 分支选择/指示**（如 `main`）
   - 右侧为语音输入图标与圆形上箭头发送/中断按钮。
5. **未真正连接本机 `~/.codex` 与 `codex` CLI**：旧版前端直接用 `setTimeout` 模拟了假回复，没有读取本机 `~/.codex/auth.json`、`~/.codex/config.toml`、`~/.codex/sessions`，也没有调用本机的 `codex` 可执行文件。

---

## 二、 架构重构与实施计划（Implementation Plan）

### Phase 1：本机 Codex 深度桥接服务（`server/codex-local-bridge.mjs`）
构建统一的 Node.js 本地桥接核心，**同时挂载到 Vite 开发服务器（`vite.config.ts` 插件中间件）与独立 `server/app-server.mjs`**，确保无论通过 `npm run dev`、`npm start` 还是 Electron 启动，前端都能 100% 实时访问本机环境：

1. **自动探测本机 `codex` CLI 与环境路径**：
   - 通过 `/bin/zsh -lc "which codex"` 及遍历 macOS 常见安装路径（`/opt/homebrew/bin/codex`、`/usr/local/bin/codex`、`~/.nvm/versions/node/*/bin/codex`、`~/.fnm/...`、`~/.bun/bin/codex`、`~/.cargo/bin/codex`、`~/.local/bin/codex`、`/Applications/Codex.app/Contents/Resources/codex`）定位本机 `codex` 二进制文件。
   - 执行 `codex --version` 与 `codex login status` 获取真实 CLI 版本与登录状态。
2. **读取并解析本机 `~/.codex/` 核心配置与凭据**：
   - **`~/.codex/auth.json`**：解析登录模式（`ChatGPT Account OAuth` / `API Key` / `Access Token`），安全解码 `tokens.id_token` / `access_token` 的 JWT Payload 提取账号邮箱、用户名、订阅等级（Plus / Pro / Team / Enterprise）、`account_id` 与最近刷新时间（对敏感 Token 进行脱敏展示）。
   - **`~/.codex/config.toml` 与项目 `.codex/config.toml`**：解析用户配置的默认 `model`、`model_provider`、`model_reasoning_effort`、`approval_policy`、`sandbox_mode`、`[model_providers.*]`、`[mcp_servers.*]`、`[projects.*]`，并支持在界面中直接查看与修改写回。
   - **本机真实历史会话导入（`~/.codex/sessions` & `~/.codex/history.jsonl`）**：扫描 `~/.codex/sessions/` 下的 `.jsonl` 会话记录与 `~/.codex/history.jsonl`，将其转化为可在侧边栏直接点开查看和继续对话（`codex exec resume`）的真实历史线程。
   - **本机 Skills 扫描（`~/.codex/skills` & `.codex/skills`）**：自动读取本机已安装的 `SKILL.md` 技能包。
3. **直接调用本机 `codex` 进行操作与模型流式推理（`/api/codex/turn-stream`）**：
   - 当用户在 Composer 发送指令时，后端直接拉起本机 `codex exec --json` 子进程（支持透传 `-C <workspace>`、`-m <model>`、`-s <sandbox_mode>`、`-c model_reasoning_effort="<effort>"`、以及 `resume <session_id>`）。
   - 实时解析 `codex exec --json` 输出的标准 JSONL 事件流（`thread.started`、`turn.started`、`item.started`、`item.updated`、`item.completed` 涵盖 `reasoning`、`command_execution`、`file_change`、`mcp_tool_call`、`web_search`、`todo_list`、`agent_message`、`turn.completed`），通过 SSE 实时推送到前端渲染。
   - 若本机配置了自定义 `model_provider` / `base_url` 且需直连 OpenAI Responses / Chat Completions API，同时提供基于 `~/.codex/auth.json` + `config.toml` 的原生直连兜底。
4. **真实本地 Git 与文件操作（`/api/git/*` & `/api/fs/*`）**：
   - 实时执行 `git status --porcelain`、`git diff`、`git branch --show-current`、`git worktree list`，将工作区真实的未提交改动渲染到右侧 Review Diff 抽屉，支持真实的 Stage、Unstage、Revert、Commit 与 Worktree 创建。

---

### Phase 2：一键换肤系统（3 款精选主题皮肤）
通过 CSS 变量体系（CSS Custom Properties）与 React 状态联动，在顶部工具栏提供 **一键换肤（One-Click Skin Switcher）**，支持单击循环切换或下拉选择三种风格迥异的桌面皮肤（自动持久化至 `localStorage`）：

| 皮肤 ID | 皮肤名称 | 视觉定位与色彩体系 |
| :--- | :--- | :--- |
| **`codex-dark`** | **官方极夜黑 (Codex Dark)** | 1:1 复刻 OpenAI Codex macOS 官方深色外观（`#0D0D0D` 主画布、`#141414` 侧栏、`#1F1F22` 悬浮输入框、克制的银白高光与 `#10A37F` 状态点缀）。 |
| **`macos-light`** | **原生昼白 (macOS Daylight)** | 复刻 macOS 原生浅色模式（`#FFFFFF` 纯净主画布、`#F4F4F6` 磨砂侧栏、`#111827` 高对比深色字体、清爽的浅色代码 Diff 视图）。 |
| **`aurora-midnight`** | **极光深空 (Aurora Slate)** | 专为多智能体极客打造的深空蓝紫玻璃拟态皮肤（`#080C14` 深海主画布、`#0B101B` 侧栏、`#38BDF8` 极光青与 `#818CF8` 靛蓝高亮）。 |

---

### Phase 3：1:1 官方 OpenAI Codex Desktop UI 界面重构
1. **左侧导航栏（`LeftSidebar.tsx`，`w-[250px]` 可收起）**：
   - 顶部：macOS 红黄绿圆点 + 侧栏折叠按钮 + 搜索按钮（`⌘K`）。
   - 核心入口：`New thread`、`Automations`、`Skills`（以及本机 Codex 配置中心 `Codex Config`）。
   - 线程列表：`Pinned`（置顶）+ `Threads`（按项目文件夹分组，支持添加本地项目路径、同步本机 `~/.codex/sessions` 历史会话、悬停新建线程）。
   - 底部：展示从 `~/.codex/auth.json` 读取的真实本机登录状态徽章（如 `Logged in via ChatGPT / API Key`）、CLI 版本号与 `Settings` 按钮。
2. **中央主画布与官方 Composer（`CenterThreadView.tsx`，自适应宽屏居中布局）**：
   - **顶部集成式 Header**：左侧显示侧栏展开按钮（当侧栏收起时）、当前项目名/线程标题、分支/Worktree 标识与 `Hand off`；右侧提供 **一键换肤组件（3 皮肤切换）**、**`Open` 外部编辑器下拉菜单（Cursor / VS Code / Zed / Ghostty / Terminal / Finder）**、**`Commit` Git 下拉菜单（Commit / Push / Create PR）**、**`+add -del` Diff 抽屉开关** 与 **终端面板开关（`⌘J`）**。
   - **对话与执行流**：采用与官方一致的紧凑可折叠步骤条（`Thought Ns`、`Read file`、`Ran command`、`Edited file +N -M`）+ Markdown 渲染，不再用冗余边框塞满屏幕。
   - **官方底部 Composer**：完整还原 `+` 附件、`Plan / Agent` 模式、模型选择（同步 `~/.codex/config.toml`）、推理强度（`Low / Medium / High / Extra high`）、`Local / Worktree` 切换、`Default permissions / Full access` 切换与分支指示器。
3. **右侧可折叠/可调宽抽屉（`RightInspectorPane.tsx`）**：
   - **默认按需展开（不挤压中央对话区）**：包含 `Review (Diff)`、`Files`、`Terminal`、`Browser` 四个干净 Tab，默认读取本机当前目录真实的 `git diff` 与文件树。
