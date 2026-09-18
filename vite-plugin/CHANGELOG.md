# @nonnajs/vite-plugin

## 1.1.0

### Minor Changes

-   5acafec: Initial release of `@nonnajs/vite-plugin`:

    -   **Vite Browser Compatibility**: Vite plugin providing browser-safe shims for Node.js built-ins used by `@nonnajs/di`.
    -   **AsyncLocalStorage Shim**: Transparently resolves and shims `node:async_hooks` and `async_hooks` for browser bundle targets.
    -   **Zero-Fuss Configuration**: Exported as `nonnaPlugin()` and default export for effortless inclusion in `vite.config.ts`.
