---
name: nonna-deno
description: Use when building or bootstrapping a Deno application with @nonnajs/di — either a plain Deno script/service using async factory providers, or a REST/HTTP server built with Hono and Deno.serve with per-request DI scoping. Load nonna-di and nonna-compiler first; this skill picks between the two Deno sample flavours and links to their full GitHub repos for bootstrap.
---

# Nonna on Deno

> Load [`nonna-di`](../nonna-di/SKILL.md) and [`nonna-compiler`](../nonna-compiler/SKILL.md) first
> — this skill assumes both.

Two reference samples, pick the one matching the task:

| Need                                                      | Sample             | Repo                                                                                 |
| --------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| Plain server-side app (async providers, background tasks) | `sample-deno`      | [`github.com/nonnajs/sample-deno`](https://github.com/nonnajs/sample-deno)           |
| REST/HTTP server (Hono + `Deno.serve`)                    | `sample-deno-http` | [`github.com/nonnajs/sample-deno-http`](https://github.com/nonnajs/sample-deno-http) |

Fetch the matching repo and adapt it rather than generating the DI/build wiring from scratch.

## `sample-deno` (plain) at a glance

Demonstrates an **async factory provider** (`eager: true, async: true`) for a `DatabaseService`
that must connect before anything else resolves it, plus request-scoped `TaskService` run inside
isolated scopes:

```ts
injector.register({
    provide: DatabaseService,
    useFactory: async (cfg: DenoAppConfig) => {
        const db = new DatabaseService();
        await db.connect(cfg.dbUrl);
        return db;
    },
    inject: [DENO_CONFIG],
    async: true,
    eager: true,
});

const db = await injector.getAsync(DatabaseService); // async providers need getAsync()
const [res1, res2] = await Promise.all([
    runTaskInScope(injector, "sync-inventory"),
    runTaskInScope(injector, "process-payouts"),
]);
```

```sh
deno run --allow-all src/main.ts
deno test
```

## `sample-deno-http` (REST) at a glance

Demonstrates request-scoped controllers behind a Hono middleware that wraps every request in
`injector.runInScope()`:

```ts
app.use("*", async (c, next) => {
    return injector.runInScope(async () => {
        const ctx = injector.get(HonoRequestContext);
        ctx.method = c.req.method;
        ctx.path = c.req.path;
        await next();
    });
});

app.get("/books", c => {
    const controller = injector.get(BookController); // BookController is scope: "request"
    return c.json(controller.listBooks());
});
```

```sh
deno run --allow-all src/main.ts
deno test
```

## Decision points

-   **`deno.json` `imports`** map `@nonnajs/di`/`@nonnajs/compiler` to `npm:` specifiers — both
    samples' `deno.json` is the reference for exact version pinning.
-   **The AOT compile step still runs via Node/npm tooling** (`nonna-compile`) even though the app
    executes on Deno — see each sample's `package.json` for the `compile-deps` script that both
    `deno run` and `deno test` depend on having been run first.
-   **Async providers require `getAsync()`** — calling `get()` on one throws `AsyncProviderError`
    by design; don't "fix" this by making the provider non-async.
-   **Hono is not required** — it's what `sample-deno-http` happens to use; native `Deno.serve()`
    works identically, just wrap the handler body in `injector.runInScope()` the same way.
