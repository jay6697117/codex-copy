# Sites 公开部署核查

任务：`01a13985-1358-7571-8d6b-3ba6d27cd84c`；核查日期：2026-10-14。

- 本地项目为 `codex-desktop-app`，使用 React、TypeScript、Vite、Electron 和本机 Node 后台。
- `.openai/hosting.json` 不存在，无已保存的站点 ID、版本 ID 或部署 ID。
- Sites 原生 `list_sites` 返回 20 个已有站点，分页结束；均已配置 public，没有与本项目或当前线程匹配的站点。
- `src/services/appServerClient.ts` 将后台请求回退至 `http://127.0.0.1:4500`。Codex 会话、文件系统、Git、终端能力依赖本机服务。
- `vite.config.ts` 的本机 API 中间件只在开发服务器中运行，Vite 静态构建不会提供这些 API。
- `src/data/initialCodexData.ts` 中的“部署 Sites 并公开访问”等内容是示例标题，不构成实际部署记录。
- Sites 服务端运行环境为 Cloudflare Workers；不能直接部署本机 Electron 与子进程运行方式。
- 访问目标为 public，即任何获得链接的访问者；这与仅工作区成员可见不同。

## 目标明确后的发布证据

- 用户明确指定“当前 Codex 项目”，前述目标缺失问题已解除。
- 站点 ID：`appgprj_6acf3fbbd9d08191b83c4094cd91bf71`。
- 公开地址：https://cod![alt text](image.png)ex-workbench-stevezhang.qilei991012.chatgpt.site
- 公开版通过 `.env.sites` 和 `npm run build:site` 构建。桌面版继续使用原 `npm run build`。
- 公开版首次访问不请求本机服务；点击连接后才启用 loopback 请求，并使用服务返回的真实工作目录。刷新断开连接。
- 原生部署结果为 `succeeded`；后续 `get_site` 返回 `access_mode=public`、`latest_version_number=1`、`disabled_by=null`。
- 干净的隔离浏览器会话直接打开线上地址，工作台正常渲染，没有登录跳转、控制台错误或首次加载的 API 请求。
