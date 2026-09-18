/**
 * Source of the browser-safe stand-ins served (as virtual modules) in place of the handful of
 * Node.js builtins `@nonnajs/di`'s published dist bundle statically imports. Kept as plain-string
 * ES module source - rather than real `.ts` files resolved from `dist/` at runtime - so this
 * plugin ships as a single bundled entry point (matching every other `@nonnajs/*` package here)
 * with no sibling-file path resolution to get wrong across the plugin's own cjs/esm dual build.
 *
 * @remarks
 * None of these shims provide real Node semantics - see {@link nonna} in `./index.ts` for what
 * each one does and doesn't emulate, and when it's actually exercised at runtime.
 */

export const ASYNC_HOOKS_SHIM = `
export class AsyncLocalStorage {
    #store;

    run(store, callback) {
        const previous = this.#store;
        this.#store = store;
        try {
            return callback();
        } finally {
            this.#store = previous;
        }
    }

    getStore() {
        return this.#store;
    }
}
`;

export const FS_PROMISES_SHIM = `
export async function readFile() {
    throw new Error("fs.readFile() is not available in the browser - this app never calls injector.loadBeans().");
}
`;

export const PATH_SHIM = `
function isAbsolute(target) {
    return target.startsWith("/");
}

function dirname(target) {
    const index = target.lastIndexOf("/");
    return index === -1 ? "." : target.slice(0, index) || "/";
}

function resolve(...segments) {
    return segments.join("/");
}

export default {isAbsolute, dirname, resolve};
export {isAbsolute, dirname, resolve};
`;

export const URL_SHIM = `
export function pathToFileURL(target) {
    return {href: "file://" + target};
}
`;
