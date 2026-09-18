# `@nonnajs/svelte`

> Svelte bindings for [`@nonnajs/di`](../di) - `setInjector()` context helper plus `useInjection()`/`useOptionalInjection()`/`useAllInjections()`/`useInjector()` functions for zero-reflection dependency injection in Svelte apps.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Installation

```sh
# npm
npm install @nonnajs/svelte @nonnajs/di svelte

# Optional: Build-time AOT compiler
npm install --save-dev @nonnajs/compiler

# If using Vite in the browser
npm install --save-dev @nonnajs/vite-plugin
```

`@nonnajs/di` and `svelte` are peer dependencies (Svelte `>=4.0` or `>=5.0`, any `@nonnajs/di` `1.x`).

---

## Working Sample

A fully functional, runnable sample application is available on GitHub:
👉 **[`nonnajs/sample-svelte`](https://github.com/nonnajs/sample-svelte)** (Svelte 5 + Vite + `@nonnajs/svelte`)

---

## Complete Example

### 1. Define Services

Services are standard TypeScript classes decorated with `@Injectable()` from `@nonnajs/di`.

```ts
// src/services/user.repository.ts
import {Injectable} from "@nonnajs/di";

export interface User {
    id: string;
    name: string;
    email: string;
}

@Injectable()
export class UserRepository {
    private readonly users: User[] = [
        {id: "1", name: "Alice", email: "alice@example.com"},
        {id: "2", name: "Bob", email: "bob@example.com"},
    ];

    findAll(): User[] {
        return this.users;
    }
}
```

```ts
// src/services/user.service.ts
import {Injectable} from "@nonnajs/di";
import {UserRepository, User} from "./user.repository";

@Injectable()
export class UserService {
    // Constructor dependency is inferred automatically at build time with @nonnajs/compiler
    constructor(private readonly userRepo: UserRepository) {}

    getUsers(): User[] {
        return this.userRepo.findAll();
    }
}
```

### 2. AOT Dependency Compilation (Optional, Recommended)

With `@nonnajs/compiler`, constructor dependencies are inferred at build time using TypeScript's `TypeChecker` with **zero runtime reflection**:

```json
// package.json
{
    "scripts": {
        "prebuild": "nonna-compile",
        "build": "vite build"
    }
}
```

### 3. Application Bootstrap & Context Setup

Boot the container once at your app entry point, and bind it in your root component using `setInjector()`:

```ts
// src/main.ts
import {mount} from "svelte";
import {Nonna} from "@nonnajs/di";
import App from "./App.svelte";

// Import AOT-generated dependencies metadata (if using @nonnajs/compiler)
import "./__generated__/nonna-dependencies.generated";

async function bootstrap() {
    // 1. Configure and build the container
    const injector = await Nonna.injector().scan().build();

    // 2. Mount Svelte root component passing injector as prop
    const app = mount(App, {
        target: document.getElementById("app")!,
        props: {injector},
    });

    return app;
}

bootstrap();
```

```svelte
<!-- src/App.svelte -->
<script lang="ts">
import type {Injector} from "@nonnajs/di";
import {setInjector} from "@nonnajs/svelte";
import UserList from "./components/UserList.svelte";

let {injector} = $props<{injector: Injector}>();

// Sets injector in Svelte context for all child components
setInjector(injector);
</script>

<main>
    <h1>My Svelte Application</h1>
    <UserList />
</main>
```

### 4. Component Injection

Use `useInjection()`, `useOptionalInjection()`, `useAllInjections()`, or `useInjector()` inside child components:

```svelte
<!-- src/components/UserList.svelte -->
<script lang="ts">
import {useInjection} from "@nonnajs/svelte";
import {UserService} from "../services/user.service";

// Injects the singleton UserService instance from the Svelte context
const userService = useInjection(UserService);
const users = userService.getUsers();
</script>

<div>
    <h2>User Directory</h2>
    <ul>
        {#each users as user (user.id)}
            <li>
                <strong>{user.name}</strong> ({user.email})
            </li>
        {/each}
    </ul>
</div>
```

---

## Bundling For The Browser

`@nonnajs/di` uses Node.js `AsyncLocalStorage` by default for request scoping. When building for the browser with Vite, use [`@nonnajs/vite-plugin`](../vite-plugin) to automatically provide browser-safe shims:

```ts
// vite.config.ts
import {defineConfig} from "vite";
import {svelte} from "@sveltejs/vite-plugin-svelte";
import nonna from "@nonnajs/vite-plugin";

export default defineConfig({
    plugins: [svelte(), nonna()],
});
```

---

## API

### `setInjector(injector: Injector): Injector`

Makes `injector` available to every child component in the Svelte context tree via Svelte's `setContext`. Must be called synchronously during component initialization (in `<script>`).

### `hasInjector(): boolean`

Returns `true` if an `Injector` exists in the current component's ancestor context tree.

### `useInjector(): Injector`

Returns the `Injector` from the nearest ancestor component that called `setInjector()`. Throws if called outside an active injector context.

### `useInjection<T>(token: Token<T>): T`

Resolves `token` via `injector.get(token)`. Throws exactly what `Injector.get()` throws (`ProviderNotFoundError`, `AsyncProviderError`, `ScopeError`, ...).

```ts
const logger = useInjection(Logger);
```

### `useOptionalInjection<T>(token: Token<T>): T | undefined`

Like `useInjection()`, but resolves to `undefined` instead of throwing when `token` isn't registered - mirrors `Injector.getOptional()`.

### `useAllInjections<T>(token: Token<T>): readonly T[]`

Resolves every provider registered for `token` (for `multi: true` tokens) - mirrors `Injector.getAll()`. Resolves to `[]` if none are registered.

---

## Bundling For The Browser

`@nonnajs/di`'s published bundle statically imports a handful of Node builtins (`node:async_hooks`, `node:fs/promises`, `node:path`, `node:url`) that a real browser bundler can't resolve on its own. If you're using Vite, [`@nonnajs/vite-plugin`](../vite-plugin) aliases them to browser-safe shims with a single `plugins: [nonna()]` entry.

---

## License

MIT © Manuel Santos
