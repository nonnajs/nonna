import {AsyncLocalStorage} from "node:async_hooks";

import type {ContextStorage, RequestScopeStore} from "./types";

/**
 * Default request-scope storage, backed by `node:async_hooks`.
 *
 * @remarks
 * Bun and Deno both implement this module through their Node compatibility layers, so this
 * adapter is expected to work unmodified on all three runtimes; a different
 * {@link ContextStorage} implementation can be supplied via {@link InjectorOptions.contextStorage}
 * for environments where that's not the case (e.g. edge/Workers runtimes).
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export class AsyncLocalStorageContextStorage implements ContextStorage<RequestScopeStore> {
    private readonly storage = new AsyncLocalStorage<RequestScopeStore>();

    run<R>(store: RequestScopeStore, fn: () => R): R {
        return this.storage.run(store, fn);
    }

    getStore(): RequestScopeStore | undefined {
        return this.storage.getStore();
    }
}
