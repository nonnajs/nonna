# `@nonna/vite-plugin`

> Vite plugin for [`@nonna/di`](../di) - aliases the handful of Node.js builtins `@nonna/di`'s published dist bundle statically imports to minimal, browser-safe shims, so a browser app (React, Vue, or anything else Vite bundles) can resolve `@nonna/di` at all.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The Problem

`@nonna/di`'s default request-scope storage (`AsyncLocalStorage`, from `node:async_hooks`) and `injector.loadBeans()` (`node:fs/promises`, `node:path`, `node:url`) are Node-only features. Most browser apps never touch either - no `runInScope()`/request-scoped providers, `.scan()` instead of `loadBeans()` - but `@nonna/di`'s published bundle still statically imports those four builtins (tsup's `platform: "neutral"` build strips the `node:` prefix, so both the bare and prefixed specifiers show up), and a real browser bundler like Rollup can't resolve either form on its own. Without this plugin, building `@nonna/di` into a browser bundle fails at bundle time with an unresolved-import error.

## Installation

```sh
npm install --save-dev @nonna/vite-plugin
```

`vite` is a peer dependency - bring your own version (`>=4`).

## Usage

```ts
// vite.config.ts
import {defineConfig} from "vite";
import {nonna} from "@nonna/vite-plugin";

export default defineConfig({
    plugins: [nonna()],
});
```

That's it - `@nonna/di` (and anything built on top of it, like [`@nonna/react`](../react) or [`@nonna/vue`](../vue)) now bundles cleanly for the browser.

## What The Shims Actually Do

None of the four shims provide real Node semantics - they exist purely so the bundler has _something_ to resolve:

-   **`async_hooks`** - a minimal `AsyncLocalStorage` stand-in with single-slot `run()`/`getStore()`. Not real async-context isolation across concurrent calls. Only exercised if your app calls `injector.runInScope()` without supplying its own `contextStorage`.
-   **`fs/promises`** - a `readFile()` that always throws. Only exercised if your app calls `injector.loadBeans()`.
-   **`path`** / **`url`** - minimal `isAbsolute`/`dirname`/`resolve` and `pathToFileURL()` implementations. Also only exercised by `loadBeans()`.

If your app needs real request scoping in the browser, supply your own `ContextStorage` via `Nonna.injector().withContextStorage(...)` instead of relying on the shimmed default.

## API

### `nonna(options?: NonnaPluginOptions): Plugin`

-   `options.shims?: NonnaShimName[]` - which of `"async_hooks" | "fs/promises" | "path" | "url"` to shim. Defaults to all four; narrow this only if you've audited your app and know it never reaches the feature a given shim backs.

## License

MIT © Manuel Santos
