import type {Injector} from "@nonnajs/di";
import {getContext, hasContext, setContext} from "svelte";

/**
 * Svelte context symbol carrying the active {@link Injector}.
 */
export const NONNA_INJECTOR_KEY = Symbol("NonnaInjector");

/**
 * Makes an {@link Injector} available to child components via Svelte's context API.
 * Call this synchronously during component initialization in your root/parent component.
 *
 * @param injector - An already-configured, initialized {@link Injector}.
 * @returns The passed injector.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 * import {setInjector} from "@nonnajs/svelte";
 * import type {Injector} from "@nonnajs/di";
 *
 * let {injector} = $props<{injector: Injector}>();
 * setInjector(injector);
 * </script>
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function setInjector(injector: Injector): Injector {
    setContext(NONNA_INJECTOR_KEY, injector);
    return injector;
}

/**
 * Checks whether an {@link Injector} is available in the current Svelte component context.
 *
 * @returns `true` if an injector was provided in an ancestor context, `false` otherwise.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function hasInjector(): boolean {
    return hasContext(NONNA_INJECTOR_KEY);
}

/**
 * Reads the {@link Injector} supplied by the nearest ancestor component that called {@link setInjector}.
 *
 * @remarks
 * Like every other Svelte context function (`getContext()`), this only works when called synchronously
 * during component initialization - not from async callbacks, timers, or event handlers.
 *
 * @throws {@link Error} if called outside a component with an active {@link Injector} context.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function useInjector(): Injector {
    const injector = getContext<Injector | undefined>(NONNA_INJECTOR_KEY);
    if (!injector) {
        throw new Error(
            "useInjector() (and useInjection()/useOptionalInjection()/useAllInjections()) must be called " +
                "during component initialization in a component hierarchy where setInjector(injector) was called.",
        );
    }
    return injector;
}
