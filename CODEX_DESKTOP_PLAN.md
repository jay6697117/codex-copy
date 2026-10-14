# OpenAI Codex Desktop 深度优化方案（中英双语、Goal 目标模式、微信/QQ/钉钉三款皮肤与真实开发工作流验证）

## 一、 广泛深入调研结论（Research Findings）

### 1. 新版 OpenAI Codex Desktop 的 `Goal` 模式（替代旧版 `Plan` 模式）
根据 OpenAI Codex 最新文档与专题指南（参考：[Codex `/goal` Guide — Kingy AI](https://kingy.ai/news/openai-codex-goal-the-new-long-horizon-mode-for-agentic-coding/)、[Codex `/goal`: Persistent Objectives — LaoZhang AI](https://blog.laozhang.ai/en/posts/codex-goal)、[How to use the Codex desktop app — Flavio Copes](https://flaviocopes.com/codex/)）：
- **核心机制**：新版 Codex Desktop 将长周期自主工作收敛为 **Goal 模式（`/goal`）**。用户点击 Composer 底部的 **`Goal（目标）`** 按钮或输入 `/goal <持久目标描述>`，即可为当前会话绑定一个跨轮次的持久目标（Persistent Objective，上限 4,000 字符），包含期望结果、约束边界与可验证完成条件（Stopping Condition）。
- **桌面端交互控件（Goal Progress Row）**：
  - 当会话绑定了 Goal 后，在 Composer 正上方会常驻一条 **目标进度控制栏（Goal Bar）**，展示当前目标内容与状态（`进行中 Active` / `已暂停 Paused` / `已完成 Completed`）。
  - 支持四大生命周期操作：
    1. **查看/编辑目标（`编辑` / `/goal edit`）**：调整验收条件或目标范围。
    2. **暂停目标（`暂停` / `/goal pause`）**：暂停长周期自主推进以审查代码 Diff。
    3. **继续执行（`继续` / `/goal resume`）**：恢复已暂停的目标并继续推进下一轮。
    4. **清除目标（`清除` / `/goal clear`）**：移除当前绑定的持久目标（保留已生成的文件改动）。

---

### 2. 微信皮肤、QQ皮肤、钉钉皮肤的设计规范与色彩体系调研
通过对 [微信标准色彩指引](https://res.wx.qq.com/a/wx_fed/wedesign/res/2b7c/WeChat_Standard_Color_Guidelines_201703.pdf)、[腾讯 TDesign 色彩体系](http://tdesign.tencent.com/design/color)、[腾讯 QQ Design 官方色彩规范 (`qq.design`)](https://qq.design/design/Foundation/Color/) 与 [钉钉设计开放平台 OpenUI (`ding.design`)](https://ding.design/) 的深入调研，我们提炼出三款国民级桌面应用最具辨识度的视觉基因：

| 皮肤维度 | 1. 微信皮肤 (`wechat` · 默认皮肤) | 2. QQ皮肤 (`qq` · 腾讯 QQ NT 风格) | 3. 钉钉皮肤 (`dingtalk` · 钉钉专业工作台风格) |
| :--- | :--- | :--- | :--- |
| **设计气质** | 温润克制、极简灰白分层、标志性微信绿与经典荧光绿聊天气泡 | 年轻灵动、通透冰川蓝灰背景、活力企鹅天蓝气泡与轻渐变高光 | 专业高效、深邃商务藏蓝侧栏与工作台、高对比科技蓝强调色 |
| **主画布背景 (`--bg-app`)** | `#F5F5F5`（微信桌面版经典浅灰聊天底色） | `#F2F5FA`（QQ `@color_icon_general_04` `#EBEDF5` 冰蓝灰底色） | `#161E2E`（钉钉深色专业工作台底色） |
| **左侧边栏 (`--bg-sidebar`)** | `#EAEAEA`（微信桌面版标志性中灰会话列表栏） | `#E8EEF8`（QQ NT 轻透雾蓝侧边栏） | `#101622`（钉钉企业级深海藏蓝导航栏） |
| **顶部导航栏 (`--bg-header`)** | `rgba(245, 245, 245, 0.95)` + `#DCDCDC` 分割线 | `linear-gradient(90deg, #EBF2FC, #F5F8FD)` 毛玻璃顶栏 | `rgba(16, 22, 34, 0.94)` + `#26334D` 商务分割线 |
| **卡片/AI气泡 (`--bg-card`)** | `#FFFFFF`（纯白客态卡片，配 `#E4E4E4` 细边框） | `#FFFFFF`（纯白圆润卡片，配 `#DCE4F2` 边框） | `#1E293E`（深蓝灰商务卡片，配 `#2C3B59` 边框） |
| **用户发送气泡 (`--user-bubble-bg`)** | **`#95EC69`**（微信最具代表性的浅绿主态气泡，配 `#111111` 深色字） | **`#0099FF`**（QQ 官方 `@color_bubble_host` `#00CAFC/#0099FF` 蓝气泡，白字） | **`#0089FF`**（钉钉官方品牌蓝气泡，配 `#FFFFFF` 纯白字） |
| **品牌主色/按钮 (`--accent-primary`)** | **`#07C160`**（微信标准品牌绿 WeChat Green） | **`#0099FF`**（QQ 品牌天蓝，辅以 `#02D8FC → #1FA5FF` 渐变） | **`#0089FF`**（钉钉标准商务蓝 DingTalk Blue） |
| **主/次文字颜色** | `#191919` / `#5C5C5C` / `#888888` | `#03081A` / `#4E5670` / `#8E96B0` | `#F0F4FA` / `#A3B3CC` / `#6C7F9E` |

---

### 3. 中英双语国际化架构（默认中文，设置中切换英文）
- 建立完整的 `src/i18n/translations.ts` 字典体系，支持：
  - **`zh-CN`（简体中文，默认）**：所有导航栏（`新建会话`、`自动化任务`、`技能中心`、`待审队列`、`工作树 (Worktrees)`、`设置与本机配置`）、顶部工具栏（`在 Cursor 中打开`、`提交代码`、`审查改动`）、Composer 控件（`目标模式 /goal`、`本地工作区 / 独立工作树`、`默认权限 / 只读模式 / 完全访问`、`推理强度：高`）以及设置中心全中文呈现。
  - **`en-US`（English）**：完整保留官方英文原版术语，可在 **设置 (Settings)** 页面中一键切换，状态持久化至 `localStorage`。
- **界面减负**：将原有的顶部换肤按钮移入 **设置 (Settings)** 页面，与语言切换并列排布，释放顶部 Header 空间，避免遮挡项目与会话标题。

---

### 4. 真实本机 Codex 开发能力验证与冗余清理计划
1. **优化本机 `codex` CLI 调用兼容性（`server/codex-local-bridge.mjs`）**：
   - 使用交互式登录 Shell（`/bin/zsh -ilc "which codex"`）确保加载 `.zshrc` / `.zprofile` 中的 PATH。
   - 当用户选择的模型与本机 `~/.codex/config.toml` 默认模型（如 `gpt-6-astra`）一致时，自动交由本机 `config.toml` 驱动，避免多余参数冲突；将 `max` 推理强度安全映射为 `high`，确保所有版本 `codex exec --json` 稳定运行。
   - 在 Goal 模式下，自动将当前线程绑定的持久目标（Objective）与完成准则注入 `codex exec` 上下文。
2. **真实开发测试闭环**：
   - 通过应用后端接口与本机环境联动，执行真实的开发指令、文件读写与 `git status` / `git diff` 校验。
3. **全面清理测试与不必要的功能组件**：
   - 删除未使用的旧版顶栏组件 `src/components/TopCommandBar.tsx`。
   - 删除与核心开发工作台无关的 3D 游戏演示组件 `src/components/VoxelVelocityGame.tsx`。
   - 清理 `src/data/initialCodexData.ts` 中虚构的 `voxel-velocity-3d`、`app-server-harness` 假项目与冗余英文演示历史，仅保留当前真实本地仓库 `codex-test` 与本机 `~/.codex/sessions` 真实历史会话。
