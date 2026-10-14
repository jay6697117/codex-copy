# OpenAI Codex Desktop — 深度审计、根因分析与 100% 官方级复刻重构报告

## 一、 九张截图与四大核心问题深度审计

### 1. 任务执行中缺乏实时运行态指示与长任务 `Load failed` 断流（图 1 `20BD3693...` & 图 2 `CBE731C5...`）
- **根因诊断**：
  1. **多阶段工具调用间隙缺乏底部实时状态栏**：在 [src/services/appServerClient.ts](file:///Users/zhangjinhui/Desktop/codex-test/src/services/appServerClient.ts) 中，原先在收到第一条中间 `agent_message`（例如 `进入 Code 阶段...`）时就将顶部的 `reasoning` 条目置为 `completed`（显示为静态的 `已思考 54s`）。当后续连续执行完 9 条 Shell 命令（均显示 `exit 0`）并进入下一轮推理或长命令执行时，消息流底部没有任何处于 `streaming` 状态的动画组件，导致界面看起来像卡死或中断。
  2. **macOS `WKWebView` 流式请求空闲超时 (`Load failed`)**：当 `codex exec` 在 `xhigh` / `Max` / `Ultra` 模式下深度思考或执行耗时测试超过约 60 秒未向 stdout 输出新行时，`WKWebView` 的 `fetch` 流会因 Socket 空闲超时抛出 `TypeError: Load failed`，并被前端 catch 块直接渲染为 `无法连接到本机 Codex 服务: Load failed`。
- **修复与优化**：
  1. **新增官方风格底部实时执行状态栏 (`renderLiveTurnActivityBar`)**：在 [src/components/CenterThreadView.tsx](file:///Users/zhangjinhui/Desktop/codex-test/src/components/CenterThreadView.tsx) 中，只要当前 Turn 处于 `in_progress` 状态，消息流最底部始终展示带呼吸脉冲光圈与旋转指示器的实时状态栏，动态反馈当前阶段（`正在执行终端命令...` / `正在分析命令执行结果并规划下一步操作...` / `已编辑文件，正在验证代码变更...`）、已执行步数徽章（如 `已执行 9 步`）、实时递增秒表（`55s`）以及快捷 `停止` 按钮。
  2. **多阶段推理块按时间轴动态追加**：当命令执行后再次产生新的 `reasoning` 事件时，自动在对应时间轴位置创建新的流式思考卡片。
  3. **2 秒级服务端流式心跳保活 (`bridge.heartbeat`)**：在 [server/codex-local-bridge.mjs](file:///Users/zhangjinhui/Desktop/codex-test/server/codex-local-bridge.mjs) 的 `streamLocalCodexTurn` 中注入每 2 秒一次的 `{"type":"bridge.heartbeat","elapsedSec":...}` 保活帧，彻底杜绝 `WKWebView` 长连接超时导致的 `Load failed`；同时在前端流结束异常恢复逻辑中，若已收到有效执行步骤则自动同步 Git 状态并平滑收尾。

---

### 2. 在 `/Users/zhangjinhui/Desktop/my-g4-app` 发送提示词后出现在所有历史目录中（图 2 `CBE731C5...`）
- **根因诊断**：
  1. **Base64 前缀截断导致的严重 ID 哈希碰撞**：在 [server/codex-local-bridge.mjs](file:///Users/zhangjinhui/Desktop/codex-test/server/codex-local-bridge.mjs) 中，此前生成工作空间 ID 的代码为：
     `const id = 'proj_' + Buffer.from(normalized).toString('base64url').slice(0, 18);`
     由于所有位于 `/Users/zhangjinhui/...` 下的目录路径前 18 个字节都是 `/Users/zhangjinhui`，其 Base64 编码前 18 位完全相同（均为 `proj_L1VzZXJzL3poYW5nam`）！
  2. 这导致所有用户目录拥有**完全相同的 `project.id`**，因此在 `my-g4-app` 下发送一条提示词，侧边栏 `th.projectId === project.id` 会在所有目录下同时匹配成功并同时展开！
- **修复方案**：
  1. 在 [server/codex-local-bridge.mjs](file:///Users/zhangjinhui/Desktop/codex-test/server/codex-local-bridge.mjs) 中引入 `crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12)` 生成全局唯一、无碰撞的 `makeWorkspaceId(normalizedPath)`。
  2. 在 [src/components/LeftSidebar.tsx](file:///Users/zhangjinhui/Desktop/codex-test/src/components/LeftSidebar.tsx) 与 [src/App.tsx](file:///Users/zhangjinhui/Desktop/codex-test/src/App.tsx) 中，严格按规范化绝对路径 `normalizePath(th.cwd) === normalizePath(project.repoPath)` 将会话绑定至唯一对应的工作空间目录。

---

### 3. 屏蔽未在本应用中使用的历史目录/会话，并支持折叠收起（图 3 `00D35500...`）
- **根因诊断**：
  1. `listAllWorkspaces` 此前读取了 `~/.codex/config.toml` 中的 `[projects."..."]` 历史记录，把本机 CLI 曾经访问过的 20 多个无关目录（如 `frost-trail`、`PinBattle`、`kickoff`、`RopePuzzle`、`uncle-wolf-node` 等）全部塞进了侧边栏。
  2. `scanLocalCodexSessions` 此前读取了 `~/.codex/history.jsonl` 的全部历史记录，将未在本应用中打开过的旧会话全部塞入 `最近` 列表，且不支持折叠。
- **修复方案**：
  1. **严格隔离应用工作空间存储**：将工作空间配置文件独立为 `~/.codex/codex_desktop_app_workspaces_v2.json`，彻底移除对 `~/.codex/config.toml` 中 `[projects]` 的自动扫描导入，仅展示用户在本应用中实际使用或新建的工作目录（如 `codex-test`、`my-g4-app`）。
  2. **仅展示归属于本应用工作空间的会话**：过滤 `scanLocalCodexSessions` 与前端 `recentThreads`，不再导入任何非本应用工作目录的外部历史会话。
  3. **支持分段折叠与“展开更多/收起”**：在 [src/components/LeftSidebar.tsx](file:///Users/zhangjinhui/Desktop/codex-test/src/components/LeftSidebar.tsx) 中，为 `项目` 与 `最近` 标题栏增加点击折叠/展开切换箭头，超出默认条数时提供 `展开更多 / 收起` 按钮，并支持悬停一键移除单个目录或会话。

---

### 4. 100% 像素级复刻官方模型推理强度滑动选择器（图 4–6 对比官方图 7–9 `5D0327A7...`, `F4D978F4...`, `3EFE149D...`）
- **官方截图细节对比审计**：
  1. **六档档位命名**：官方中文界面下 6 个档位依次为 `低` (`low`)、`中` (`medium`)、`高` (`high`)、`极高` (`xhigh`)、`Max` (`max`)、`Ultra` (`ultra`)——第 5、6 档在官方中文界面下固定显示为 **`Max`** 与 **`Ultra`**（而非“超高”、“最大”）。
  2. **标题色彩变化**：前 5 档（`低` / `中` / `高` / `极高` / `Max`）顶部标题为亮蓝色 `#388BFD`，而第 6 档 **`Ultra`** 顶部标题变为星空紫罗兰色 **`#A78BFA`**。
  3. **滑道与纯白大圆滑块几何比例**：
     - 之前版本将白色圆滑块包裹在蓝色粗滑道内部（滑道比滑块更粗，导致滑块右侧有一圈蓝边）。
     - 官方截图中，胶囊滑道高度更纤细（`26px`），而纯白圆形滑块直径更大（`34px`），**白色圆滑块上下各凸出滑道边界 `4px`**，且左侧蓝色填充条（`#2E7CF6`）精准终止于白色圆滑块圆心处，右侧为深灰底色（`#38383C`），绝无蓝边包裹滑块右侧的现象。
  4. **`Ultra` 档位专属星云粒子滑道（图 9 `3EFE149D...`）**：
     - 当滑块推至最右侧 `Ultra` 档位时，整条胶囊滑道变为蓝紫渐变星云背景（`linear-gradient(90deg, #1E42B8 0%, #375DF5 24%, #6D4AFF 58%, #9055EB 85%, #A66BFF 100%)`），内部散落大小与透明度各异的发光白色星尘粒子簇。
  5. **底部触发胶囊联动**：当推理强度弹窗处于打开状态时，输入框右下角触发按钮切换为深灰圆角胶囊 **`选择强度 ⌄`**，支持点击档位与按住鼠标左右平滑拖拽滑块。
