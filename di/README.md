# `@nonna/di`

> High-performance, zero-reflection, runtime-agnostic Dependency Injection container for modern JavaScript & TypeScript.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen.svg)](package.json)
[![Runtimes](https://img.shields.io/badge/Runtimes-Node.js%20%7C%20Deno%20%7C%20Bun%20%7C%20Edge-blue.svg)](https://github.com/nodejs-boot/node-boot)

`@nonna/di` is the micro-runtime core of the **Nonna** DI framework. It provides IoC container management, 5 provider types, 3 lifecycle scopes (including isolated asynchronous request scoping), reverse-order teardown, and container inspection with **zero external dependencies** and **no `reflect-metadata`**.

![Nonna Architecture Diagram](../nonna-architecture.svg)

---

## Installation

```sh
# npm
npm install @nonna/di

# pnpm
pnpm add @nonna/di

# yarn
yarn add @nonna/di

# Bun
bun add @nonna/di
```

### Deno

```json
{
    "imports": {
        "@nonna/di": "npm:@nonna/di@^1.0.0"
    }
}
```

---

## Core Features

-   **Zero Runtime Dependencies**: Does not pull in TypeScript, `reflect-metadata`, or external helpers.
-   **Runtime Agnostic**: Runs identically in Node.js (18+), Deno (1.40+, 2.x), Bun (1.0+), and Edge Workers.
-   **Three Scopes**:
    -   `singleton` (default) — single shared instance per container.
    -   `transient` — new instance instantiated per resolution.
    -   `request` — isolated instance per asynchronous execution flow (`runInScope()`) via `AsyncLocalStorage`.
-   **Five Provider Types**: `useClass`, `useValue`, `useFactory` (sync & async), `useExisting`, and `multi: true` arrays.
-   **Architectural Guardrails**: Prevents circular dependencies and blocks singletons from depending on request-scoped providers.
-   **Deterministic Lifecycle**: `OnInit` (`onInit()`) and `OnDestroy` (`onDestroy()`) hooks executed in topological / reverse creation order.
-   **Full Introspection**: `injector.inspect()` returns full diagnostics of registered tokens, scopes, and dependency graphs.

---

## State Of The Art

Most JavaScript DI containers pick one of two trade-offs: lean on `reflect-metadata` + `emitDecoratorMetadata` for auto-wiring (TypeDI, InversifyJS, tsyringe) and accept the runtime reflection tax and the Deno/Bun/edge compatibility gaps that come with it, or drop auto-wiring altogether and make every dependency a manual, stringly-typed registration. Nonna is built to not have to choose:

-   **AOT, not reflection.** `@nonna/compiler` statically analyzes your TypeScript at build time and generates plain `defineDependencies(Target, [...])` calls - concrete-class dependencies are known before the process even starts. The runtime injector never imports `typescript`, never touches `Reflect.getMetadata`, and never needs `emitDecoratorMetadata` to be turned on. This is enforced, not just claimed: a guardrail test (`guardrails.test.ts`) fails the build if any source file so much as imports `reflect-metadata` or the compiler package.
-   **Genuinely runtime-agnostic.** The same injector code runs unmodified on Node 18+, Deno, Bun, and edge/Workers runtimes - the one platform-specific piece (request-scope propagation) is abstracted behind a one-method `ContextStorage` interface, defaulting to `AsyncLocalStorage` where available and swappable everywhere else.
-   **Zero runtime dependencies, full stop.** Not "zero besides a small polyfill" - `package.json` ships an empty `dependencies` object, checked by the same guardrail suite.
-   **Statically-known async, everywhere.** Whether a factory or an `onInit()` is async is decided once, from the function's own shape, at registration/compile time - never by sniffing whether a call happened to return a `Promise`. That's what lets `get()` fail fast with a clear `AsyncProviderError` _before_ running a constructor whose result would've been thrown away, instead of a container that "usually works" and occasionally hands back an unresolved `Promise` where an instance was expected.
-   **Scope violations are a build-time-shaped error, not a 3am incident.** `initialize()` walks the whole graph and rejects a singleton that transitively depends on a request-scoped provider (even through a transient hop) before your app ever accepts traffic - not the first time two concurrent requests race on a shared instance in production.
-   **Performance work that goes past "it's fast":** integer-keyed registrations instead of `Symbol()` allocation, memoized dependency metadata instead of a `WeakMap` hit per resolution, a mutable stack + `Set` for circular-dependency tracking on the hot synchronous path, `AsyncLocalStorage` skipped entirely when nothing is request-scoped, and independent eager providers booting concurrently instead of one-at-a-time. See [Performance Notes](#performance-notes) below for the details and the reasoning behind each one.
-   **A fluent bootstrap without hiding the machine.** `Nonna.injector()...build()` reads like a config DSL, but it's a thin, inspectable wrapper - `.build()` is the only thing that isn't just a direct passthrough to `Injector`, and the imperative API underneath is always there for anyone who wants lower-level control.
-   **Small enough to actually read.** The entire runtime is a handful of files with no hidden metadata layer or proxy magic - `injector.ts` is the whole resolution algorithm, start to finish.

---

## Quick Example

```ts
import {Injectable, Nonna} from "@nonna/di";

@Injectable()
export class DatabaseService {
    query(sql: string) {
        return [{id: 1, name: "Item"}];
    }
}

@Injectable()
export class UserService {
    constructor(private readonly db: DatabaseService) {}

    getUsers() {
        return this.db.query("SELECT * FROM users");
    }
}

// 1. Configure and boot the container in one chain
const injector = await Nonna.injector().scan().build();

// 2. Resolve an instance
const userService = injector.get(UserService);
console.log(userService.getUsers());

// 3. Cleanup
await injector.destroy();
```

---

## Detailed API & Guide

### 1. Bootstrapping the Injector

The recommended way to configure and boot a container is the fluent `Nonna.injector()` builder. Nothing touches a real `Injector` until the terminal `build()` call - which is also what runs `initialize()` for you, so the returned `Injector` is already validated and eager-warm:

```ts
import {Nonna} from "@nonna/di";

const injector = await Nonna.injector()
    .withContextStorage(customStorage) // optional - defaults to AsyncLocalStorage
    .register({provide: Logger, useClass: ConsoleLogger})
    .registerValue(CONFIG_TOKEN, config)
    .registerFactory(DB_POOL, [CONFIG_TOKEN], makePool)
    .scan() // pulls in every @Injectable()/@Service() class
    .loadBeans("./beans.manifest.json")
    .freeze() // freezeAfterInitialize: blocks register() after build()
    .build(); // refresh + validate + eager-init, returns a ready Injector
```

This is pure sugar over the lower-level, imperative API, which remains fully supported for callers who want that level of control - e.g. holding an uninitialized `Injector` around for a while, or driving `refresh()`/`initialize()` at a different point in your app's startup sequence:

```ts
import {Injector} from "@nonna/di";

const injector = Injector.create({
    // Optional custom AsyncLocalStorage context storage implementation
    contextStorage: customContextStorage,
});

injector.register({provide: Logger, useClass: ConsoleLogger});
injector.refresh(); // pulls in @Injectable()/@Service() classes
await injector.initialize();
```

### 2. Registering Providers

#### A. Class Provider (`useClass`)

```ts
injector.register({
    provide: UserRepository,
    useClass: MongoUserRepository,
    scope: "singleton", // "singleton" | "transient" | "request"
    eager: false, // If true, instantiated during injector.initialize()
});
```

#### B. Value Provider (`useValue` / `registerValue`)

```ts
export const CONFIG_TOKEN = Symbol("CONFIG_TOKEN");

injector.register({
    provide: CONFIG_TOKEN,
    useValue: {port: 8080, env: "production"},
});

// Or use the shortcut:
injector.registerValue(CONFIG_TOKEN, {port: 8080, env: "production"});
```

#### C. Factory Provider (`useFactory` / `registerFactory`)

Factories can be synchronous or asynchronous, and receive injected dependencies.

```ts
export const DB_POOL = Symbol("DB_POOL");

// Synchronous factory:
injector.registerFactory(CacheClient, [CONFIG_TOKEN], (config: AppConfig) => new CacheClient(config.redisUrl));

// Asynchronous factory:
injector.register({
    provide: DB_POOL,
    useFactory: async (config: AppConfig) => {
        const pool = new ConnectionPool(config.dbUrl);
        await pool.connect();
        return pool;
    },
    inject: [CONFIG_TOKEN],
    async: true,
    eager: true,
});
```

#### D. Alias Provider (`useExisting`)

Map one token to an existing registered token:

```ts
injector.register({
    provide: ReadOnlyRepository,
    useExisting: UserRepository,
});
```

#### E. Multi-Providers (`multi: true`)

Register multiple items under a single token and resolve them with `getAll(token)`:

```ts
export const INTERCEPTOR_TOKEN = Symbol("INTERCEPTOR_TOKEN");

injector.register({provide: INTERCEPTOR_TOKEN, useClass: AuthInterceptor, multi: true});
injector.register({provide: INTERCEPTOR_TOKEN, useClass: LoggingInterceptor, multi: true});

// Resolves to [AuthInterceptor, LoggingInterceptor]
const interceptors = injector.getAll<Interceptor>(INTERCEPTOR_TOKEN);
```

---

### 3. Dependency Injection Decorators

```ts
import {Injectable, Service, Inject, Optional} from "@nonna/di";

export const API_KEY = Symbol("API_KEY");

@Injectable({scope: "request"})
export class OrderService {
    constructor(
        // Inferred by @nonna/compiler at build-time
        private readonly userRepo: UserRepository,

        // Explicit symbol or string token
        @Inject(API_KEY) private readonly apiKey: string,

        // Optional dependency (injected as undefined if not registered)
        @Optional() private readonly notificationService?: NotificationService,
    ) {}
}
```

-   `@Injectable(options?)` / `@Service(options?)`: Registers class with the global metadata registry.
-   `@Inject(token)`: Explicitly specifies the DI token for a constructor parameter.
-   `@Optional(token?)`: Marks a parameter as optional so resolution succeeds even if the token is missing.

#### Field (Property) Injection

`@Inject()`/`@Optional()` also work directly on a class field - not just constructor parameters:

```ts
@Injectable()
export class OrderService {
    @Inject(MetricsClient)
    private readonly metrics!: MetricsClient;

    @Optional(FEATURE_FLAGS)
    private readonly flags?: FeatureFlags;
}
```

-   Only applies to `useClass` providers - the injector assigns the resolved value onto the property immediately after construction, before `onInit()` runs.
-   Unlike constructor parameters, there's no AOT/type inference for fields - `@Inject(token)` always needs an explicit token. A bare `@Optional()` (no token) on a field is a no-op.
-   Subclasses inherit (and can override) a parent class's decorated fields.
-   Works through both `get()`/`getAll()` and `getAsync()`/`getAllAsync()`, and participates in the same missing-provider/scope-violation validation as constructor dependencies during `initialize()`.

---

### 4. Scopes & Request Isolation

```ts
@Injectable({scope: "request"})
export class RequestContext {
    public requestId = `req-${Math.random().toString(36).slice(2, 9)}`;
    public user?: {id: string};
}

// In your HTTP server / request handler:
async function handleRequest(req: Request) {
    return injector.runInScope(async () => {
        const ctx = injector.get(RequestContext);
        ctx.user = authenticate(req);

        const controller = injector.get(OrderController);
        return controller.handle();
    });
}
```

-   Any call inside `runInScope()` shares the same `request`-scoped instances.
-   Parallel `runInScope()` calls remain strictly isolated across asynchronous continuations.
-   Resolving a `request`-scoped provider outside `runInScope()` throws `ScopeError`.

---

### 5. Eager vs. Lazy Instantiation

All providers in `@nonna/di` are **lazy by default**:

-   **Lazy (`eager: false`, default)**: Instances are created upon the first call to `get()` / `getAsync()`.
-   **Eager (`eager: true`)**: Instances are pre-warmed during `await injector.initialize()`. If an eager provider is asynchronous (`async: true`), `initialize()` awaits its resolution.

```ts
// Eager via decorator
@Injectable({eager: true})
export class AppInitService implements OnInit {
    async onInit() {
        console.log("Pre-warmed at startup!");
    }
}

// Eager via provider registration
injector.register({
    provide: DATABASE_POOL,
    useFactory: async cfg => createPool(cfg),
    inject: [CONFIG_TOKEN],
    async: true,
    eager: true,
});
```

Calling `await injector.initialize()` validates the dependency graph, runs scope checks, and instantiates all `eager: true` providers before accepting traffic.

---

### 6. Lifecycle Management

Implement `OnInit` and `OnDestroy` interfaces to manage resource initialization and teardown:

```ts
import {Injectable, OnInit, OnDestroy} from "@nonna/di";

@Injectable()
export class RedisService implements OnInit, OnDestroy {
    private client: any;

    async onInit(): Promise<void> {
        this.client = await createRedisClient();
    }

    async onDestroy(): Promise<void> {
        await this.client.quit();
    }
}
```

-   `onInit()` runs once, immediately after an instance is constructed - for every scope (singleton, transient, request), not only eager ones. `injector.initialize()` additionally _triggers_ construction (and therefore `onInit()`) for every `eager: true` provider, so eager instances are pre-warmed before it resolves.
-   Whether `onInit()` is async is resolved statically from the class itself (never sniffed from a call), the same way `useFactory`'s `async` is. A class with an `async onInit()` can only be constructed through `getAsync()`/`getAllAsync()`, or eagerly via `initialize()`; a sync `get()`/`getAll()` call throws `AsyncProviderError` _before_ the constructor ever runs, exactly as it already does for an async `useFactory`.
-   `injector.destroy()`: Calls `onDestroy()` in **reverse creation order** and clears all singleton caches.

---

### 7. Container Inspection API

```ts
const diagnostics = injector.inspect(UserService); // single token
const allMiddleware = injector.inspectAll(MIDDLEWARE_TOKEN); // one entry per multi-provider registration

console.log(`scope=${diagnostics?.scope}, instantiated=${diagnostics?.instantiated}`);
```

`inspect(token)` returns a single `Inspection | undefined` (or `undefined` if the token was never registered); `inspectAll(token)` returns one `Inspection` per registration, which only matters for `multi: true` tokens.

---

## Performance Notes

A few internal choices exist specifically to keep the hot resolution path cheap:

-   **`runInScope()` skips `AsyncLocalStorage` entirely** when no `request`-scoped provider has ever been registered - there's nothing to isolate, so the context-propagation cost (real and measurable under load) is never paid. One consequence: `currentScopeId()` reports `undefined` inside `runInScope()` in that case.
-   **Registration ids are plain incrementing integers**, not `Symbol()`s - cheaper to hash/compare in `Map` lookups, and skips a string-formatting cost on every `register()` call.
-   **A class provider's dependency list is read from its metadata store once and memoized**, not re-read on every `transient`/`request` resolution.
-   **Circular-dependency tracking on the synchronous path** (`get()`/`getAll()`) uses a mutable stack + `Set` instead of copying an array at every recursion depth.
-   **`initialize()` starts every eager provider concurrently** (via `Promise.all`) instead of awaiting them one at a time - independent eager providers (e.g. a DB pool and an unrelated message-broker client) initialize in parallel, and any dependency they share is still only ever constructed once.

---

## Errors Reference

| Error Class               | Description                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ProviderNotFoundError`   | A required token was not registered in the container.                                                             |
| `CircularDependencyError` | A circular dependency was detected during instantiation.                                                          |
| `ScopeError`              | A request-scoped token was requested outside `runInScope()`, or a singleton depends on a request-scoped provider. |
| `AsyncProviderError`      | Synchronous `get()` was called on an async provider. Use `await getAsync()` instead.                              |
| `LifecycleError`          | One or more `onDestroy()` hooks failed during `destroy()`.                                                        |
| `InjectorDestroyedError`  | Attempted to resolve tokens on an injector that has already been destroyed.                                       |

---

## Fun Fact

Nonna was born on vacation in Rome, coded during the "cold hours" in a hotel room while the kids watched TV - a tentative replacement for TypeDI in an existing project, driven by a deceptively simple question: how "pure" (zero-reflection) and fast can a DI container actually get if you stop assuming `reflect-metadata` has to be part of the deal?

---

## License

MIT © Manuel Santos
