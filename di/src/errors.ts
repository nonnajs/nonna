import type {Token} from "./types";

export function describeToken(token: Token): string {
    if (typeof token === "string") return `"${token}"`;
    if (typeof token === "symbol") return token.toString();
    return token.name || "<anonymous class>";
}

/**
 * Base class for every error `@nonnajs/di` throws.
 *
 * @remarks
 * Sets `this.name` to the concrete subclass name (via `new.target`) so `error.name` is always
 * accurate (e.g. `"ProviderNotFoundError"`), including after minification.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export class InjectorError extends Error {
    constructor(message: string, options?: {cause?: unknown}) {
        super(message, options);
        this.name = new.target.name;
    }
}

/** Thrown by {@link Injector.get}/{@link Injector.getAsync} when no provider is registered for a required token. */
export class ProviderNotFoundError extends InjectorError {
    /**
     * @param token - The token that could not be resolved.
     * @param dependencyChain - The chain of tokens that led to this resolution, for a readable error message.
     */
    constructor(public readonly token: Token, public readonly dependencyChain: readonly Token[] = []) {
        const chain =
            dependencyChain.length > 0
                ? `\n\nDependency chain:\n${dependencyChain.map(describeToken).join(" → ")}`
                : "";
        super(`No provider registered for ${describeToken(token)}.${chain}`);
    }
}

/** Thrown when resolving a token would require resolving itself again, transitively. */
export class CircularDependencyError extends InjectorError {
    /** @param chain - The full cycle, starting and ending at the same token. */
    constructor(public readonly chain: readonly Token[]) {
        super(`Circular dependency detected: ${chain.map(describeToken).join(" → ")}`);
    }
}

/** Thrown for a malformed {@link Provider} (missing a `use*` field) or an invalid multi/non-multi mix. */
export class InvalidProviderError extends InjectorError {
    constructor(message: string, public readonly token?: Token) {
        super(message);
    }
}

/**
 * Thrown by {@link Injector.get}/{@link Injector.getAll} when the resolved provider requires
 * asynchronous construction.
 *
 * @remarks
 * Covers both an async `useFactory` and a class whose `onInit()` is statically known to be
 * async. Use `getAsync()`/`getAllAsync()` instead.
 */
export class AsyncProviderError extends InjectorError {
    /** @param token - The token whose provider requires async resolution. */
    constructor(public readonly token: Token) {
        super(
            `Token ${describeToken(token)} requires asynchronous initialization. ` +
                `Use injector.getAsync()/getAllAsync() instead of get()/getAll().`,
        );
    }
}

/**
 * Thrown for a request-scope violation: resolving a `request`-scoped token outside
 * {@link Injector.runInScope}, or a `singleton` transitively depending on one.
 */
export class ScopeError extends InjectorError {
    constructor(message: string, public readonly token?: Token, public readonly dependencyChain?: readonly Token[]) {
        super(message);
    }
}

/** Thrown by {@link Injector.loadBeans} when a manifest file or one of its listed modules can't be read/imported/parsed. */
export class BeanManifestError extends InjectorError {
    /**
     * @param message - Human-readable description of what went wrong.
     * @param manifestPath - Path to the manifest file involved, if any.
     * @param options - Standard `Error` options; `cause` carries the underlying I/O/parse/import error.
     */
    constructor(message: string, public readonly manifestPath?: string, options?: {cause?: unknown}) {
        super(message, options);
    }
}

/**
 * Thrown by {@link Injector.destroy} when one or more `onDestroy()` hooks fail.
 *
 * @remarks
 * Aggregates every failure instead of surfacing only the first one, since a slow/failing
 * dependency shouldn't hide sibling failures during teardown.
 */
export class LifecycleError extends InjectorError {
    /** @param failures - Every `(token, error)` pair whose `onDestroy()` hook threw or rejected. */
    constructor(public readonly failures: ReadonlyArray<{token: Token; error: unknown}>) {
        super(
            `${failures.length} lifecycle hook(s) failed during destroy():\n` +
                failures
                    .map(
                        f =>
                            `  - ${describeToken(f.token)}: ${
                                f.error instanceof Error ? f.error.message : String(f.error)
                            }`,
                    )
                    .join("\n"),
        );
    }
}

/** Thrown by any {@link Injector} method (except an already-resolved `destroy()`) once the injector has been destroyed. */
export class InjectorDestroyedError extends InjectorError {
    /** @param token - The token that was being resolved/registered when the injector was found destroyed, if any. */
    constructor(public readonly token?: Token) {
        super(
            token
                ? `Cannot resolve ${describeToken(token)}: injector has already been destroyed.`
                : "Injector has already been destroyed.",
        );
    }
}
