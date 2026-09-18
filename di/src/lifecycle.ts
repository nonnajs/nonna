import {LifecycleError} from "./errors";
import type {RegistrationId, Token} from "./types";

/**
 * The only teardown contract the injector recognizes.
 *
 * @remarks
 * Deliberately does not guess at `close()`/`dispose()`/`shutdown()`/`stop()` - an explicit,
 * single, well-known method name keeps teardown predictable. Called by {@link Injector.destroy}
 * (singletons) and at the end of {@link Injector.runInScope} (request-scoped instances), in
 * reverse creation order.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export interface OnDestroy {
    onDestroy(): void | Promise<void>;
}

/** Type guard: does `instance` implement {@link OnDestroy}? */
export function hasOnDestroy(instance: unknown): instance is OnDestroy {
    return (
        typeof instance === "object" &&
        instance !== null &&
        typeof (instance as Partial<OnDestroy>).onDestroy === "function"
    );
}

/**
 * Post-construction lifecycle hook, run once immediately after an instance is built.
 *
 * @remarks
 * Runs for every instance actually constructed - singleton, transient, and request scope alike -
 * because it mirrors "finish constructing this specific object" rather than "tear down something
 * this container owns" (which is what {@link OnDestroy} is for, and why that one only runs for
 * tracked singleton/request instances). Whether `onInit()` is `async` is resolved statically from
 * the method's own shape (see {@link Injector.runOnInitSync}), never sniffed from a call - a class
 * with an async `onInit()` can only be constructed via `getAsync()`/`getAllAsync()`, or eagerly
 * during {@link Injector.initialize}.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export interface OnInit {
    onInit(): void | Promise<void>;
}

/** Type guard: does `instance` implement {@link OnInit}? */
export function hasOnInit(instance: unknown): instance is OnInit {
    return (
        typeof instance === "object" && instance !== null && typeof (instance as Partial<OnInit>).onInit === "function"
    );
}

/**
 * Destroys instances in reverse creation order, collecting every `onDestroy()` failure into a
 * single {@link LifecycleError} instead of stopping at the first one - a slow/failing dependency
 * shouldn't prevent the rest of the graph from being torn down.
 *
 * @param creationOrder - Registration ids in the order their instances were created.
 * @param instances - The live instance cache to read from (singletons or a request scope's store).
 * @param tokenOf - Resolves a registration id back to its token, for error reporting.
 * @throws {@link LifecycleError} if one or more `onDestroy()` hooks threw or rejected.
 */
export async function destroyInReverseOrder(
    creationOrder: readonly RegistrationId[],
    instances: ReadonlyMap<RegistrationId, unknown>,
    tokenOf: (id: RegistrationId) => Token,
): Promise<void> {
    const failures: Array<{token: Token; error: unknown}> = [];

    for (let i = creationOrder.length - 1; i >= 0; i--) {
        const id = creationOrder[i]!;
        const instance = instances.get(id);
        if (hasOnDestroy(instance)) {
            try {
                await instance.onDestroy();
            } catch (error) {
                failures.push({token: tokenOf(id), error});
            }
        }
    }

    if (failures.length > 0) {
        throw new LifecycleError(failures);
    }
}
