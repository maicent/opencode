# AGENTS.md

本仓库是 `anomalyco/opencode` monorepo 的 fork（`maicent/opencode`)，用于开发 **Storm Fish（拜风鱼）**——基于 opencode 的离线 AI 代理桌面端。核心交付物是 `packages/desktop` 产出的**离线 Windows 桌面安装器**。

- 默认分支 `dev`；本地可能没有 `main`,diff 用 `dev` 或 `origin/dev`。
- 远端：`origin` = `maicent/opencode`（本 fork),`upstream` = `anomalyco/opencode`（上游）。
- 所有 PR 必须关联一个已有 issue，见 `CONTRIBUTING.md`（issue 模板、vouch 机制、PR 要求）。
- 离线设计背景与开关对照表见根目录 `offline-agent-plan.md`（中文）。

## Storm Fish 离线桌面端构建

一条命令产出离线安装器（在 `packages/desktop` 下）:

```
bun run dist:win:offline
```

按序执行：(1) `scripts/prepare-win-natives.ts` 抓取 bun 在 linux 宿主上跳过的 win32-x64 原生 optional 依赖（node-pty / watcher / msgpackr);(2) `scripts/prepare-wine.ts` 在 PATH 无 wine 时下载便携 Kron4ek wine 到 `.cache/wine`（已 gitignore);(3) export `PATH(.cache/wine/bin)` + `WINEPREFIX` + 离线环境变量；(4) 离线 `electron-vite build`(`OPENCODE_OFFLINE=1`);(5) `electron-builder --win` → `dist/opencode-desktop-win-x64.exe`(NSIS 安装器）。

便携 zip（免安装，气隙环境更合用）:`electron-builder --win zip`。win target 默认仅 `nsis`,zip 需显式指定；`zip` 目标**不需要 wine**。

易踩的坑（均已验证）:

- `electron-builder` 只打包已存在的 `out/`,**不会重跑 vite 构建** → `OPENCODE_OFFLINE` 这类构建期 define 必须先经 vite 构建烘焙进 `out/` 再打包。`dist:win:offline` 已按序处理，别拆散顺序。
- bun 在 linux 宿主只装本平台的 optional 原生依赖；跨平台打 win 包必须用 `prepare-win-natives.ts` 补 win32 变体，否则打进的是 linux ELF,Windows 上启动即崩。
- 只有 NSIS 步骤需要 wine（跑 rcedit/signtool 给 exe 嵌入图标/版本元数据）;`zip` 目标与 `win-unpacked` 不需要。已由 `prepare-wine.ts` 自动化，无需 sudo/apt。
- 离线开关链路：构建期 define `OPENCODE_OFFLINE`(`electron.vite.config.ts`)→ `OFFLINE` 常量（`src/main/constants.ts`)→ 门控 updater 启动与 10 分钟检查定时器（`src/main/index.ts`)，并经 `preferAppEnv` 向 sidecar 注入 `OFFLINE_ENV`(`src/main/server.ts`，含 `OPENCODE_DISABLE_AUTOUPDATE/MODELS_FETCH/LSP_DOWNLOAD/SHARE/PURE`)。改离线行为从这些点入手。
- updater 用 `enabled:false` 使 `check()` 立即返回、零网络；离线**不需要**移除 `electron-updater`。
- `node-pty` 经静态 import 链（`index.ts → wsl/servers.ts → wsl/runtime.ts → @lydell/node-pty`）启动即加载；跨平台打包靠 `electron.vite.config.ts` 的 `OPENCODE_TARGET_PLATFORM` override 让它在构建期解析到 win32 原生变体。
- 渲染层 Sentry 仅在 `VITE_SENTRY_DSN` 设置时启用；主进程 crash reporting 用 `uploadToServer:false`（无网络）。离线构建不传 Sentry DSN 即可。
- 品牌：`electron-builder.config.ts` 的 `appId`/`productName` 及图标仍是 opencode 原值（`ai.opencode.desktop` / `OpenCode`)；发布 Storm Fish 正式版需改品牌资源。

桌面端开发：仓库根 `bun dev:desktop`，或 `bun --cwd packages/desktop dev`。

