---
name: nonna-di
description: Use when writing or reviewing any code that uses @nonnajs/di directly — @Injectable/@Inject/@Optional decorators, the Nonna.injector() fluent builder, provider registration (useClass/useValue/useFactory/multi), singleton vs request scope, injector.runInScope(), or OnInit/OnDestroy lifecycle hooks. This is the foundational skill for the Nonna DI runtime container that every platform/runtime skill builds on; load it before any node/deno/bun/react/vue/svelte/web-components/stencil skill.
---

# `@nonnajs/di` — Runtime DI Container

> New project and unsure which platform to target? See [`nonna`](../nonna/SKILL.md) for the
> overview and the platform-skill picker.

Package: [`di/`](https://github.com/nonnajs/nonna/tree/main/di) in `nonnajs/nonna`.

## Minimal skeleton

```ts
import {Injectable, Optional, Inject, Nonna} from "@nonnajs/di";

@Injectable()
export class UserRepository {
    findById(id: string) {
        /* ... */
    }
}

@Injectable()
export class UserService {
    // Constructor params are inferred as DI tokens by @nonnajs/compiler (see nonna-compiler) —
    // no decorators needed on concrete-class dependencies.
    constructor(
        private readonly userRepo: UserRepository,
        @Optional() private readonly notifier?: NotificationService,
    ) {}
}

// Bootstrap — the fluent builder validates the graph and pre-warms eager singletons in build():
const injector = await Nonna.injector()
    .register({provide: "API_KEY", useValue: "secret"}) // manual token registration
    .register({provide: GREETER, useClass: FriendlyGreeter, multi: true}) // multi-provider
    .scan() // pulls in globally @Injectable-decorated classes
    .build();

const userService = injector.get(UserService);
await injector.destroy(); // reverse-order OnDestroy teardown
```

The lower-level imperative API (`Injector.create()` → `.register()` → `.refresh()`) remains fully
supported when callers need control over exactly when each step runs — see the main
[README](https://github.com/nonnajs/nonna/blob/main/README.md#1-container-instantiation--lifecycle)
for both forms side by side.

## Decision points an agent should get right

-   **`@Injectable()` default scope is singleton.** Use `@Injectable({scope: "request"})` for
    anything that must be created fresh per HTTP request / per async execution flow (controllers,
    per-request context objects). A singleton that transitively depends on a request-scoped
    provider fails fast at `initialize()`/`build()` time — this is intentional, don't work around it
    by widening the dependency's scope without checking whether that's actually correct.
-   **`useClass` vs `useValue` vs `useFactory`.** `useValue` for plain config/constants,
    `useFactory` for anything requiring async setup (mark `async: true`) or computed construction,
    `useClass` for everything else. `eager: true` on a factory pre-resolves it during `build()`
    instead of lazily on first `get()`.
-   **`multi: true`** registers several providers under the same token (e.g. plugin lists); resolve
    all of them with `injector.getAll(TOKEN)`.
-   **`@Optional()`** marks a constructor parameter as not required — resolves to `undefined`
    instead of throwing if nothing is registered for that token.
-   **`@Inject(TOKEN)`** is required for non-class tokens (strings, symbols, interfaces) since there's
    no concrete class for the compiler/runtime to infer from.
-   **`injector.runInScope(fn)`** is how request scope gets created — wrap the smallest unit that
    represents "one request"/"one logical operation" (an HTTP handler, a queue message handler, a
    CLI task run). Everything resolved inside `fn` (directly or transitively) shares that scope.
-   **`getAsync()` vs `get()`** — any provider registered with `async: true` must be resolved with
    `injector.getAsync()`; calling `get()` on it throws `AsyncProviderError` by design, so the caller
    finds out before an unresolved `Promise` leaks out somewhere unexpected.
-   **Custom `ContextStorage`** — pass `.withContextStorage(...)` on the builder when the default
    `AsyncLocalStorage`-backed storage isn't available (e.g. browser runtimes use
    [`@nonnajs/vite-plugin`](https://github.com/nonnajs/nonna/tree/main/vite-plugin)'s shim instead).

## Platform-specific bindings

`@nonnajs/di` itself is UI-framework-agnostic. For component-tree integration (context providers,
hooks/composables), open the matching platform skill instead of hand-rolling wiring:
[`nonna-react`](../nonna-react/SKILL.md), [`nonna-vue`](../nonna-vue/SKILL.md),
[`nonna-svelte`](../nonna-svelte/SKILL.md), [`nonna-web-components`](../nonna-web-components/SKILL.md),
[`nonna-stencil`](../nonna-stencil/SKILL.md). For server-side usage on Node/Deno/Bun, see
[`nonna-node`](../nonna-node/SKILL.md), [`nonna-deno`](../nonna-deno/SKILL.md),
[`nonna-bun`](../nonna-bun/SKILL.md).

## Full API reference

For every decorator, builder method, and provider shape with examples, read the main
[README.md](https://github.com/nonnajs/nonna/blob/main/README.md#core-concepts--features) — it is
kept as the single source of truth ahead of this summary.
