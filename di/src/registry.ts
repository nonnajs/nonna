import type {Constructor, Scope, Token} from "./types";

/**
 * A decorator-driven registration, as recorded by `@Injectable()`/`@Service()`.
 *
 * @remarks
 * This is a registration bridge, not the container itself: an {@link Injector}'s `refresh()`
 * pulls from here, but resolution/caching always happens on the Injector's own local state, so
 * multiple injectors never accidentally share singleton instances.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export interface GlobalRegistration {
    token: Token;
    target: Constructor;
    scope: Scope;
    eager: boolean;
}

const globalRegistrations = new Map<Token, GlobalRegistration>();

/** Records (or overwrites) a class's decorator-driven registration. Called by `@Injectable()`/`@Service()`. */
export function registerGlobal(registration: GlobalRegistration): void {
    globalRegistrations.set(registration.token, registration);
}

/** Returns every class registered so far via `@Injectable()`/`@Service()`, across the whole process. */
export function getGlobalRegistrations(): readonly GlobalRegistration[] {
    return [...globalRegistrations.values()];
}

/** Test-isolation helper only - the {@link Injector} itself never calls this. */
export function clearGlobalRegistry(): void {
    globalRegistrations.clear();
}
