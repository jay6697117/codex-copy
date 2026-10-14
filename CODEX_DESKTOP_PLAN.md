# OpenAI Codex Desktop App — 深度审计与真实 Codex App 体验对齐方案 (`CODEX_DESKTOP_PLAN.md`)

---

## 一、 全面深度审计：为什么打包安装后的 App 与真实 Codex App 体验存在差异？

通过对打包产物 (`Codex Desktop.app` / `Codex Desktop.exe`)、本地桥接层 (`server/codex-local-bridge.mjs`)、前端状态流 (`src/services/appServerClient.ts`) 与工作区配置文件 (`.codex/config.toml`) 的逐行审计，定位出以下 **6 个核心根因 (Root Causes)**：

| 编号 | 问题现象 | 根本原因 (Root Cause) | 修复与优化方案 |
| :--- | :--- | :--- | :--- |
| **RC-1** | **执行报错 (`执行报错`)：项目级 `.codex/config.toml` 污染本机配置** | 项目目录下 `.codex/config.toml` 残留了早期虚构配置 `model = "gpt-6.1-sol"` 及非官方 TOML 段 (`[app_server]`, `[skills]`, `reasoning_effort`)，且在打包时被复制进了 `Codex Desktop.app/Contents/Resources/app/.codex/config.toml`。真实 `codex` CLI 启动时会优先读取工作目录 `.codex/config.toml`，导致覆盖用户本机 `~/.codex/config.toml` (`model = "gpt-6-astra"`) 或触发 TOML 解析报错。 | 1. 清理 `.codex/config.toml` 中的虚构模型与非标字段，完全遵循 [OpenAI Codex `config.toml` 官方规范](https://learn.chatgpt.com/docs/config-file/config-reference)。<br>2. 在桥接层过滤掉任何历史残留的虚构模型名 (`gpt-6.1-sol`, `gpt-6-luna`)，优先使用本机 `~/.codex/config.toml` 中的真实模型。 |
| **RC-2** | **执行报错 (`执行报错`)：`codex exec` 参数兼容性与 `stdin` 传递问题** | 1. 新建会话默认 `model` 被硬编码为 `'gpt-5.4'`，与本机 `~/.codex/config.toml` 的 `'gpt-6-astra'` 不一致，触发 `-m gpt-5.4`，若用户自定义 Provider 仅支持配置模型即报错。<br>2. `codex exec resume <id>` 子命令不支持部分顶层参数（如 `--skip-git-repo-check`、`-C`、`-s`），直接拼接会导致 CLI 退出码 2 ([Issue #6717](https://github.com/openai/codex/issues/6717))。<br>3. 多行 Prompt 作为命令行位置参数传递易受引号/换行截断。 | 1. 遵循 [OpenAI 非交互模式规范](https://learn.chatgpt.com/docs/non-interactive-mode)，改用 `codex exec --json -` 通过 **`stdin` 管道**安全写入完整 Prompt。<br>2. 默认模型设为跟随本机 `config.toml`（不额外传 `-m`），仅在用户显式切换其他模型时传 `-m`。<br>3. **智能三级回退重试机制**：若带 `resume` 或自定义 `-m`/`-c` 参数执行失败，自动回退为使用本机默认配置的 `codex exec --json --skip-git-repo-check -C <cwd> -` 无缝重试。 |
| **RC-3** | **模型选择 (`模型选择`) 不真实、缺乏本机配置联动** | 底部模型选择器仅为原生 `<select>`，包含虚构模型名，且未读取 `~/.codex/models_cache.json` 或区分「本机 `config.toml` 默认模型」，也不支持自定义输入模型 ID 或同步回写 `config.toml`。 | 重构为 **官方风格模型选择弹窗 (Model Selector Popover)**：<br>1. 顶部置顶显示本机 `~/.codex/config.toml` 当前生效模型（如 `gpt-6-astra`）。<br>2. 自动扫描 `~/.codex/models_cache.json`、Profiles 与官方 Codex 模型列表 (`gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5.1-codex-max`, `gpt-5.1-codex-mini`, `o3`, `o4-mini`)。<br>3. 支持手动输入任意自定义模型 ID，并支持一键「保存为本机默认模型」。 |
| **RC-4** | **模型推理程度选择 (`模型推理程度选择`) 被截断失效** | 1. `codex.ts` 定义了 `'max'`，而 `CenterThreadView.tsx` 使用了 `'xhigh'`，类型不一致。<br>2. `server/codex-local-bridge.mjs` 第 723 行硬编码 `reasoningEffort === 'low' \|\| reasoningEffort === 'medium' ? reasoningEffort : 'high'`，导致用户选择 `超高 (xhigh)` 或 `极速 (minimal)` 时被强制改写为 `high`！ | 遵循 [OpenAI Codex 推理等级规范](https://kingy.ai/news/openai-codex-reasoning-levels-low-medium-high-extra-high/) 与 [Issue #26930](https://github.com/openai/codex/issues/26930)：<br>1. 统一支持 `minimal` (极速)、`low` (低/Light)、`medium` (中)、`high` (高)、`xhigh` (超高/Extra High) 五档推理程度。<br>2. 重构底部 **推理程度选择弹窗 (Reasoning Effort Popover)**，准确传递 `-c model_reasoning_effort="<level>"`。 |
| **RC-5** | **推理 Thinking 过程 (`推理thinking过程`) 不显示或杂乱** | 1. 根据 [Codex `exec --json` 事件规范](https://takopi.dev/reference/runners/codex/exec-json-cheatsheet/)，必须启用 `model_reasoning_summary` (`auto` / `detailed`) 才会输出 `reasoning` 事件。<br>2. 前端把 `stderr.delta` 的 CLI 内部日志直接塞入 `reasoningSteps`，且默认折叠了思考卡片 (`isExpanded = false`)，无实时计时器。 | 1. 桥接层默认注入 `-c model_reasoning_summary="detailed"`，完整解析 `item.type === 'reasoning'`（含 `text` / `summary`）、`todo_list` 与 `command_execution`。<br>2. **思考过程流式展开 + 实时秒表计时**：思考进行中 (`streaming`) 自动展开显示最新推理标题与步骤，秒表实时跳动（`正在思考 3s...`），完成后展示 `已思考 Xs · N 个步骤` 并支持折叠。 |
| **RC-6** | **打包安装后 (`Codex Desktop.app`) 端口冲突与工作目录问题** | 1. `CodexDesktopMac.m` 启动内嵌服务时若 4500 端口被旧进程占用，会导致启动失败或连上旧服务。<br>2. 安装到 `/Applications` 后，默认 `cwd` 指向了 `/Applications/Codex Desktop.app/Contents/Resources/app` 而非用户真实代码仓库。 | 1. `app-server.mjs` 与 `CodexDesktopMac.m` 增加旧端口清理与动态端口健康校验，通过 `/bin/zsh -ilc "which node"` 确保找到本机 Node。<br>2. 默认工作区自动定位到用户真实项目目录，并在侧边栏/顶栏新增 **「切换/添加本地项目目录」** 功能。 |

---

## 二、 实施计划 (`Phase 3 & Phase 4`)

1. **清理并规范化 `.codex/config.toml`**
   - 移除 `.codex/config.toml` 中的 `model = "gpt-6.1-sol"` 与非标 TOML 块，确保本机 `~/.codex/config.toml` 配置 100% 生效。
2. **重构 `server/codex-local-bridge.mjs` 与 `server/api-router.mjs`**
   - 新增 `~/.codex/models_cache.json` 与本机可用模型自动发现接口。
   - 完整支持 `minimal` | `low` | `medium` | `high` | `xhigh` 推理等级与 `model_reasoning_summary="detailed"`。
   - 改用 `stdin` 管道向 `codex exec --json` 传递 Prompt，实现 `resume` 失败自动回退与参数不兼容自动重试机制。
   - 新增 `/api/workspace/select` 接口支持切换任意本地文件夹作为项目工作区。
3. **重构前端模型选择器、推理程度选择器与 Thinking 思考流 (`src/components/CenterThreadView.tsx`, `src/services/appServerClient.ts`, `src/App.tsx`)**
   - 实现官方风格的模型选择上拉菜单（支持跟随 `config.toml`、切换官方/本机模型、自定义模型 ID、一键写入 `config.toml`）与推理程度选择菜单。
   - 实现实时展开的 Thinking 思考流卡片（带实时计时器、加粗阶段标题提取、步骤时间线）与 `todo_list` 进度清单渲染。
4. **重新构建 macOS 与 Windows 安装包并实测验证 (`scripts/package-desktop.mjs`)**
   - 优化 `CodexDesktopMac.m` 的 Node 探测（支持 `/bin/zsh -ilc "which node"`）、端口冲突自动接管与真实项目路径传递。
   - 运行 `npm run package` 重新生成 `Codex Desktop.app`、`.pkg`、`.zip` 与 Windows `.exe`、`.zip`，并进行全链路实测验证。
