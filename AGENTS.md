# AGENTS.md

Instructions for AI coding agents working in this repository.

## What this repo is

**Nonna** (`nonnajs/nonna`) is a pnpm/Turborepo monorepo for a zero-reflection,
runtime-agnostic Dependency Injection framework:

-   `di/` — `@nonnajs/di`, the runtime container (zero dependencies, no `reflect-metadata`).
-   `compiler/` — `@nonnajs/compiler`, an AOT TypeScript `TypeChecker`-based compiler that infers
    constructor dependency tokens at build time (`nonna-compile` CLI).
-   `react/`, `vue/`, `svelte/`, `web-components/`, `stencil/` — framework bindings on top of `di`.
-   `vite-plugin/` — browser build shims for `@nonnajs/di`'s Node-builtin imports.
-   `samples/` — runnable reference apps (see "Samples are separate repos" below).
-   `docs/` — architecture diagrams and supporting docs.

Read the root `README.md` first for the architecture, feature list, and full quick-start; it is the
source of truth ahead of package-level READMEs.

## Non-negotiable design invariants

These are enforced by guardrail tests — do not "fix" a failing guardrail by weakening it:

-   **`@nonnajs/di` has zero runtime dependencies.** Never add a dependency to `di/package.json`.
-   **No `reflect-metadata`, no `emitDecoratorMetadata`.** Runtime source files must never import
    `reflect-metadata` or the `compiler` package.
-   **Runtime-agnostic.** `di/` code must run unmodified on Node.js 18+, Deno, and Bun. The only
    platform-specific piece is `ContextStorage` (defaults to `AsyncLocalStorage`, swappable).
-   **Async-ness is static, not sniffed.** Whether a factory/`onInit()` is async is determined by
    its own declared shape, not by checking if a call returned a `Promise`.
-   **Scope safety is validated eagerly.** A singleton that transitively depends on a
    request-scoped provider must fail at `initialize()`/`build()` time, not at first concurrent
    request.

## Workspace & tooling

-   Package manager: **pnpm** (`packageManager` pinned in root `package.json`) — always use `pnpm`,
    never `npm`/`yarn`, inside this repo.
-   Task runner: **Turborepo** (`turbo.json`) — root scripts fan out to every workspace package.
-   Workspaces: `compiler`, `di`, `react`, `vue`, `svelte`, `web-components`, `stencil`,
    `vite-plugin`, and everything under `samples/*` (see `pnpm-workspace.yaml`).
-   Node `>=18`, `pnpm >=8` (see `engines` in root `package.json`).

### Common commands (run from repo root)

```sh
pnpm install          # install all workspace packages
pnpm build            # turbo run build (respects dependency graph via ^build)
pnpm test             # turbo run test (builds first)
pnpm test:coverage    # turbo run test:coverage in parallel
pnpm lint             # turbo run lint (eslint per package)
pnpm lint:fix         # eslint --fix per package
pnpm format:check     # prettier --check across the whole repo
pnpm format:fix       # prettier --write across the whole repo
pnpm tsc              # turbo run tsc (--noEmit per package)
```

Scope any of the above to a single package with turbo's filter flag, e.g.:

```sh
pnpm turbo run test --filter=@nonnajs/di
pnpm --filter @nonnajs/di build
```

### Testing

Packages use Node's built-in test runner, not Jest/Vitest:

```sh
node --test --test-reporter node-test-reporter --require ts-node/register test/**/*.{test,it.test}.ts
```

Test files live in each package's `test/` directory and end in `.test.ts` or `.it.test.ts`. Always
run `pnpm build` (or rely on turbo's `dependsOn: ["build"]` for `test`) before running tests
directly, since packages import each other's built `dist/` output via `workspace:*`.

### Linting & formatting

-   ESLint config is the flat `eslint.config.mjs` at the repo root, shared by every package.
-   Prettier (`.prettierrc.yaml`): 4-space indent, no tabs, double quotes (`singleQuote: false`),
    trailing commas everywhere, 120 print width, `arrowParens: avoid`. Run `pnpm format:fix` rather
    than hand-formatting.
-   `lint-staged` + `husky` run on commit — don't bypass with `--no-verify` unless explicitly asked.

## Samples are separate GitHub repos, not a monorepo package

Every directory under `samples/` (`sample-node`, `sample-node-http`, `sample-deno`,
`sample-deno-http`, `sample-bun`, `sample-bun-http`, `sample-react`, `sample-vue`,
`sample-svelte`, `sample-web-components`, `sample-stencil`) is its own git repository under the
`nonnajs` GitHub org (e.g. `github.com/nonnajs/sample-node`), checked out inside this workspace for
local development/testing. **Do not** assume `git commit`/`git push` at the repo root touches
sample changes — commit inside the sample's own directory, and be aware `git status` at the root
won't show changes inside these nested repos.

When bootstrapping a new app for a user, prefer fetching/adapting the matching `nonnajs/sample-*`
repo over generating the DI/build wiring from scratch — these samples are the canonical reference
implementations for every supported runtime/framework.

## Versioning & releases

This repo uses **Changesets** (`.changeset/`) with `workspace:*` internal dependencies. Any change
to a published package (`compiler`, `di`, `react`, `vue`, `svelte`, `web-components`, `stencil`,
`vite-plugin`) that should ship in the next release needs a changeset:

```sh
pnpm changeset:create   # interactive prompt, writes .changeset/*.md
pnpm release:status      # preview what would be released
```

Do not hand-edit package `version` fields or `CHANGELOG.md` files — those are generated by
`pnpm release:version` (`changeset version`). See `RELEASING.md` for the full `workspace:*` +
Changesets interaction model.

## Style conventions

-   Constructor-inject concrete classes as plain TypeScript parameter types; let
    `@nonnajs/compiler` infer the token. Only use `@Inject(TOKEN)` for non-class tokens (strings,
    symbols, interfaces).
-   Default provider scope is singleton; mark request-scoped classes explicitly with
    `@Injectable({scope: "request"})`.
-   Keep `di/src` free of anything that would violate the zero-dependency/no-reflection guardrails
    — new runtime features belong behind an abstraction (like `ContextStorage`), not a direct
    platform API import.
-   Match existing package structure when adding a new binding package: `src/`, `test/`, a `tsup`
    build, and a `README.md` documenting the public API with a runnable example.

## Related: Copilot CLI skills

A modular Nonna skills library (`nonna`, `nonna-di`, `nonna-compiler`, `nonna-node`, `nonna-deno`,
`nonna-bun`, `nonna-react`, `nonna-vue`, `nonna-svelte`, `nonna-web-components`, `nonna-stencil`)
exists for GitHub Copilot CLI under `~/.agents/skills/nonna*` — consult those for detailed,
per-platform guidance and links to full working samples when acting as an agent on this codebase.