## 分支 / 提交规范

- 分支名：简短、至多三个词、连字符分隔、不带斜杠或类型前缀。例：`session-recovery`、`fix-scroll-state`、`regenerate-sdk`。
- 提交与 PR 标题用 conventional commits，如 `feat(app):`、`fix(desktop):`、`chore(sdk):`。

## 工具链

- 包管理器：`bun`（`packageManager` 锁定 `bun@1.3.14`)，一律用 `bun`。
- 类型检查：仓库根 `bun run typecheck`（跑 `bun turbo typecheck`)；包目录内 `bun typecheck`。**不要直接跑 `tsc`**。
- Lint：仓库根 `bun run lint`（跑 `oxlint`)。
- 测试**不能**在仓库根跑（根目录 `bun test` 是故意失败的），在对应包目录跑 `bun test`。
- CI 跑 `GITHUB_ACTIONS=false bun turbo test` 与 `bun run typecheck`。

## 开发命令

- `bun install` — 装依赖并跑 `postinstall`:`bun run --cwd packages/core fix-node-pty`。
- `bun dev` — 启动 `packages/opencode` 的交互式 TUI。别当前台阻塞命令跑，用 `tmux` 或 server 命令。
- `bun dev serve` — 启动无头 API server。
- `bun dev web` — 启动 server 并打开 Web UI。
- `bun dev <directory>` — 针对指定目录跑 TUI。
- `bun dev:web` — 只启动 `packages/app` 的 Vite dev server（后端需单独跑）。
- `bun dev:desktop` — 开发模式启动 Electron 桌面端。
- `bun dev:console` — 启动 console Web 应用。
- `bun dev:stats` — 启动 stats SolidStart 站点。
- `bun dev:storybook` — 启动 storybook。

## Monorepo 结构

关键包：

- `packages/opencode` — CLI / TUI / server / session 逻辑。入口 `src/index.ts`。
- `packages/core` — Effect services、Drizzle DB、tools、plugins、LSP、filesystem。
- `packages/llm` — Effect Schema 优先的 LLM 核心（routes、providers、protocols)。
- `packages/schema` — 浏览器安全的 wire/storage 契约。
- `packages/protocol` — HTTP/WS 契约与中间件。
- `packages/server` — 具体 HTTP router。
- `packages/client` — 由 `server` HttpApi 生成的 Promise/Effect client。
- `packages/sdk-next` — 进程内 Effect SDK，组合 Client + Core + Server。
- `packages/sdk/js` — 旧版 JavaScript SDK。
- `packages/tui` — TUI 组件与运行时。
- `packages/ui` — 共享 SolidJS 组件库。
- `packages/app` — 共享 SolidJS Web 应用 UI(web 与 desktop 共用）。
- `packages/desktop` — `packages/app` 的 Electron 外壳；sidecar 跑 `packages/opencode` server。**Storm Fish 的主战场**。
- `packages/web` — Astro/Starlight 营销/文档站。
- `packages/console/` — 嵌套 workspace:console app、core、function。
- `packages/stats/` — 嵌套 workspace:stats app、core、function。
- `packages/cli` — 实验性 CLI（用 `tui`、`core`、`server`、`sdk`)。

## 依赖方向

- 运行时代码：`schema` → `core` / `protocol` → `server`。
- client 运行时只能依赖 `schema` 与 `protocol`，绝不能依赖 `core` 或 `server`。
- `sdk-next` 是唯一允许组合 `client`、`core`、`server` 的层。

## 构建 / 代码生成

- 改了公开的 `Protocol` 或 `Server` `HttpApi` 后，在 `packages/client` 跑 `bun run generate`，用 `bun run check:generated` 校验。
- 不要直接改 `packages/client/src/generated` 或 `packages/client/src/generated-effect`。
- 重新生成旧版 JavaScript SDK:`./packages/sdk/js/script/build.ts`。
- 构建独立 CLI 二进制：`./packages/opencode/script/build.ts --single`，产物 `packages/opencode/dist/opencode-<platform>/bin/opencode`。
- 桌面端打包见上文「Storm Fish 离线桌面端构建」；非离线打包：`bun run --cwd packages/desktop build && bun run --cwd packages/desktop package`。
- 完整 CI 生成：`./script/generate.ts`。

