---
name: nonna-node
description: Use when building or bootstrapping a Node.js application with @nonnajs/di — either a plain long-running Node process/background service, or a REST/HTTP server on native node:http with per-request DI scoping. Load nonna-di and nonna-compiler first; this skill picks between the two Node sample flavours and links to their full GitHub repos for bootstrap.
---

# Nonna on Node.js

> Load [`nonna-di`](../nonna-di/SKILL.md) and [`nonna-compiler`](../nonna-compiler/SKILL.md) first
> — this skill assumes both.

Two reference samples, pick the one matching the task:

| Need                                                  | Sample             | Repo                                                                                 |
| ----------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| Plain server-side app (background jobs, CLI, no HTTP) | `sample-node`      | [`github.com/nonnajs/sample-node`](https://github.com/nonnajs/sample-node)           |
| REST/HTTP server (native `node:http`)                 | `sample-node-http` | [`github.com/nonnajs/sample-node-http`](https://github.com/nonnajs/sample-node-http) |

Fetch the matching repo and adapt it rather than generating the DI/build wiring from scratch —
`degit`/`git clone` it, rename, then edit services/controllers.

## `sample-node` (plain) at a glance

Demonstrates AOT-compiled constructor injection, singleton + request scopes, `@Optional()`, and
`OnDestroy` lifecycle in a plain Node process — no HTTP involved:

```ts
@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly logger: LoggerService,
        @Optional() private readonly notificationService?: NotificationService,
    ) {}
}

const injector = await createApp({appName: "...", environment: "production", port: 3000});
const userService = injector.get(UserService);
```

```sh
pnpm build   # compile-deps (nonna-compile) + tsc
pnpm start
pnpm test
```

## `sample-node-http` (REST) at a glance

Demonstrates request-scoped controllers over native `node:http`, wrapping each incoming request in
`injector.runInScope()`:

```ts
@Injectable({scope: "request"})
export class UserController {
    constructor(
        private readonly userRepo: UserRepository,
        private readonly logger: LoggerService,
        private readonly ctx: HttpRequestContext,
    ) {}
}

const server = http.createServer((req, res) => {
    void injector.runInScope(async () => {
        const ctx = injector.get(HttpRequestContext);
        ctx.req = req;
        ctx.res = res;
        const router = injector.get(HttpRouter); // resolves UserController internally
        await router.handle();
    });
});
```

```sh
pnpm build   # compile-deps + tsc
pnpm start   # starts the HTTP server
pnpm test
```

## Decision points

-   **No web framework here** — `sample-node-http` uses native `node:http` + a hand-rolled
    `HttpRouter`. If the task wants Express/Fastify/Koa-style middleware, that's outside Nonna's
    scope (Nonna is DI-only) — just resolve controllers from within that framework's request
    handler the same way `sample-node-http` does with `runInScope()`.
-   **Request scope boundary = one HTTP request**, wrapped once per incoming request, not per
    route handler function.
-   Singletons (`UserRepository`, `LoggerService`) are shared across requests and torn down once
    via `injector.destroy()` on process shutdown, with `OnDestroy` hooks running in reverse order.
