# AGENTS.md

- Default branch is `dev`. Local `main` may not exist; use `dev` or `origin/dev` for diffs.
- All PRs must reference an existing issue. See `CONTRIBUTING.md` for issue templates, vouch system, and PR expectations.

## Branch / commit conventions

- Branch names: short, at most three words, hyphenated, no slashes or type prefixes.  
  Examples: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`.
- Commits and PR titles: conventional commits, e.g. `feat(app):`, `fix(desktop):`, `chore(sdk):`.

## Toolchain

- Package manager: `bun` (pin is `bun@1.3.14` in `packageManager`). Use `bun` for everything.
- Typecheck: `bun run typecheck` from root runs `bun turbo typecheck`; from a package dir run `bun typecheck`.
- Never run `tsc` directly.
- Lint: `bun run lint` from root runs `oxlint`.
- Tests cannot run from repo root (`bun test` at root fails intentionally). Run `bun test` from the relevant package directory.
- CI runs `GITHUB_ACTIONS=false bun turbo test` and `bun run typecheck`.

## Development commands

- `bun install` — installs dependencies and runs `postinstall`: `bun run --cwd packages/core fix-node-pty`.
- `bun dev` — launches the interactive TUI in `packages/opencode`. Do not run as a blocking foreground command; use `tmux` or a server command instead.
- `bun dev serve` — starts the headless API server.
- `bun dev web` — starts server and opens the web UI.
- `bun dev <directory>` — runs TUI against a specific directory.
- `bun dev:web` — starts the `packages/app` Vite dev server only (backend must be running separately).
- `bun dev:desktop` — starts the Electron desktop app in dev mode.
- `bun dev:console` — starts the console web app.
- `bun dev:stats` — starts the stats SolidStart site.
- `bun dev:storybook` — starts storybook.

## Monorepo structure

Key packages:

- `packages/opencode` — CLI / TUI / server / session logic. Entry: `src/index.ts`.
- `packages/core` — Effect services, Drizzle DB, tools, plugins, LSP, filesystem.
- `packages/llm` — Effect Schema-first LLM core (routes, providers, protocols).
- `packages/schema` — Browser-safe wire/storage contracts.
- `packages/protocol` — HTTP/WS contracts and middleware.
- `packages/server` — Concrete HTTP router.
- `packages/client` — Generated Promise/Effect client from `server` HttpApi.
- `packages/sdk-next` — In-process Effect SDK that composes Client + Core + Server.
- `packages/sdk/js` — Legacy JavaScript SDK.
- `packages/tui` — TUI components and runtime.
- `packages/ui` — Shared SolidJS component library.
- `packages/app` — Shared SolidJS web app UI (used by web and desktop).
- `packages/desktop` — Electron wrapper around `packages/app`; sidecars `packages/opencode` server.
- `packages/web` — Astro/Starlight marketing/docs site.
- `packages/console/` — Nested workspace: console app, core, function.
- `packages/stats/` — Nested workspace: stats app, core, function.
- `packages/cli` — Experimental CLI (uses `tui`, `core`, `server`, `sdk`).

## Dependency direction

- Runtime code: `schema` → `core` / `protocol` → `server`.
- Client runtime may depend on `schema` and `protocol` only; never `core` or `server`.
- `sdk-next` is the only surface allowed to compose `client`, `core`, and `server`.

## Build / generate

- After changing the public `Protocol` or `Server` `HttpApi`, run `bun run generate` from `packages/client`. Verify with `bun run check:generated`.
- Do not edit `packages/client/src/generated` or `packages/client/src/generated-effect` directly.
- To regenerate the legacy JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- To build a standalone CLI binary, run `./packages/opencode/script/build.ts --single`; output is `packages/opencode/dist/opencode-<platform>/bin/opencode`.
- Desktop build: `bun run --cwd packages/desktop build && bun run --cwd packages/desktop package`.
- Full CI generate: `./script/generate.ts`.

## Testing

- `bun test` from the package directory (e.g., `packages/opencode`, `packages/core`, `packages/app`, `packages/ui`).
- `bun turbo test` runs the configured test graph.
- HttpApi gates: `bun run test:httpapi` from `packages/opencode`.
- E2E: `bunx playwright install chromium` then `bun run --cwd packages/app test:e2e:local`. Requires a backend at `localhost:4096` by default.
- On Windows, CI sets `OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true`.

## Offline / self-hosted deployment

If packaging for an environment with no general internet (only the AI provider endpoint):

- `OPENCODE_DISABLE_AUTOUPDATE=1`
- `OPENCODE_DISABLE_MODELS_FETCH=1`
- `OPENCODE_DISABLE_LSP_DOWNLOAD=1`
- `OPENCODE_DISABLE_SHARE=1`
- `OPENCODE_PURE=1`
- `OPENCODE_DISABLE_EMBEDDED_WEB_UI=1`
- Pre-install native binaries: `rg` in PATH, required LSP servers, and platform optional dependencies (`@parcel/watcher-*`, `@lydell/node-pty-*`).
- Pre-cache skills to `~/.cache/opencode/skills/` or avoid `skills.urls`.
- For desktop, remove or disable `electron-updater` before distributing offline.

## Code style

- Keep logic in one function unless composable/reusable. Avoid single-use helpers.
- Avoid `try`/`catch`, `any`, and `else`; prefer early returns and ternaries.
- Use `const`; avoid `let`.
- Prefer `Bun.file()` and Bun APIs.
- Avoid unnecessary destructuring; use dot notation.
- No aliased imports, no star imports, no `import * as Foo`.
- Use the module's own exported namespace: `import { Project } from "@opencode-ai/core/project"` then `Project.ID`.
- Dynamic imports for heavy modules; destructure near the top of the narrowest scope.
- In `src/config`, follow the existing self-export pattern: `export * as ConfigAgent from "./agent"`.
- Drizzle schema fields use `snake_case`.
- Avoid `export namespace Foo { ... }`; use flat top-level exports plus `export * as Foo from "./foo"` at the bottom of the file.
- For multi-sibling directories, do not add a barrel `index.ts`; import specific siblings.
- In Effect generators, bind services to named variables before calling methods; do not use nested `yield* (yield* Foo.Service).bar()`.

## V2 Session Core

- Keep durable prompt admission separate from model execution. `SessionV2.prompt(...)` admits one durable `session_input` row before scheduling advisory `SessionExecution.wake(sessionID)` unless `resume: false` requests admit-only behavior.
- Reusing a Session ID adopts the existing Session. Reusing a prompt message ID reconciles an exact retry only when Session, prompt, and delivery mode match; conflicting reuse fails.
- Keep `SessionExecution` process-global and Session-ID based.
- Keep `SessionRunner`, model resolution, tool registry, permissions, and filesystem Location-scoped.
- Preserve one explicit `llm.stream(request)` call per provider turn and reload projected history before durable continuation.
- Keep delivery vocabulary explicit: prompts steer by default; an explicit `queue` input stays pending until the Session would otherwise become idle.
- Keep EventV2 replay owner claims separate from clustered Session execution ownership.

## Package-specific guides

- `packages/opencode/AGENTS.md` — Effect runtime, module shape, database, TUI dev server.
- `packages/app/AGENTS.md` — local dev setup, SolidJS, Playwright, browser automation.
- `packages/llm/AGENTS.md` — routes, providers, protocols, recording tests.
- `packages/schema/AGENTS.md` — schema boundary, naming, optional fields, V1 coexistence.
- `packages/core/src/tool/AGENTS.md` — tool registry, application tools, permissions, output.
- `packages/desktop/AGENTS.md` — IPC boundaries (renderer uses `window.api`, main registers in `src/main/ipc.ts`).
