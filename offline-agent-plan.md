# 离线 Agent 桌面应用开发计划

## 1. 项目目标

开发一个在**无互联网环境**中运行的 Agent 代理应用（桌面版优先）。环境中没有公网，但允许访问本地或内网的 AI 接口提供商（如本地 Ollama / vLLM，或企业内网 API）。

## 2. 技术选型结论

### 2.1 不选 Pi，选 OpenCode

- **Pi** 的定位是"minimal terminal coding harness"，核心只有 CLI / TUI / Node.js SDK，没有官方 Web 或 Desktop 包。要做成桌面应用，基本等于自己重写 UI 和进程通信，成本很高。
- **OpenCode** 仓库本身包含 `packages/web`（Web 应用）、`packages/desktop`（Electron 桌面应用）、`packages/opencode`（CLI/TUI 后端）、`packages/client` 和 `packages/sdk`，已经是一个多端产品。
- 因此，**做桌面离线 Agent 应用应基于 OpenCode 的 `packages/desktop`**。

### 2.2 只开发桌面版是否可行

- **可行**，但 `packages/desktop` 不是独立包，它是整个 OpenCode monorepo 的 Electron 外壳。
- 桌面应用 = `packages/desktop`（Electron 壳） + `packages/opencode`（作为本地 sidecar 后端） + `@opencode-ai/app/ui`（渲染层 UI）。
- 可以只发布桌面版，不发布 Web 版和 CLI，但构建时仍需要构建整个 monorepo 的相关 workspace 包。

## 3. 离线部署关键开关

OpenCode 默认会尝试联网，但每个行为都有开关或预缓存方案：

| 网络行为 | 开关 / 离线方案 |
| --- | --- |
| 启动时检查更新 | `OPENCODE_DISABLE_AUTOUPDATE=1` 或全局配置 `autoupdate: false` |
| 拉取 models.dev 模型目录 | `OPENCODE_DISABLE_MODELS_FETCH=1` 或 `OPENCODE_MODELS_PATH=/path/to/models.json` |
| LSP 语言服务器自动下载 | `OPENCODE_DISABLE_LSP_DOWNLOAD=1` |
| 分享功能 | `OPENCODE_DISABLE_SHARE=1` |
| 远程 Skill 下载 | 删除 `skills.urls`，只保留本地 skill 目录；首次联网后可缓存到 `~/.cache/opencode/skills/<hash>/` |
| 外部 npm 插件安装 | `OPENCODE_PURE=1`，只使用内置插件 |
| OpenCode 账号 / OAuth | 不登录，只使用 API key 方式的本地/内网 AI 提供商 |
| ripgrep 二进制下载 | 预装 `rg` 到 PATH |
| `.opencode` 目录插件依赖 | 预置该目录的 `node_modules`，或不使用 `.opencode` 目录 |
| Websearch / Webfetch 工具 | 不启用，或缺省 API key 使工具无法调用 |
| 桌面版自动更新 | 打包时关闭 `electron-updater` / 移除更新检查逻辑 |

## 4. 桌面版需要额外处理的部分

桌面版已经设置 `OPENCODE_DISABLE_EMBEDDED_WEB_UI = "true"`，不会回退到 `https://app.opencode.ai`，而是本地起 sidecar，因此**比 Web 版更适合离线**。

但桌面版仍有以下需要处理：

- `src/main/updater.ts` 的自动更新每 10 分钟检查一次，离线部署必须关闭。
- `src/main/wsl/` 的 Windows WSL 集成功能，如不需要可移除。
- `opencode://` deep link 和协议处理，可按需简化。
- `@lydell/node-pty-*`、`@parcel/watcher-*` 等原生依赖，需要按目标平台预装对应平台二进制。
- `packages/opencode` sidecar 的离线环境变量需要一并配置。

## 5. 推荐开发路径

1. 以 `packages/desktop` 为起点，逐步剥离不需要的功能：去掉自动更新、WSL、deep link 等。
2. UI 和组件修改优先在 `@opencode-ai/app` 和 `@opencode-ai/ui` 里进行，不在 `packages/desktop` 硬写。
3. 把 `packages/opencode` 的 sidecar 当作后端，配置离线环境变量。
4. 构建流程仍需要全 monorepo `bun install`，然后 `bun run build && bun run package`。
5. 用 `electron-builder` 打出 `dmg` / `exe` / `AppImage`，单包安装即可离线运行。
6. 防火墙策略：只允许桌面应用访问 AI 提供商接口，其他外网出站全部阻断。

## 6. 仓库信息

- 原仓库：`anomalyco/opencode`
- 已 fork 到：`maicent/opencode`
- 本地工作区 `origin` 已改为：`https://github.com/maicent/opencode.git`

## 7. 下一步行动清单

- [ ] 在本地验证 `packages/desktop` 能正常 `bun dev` 启动。
- [ ] 关闭桌面版自动更新逻辑，验证打包后无更新请求。
- [ ] 为 sidecar 配置离线环境变量并验证无网络请求。
- [ ] 在目标平台（Linux / Windows / macOS）打出一个可离线运行的安装包。
- [ ] 在纯内网环境中用本地 AI 提供商（Ollama / vLLM）做端到端测试。
