---
name: nonna-bun
description: Use when building or bootstrapping a Bun application with @nonnajs/di — either a plain Bun script/service using multi-providers for plugin systems, or a REST/HTTP server built on Bun.serve and Web Standards Request/Response with per-request DI scoping. Load nonna-di and nonna-compiler first; this skill picks between the two Bun sample flavours and links to their full GitHub repos for bootstrap.
---

# Nonna on Bun

> Load [`nonna-di`](../nonna-di/SKILL.md) and [`nonna-compiler`](../nonna-compiler/SKILL.md) first
> — this skill assumes both.

Two reference samples, pick the one matching the task:

| Need                                                               | Sample            | Repo                                                                               |
| ------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------- |
| Plain server-side app (plugin systems, background tasks)           | `sample-bun`      | [`github.com/nonnajs/sample-bun`](https://github.com/nonnajs/sample-bun)           |
| REST/HTTP server (`Bun.serve`, Web Standards `Request`/`Response`) | `sample-bun-http` | [`github.com/nonnajs/sample-bun-http`](https://github.com/nonnajs/sample-bun-http) |

Fetch the matching repo and adapt it rather than generating the DI/build wiring from scratch.

## `sample-bun` (plain) at a glance

Demonstrates **multi-providers** for a plugin system (`PLUGIN_TOKEN`, `multi: true`) resolved with
`injector.getAll()`, plus a request-scoped `ApiService` run inside its own scope per call:

```ts
injector.register({provide: PLUGIN_TOKEN, useClass: LoggingPlugin, multi: true});
injector.register({provide: PLUGIN_TOKEN, useClass: MetricsPlugin, multi: true});

return injector.runInScope(async () => {
    const apiService = injector.get(ApiService); // scope: "request"
    const plugins = injector.getAll<AppPlugin>(PLUGIN_TOKEN);
    return apiService.execute(action, payload, plugins);
});
```

```sh
bun run src/index.ts
bun test test/
```

## `sample-bun-http` (REST) at a glance

Demonstrates request-scoped controllers over Bun's native `Bun.serve`, wrapping each `fetch`
handler call in `injector.runInScope()`:

```ts
const fetchHandler = async (req: Request): Promise<Response> => {
    return injector.runInScope(async () => {
        const ctx = injector.get(BunHttpRequestContext);
        ctx.method = req.method;
        ctx.url = req.url;
        const router = injector.get(HttpRouter); // resolves ItemController (scope: "request")
        return router.handle(req);
    });
};
```

```sh
bun run src/index.ts
bun test test/
```

## Decision points

-   **No web framework here** — `sample-bun-http` uses Web Standards `Request`/`Response` directly
    with a hand-rolled `HttpRouter`, no Hono/Elysia. If the task wants a framework, resolve
    controllers from within that framework's handler the same way, inside `runInScope()`.
-   **Multi-providers (`multi: true`) are the idiomatic way to model plugin/middleware chains** —
    prefer `injector.getAll(TOKEN)` over an ad-hoc array when the set of implementations should be
    swappable/extensible via DI registration.
-   **`OnDestroy` on singletons (`StorageService`, `LoggerService`)** — Bun processes should still
    call `injector.destroy()` on shutdown for deterministic cleanup, same as Node/Deno.
