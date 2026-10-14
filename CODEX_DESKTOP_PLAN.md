# OpenAI Codex 桌面端深度审计与真实本机对齐方案 (Phase 2 Audit & Implementation Plan)

## 一、三张截图问题深度根因审计 (Root Cause Audit)

### 1. 图一报错：`Error: spawn /Users/zhangjinhui/.nvm/versions/node/v20.10.0/lib/node_modules/@openai/codex/vendor/aarch64-apple-darwin/codex/codex ENOENT`
- **根因定位 (`server/codex-local-bridge.mjs`)**：
  1. **PATH 优先级反转**：`buildAugmentedPath()` 在遍历 `~/.nvm/versions/node` 时使用了 `versions.sort().reverse()` 配合 `extraDirs.unshift(...)`，两次反转导致最旧的 `v20.10.0/bin` 被排在了 `PATH` 最前面，覆盖了本机 `/Applications/Codex.app/Contents/Resources`、`/opt/homebrew/bin` 以及更高版本的 Node (`v22+`)。
  2. **缺乏可执行二进制健康探测 (`Health Probe`)**：`resolveCodexBinary()` 仅调用了 `fsSync.existsSync(candidate) && stat.isFile()`。由于 `v20.10.0/bin/codex` 是一个 JS 包装脚本（文件本身存在），被直接选中并缓存；但该旧版本下的原生二进制 `vendor/aarch64-apple-darwin/codex/codex` 缺失（macOS 常见 npm 可选依赖/XProtect 隔离问题），导致运行 `spawn` 时抛出 `ENOENT`。
  3. **附带 UI 瑕疵**：
     - 当 `stderr` 输出多行 Node.js 异常对象时，最后一行 `}` 被推入 `stderr.delta`，导致思考卡片标题显示 `已思考 1s · }`。
     - 左侧边栏读取 `~/.codex/sessions/*.jsonl` 时，未过滤系统注入的 `# AGENTS.md instructions...` 与 `<codex_interactive_shell>` 等初始化块，导致历史会话标题显示为 `# AGENTS.md...` 和 `<codex_inter...`。

- **修复方案**：
  1. **重构二进制探测优先级与健康校验 (`resolveCodexBinary` & `probeCodexBinary`)**：
     - 优先探测本机真实安装的官方桌面端内置 CLI（`/Applications/Codex.app/Contents/Resources/codex`、`/Applications/ChatGPT.app/Contents/Resources/codex`）与 Homebrew（`/opt/homebrew/bin/codex`、`/usr/local/bin/codex`）。
     - 对 `~/.nvm/versions/node` 与 `fnm` 采用语义化版本号降序排列（最高版本优先），并同时探测 `@openai/codex-darwin-arm64` / `vendor` 原生二进制路径。
     - **强制执行健康校验**：每个候选路径必须通过 `"${candidate}" --version` 实测（返回码 `0` 且无 `ENOENT`/`Error: spawn`），自动跳过损坏的 `v20.10.0` 包装脚本。
     - **运行时自愈重试**：若运行期捕获 `ENOENT`，自动拉黑失效路径、强制刷新可用二进制并无缝重试。
  2. **净化思考流与会话标题**：
     - 过滤 `stderr` 中的堆栈跟踪与括号符号（`{`, `}`, `at ...`, `errno:`），确保思考标题只展示有意义的阶段摘要。
     - 结合 `~/.codex/history.jsonl` 并剥离 `# AGENTS.md`、`<codex_interactive_shell>`、`<environment_context>`、`<INSTRUCTIONS>` 等系统注入标签，还原真实用户提问作为会话标题。

---

### 2. 图二问题：模型目录与本机真实 Codex App 模型目录不一致
- **根因定位 (`server/codex-local-bridge.mjs` & `src/components/CenterThreadView.tsx`)**：
  1. 真实 Codex App 的模型目录来自 `~/.codex/models_cache.json` 中的 `models` 数组。每个模型对象包含 `slug`、`display_name`、`description`、`visibility`（`"list"` | `"hide"` | `"none"`）、`priority`、`default_reasoning_level` 和 `supported_reasoning_levels`。
  2. 此前 `discoverCachedModels()` 未过滤 `visibility`，把 `models_cache.json` 中 `visibility: "hide"` 或 `"none"` 的内部测试/隐藏模型（如 `gpt-reserve`、`gpt-daybreak-blue-latest`、`gpt-5.6-terra`、`gpt-5.6-luna` 等）以及硬编码的旧模型列表全部混入下拉框，且未按 `priority` 排序。

- **修复方案**：
  1. 新增 `discoverLocalModelCatalog(codexHome, codexBin)`，严格按照官方 Codex 模型管理器逻辑：
     - 仅保留 `visibility === 'list'`（或用户当前在 `config.toml` 显式指定的默认模型），剔除 `visibility === 'hide'` / `'none'` 的内部隐藏模型。
     - 严格按 `models_cache.json` 的 `priority` 升序排列。
     - 提取每个模型的 `slug`、`displayName` (`display_name`)、`description`、`defaultReasoningLevel` 与 `supportedReasoningLevels`。
  2. 前端模型选择器展示与真实 Codex App 一致的模型目录（含模型显示名称、描述与默认标记）。

---

### 3. 图三问题：模型推理程度目录与本机真实 Codex App 不一致
- **根因定位 (`src/components/CenterThreadView.tsx`)**：
  1. 真实 Codex App 的推理程度（Reasoning Effort）目录**由当前所选模型在 `models_cache.json` 中的 `supported_reasoning_levels` 动态决定**。
  2. 对于主流模型（如 `gpt-6-astra`、`gpt-5.4`、`gpt-5.3-codex` 等），官方 `supported_reasoning_levels` 仅包含 **4 个标准档位**：
     - **低 (Low)** (`low`)
     - **中 (Medium)** (`medium`)
     - **高 (High)** (`high`)
     - **超高 (Extra high)** (`xhigh`)
  3. 此前前端写死了包含 `极速 (Minimal)` 在内的 5 个固定档位，导致与真实 Codex App 的 4 档（或按模型动态变化的档位）不一致。

- **修复方案**：
  1. 前端推理强度弹窗直接读取当前选中模型的 `supportedReasoningLevels`（若模型支持 4 档 `low` / `medium` / `high` / `xhigh`，则精准渲染这 4 档及对应描述；仅当某模型显式声明支持 `minimal` 时才显示 `minimal`）。
  2. 当切换模型时，若当前推理强度不在新模型的 `supportedReasoningLevels` 中，自动对齐到该模型的 `defaultReasoningLevel`。
