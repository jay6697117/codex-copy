# OpenAI Codex Desktop 深度重构与完善方案 (Phase 3 Audit & Architecture Plan)

## 一、五张实机运行截图与两处红框深度审计 (Forensic Audit)

### 1. 图三 (`67972F4B-390D-4D4A-81C9-DAD4627759D8.png`) 两处红框问题定位与修复
- **左上角红框 (Red Box 1)**：
  1. **双层红绿灯重叠**：macOS 原生窗口 (`NSWindowStyleMaskFullSizeContentView`) 在左上角 `(x: 14, y: 12)` 渲染了系统级红黄绿窗口按钮，而 `LeftSidebar.tsx` 在左侧 46px 窄栏顶部又渲染了一排 HTML 模拟红黄绿圆点，导致两套红黄绿按钮上下错位重叠。
  2. **顶栏导航按钮 (`←` `→` `[|]`) 与 `Codex ⌄` 垂直错位**：真实 Codex App 顶栏第一行 (`h-10`) 左侧为系统红黄绿按钮，紧接着同一水平线右侧为 `←`、`→`、`[|]` 侧栏收起按钮；第二行左栏的 `主页 (Home)` 图标与右栏的 `Codex ⌄` 及 `🔔` `🔍` 严格处于同一水平线上。
  - **修复方案**：移除 HTML 模拟红黄绿圆点，将左侧双栏顶部统一为 `h-10` 原生标题拖拽栏（左侧预留 72px 给 macOS 原生红黄绿按钮，右侧紧跟 `←` `→` `[|]`），第二行让 46px 窄栏的 `Home` 图标与 228px 侧栏的 `Codex ⌄` 像素级水平对齐。
- **左下角红框 (Red Box 2)**：
  1. **左窄栏底部悬空截断 & 侧边栏溢出裁剪**：`LeftSidebar.tsx` 外层容器与 `aside` 缺少 `min-h-0 overflow-hidden`，当 `最近` 会话列表较长时，`aside` 高度撑破 `100vh`，导致 `解释这是什么` 在窗口底边被拦腰截断，而 46px 窄栏停留在上方，造成左下角 `↓` 与 `XX` 头像下方出现一块突兀的断层空白。
  2. **会话重复显示**：`项目 -> codex-test` 下重复出现了两条 `"你是什么模型"`，`最近` 下又出现了一条 `"你是什么模型"`（由于当前新建会话改名后与 `~/.codex/sessions` 同步回来的会话未按 `cliSessionId` / 标题去重）。
  - **修复方案**：为侧边栏全部 Flex 纵向容器加上严格的 `h-full min-h-0 overflow-hidden`，确保 46px 窄栏与 228px 侧边栏底部 100% 贴齐窗口底边；对会话列表按 `cliSessionId` 与标题智能去重，并按每个会话实际的 `cwd` 归属到对应工作空间项目下。

---

### 2. 图一、图二、图四、图五：思考与推理过程重构、消除 `ERROR` 显示与提升 Agent 运行流畅度
- **问题根因分析**：
  1. **内部 Rust 日志混入思考卡片**：`codex exec --json` 运行时，Rust `tracing` 会向 `stderr` 输出带时间戳的内部日志：
     - `2026-10-14T07:04:39.340583Z ERROR codex_rmcp_client::oauth::refresh_transaction: error=failed to refresh OAuth tokens for server cloudflare-api...`
     - `2026-10-14T07:04:40.041341Z ERROR codex_models_manager::manager: failed to refresh available models: request timed out`
     旧版桥接层将 `stderr` 行作为 `stderr.delta` 推入了前端 `reasoningSteps`，导致思考卡片和标题栏显示满屏 `ERROR`。
  2. **合成提示语与左边框裁切 (`D02852B2-22B5-4FFE-86FB-8AAF31B953C8.png`)**：
     - 思考列表第一行被塞入了合成文本 `正在调用 GPT-6 Astra (推理强度: xhigh)`（即使用户选了 `最大` 也显示 `xhigh`），且粗白左边框贴近圆角边缘产生视觉裁切。
  3. **Agent 启动耗时 31s ~ 83s 的核心性能瓶颈**：
     - **瓶颈 A (`codex_models_manager` 超时)**：本机 `~/.codex/models_cache.json` 的 `"fetched_at"` 时间戳过期，导致每次启动 `codex exec` 时 CLI 都尝试联网刷新模型列表并等待 20~30 秒超时后才开始推理！
     - **瓶颈 B (`cloudflare-api` MCP OAuth 刷新失败)**：本机 `~/.codex/config.toml` 中配置的 `cloudflare-api` MCP 服务 OAuth Token 已失效 (`invalid_grant`)，每次启动 `codex exec` 都要耗时重连刷新！
