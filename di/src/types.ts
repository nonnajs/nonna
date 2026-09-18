/**
 * A constructor for a concrete class `T`.
 *
 * @remarks
 * Preferred as a {@link Token} because it is inferable by `@nonnajs/compiler` without any
 * decorator, and gives the injector a runtime identity to key registrations on.
 */
export type Constructor<T = unknown> = new (...args: any[]) => T;

/**
 * A constructor for an abstract class `T`.
 *
 * @remarks
 * Abstract classes cannot be instantiated directly, but are still valid {@link Token}s - the
 * concrete implementation is supplied via `useClass`/`useExisting` on the {@link Provider}.
 */
export type AbstractConstructor<T = unknown> = abstract new (...args: any[]) => T;

/**
 * A DI token: the key a {@link Provider} is registered under and later resolved by.
 *
 * @remarks
 * Concrete/abstract classes are preferred (inferable by the AOT compiler); symbols/strings are
 * for values that have no runtime class representation (configuration, connection pools, etc).
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export type Token<T = unknown> = Constructor<T> | AbstractConstructor<T> | symbol | string;

/**
 * Opaque identifier of a single registration (not of a token).
 *
 * @remarks
 * Unique per registration rather than per token, so multi-providers (`multi: true`) each own an
 * independent cache slot instead of colliding on a shared token key. Implemented as a plain
 * incrementing integer rather than a `Symbol`: numeric keys hash and compare faster in a `Map`,
 * and it avoids paying for a `Symbol(describeToken(token))` (string formatting included) on every
 * single registration just to get a unique identity.
 */
export type RegistrationId = number;

/**
 * The lifetime of a resolved instance.
 *
 * - `singleton` - one shared instance per {@link Injector} (default).
 * - `transient` - a new instance on every resolution.
 * - `request` - one shared instance per {@link Injector.runInScope} call.
 */
export type Scope = "singleton" | "transient" | "request";

/**
 * A single constructor-parameter dependency, as recorded by {@link defineDependencies} or the
 * `@Inject()`/`@Optional()` decorators.
 */
export interface Dependency<T = unknown> {
    token: Token<T>;
    optional?: boolean;
}

/**
 * Shorthand form accepted by {@link defineDependencies}: either a bare {@link Token} (implying
 * `optional: false`) or an explicit {@link Dependency} object.
 */
export type DependencyDeclaration<T = unknown> = Token<T> | Dependency<T>;

interface BaseProvider<T> {
    provide: Token<T>;
    scope?: Scope;
    eager?: boolean;
    multi?: boolean;
}

/** Registers a class to be constructed (with its dependencies injected) by the container. */
export interface ClassProvider<T = unknown> extends BaseProvider<T> {
    useClass: Constructor<T>;
}

/** Registers an already-constructed value, resolved as-is with no construction step. */
export interface ValueProvider<T = unknown> extends BaseProvider<T> {
    useValue: T;
}

/** Registers a factory function, invoked with its own resolved `inject` dependencies. */
export interface FactoryProvider<T = unknown> extends BaseProvider<T> {
    useFactory: (...args: any[]) => T | Promise<T>;
    inject?: readonly Token[];
    /**
     * Must be set to `true` when `useFactory` returns a `Promise`. Never inferred by sniffing
     * the return value at call time - async-ness is always statically known up front.
     */
    async?: boolean;
}

/** Aliases one token to an already-registered token, resolving to the exact same instance. */
export interface ExistingProvider<T = unknown> extends BaseProvider<T> {
    useExisting: Token<T>;
}

/**
 * The union of all provider registration shapes accepted by {@link Injector.register}.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export type Provider<T = unknown> = ClassProvider<T> | ValueProvider<T> | FactoryProvider<T> | ExistingProvider<T>;

/** Discriminates which `use*` field a {@link Provider} was registered with. */
export type ProviderKind = "class" | "value" | "factory" | "existing";

/**
 * Normalized, internal representation of a registration.
 *
 * @remarks
 * Runtime resolution operates only on this shape - never on the raw {@link Provider} union - so
 * the hot path never has to re-inspect which `use*` field was supplied.
 */
export interface CompiledProvider<T = unknown> {
    id: RegistrationId;
    token: Token<T>;
    kind: ProviderKind;
    scope: Scope;
    eager: boolean;
    multi: boolean;
    dependencies: () => readonly Dependency[];
    /**
     * Field/property dependencies declared via `@Inject()`/`@Optional()` on a class field.
     * Only ever populated for `kind === "class"` providers (see
     * {@link Injector.injectFieldsSync}/{@link Injector.injectFieldsAsync}) - factory/value/
     * existing providers hand back an already-built value with no class-level field metadata to
     * read from.
     */
    fieldDependencies: () => ReadonlyMap<PropertyKey, Dependency> | undefined;
    invoke: (resolvedDeps: unknown[]) => T | Promise<T>;
    isAsync: boolean;
    /**
     * Statically known (via prototype inspection, never a runtime sniff) only for class
     * providers - `true` when `target.prototype.onInit` is an `async` function. For other
     * provider kinds this is always `false` and the injector falls back to checking the
     * constructed instance's `onInit` directly.
     *
     * @see Injector.runOnInitSync
     */
    onInitIsAsync: boolean;
}

/**
 * Debug/introspection snapshot for a single registration.
 *
 * @see Injector.inspect
 * @see Injector.inspectAll
 */
export interface Inspection {
    token: Token;
    scope: Scope;
    kind: ProviderKind;
    multi: boolean;
    eager: boolean;
    isAsync: boolean;
    dependencies: readonly Token[];
    /** Only meaningful for singleton scope - transient/request instances are never cached this way. */
    instantiated: boolean;
}

/**
 * Abstraction over "how does the current async call stack carry request-scoped state".
 *
 * @remarks
 * Node's default implementation ({@link AsyncLocalStorageContextStorage}) uses
 * `node:async_hooks`' `AsyncLocalStorage`; this interface lets Bun/Deno (or tests) supply an
 * alternative without the {@link Injector} needing to know which.
 */
export interface ContextStorage<T> {
    run<R>(store: T, fn: () => R): R;
    getStore(): T | undefined;
}

/** Per-{@link Injector.runInScope} call state: the live request-scoped instance cache. */
export interface RequestScopeStore {
    id: string;
    instances: Map<RegistrationId, unknown>;
    creationOrder: RegistrationId[];
}

/** Options accepted by {@link Injector.create}. */
export interface InjectorOptions {
    contextStorage?: ContextStorage<RequestScopeStore>;
}
