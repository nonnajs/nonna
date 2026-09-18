---
name: nonna
description: Use when starting any task involving Nonna — a lightweight, zero-reflection, runtime-agnostic Dependency Injection framework (@nonnajs/di) and AOT compiler (@nonnajs/compiler) for TypeScript/JavaScript. Load this first to get an overview and decide which platform/runtime skill to open next (Node, Deno, Bun, React, Vue, Svelte, Web Components, Stencil). This is the router skill for the whole Nonna skills library.
---

# Nonna

> **Nonna** = `@nonnajs/di` (zero-reflection runtime DI container) + `@nonnajs/compiler` (AOT
> TypeScript `TypeChecker`-based dependency compiler). Everything else in the ecosystem —
> framework bindings, samples — is built on those two packages.

Repo: [`github.com/nonnajs/nonna`](https://github.com/nonnajs/nonna)

## Core architectural pillars

-   **Zero runtime dependencies, no `reflect-metadata`.** `@nonnajs/di` ships an empty
    `dependencies` object; nothing in the runtime path imports `typescript` or touches
    `Reflect.getMetadata`.
-   **AOT, not reflection.** `@nonnajs/compiler` statically analyzes constructor parameter types
    with the real TypeScript `TypeChecker` at build time and generates plain
    `defineDependencies(Target, [...])` calls — tokens are known before the process starts.
-   **Genuinely runtime-agnostic.** The same injector code runs unmodified on Node.js 18+, Deno,
    Bun, and edge/Workers runtimes.
-   **First-class request scoping.** `injector.runInScope()` isolates state per async execution
    flow (`AsyncLocalStorage`-backed by default), with build-time guardrails against singletons
    that transitively depend on request-scoped providers.
-   **Deterministic lifecycle.** `OnInit`/`OnDestroy` hooks, reverse-order teardown, aggregated
    error reporting.

## Load next

Always start with the two foundational skills — every platform/runtime skill assumes them:

| Skill                                          | Package             | Covers                                                                                        |
| ---------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| [`nonna-di`](../nonna-di/SKILL.md)             | `@nonnajs/di`       | `@Injectable`, `Nonna.injector()` builder, providers, scopes, lifecycle hooks, `runInScope()` |
| [`nonna-compiler`](../nonna-compiler/SKILL.md) | `@nonnajs/compiler` | `nonna-compile` CLI, AOT token inference, generated dependency files                          |

Then pick **one** platform/runtime skill for the app you're building or bootstrapping:

| Platform/runtime | Skill                                                      | Sample(s) referenced                                           |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Node.js          | [`nonna-node`](../nonna-node/SKILL.md)                     | `sample-node` (plain), `sample-node-http` (REST)               |
| Deno             | [`nonna-deno`](../nonna-deno/SKILL.md)                     | `sample-deno` (plain), `sample-deno-http` (REST via Hono)      |
| Bun              | [`nonna-bun`](../nonna-bun/SKILL.md)                       | `sample-bun` (plain), `sample-bun-http` (REST via `Bun.serve`) |
| React            | [`nonna-react`](../nonna-react/SKILL.md)                   | `sample-react`                                                 |
| Vue 3            | [`nonna-vue`](../nonna-vue/SKILL.md)                       | `sample-vue`                                                   |
| Svelte 5         | [`nonna-svelte`](../nonna-svelte/SKILL.md)                 | `sample-svelte`                                                |
| Web Components   | [`nonna-web-components`](../nonna-web-components/SKILL.md) | `sample-web-components`                                        |
| StencilJS        | [`nonna-stencil`](../nonna-stencil/SKILL.md)               | `sample-stencil`                                               |

For **server runtimes** (Node, Deno, Bun), each skill points to two working samples: a plain
"server version" (long-running process / background work, no HTTP) and an "http rest version"
(a REST-style HTTP server built with request scoping). Pick whichever matches the task.

## Bootstrap philosophy

Every platform/runtime skill links to a **full, runnable GitHub sample repo** under the
[`nonnajs`](https://github.com/nonnajs) org. When bootstrapping a new app, fetch and adapt the
matching sample instead of generating the DI wiring, build scripts, and boilerplate from scratch —
these samples are the source of truth for how the pieces fit together.

## Installation quick reference

```sh
# Node/Bun
npm install @nonnajs/di
npm install --save-dev @nonnajs/compiler
```

```json
// deno.json
{"imports": {"@nonnajs/di": "npm:@nonnajs/di@^1.0.0"}}
```

Browser frameworks (React/Vue/Svelte/Web Components/Stencil) also need
[`@nonnajs/vite-plugin`](https://github.com/nonnajs/nonna/tree/main/vite-plugin) as a dev
dependency — it shims the handful of Node builtins `@nonnajs/di`'s bundle statically imports
(`async_hooks`, `fs/promises`, `path`, `url`) so Rollup/Vite can bundle it for the browser. See the
relevant platform skill for exact `vite.config.ts` wiring.
