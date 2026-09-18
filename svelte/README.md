# `@nonna/svelte`

> Svelte bindings for [`@nonna/di`](../di) - `setInjector()` context helper plus `useInjection()`/`useOptionalInjection()`/`useAllInjections()`/`useInjector()` functions for zero-reflection dependency injection in Svelte apps.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Installation

```sh
npm install @nonna/svelte @nonna/di svelte
```

`@nonna/di` and `svelte` are peer dependencies - bring your own versions (Svelte `>=4.0` or `>=5.0`, any `@nonna/di` `1.x`).

---

## Quick Example

```svelte
<!-- UserList.svelte -->
<script lang="ts">
import {useInjection} from "@nonna/svelte";
import {UserService} from "./user.service";

const userService = useInjection(UserService);
const users = userService.getUsers();
</script>

<ul>
    {#each users as user (user.id)}
        <li>{user.name}</li>
    {/each}
</ul>
```

```svelte
<!-- App.svelte -->
<script lang="ts">
import type {Injector} from "@nonna/di";
import {setInjector} from "@nonna/svelte";
import UserList from "./UserList.svelte";

let {injector} = $props<{injector: Injector}>();
setInjector(injector);
</script>

<UserList />
```

```ts
// main.ts
import {mount} from "svelte";
import {Nonna} from "@nonna/di";
import App from "./App.svelte";

// 1. Configure and boot the container once, at your app's entry point - not inside component initialization.
const injector = await Nonna.injector().scan().build();

const app = mount(App, {
    target: document.getElementById("app")!,
    props: {injector},
});

export default app;
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

`@nonna/di`'s published bundle statically imports a handful of Node builtins (`node:async_hooks`, `node:fs/promises`, `node:path`, `node:url`) that a real browser bundler can't resolve on its own. If you're using Vite, [`@nonna/vite-plugin`](../vite-plugin) aliases them to browser-safe shims with a single `plugins: [nonna()]` entry.

---

## License

MIT © Manuel Santos