- **重构与优化方案**：
  1. **零延迟预热 `~/.codex/models_cache.json` (`touchModelsCacheFreshness`)**：每次调用前自动将 `~/.codex/models_cache.json` 的 `"fetched_at"` 更新为当前 ISO 时间戳，使 `codex_models_manager` 直接命中本地缓存（0ms 启动，彻底消除 `failed to refresh available models: request timed out` 的 30 秒卡顿）。
  2. **自动隔离失效的远程 OAuth MCP 服务**：在执行 `codex exec` 时默认传入 `-c 'mcp_servers={}'`（除非用户指令明确提及 MCP），彻底消除 `cloudflare-api` OAuth 刷新失败带来的阻塞与报错。
  3. **重构纯净的思考与推理流 (Thinking & Reasoning UI)**：
     - 彻底移除 `正在调用 ...` 合成步骤与 `stderr` 日志注入，并在子进程注入 `RUST_LOG=off`。
     - 仅展示模型真实输出的 `reasoning` 思考摘要（如 `Finishing navigation check`）与真实工具调用步骤（如 `执行命令`、`文件修改`）。
     - 重构思考卡片样式（移除突兀的粗白竖线，改为细腻的时间轴圆点与呼吸动画，若某轮简单问答无中间推理步骤则自动隐藏空思考框）。

---

### 3. 新增多工作目录 / 工作空间创建、导入与切换系统 (Multi-Workspace Manager)
- **功能设计**：
  1. **后端接口 (`server/app-server.mjs` & `server/codex-local-bridge.mjs`)**：
     - `GET /api/workspaces`：读取已保存的工作空间列表（持久化于 `~/.codex/desktop_workspaces.json` 并合并 `~/.codex/config.toml` 中的 `[projects]`），同时扫描 `~/Desktop` 下的现有项目目录供一键导入。
     - `POST /api/workspaces/pick-folder`：调用 macOS 原生 `osascript` (`choose folder`) 弹出系统原生 Finder 文件夹选择窗口（内置原生「新建文件夹」按钮）。
     - `POST /api/workspaces/create`：支持在指定父目录（如 `/Users/zhangjinhui/Desktop`）下一键新建工作目录、自动执行 `git init` 初始化仓库、生成 `AGENTS.md`，并持久化写入工作空间列表。
     - `POST /api/workspaces/remove`：支持移除不再使用的工作空间。
  2. **前端交互 (`LeftSidebar.tsx`, `CenterThreadView.tsx`, `Modals.tsx`)**：
     - 侧边栏 `项目` 标题栏右侧新增 **`+`（新建/打开工作空间）** 按钮，支持管理多个项目目录，点击任意项目即刻切换当前工作目录 (`cwd`)、文件树与 Git 状态。
     - 底部输入框上方 `📁 <当前项目名>` 按钮动态显示当前工作目录名称（不再固定显示 `选择项目`），点击弹出工作空间菜单，支持一键切换项目、**「+ 新建工作空间目录...」** 或 **「📂 从 Finder 选择本地目录...」**。
