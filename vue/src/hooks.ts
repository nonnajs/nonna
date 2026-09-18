import type {Token} from "@nonnajs/di";
import {useInjector} from "./NonnaProvider";

/**
 * Resolves `token` from the nearest {@link NonnaProvider}'s {@link Injector}, synchronously.
 *
 * @remarks
 * Unlike `@nonnajs/react`'s `useInjection()`, this needs no memoization: a Vue component's
 * `setup()` runs exactly once per component instance (Vue re-renders by re-running the *render*
 * function, not `setup()`), so calling `injector.get(token)` here already resolves at most once
 * per instance - the same "resolve once, reuse across re-renders" behavior React's hook needs
 * `useMemo()` to get. Mirrors `Injector.get()` exactly, including every error it can throw
 * (`ProviderNotFoundError`, `AsyncProviderError`, `ScopeError`, ...) - `useInjection()` does not
 * swallow or convert them.
 *
 * @param token - The token to resolve.
 * @returns The resolved instance/value.
 * @throws Whatever `Injector.get()` throws - see its docs in `@nonnajs/di`.
 * @throws {@link Error} if called outside a {@link NonnaProvider}.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import {useInjection} from "@nonnajs/vue";
 * import {UserService} from "./user.service";
 *
 * const userService = useInjection(UserService);
 * const users = userService.getUsers();
 * </script>
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function useInjection<T>(token: Token<T>): T {
    return useInjector().get(token);
}

/**
 * Like {@link useInjection}, but resolves to `undefined` instead of throwing
 * `ProviderNotFoundError` when `token` isn't registered - mirrors `Injector.getOptional()`.
 *
 * @param token - The token to resolve.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function useOptionalInjection<T>(token: Token<T>): T | undefined {
    return useInjector().getOptional(token);
}

/**
 * Resolves every provider registered for `token` (intended for `multi: true` tokens) - mirrors
 * `Injector.getAll()`.
 *
 * @param token - The token to resolve.
 * @returns Every resolved instance/value for `token` (empty if none are registered).
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function useAllInjections<T>(token: Token<T>): readonly T[] {
    return useInjector().getAll(token);
}
