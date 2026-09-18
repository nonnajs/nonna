# `@nonnajs/vue`

> Vue 3 bindings for [`@nonnajs/di`](../di) - a `<NonnaProvider>` component plus `useInjection()`/`useOptionalInjection()`/`useAllInjections()`/`useInjector()` composables, in the spirit of [`@nonnajs/react`](../react)/`inversify-vue`.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Installation

```sh
npm install @nonnajs/vue @nonnajs/di vue
```

`@nonnajs/di` and `vue` are peer dependencies - bring your own versions (Vue `>=3.2`, any `@nonnajs/di` `1.x`).

---

## Quick Example

```vue
<!-- App.vue -->
<script setup lang="ts">
import {useInjection} from "@nonnajs/vue";
import {UserService} from "./user.service";

const userService = useInjection(UserService);
const users = userService.getUsers();
</script>

<template>
    <ul>
        <li v-for="user in users" :key="user.id">{{ user.name }}</li>
    </ul>
</template>
```

```ts
// main.ts
import {createApp} from "vue";
import {Nonna} from "@nonnajs/di";
import {NonnaProvider} from "@nonnajs/vue";
import App from "./App.vue";

// 1. Configure and boot the container once, at your app's entry point - not inside the tree.
const injector = await Nonna.injector().scan().build();

const RootApp = {
    render: () => h(NonnaProvider, {injector}, {default: () => h(App)}),
};
createApp(RootApp).mount("#app");
```

---

## Why an already-built `Injector`?

`NonnaProvider` takes a ready `Injector` - never a builder, and never a `Promise<Injector>`. Bootstrapping (`await Nonna.injector()...build()`) is async, and belongs in your app's own entry point, before `app.mount()` - not something the provider does on your behalf. This keeps `NonnaProvider` itself trivial (a single `provide()` call, no implicit loading state, no suspense boundary you didn't ask for) and matches how [`@nonnajs/react`](../react)'s `<NonnaProvider>` works: you own the container's lifecycle, the provider component just makes it available to the tree.

If you'd rather provide the injector at the app root instead of wrapping a component in your template, call Vue's own `app.provide()` - `NonnaProvider` is a thin convenience over exactly that (see its source), so either style interops fine; just make sure whichever you pick actually runs before any component calls `useInjector()`/`useInjection()`.

---

## API

### `<NonnaProvider :injector="injector">`

Makes `injector` available to every composable below it in the tree, via Vue's `provide`/`inject`. Safe to nest (an inner `NonnaProvider` shadows an outer one, e.g. for a request-scoped sub-tree with its own child injector).

### `useInjector(): Injector`

Returns the `Injector` from the nearest `NonnaProvider`. Throws if called outside one - every other composable here is built on top of this and inherits that behavior. Like all `inject()`-based composables, only works when called synchronously from `setup()` (or another composable called from `setup()`).

### `useInjection<T>(token: Token<T>): T`

Resolves `token` via `injector.get(token)`. Throws exactly what `Injector.get()` throws (`ProviderNotFoundError`, `AsyncProviderError`, `ScopeError`, ...) - nothing is swallowed or converted.

```ts
const logger = useInjection(Logger);
```

Unlike `@nonnajs/react`'s `useInjection()`, there's no memoization here to worry about: a Vue component's `setup()` runs exactly once per component instance (Vue re-renders by re-running the _render_ function, not `setup()`), so this already resolves at most once per instance for free.

### `useOptionalInjection<T>(token: Token<T>): T | undefined`

Like `useInjection()`, but resolves to `undefined` instead of throwing when `token` isn't registered - mirrors `Injector.getOptional()`.

### `useAllInjections<T>(token: Token<T>): readonly T[]`

Resolves every provider registered for `token` (for `multi: true` tokens) - mirrors `Injector.getAll()`. Resolves to `[]` if none are registered.

---

## What this package deliberately doesn't do

-   **No async resolution composable.** `useInjection()` is sync-only, matching `injector.get()`. If a token needs `getAsync()`, resolve it during your own bootstrap (before `build()` finishes, or via an eager provider) rather than inside `setup()`.
-   **No reactive re-resolution on a changing token.** These composables take a plain `Token<T>`, not a `ref`/getter - a DI token used to resolve a service isn't expected to change identity within a component's lifetime. If you need a different token's service for a different piece of reactive state, resolve both up front (or key a `<component>`/list item so Vue mounts a fresh instance) rather than reaching for a reactive token.
-   **No request-scope integration with the render tree.** `Injector.runInScope()` is designed around a request/call lifecycle (an HTTP request, a job run), not a component's mount lifecycle - nest a `NonnaProvider` with a differently-scoped child `Injector` if you need per-subtree isolation.

---

## Bundling For The Browser

`@nonnajs/di`'s published bundle statically imports a handful of Node builtins (`node:async_hooks`, `node:fs/promises`, `node:path`, `node:url`) that a real browser bundler can't resolve on its own. If you're using Vite, [`@nonnajs/vite-plugin`](../vite-plugin) aliases them to browser-safe shims with a single `plugins: [nonna()]` entry.

---

## License

MIT © Manuel Santos
