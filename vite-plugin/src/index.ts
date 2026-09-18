import type {Plugin} from "vite";
import {ASYNC_HOOKS_SHIM, FS_PROMISES_SHIM, PATH_SHIM, URL_SHIM} from "./shims";

/** The Node.js builtins `@nonna/di`'s published dist bundle statically imports. */
export type NonnaShimName = "async_hooks" | "fs/promises" | "path" | "url";

const SHIM_SOURCE: Record<NonnaShimName, string> = {
    async_hooks: ASYNC_HOOKS_SHIM,
    "fs/promises": FS_PROMISES_SHIM,
    path: PATH_SHIM,
    url: URL_SHIM,
};

/** Prefixed with `\0` so other plugins' `resolveId` hooks skip it (Rollup convention for virtual module ids). */
const VIRTUAL_PREFIX = "\0nonna-node-shim:";

/** Options accepted by {@link nonna}. */
export interface NonnaPluginOptions {
    /**
     * Which builtins to shim. Defaults to all four - narrow this only if you've audited your app
     * and know it never reaches the specific `@nonna/di` feature backed by a given shim (see
     * {@link nonna}'s own doc comment for which feature maps to which shim).
     */
    shims?: readonly NonnaShimName[];
}

/**
 * Vite plugin that aliases the handful of Node.js builtins `@nonna/di`'s published dist bundle
 * statically imports - `node:async_hooks`/`async_hooks`, `node:fs/promises`/`fs/promises`,
 * `node:path`/`path`, `node:url`/`url` (tsup's `platform: "neutral"` build strips the `node:`
 * prefix, hence both bare and prefixed forms need aliasing) - to minimal, browser-safe virtual
 * modules, so a browser bundler (Rollup, via Vite) has something to resolve `@nonna/di` against
 * at all.
 *
 * @remarks
 * None of these shims provide real Node semantics - they exist purely so the bundler has
 * *something* to resolve, and `@nonna/di`'s browser-relevant surface (`Injector.get()`/
 * `getAsync()`/`register()`/scopes/lifecycle/...) never actually calls into them unless your app
 * itself calls `injector.loadBeans()` (uses `fs/promises` + `path` + `url`) or
 * `injector.runInScope()` with no custom `contextStorage` (uses `async_hooks`, and even then only
 * provides single-threaded, non-isolating storage - not real `AsyncLocalStorage` semantics). If
 * you need real request scoping in a browser app, supply your own `ContextStorage` via
 * `Nonna.injector().withContextStorage(...)` instead of relying on the shimmed default.
 *
 * @param options - Optional configuration; see {@link NonnaPluginOptions}.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import {defineConfig} from "vite";
 * import {nonna} from "@nonna/vite-plugin";
 *
 * export default defineConfig({
 *     plugins: [nonna()],
 * });
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function nonna(options: NonnaPluginOptions = {}): Plugin {
    const enabled = options.shims ?? (Object.keys(SHIM_SOURCE) as NonnaShimName[]);

    const virtualIdFor = new Map<string, NonnaShimName>();
    for (const name of enabled) {
        virtualIdFor.set(name, name);
        virtualIdFor.set(`node:${name}`, name);
    }

    return {
        name: "@nonna/vite-plugin",
        enforce: "pre",
        resolveId(id) {
            const shimName = virtualIdFor.get(id);
            return shimName ? VIRTUAL_PREFIX + shimName : undefined;
        },
        load(id) {
            if (!id.startsWith(VIRTUAL_PREFIX)) return undefined;
            return SHIM_SOURCE[id.slice(VIRTUAL_PREFIX.length) as NonnaShimName];
        },
    };
}
