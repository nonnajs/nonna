import type {Token} from "@nonnajs/di";
import {useMemo} from "react";
import {useInjector} from "./NonnaProvider";

/**
 * Resolves `token` from the nearest {@link NonnaProvider}'s {@link Injector}, synchronously.
 *
 * @remarks
 * The resolution is memoized on `[injector, token]`, so a `transient`-scoped token isn't
 * re-constructed on every render - only when the injector instance or the token itself changes
 * identity. This mirrors `Injector.get()` exactly, including every error it can throw
 * (`ProviderNotFoundError`, `AsyncProviderError`, `ScopeError`, ...) - `useInjection()` does not
 * swallow or convert them.
 *
 * @param token - The token to resolve.
 * @returns The resolved instance/value.
 * @throws Whatever `Injector.get()` throws - see its docs in `@nonnajs/di`.
 * @throws {@link Error} if called outside a {@link NonnaProvider}.
 *
 * @example
 * ```tsx
 * function UserList() {
 *     const userService = useInjection(UserService);
 *     const users = userService.getUsers();
 *     return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
 * }
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function useInjection<T>(token: Token<T>): T {
    const injector = useInjector();
    return useMemo(() => injector.get(token), [injector, token]);
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
    const injector = useInjector();
    return useMemo(() => injector.getOptional(token), [injector, token]);
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
    const injector = useInjector();
    return useMemo(() => injector.getAll(token), [injector, token]);
}
