import type {Token} from "@nonna/di";
import {useInjector} from "./context";

/**
 * Resolves `token` from the nearest {@link Injector} in Svelte context, synchronously.
 *
 * @remarks
 * In Svelte, component script initialization runs once when the component mounts.
 * Calling `injector.get(token)` resolves once during initialization. Mirrors `Injector.get()`
 * exactly, including every error it can throw (`ProviderNotFoundError`, `AsyncProviderError`,
 * `ScopeError`, ...) - `useInjection()` does not swallow or convert them.
 *
 * @param token - The token to resolve.
 * @returns The resolved instance/value.
 * @throws Whatever `Injector.get()` throws - see its docs in `@nonna/di`.
 * @throws {@link Error} if called outside a component with an active injector context.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 * import {useInjection} from "@nonna/svelte";
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