## 测试

- 在包目录跑 `bun test`（如 `packages/opencode`、`packages/core`、`packages/app`、`packages/ui`)。
- `bun turbo test` 跑配置好的测试图。
- HttpApi 门禁：在 `packages/opencode` 跑 `bun run test:httpapi`。
- E2E:`bunx playwright install chromium` 后跑 `bun run --cwd packages/app test:e2e:local`，默认需要 `localhost:4096` 的后端。
- Windows 上 CI 设 `OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true`。

## CLI / 服务端自托管（手动离线环境变量）

为「无公网、只有 AI provider 端点」的环境做 CLI/服务端部署时（区别于上面的桌面端自动构建）:

- `OPENCODE_DISABLE_AUTOUPDATE=1`
- `OPENCODE_DISABLE_MODELS_FETCH=1`
- `OPENCODE_DISABLE_LSP_DOWNLOAD=1`
- `OPENCODE_DISABLE_SHARE=1`
- `OPENCODE_PURE=1`
- `OPENCODE_DISABLE_EMBEDDED_WEB_UI=1`
- 预装原生二进制：`rg` 进 PATH、所需 LSP server、平台 optional 依赖（`@parcel/watcher-*`、`@lydell/node-pty-*`)。
- 预缓存 skill 到 `~/.cache/opencode/skills/`，或不用 `skills.urls`。

## 代码风格

- 逻辑尽量放在一个函数里，除非可组合/复用；避免一次性 helper。
- 避免 `try`/`catch`、`any`、`else`；优先 early return 与三元表达式。
- 用 `const`，避免 `let`。
- 优先 `Bun.file()` 与 Bun API。
- 避免不必要的解构，用点号访问。
- 不用别名导入、不用星号导入、不用 `import * as Foo`。
- 用模块自己导出的命名空间：`import { Project } from "@opencode-ai/core/project"` 然后 `Project.ID`。
- 重模块用动态 import；在最窄作用域顶部附近解构。
- `src/config` 里沿用既有自导出模式：`export * as ConfigAgent from "./agent"`。
- Drizzle schema 字段用 `snake_case`。
- 避免 `export namespace Foo { ... }`；用扁平顶层导出，文件底部加 `export * as Foo from "./foo"`。
- 多同级文件的目录不要加 barrel `index.ts`，直接导入具体同级文件。
- Effect generator 里先把 service 绑定到具名变量再调方法，不要嵌套 `yield* (yield* Foo.Service).bar()`。

## V2 Session Core

- 持久化 prompt 准入与模型执行分离。`SessionV2.prompt(...)` 先落一条持久 `session_input` 行，再调度建议性的 `SessionExecution.wake(sessionID)`，除非 `resume: false` 要求仅准入。
- 复用 Session ID 即采用既有 Session。复用 prompt message ID 仅当 Session、prompt、投递模式都匹配时才调和为精确重试，冲突的复用会失败。
- `SessionExecution` 保持进程级全局、按 Session-ID 划分。
- `SessionRunner`、模型解析、工具注册、权限、filesystem 都按 Location 划分。
- 每个 provider turn 保留一次显式 `llm.stream(request)` 调用，持久化续跑前重新加载投影历史。
- 投递语义显式：prompt 默认即 steer；显式 `queue` 输入保持 pending，直到 Session 即将空闲。
- EventV2 回放 owner 认领与集群化 Session 执行所有权分开。

## 各包指南

- `packages/opencode/AGENTS.md` — Effect 运行时、模块形态、数据库、TUI dev server。
- `packages/app/AGENTS.md` — 本地开发、SolidJS、Playwright、浏览器自动化。
- `packages/llm/AGENTS.md` — routes、providers、protocols、录制测试。
- `packages/schema/AGENTS.md` — schema 边界、命名、optional 字段、V1 共存。
- `packages/core/src/tool/AGENTS.md` — 工具注册、应用工具、权限、输出。
- `packages/desktop/AGENTS.md` — IPC 边界（renderer 用 `window.api`,main 在 `src/main/ipc.ts` 注册）。
