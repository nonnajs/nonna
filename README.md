# Nonna DI Framework

> A lightweight, zero-reflection, runtime-agnostic Dependency Injection framework and AOT compiler for modern JavaScript and TypeScript.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![codecov](https://codecov.io/gh/nonnajs/nonna/branch/main/graph/badge.svg)](https://codecov.io/gh/nonnajs/nonna)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20|%2020%2B%20|%2022%2B-green.svg)](https://nodejs.org/)
[![Deno](https://img.shields.io/badge/Deno-1.40%2B%20|%202.x-black.svg)](https://deno.land/)
[![Bun](https://img.shields.io/badge/Bun-1.0%2B-orange.svg)](https://bun.sh/)

---

## Overview

**Nonna** is a high-performance Dependency Injection framework engineered from the ground up to be **completely independent** of specific runtimes, servers, or web frameworks. It runs identically on **Node.js**, **Deno**, **Bun**, and Edge platforms (Cloudflare Workers, Fastly Compute).

![Nonna Architecture Diagram](/docs/nonna-architecture.svg)

### Key Architectural Pillars

1. **Zero Runtime Dependencies**: `@nonnajs/di` contains **0 external dependencies** and does not require `reflect-metadata`.
2. **True Runtime Agnostic**: Operates identically on Node.js, Deno, and Bun using standard `node:async_hooks` `AsyncLocalStorage` and Web Standards.
3. **Ahead-of-Time (AOT) Compilation**: `@nonnajs/compiler` statically inspects TypeScript types with the real TypeScript `TypeChecker` during build time, inferring constructor tokens without runtime reflection.
4. **First-Class Request Scoping**: Built-in `request` scope isolates state per asynchronous execution flow (`injector.runInScope()`), with strict safety guardrails preventing request-scoped leaks into singletons.
5. **Deterministic Lifecycle**: Predictable `OnInit` and `OnDestroy` lifecycle hooks with reverse-order teardown and aggregated error reporting.
6. **Pluggable & Extensible**: First-class multi-providers (`multi: true`), async factories, alias tokens, and full container inspection APIs.

---

## Fun Fact

Nonna was born on vacation in Rome, coded during the "cold hours" in a hotel room while the kids watched TV - a tentative replacement for TypeDI in an existing project, driven by a deceptively simple question: how "pure" (zero-reflection) and fast can a DI framework actually get if you stop assuming `reflect-metadata` has to be part of the deal?

---

## State Of The Art

Most JavaScript DI frameworks pick one of two trade-offs: lean on `reflect-metadata` + `emitDecoratorMetadata` for auto-wiring (TypeDI, InversifyJS, tsyringe) and accept the runtime reflection tax and the Deno/Bun/edge compatibility gaps that come with it, or drop auto-wiring altogether and make every dependency a manual, stringly-typed registration. Nonna is built to not have to choose:

-   **AOT, not reflection.** `@nonnajs/compiler` statically analyzes your TypeScript at build time, using the real TypeScript `TypeChecker`, and generates plain `defineDependencies(Target, [...])` calls - concrete-class dependencies are known before the process even starts. `@nonnajs/di`'s runtime injector never imports `typescript`, never touches `Reflect.getMetadata`, and never needs `emitDecoratorMetadata` turned on. This is enforced, not just claimed: a guardrail test fails the build if any runtime source file so much as imports `reflect-metadata` or the compiler package.
-   **Genuinely runtime-agnostic.** The same injector code runs unmodified on Node.js 18+, Deno, Bun, and edge/Workers runtimes - the one platform-specific piece (request-scope propagation) is abstracted behind a one-method `ContextStorage` interface, defaulting to `AsyncLocalStorage` where available and swappable everywhere else.
-   **Zero runtime dependencies, full stop.** Not "zero besides a small polyfill" - `@nonnajs/di`'s `package.json` ships an empty `dependencies` object, checked by the same guardrail suite.
-   **Statically-known async, everywhere.** Whether a factory or an `onInit()` is async is decided once, from the function's own shape, at registration/compile time - never by sniffing whether a call happened to return a `Promise`. That's what lets `get()` fail fast with a clear `AsyncProviderError` _before_ running a constructor whose result would've been thrown away, instead of a container that "usually works" and occasionally hands back an unresolved `Promise` where an instance was expected.
-   **Scope violations are a build-time-shaped error, not a 3am incident.** `initialize()` walks the whole graph and rejects a singleton that transitively depends on a request-scoped provider (even through a transient hop) before your app ever accepts traffic - not the first time two concurrent requests race on a shared instance in production.
-   **Performance work that goes past "it's fast":** integer-keyed registrations instead of `Symbol()` allocation, memoized dependency metadata instead of a `WeakMap` hit per resolution, a mutable stack + `Set` for circular-dependency tracking on the hot synchronous path, `AsyncLocalStorage` skipped entirely when nothing is request-scoped, and independent eager providers booting concurrently instead of one-at-a-time.
-   **A fluent bootstrap without hiding the machine.** `Nonna.injector()...build()` reads like a config DSL, but it's a thin, inspectable wrapper - `.build()` is the only thing that isn't just a direct passthrough to `Injector`, and the imperative API underneath is always there for anyone who wants lower-level control.
-   **Small enough to actually read.** The entire runtime is a handful of files with no hidden metadata layer or proxy magic - `injector.ts` is the whole resolution algorithm, start to finish.

---

## Workspace Structure

```
di/
├── di/                     # @nonnajs/di (Runtime Container)
│   ├── src/
│   │   ├── injector.ts     # Core Injector container implementation
│   │   ├── context.ts      # AsyncLocalStorage context storage
│   │   ├── decorators.ts   # @Injectable, @Service, @Inject, @Optional
│   │   ├── lifecycle.ts    # Lifecycle hooks (OnInit, OnDestroy)
│   │   ├── metadata.ts     # Dependency registry & defineDependencies
│   │   ├── errors.ts       # Typed error hierarchy
│   │   └── types.ts        # TypeScript interfaces & types
│   └── test/               # Runtime test suite
│
├── compiler/               # @nonnajs/compiler (AOT Dependency Compiler)
│   ├── src/
│   │   ├── cli.ts          # nonna-compile binary CLI
│   │   ├── compile.ts      # Core compiler orchestrator
│   │   ├── scanner.ts      # AST scanner for @Injectable classes
│   │   ├── resolver.ts     # TypeScript TypeChecker token resolution
│   │   └── codegen.ts      # Code generator for defineDependencies
│   └── test/               # Compiler unit & fixture tests
│
├── react/                  # @nonnajs/react (React 18+ bindings)
├── vue/                    # @nonnajs/vue (Vue 3 bindings)
├── svelte/                 # @nonnajs/svelte (Svelte 5 bindings)
├── web-components/         # @nonnajs/web-components (W3C Context Protocol + <nonna-provider>)
├── stencil/                # @nonnajs/stencil (StencilJS bindings, built on @nonnajs/web-components)
├── vite-plugin/            # @nonnajs/vite-plugin (Vite browser shim plugin)
│
└── samples/                # Runnable sample applications
    ├── sample-node/        # Pure Node.js + @nonnajs/compiler AOT
    ├── sample-node-http/   # Node.js native node:http server + request scope
    ├── sample-deno/        # Pure Deno ESM + async factory providers
    ├── sample-deno-http/   # Deno + Hono HTTP server
    ├── sample-bun/         # Pure Bun + multi-provider plugins
    ├── sample-bun-http/    # Bun native Bun.serve HTTP server
    ├── sample-react/       # Vite + React, using @nonnajs/react
    ├── sample-vue/         # Vite + Vue 3, using @nonnajs/vue
    ├── sample-svelte/      # Vite + Svelte 5, using @nonnajs/svelte
    ├── sample-web-components/ # Vite + vanilla Custom Elements, using @nonnajs/web-components
    └── sample-stencil/     # Stencil + @nonnajs/stencil
```

---

## Packages

| Package                                       | Description                                                                                         | Version | Size       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------- | ---------- |
| [`@nonnajs/di`](./di)                         | Micro runtime DI container (zero deps, zero reflection)                                             | `1.0.0` | ~27 KB     |
| [`@nonnajs/compiler`](./compiler)             | Build-time TypeScript TypeChecker AOT compiler (`nonna-compile`)                                    | `1.0.0` | Build tool |
| [`@nonnajs/react`](./react)                   | React bindings - `<NonnaProvider>` + `useInjection()` hooks                                         | `1.0.0` | ~1.5 KB    |
| [`@nonnajs/vue`](./vue)                       | Vue 3 bindings - `<NonnaProvider>` + `useInjection()` composables                                   | `1.0.0` | ~1.5 KB    |
| [`@nonnajs/svelte`](./svelte)                 | Svelte bindings - `setInjector()` + `useInjection()` context                                        | `1.0.0` | ~1.5 KB    |
| [`@nonnajs/web-components`](./web-components) | W3C Context Protocol - `<nonna-provider>` + `@inject()`/`@optionalInject()`/`@allInject()`          | `1.0.0` | ~1.5 KB    |
| [`@nonnajs/stencil`](./stencil)               | StencilJS bindings - `@Inject()`/`@OptionalInject()`/`@AllInject()` decorators (via `getElement()`) | `1.0.0` | ~0.5 KB    |
| [`@nonnajs/vite-plugin`](./vite-plugin)       | Vite plugin providing browser-safe shims for Node builtins                                          | `1.0.0` | ~1.8 KB    |

---

## Installation

### Node.js (npm / pnpm / yarn)

```sh
# Runtime container
npm install @nonnajs/di

# Build-time AOT compiler (optional, recommended for TypeScript apps)
npm install --save-dev @nonnajs/compiler
```

### Deno

```json
// deno.json
{
    "imports": {
        "@nonnajs/di": "npm:@nonnajs/di@^1.0.0"
    }
}
```

### Bun

```sh
bun add @nonnajs/di
bun add -d @nonnajs/compiler
```

---

## Quick Start

### 1. Define Services

```ts
// src/user.repository.ts
import {Injectable} from "@nonnajs/di";

export interface User {
    id: string;
    name: string;
}

@Injectable()
export class UserRepository {
    private users = new Map<string, User>([["u1", {id: "u1", name: "Alice"}]]);

    findById(id: string): User | undefined {
        return this.users.get(id);
    }
}
```

```ts
// src/user.service.ts
import {Injectable, Optional} from "@nonnajs/di";
import {UserRepository, User} from "./user.repository";

@Injectable()
export class UserService {
    // When using @nonnajs/compiler, UserRepository is automatically inferred as DI token.
    constructor(private readonly userRepo: UserRepository) {}

    getUser(id: string): User | undefined {
        return this.userRepo.findById(id);
    }
}
```

### 2. Configure AOT Dependency Compilation (Optional, Recommended)

`@nonnajs/compiler` uses zero-configuration opinionated defaults (`tsconfig.json` → `src/__generated__/nonna-dependencies.generated.ts`):

In your `package.json`:

```json
{
    "scripts": {
        "prebuild": "nonna-compile",
        "build": "tsc -p tsconfig.json"
    }
}
```

> **CLI Customization**: If your project uses custom paths, pass `-p/--project <tsconfig>` or `-o/--output <path>` (e.g., `nonna-compile -p tsconfig.build.json -o dist/deps.generated.ts`).

Import the generated file once at application bootstrap:

```ts
// src/index.ts
import "./__generated__/nonna-dependencies.generated";
import {Nonna} from "@nonnajs/di";
import {UserService} from "./user.service";

async function bootstrap() {
    // Pulls in every @Injectable() class, validates the graph, and pre-warms eager
    // singletons - all in one chained call.
    const injector = await Nonna.injector().scan().build();

    const userService = injector.get(UserService);
    console.log(userService.getUser("u1")); // { id: 'u1', name: 'Alice' }

    // Teardown container
    await injector.destroy();
}

bootstrap();
```

_(Alternatively, load metadata dynamically via `.loadBeans(["./src/__generated__/nonna-dependencies.generated"])` on the builder, instead of a static import)_.

---

## Core Concepts & Features

### 1. Container Instantiation & Lifecycle

The recommended way to configure and boot a container is the fluent `Nonna.injector()` builder. Nothing touches a real `Injector` until the terminal `build()` call - which also runs `initialize()` for you, so the returned `Injector` is already validated and eager-warm:

```ts
import {Nonna} from "@nonnajs/di";

const injector = await Nonna.injector()
    .withContextStorage(customContextStorage) // optional
    .register({provide: "API_KEY", useValue: "secret_123"}) // register custom providers
    .scan() // load globally decorated @Injectable classes into this injector instance
    .build(); // validates singletons, detects circular deps, checks scope guardrails

// Resolve instances
const instance = injector.get(MyService);

// Destroy container (calls onDestroy hooks in reverse order)
await injector.destroy();
```

This is sugar over the lower-level, imperative API, which remains fully supported for callers who want more control over exactly when each step runs:

```ts
import {Injector} from "@nonnajs/di";

const injector = Injector.create({
    contextStorage: customContextStorage, // optional
});

injector.register({provide: "API_KEY", useValue: "secret_123"});
injector.refresh();
await injector.initialize();
```

---

### 2. Providers & Registration Types

Nonna supports 5 primary provider registration patterns:

#### A. Class Provider (`useClass`)

```ts
injector.register({
    provide: UserRepository,
    useClass: SqlUserRepository,
    scope: "singleton", // "singleton" | "transient" | "request"
    eager: false,
});
```

#### B. Value Provider (`useValue`)

```ts
export const APP_CONFIG = Symbol("APP_CONFIG");

injector.register({
    provide: APP_CONFIG,
    useValue: {port: 3000, host: "localhost"},
});

// Shortcut:
injector.registerValue(APP_CONFIG, {port: 3000, host: "localhost"});
```

#### C. Factory Provider (`useFactory`, Synchronous & Asynchronous)

```ts
export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");

// Synchronous factory
injector.register({
    provide: CacheClient,
    useFactory: (config: AppConfig) => new CacheClient(config.redisUrl),
    inject: [APP_CONFIG],
    scope: "singleton",
});

// Asynchronous factory
injector.register({
    provide: DATABASE_CONNECTION,
    useFactory: async (config: AppConfig) => {
        const db = new Database();
        await db.connect(config.dbUrl);
        return db;
    },
    inject: [APP_CONFIG],
    async: true,
    eager: true,
});

// Resolve async provider:
const db = await injector.getAsync(DATABASE_CONNECTION);
```

#### D. Alias Provider (`useExisting`)

```ts
injector.register({
    provide: AuditLogger,
    useExisting: LoggerService,
});
```

#### E. Multi-Providers (`multi: true`)

Register multiple items under the same token. Resolve all of them as an array using `injector.getAll(TOKEN)`.

```ts
export const PLUGIN_TOKEN = Symbol("PLUGIN_TOKEN");

injector.register({provide: PLUGIN_TOKEN, useClass: AuthPlugin, multi: true});
injector.register({provide: PLUGIN_TOKEN, useClass: MetricsPlugin, multi: true});

// Resolves to [AuthPlugin, MetricsPlugin]
const plugins = injector.getAll<Plugin>(PLUGIN_TOKEN);
```

---

### 3. Scopes & Execution Isolation

| Scope                   | Lifetime            | Description                                                                                                     |
| ----------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `singleton` _(default)_ | Container Lifetime  | One single shared instance per `Injector`. Instantiated lazily on first `.get()` or eagerly at `.initialize()`. |
| `transient`             | Call Lifetime       | A brand new instance is instantiated every time `.get()` is called.                                             |
| `request`               | Async Flow Lifetime | One shared instance per `injector.runInScope()` execution chain, isolated using `AsyncLocalStorage`.            |

#### Request Scoping Example

```ts
import {Injectable, Injector} from "@nonnajs/di";

@Injectable({scope: "request"})
export class RequestContext {
    public requestId = `req-${Math.random().toString(36).slice(2, 9)}`;
    public user?: {id: string; role: string};
}

@Injectable({scope: "request"})
export class OrderService {
    constructor(private readonly ctx: RequestContext, private readonly userRepo: UserRepository) {}

    processOrder(total: number) {
        return {
            orderId: `ord-${Date.now()}`,
            requestId: this.ctx.requestId,
            total,
        };
    }
}

// In your HTTP middleware / request handler:
async function handleHttpRequest(req: Request) {
    return injector.runInScope(async () => {
        const ctx = injector.get(RequestContext);
        ctx.user = authenticate(req);

        const orderService = injector.get(OrderService);
        return orderService.processOrder(100);
    });
}
```

#### Scope Safety Guardrail

Nonna enforces strict architectural guardrails:

-   A `singleton` provider **cannot** depend on a `request`-scoped provider. This prevents silent request-context leaks across concurrent users.
-   Resolving a `request`-scoped bean outside `runInScope()` throws a descriptive `ScopeError`.

---

### 4. Lazy vs. Eager Instantiation

Nonna providers are **lazy by default** and **eager on opt-in**:

#### Lazy (Default: `eager: false`)

Singleton and transient instances are instantiated only on their first `.get()` or `.getAsync()` resolution. This optimizes startup time and memory footprint for components that may not be accessed immediately.

```ts
@Injectable() // lazy by default
export class ReportGenerator {
    constructor() {
        console.log("Only created when first requested!");
    }
}
```

#### Eager (`eager: true`)

When marked `eager: true`, instances are pre-warmed during `await injector.initialize()`. Any startup, connection, or configuration failures surface immediately during application boot rather than on the first incoming user request.

```ts
// Via decorator:
@Injectable({eager: true})
export class RedisService implements OnInit {
    async onInit() {
        await this.connect(); // Pre-warms connection at bootstrap
    }
}

// Via provider registration:
injector.register({
    provide: DatabasePool,
    useFactory: async (config: AppConfig) => connectPool(config),
    inject: [APP_CONFIG],
    async: true,
    eager: true, // Pre-warmed & awaited during injector.initialize()
});
```

#### What happens during `injector.initialize()`?

1. **Validates Dependency Graph**: Checks for missing required providers, invalid tokens, and circular dependencies.
2. **Validates Scope Guardrails**: Rejects any singletons that depend directly (or via transients) on request-scoped providers.
3. **Pre-warms Eager Providers**: Instantiates all `eager: true` singletons, awaiting any asynchronous factories.
4. **Executes `onInit()` Hooks**: Triggers `onInit()` on every eager singleton.
5. **Freezes Container (Optional)**: `await injector.initialize({ freezeAfterInitialize: true })` locks the container against further registrations.

---

### 5. Decorators & Explicit Injections

```ts
import {Injectable, Service, Inject, Optional} from "@nonnajs/di";

export const METRICS_CLIENT = Symbol("METRICS_CLIENT");

@Injectable({scope: "singleton", eager: false})
export class PaymentService {
    constructor(
        // Inferred automatically by @nonnajs/compiler
        private readonly userRepo: UserRepository,

        // Explicit symbol or string token
        @Inject(METRICS_CLIENT) private readonly metrics: MetricsClient,

        // Optional dependency (undefined if not registered in container)
        @Optional() private readonly notificationService?: NotificationService,
    ) {}
}
```

`@Inject()`/`@Optional()` also work directly on a class **field**, not just constructor parameters - field injection, resolved and assigned right after construction (before `onInit()`), for `useClass` providers:

```ts
@Injectable()
export class PaymentService {
    @Inject(METRICS_CLIENT)
    private readonly metrics!: MetricsClient;
}
```

There's no AOT/type inference for fields, unlike constructor parameters - a field always needs an explicit token, and subclasses inherit (and can override) a parent class's decorated fields.

---

### 6. Ahead-of-Time (AOT) Compiler (`@nonnajs/compiler`)

`@nonnajs/compiler` eliminates the need for `reflect-metadata` and manual `@Inject()` decorators on concrete classes.

#### How It Works

1. Runs against your `tsconfig.json` using TypeScript's official `TypeChecker`.
2. Locates all classes decorated with `@Injectable()` or `@Service()`.
3. Inspects each constructor parameter:
    - If marked with `@Inject(TOKEN)` or `@Optional(TOKEN)`, preserves the explicit token.
    - If typed as a concrete or abstract class, infers that class as the DI token.
    - If typed as an interface, union, primitive, or generic class (`Repo<User>`), emits a descriptive compile diagnostic requiring `@Inject(...)`.
4. Generates a standalone file containing `defineDependencies(...)` registrations.

#### CLI Command

```sh
# Zero-config (uses ./tsconfig.json and outputs to src/__generated__/nonna-dependencies.generated.ts)
npx nonna-compile

# Optional custom arguments
npx nonna-compile --project tsconfig.build.json --output custom/output/deps.generated.ts
# Short flags also supported:
npx nonna-compile -p tsconfig.build.json -o custom/output/deps.generated.ts
```

#### Generated Output Example

```ts
// AUTO-GENERATED by @nonnajs/compiler - do not edit by hand.
import {defineDependencies} from "@nonnajs/di";
import {UserService} from "./user.service";
import {UserRepository} from "./user.repository";
import {LoggerService} from "./logger.service";

defineDependencies(UserService, [UserRepository, LoggerService, {token: NotificationService, optional: true}]);
```

---

### 7. Lifecycle Management

```ts
import {Injectable, OnInit, OnDestroy} from "@nonnajs/di";

@Injectable()
export class DatabasePool implements OnInit, OnDestroy {
    private pool: any;

    async onInit(): Promise<void> {
        this.pool = await createPool();
        console.log("Database connection pool established");
    }

    async onDestroy(): Promise<void> {
        await this.pool.drain();
        console.log("Database pool drained and closed");
    }
}
```

-   `injector.initialize()` invokes `onInit()` on all eager singletons.
-   `injector.destroy()` invokes `onDestroy()` in **reverse creation order** (dependents shut down before dependencies).
-   Failures during teardown are aggregated into a `LifecycleError` without halting other disposals.

---

### 8. Inspection & Diagnostics

You can inspect the entire registered container state for debugging, testing, or health checks:

```ts
const inspection = injector.inspect();

console.log(inspection);
// [
//   {
//     token: "UserService",
//     kind: "class",
//     scope: "singleton",
//     isResolved: true,
//     dependencies: ["UserRepository", "LoggerService"],
//     async: false
//   },
//   ...
// ]
```

---

## Runtime Samples Matrix

Runnable sample applications demonstrating `@nonnajs/di` across different JavaScript runtimes and UI frameworks:

| Sample                                                                          | Runtime           | Transport / Architecture                    | Features Tested                                                                                           | Repository                                                 |
| ------------------------------------------------------------------------------- | ----------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [**`sample-node`**](https://github.com/nonnajs/sample-node)                     | Node.js (18+)     | CLI / Pure App                              | `@nonnajs/compiler` AOT, request scopes, optional deps, `OnDestroy`                                       | [GitHub](https://github.com/nonnajs/sample-node)           |
| [**`sample-node-http`**](https://github.com/nonnajs/sample-node-http)           | Node.js (18+)     | Native `node:http`                          | Zero-framework HTTP server, request scoping per incoming request, router                                  | [GitHub](https://github.com/nonnajs/sample-node-http)      |
| [**`sample-deno`**](https://github.com/nonnajs/sample-deno)                     | Deno (1.40+, 2.x) | CLI / Pure App                              | Deno ESM, async database factory provider, task runner scopes                                             | [GitHub](https://github.com/nonnajs/sample-deno)           |
| [**`sample-deno-http`**](https://github.com/nonnajs/sample-deno-http)           | Deno (1.40+, 2.x) | Hono / `Deno.serve`                         | Web Standards HTTP, middleware-driven request scopes, controllers                                         | [GitHub](https://github.com/nonnajs/sample-deno-http)      |
| [**`sample-bun`**](https://github.com/nonnajs/sample-bun)                       | Bun (1.0+)        | CLI / Pure App                              | Multi-provider plugin architecture, request scoping, `Bun.test`                                           | [GitHub](https://github.com/nonnajs/sample-bun)            |
| [**`sample-bun-http`**](https://github.com/nonnajs/sample-bun-http)             | Bun (1.0+)        | Native `Bun.serve`                          | Native Bun Web Standards HTTP server, request-scoped controller & router                                  | [GitHub](https://github.com/nonnajs/sample-bun-http)       |
| [**`sample-react`**](https://github.com/nonnajs/sample-react)                   | Browser (Vite)    | React 18 + `@nonnajs/react`                 | `<NonnaProvider>`, all four hooks, field injection, multi-providers                                       | [GitHub](https://github.com/nonnajs/sample-react)          |
| [**`sample-vue`**](https://github.com/nonnajs/sample-vue)                       | Browser (Vite)    | Vue 3 + `@nonnajs/vue`                      | `<NonnaProvider>`, composables, field injection, multi-providers                                          | [GitHub](https://github.com/nonnajs/sample-vue)            |
| [**`sample-svelte`**](https://github.com/nonnajs/sample-svelte)                 | Browser (Vite)    | Svelte 5 + `@nonnajs/svelte`                | `setInjector()`, context functions, field injection, multi-providers                                      | [GitHub](https://github.com/nonnajs/sample-svelte)         |
| [**`sample-web-components`**](https://github.com/nonnajs/sample-web-components) | Browser (Vite)    | Custom Elements + `@nonnajs/web-components` | W3C Context Protocol, `<nonna-provider>`, `@inject()`/`@optionalInject()`/`@allInject()`, field injection | [GitHub](https://github.com/nonnajs/sample-web-components) |
| [**`sample-stencil`**](https://github.com/nonnajs/sample-stencil)               | Browser (Stencil) | StencilJS + `@nonnajs/stencil`              | `@Inject()`/`@OptionalInject()`/`@AllInject()` decorators, `<nonna-provider>` interop, multi-providers    | [GitHub](https://github.com/nonnajs/sample-stencil)        |

---

## Testing with Nonna

Nonna makes testing simple because explicit registrations always override decorator defaults:

```ts
import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {Nonna} from "@nonnajs/di";
import {UserService} from "./user.service";
import {UserRepository} from "./user.repository";

class FakeUserRepository {
    findById(id: string) {
        return {id, name: "Mock User"};
    }
}

describe("UserService", () => {
    it("resolves with mock repository", async () => {
        const injector = await Nonna.injector()
            // Override repository with a mock - explicit register() always wins over scan()
            .register({provide: UserRepository, useClass: FakeUserRepository})
            .scan() // pull in the rest of the application's decorated services
            .build();

        const service = injector.get(UserService);
        const user = service.getUser("123");

        assert.equal(user?.name, "Mock User");
    });
});
```

---

## API Reference Summary

### `@nonnajs/di`

#### `Nonna` (fluent bootstrap)

-   `Nonna.injector(): InjectorBuilder`
-   `builder.withContextStorage(storage: ContextStorage): this`
-   `builder.register(provider: Provider): this`
-   `builder.registerValue(token: Token, value: unknown): this`
-   `builder.registerFactory(token: Token, inject: Token[], factory: Function): this`
-   `builder.scan(): this` — pulls in every `@Injectable()`/`@Service()` class at `build()` time
-   `builder.loadBeans(manifest: string | readonly string[]): this`
-   `builder.freeze(): this` — `freezeAfterInitialize`
-   `builder.build(): Promise<Injector>` — runs `refresh()` (if `scan()` was called) + `initialize()`, returns a ready `Injector`

#### Injector (lower-level, imperative API)

-   `static Injector.create(options?: InjectorOptions): Injector`
-   `injector.register(provider: Provider): void`
-   `injector.registerValue(token: Token, value: unknown): void`
-   `injector.registerFactory(token: Token, inject: Token[], factory: Function): void`
-   `injector.refresh(): void`
-   `injector.initialize(options?: {freezeAfterInitialize?: boolean}): Promise<void>`
-   `injector.get<T>(token: Token<T>): T`
-   `injector.getAll<T>(token: Token<T>): readonly T[]`
-   `injector.getAsync<T>(token: Token<T>): Promise<T>`
-   `injector.getAllAsync<T>(token: Token<T>): Promise<readonly T[]>`
-   `injector.runInScope<R>(fn: () => Promise<R> | R): Promise<R> | R`
-   `injector.destroy(): Promise<void>`
-   `injector.inspect(token: Token): Inspection | undefined`
-   `injector.inspectAll(token: Token): readonly Inspection[]`

> Chaining lives on `InjectorBuilder` (`Nonna.injector()...`), not on `Injector` itself - `Injector`'s own `register()`/`refresh()`/`initialize()` calls are plain imperative methods, used directly whenever you need finer-grained control than the builder's single `build()` step gives you.

#### Decorators & Metadata

-   `@Injectable(options?: { scope?: "singleton" | "transient" | "request"; eager?: boolean })`
-   `@Service(options?: ...)` (Alias for `@Injectable`)
-   `@Inject(token: Token)`
-   `@Optional(token?: Token)`
-   `defineDependencies(target: Constructor, deps: readonly DependencyDeclaration[])`

### `@nonnajs/compiler`

#### CLI

-   `nonna-compile --project <tsconfig.json> --output <outputPath>`

#### Programmatic API

-   `compile(options: CompileOptions): CompileResult`

---

## License

Distributed under the **MIT License**.
