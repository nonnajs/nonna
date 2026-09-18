import {readFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

import {AsyncLocalStorageContextStorage} from "./context";
import {
    AsyncProviderError,
    BeanManifestError,
    CircularDependencyError,
    InjectorDestroyedError,
    InjectorError,
    InvalidProviderError,
    ProviderNotFoundError,
    ScopeError,
    describeToken,
} from "./errors";
import {destroyInReverseOrder, hasOnInit} from "./lifecycle";
import {getDependencies, getFieldDependencies, isUnresolved} from "./metadata";
import {getGlobalRegistrations} from "./registry";
import type {
    ClassProvider,
    CompiledProvider,
    Constructor,
    ContextStorage,
    Dependency,
    ExistingProvider,
    FactoryProvider,
    InjectorOptions,
    Inspection,
    Provider,
    ProviderKind,
    RegistrationId,
    RequestScopeStore,
    Token,
    ValueProvider,
} from "./types";

function isClassProvider<T>(provider: Provider<T>): provider is ClassProvider<T> {
    return "useClass" in provider;
}

function isValueProvider<T>(provider: Provider<T>): provider is ValueProvider<T> {
    return "useValue" in provider;
}

function isFactoryProvider<T>(provider: Provider<T>): provider is FactoryProvider<T> {
    return "useFactory" in provider;
}

function isExistingProvider<T>(provider: Provider<T>): provider is ExistingProvider<T> {
    return "useExisting" in provider;
}

/**
 * Detects functions declared with the `async` keyword. This is a one-time, registration-time (or
 * prototype-time) check on the function object itself - never a runtime sniff of the invocation
 * result - so it stays consistent with the "async-ness is always statically known" design rule.
 * Used both for factory providers (`useFactory`) and for class providers' `onInit()` method.
 */
function looksAsync(fn: (...args: any[]) => unknown): boolean {
    return fn.constructor.name === "AsyncFunction";
}

/**
 * Statically checks a class's `onInit()` (via its prototype, without ever constructing an
 * instance) so an async `onInit()` can be rejected from sync `get()` *before* the constructor
 * runs - not after, which would mean paying for a constructor's side effects on an instance we
 * immediately throw away. Only possible for class providers: factory/value/existing providers
 * hand back an already-built value with no prototype to inspect ahead of time, so those fall back
 * to inspecting the constructed instance itself (see Injector.runOnInitSync()).
 */
function classOnInitIsAsync(target: Constructor): boolean {
    const proto = target.prototype as {onInit?: unknown} | undefined;
    return typeof proto?.onInit === "function" && looksAsync(proto.onInit as (...args: any[]) => unknown);
}

/**
 * A real dynamic import(), guaranteed to survive TypeScript's CommonJS emit. When compiling to
 * `module: "commonjs"`, tsc/ts-node downlevel a literal `import()` expression into a `require()`
 * call, which can't resolve `file://` URLs and defeats the point of using import() for ESM-safe
 * loading. Going through `new Function` hides the call from that static transform.
 */
const dynamicImport: (specifier: string) => Promise<unknown> = new Function(
    "specifier",
    "return import(specifier);",
) as (specifier: string) => Promise<unknown>;

/**
 * Threads the active *synchronous* resolution call chain through get()/getAll() and their
 * recursive helpers. `seen` gives O(1) circular-dependency detection instead of an O(depth)
 * `Array.includes()` scan; `stack` only needs to be copied when a `CircularDependencyError` is
 * actually thrown (the rare path). Both are mutated in place - pushed just before resolving a
 * token's own dependencies, popped once that resolution unwinds (see Injector.instantiate()) -
 * instead of copied at every recursion level, so a resolution of depth N allocates one
 * stack/seen pair per top-level get() call instead of N arrays.
 *
 * This mutable-stack shape is only safe because synchronous recursion has one real call stack
 * with no interleaving. The async counterparts (resolveTokenAsync/instantiateAsync) resolve
 * sibling dependencies concurrently via `Promise.all`, so two sibling branches can be "in
 * progress" on the same path at once - a shared mutable stack would let one branch's `finally`
 * pop state a concurrent sibling still depends on. The async path therefore intentionally keeps
 * the simpler immutable-array-copy approach instead of reusing this type.
 */
interface ResolutionPath {
    readonly stack: Token[];
    readonly seen: Set<Token>;
}

function newResolutionPath(): ResolutionPath {
    return {stack: [], seen: new Set()};
}

/**
 * The core IoC container: registers {@link Provider}s and resolves them by {@link Token},
 * honoring scope (`singleton`/`transient`/`request`), lifecycle (`onInit`/`onDestroy`), and
 * sync/async resolution.
 *
 * @remarks
 * Zero reflection, zero runtime dependencies - dependency metadata always comes from either the
 * `@Injectable()`/`@Inject()`/`@Optional()` decorators or `@nonna/compiler`'s AOT-generated
 * {@link defineDependencies} calls, never from `reflect-metadata`.
 *
 * Instances are never constructed with `new Injector()` directly - use the static
 * {@link Injector.create} factory, or the fluent {@link Nonna.injector} builder for a one-chain
 * configure-and-boot flow.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export class Injector {
    private readonly compiled = new Map<RegistrationId, CompiledProvider>();
    private readonly tokenIndex = new Map<Token, RegistrationId[]>();
    private readonly singletons = new Map<RegistrationId, unknown>();
    private readonly singletonPromises = new Map<RegistrationId, Promise<unknown>>();
    private readonly singletonCreationOrder: RegistrationId[] = [];
    /** Tokens registered directly via register()/registerValue()/registerFactory() - refresh() never overwrites these. */
    private readonly explicitlyRegistered = new Set<Token>();
    /** Tracks which class refresh() last compiled for a given token, so re-running refresh()/loadBeans() is a no-op when nothing changed (preserves singleton cache instead of resetting it). */
    private readonly refreshedFrom = new Map<Token, Constructor>();
    private readonly requestStorage: ContextStorage<RequestScopeStore>;
    private destroyed = false;
    private frozen = false;
    private nextRegistrationId = 0;
    private nextScopeId = 0;
    /**
     * Set once, monotonically - never reset back to `false` even if a request-scoped provider is
     * later overwritten by a non-request one. That asymmetry is deliberate: it keeps this flag
     * cheap (an OR on every registration, no graph re-scan) at the cost of a rare, harmless
     * over-approximation (continuing to pay AsyncLocalStorage overhead on runInScope() after the
     * last request-scoped provider is gone), which is always safe, never incorrect.
     */
    private hasRequestScopedProviders = false;

    private constructor(options?: InjectorOptions) {
        this.requestStorage = options?.contextStorage ?? new AsyncLocalStorageContextStorage();
    }

    /**
     * Creates a new, empty `Injector`.
     *
     * @param options - Optional configuration, e.g. a custom {@link ContextStorage} implementation.
     */
    static create(options?: InjectorOptions): Injector {
        return new Injector(options);
    }

    /**
     * Registers a provider under `provider.provide`.
     *
     * @remarks
     * Explicit `register()` calls always take precedence over `refresh()`/`loadBeans()`-driven
     * (decorator) registrations for the same token, regardless of call order. Re-registering a
     * non-multi token replaces the previous provider (last write wins) - useful for swapping in
     * test doubles.
     *
     * @param provider - Any of the four provider shapes (`useClass`/`useValue`/`useFactory`/`useExisting`).
     * @throws {@link InjectorDestroyedError} if the injector has been destroyed.
     * @throws {@link InjectorError} if the injector is frozen (see {@link Injector.initialize}).
     * @throws {@link InvalidProviderError} if the provider shape is invalid, or mixes `multi`/non-`multi` for the same token.
     */
    register<T>(provider: Provider<T>): void {
        this.registerInternal(provider, true);
    }

    private registerInternal<T>(provider: Provider<T>, explicit: boolean): void {
        if (this.destroyed) throw new InjectorDestroyedError(provider.provide);
        if (this.frozen) {
            throw new InjectorError(
                `Cannot register ${describeToken(
                    provider.provide,
                )}: injector was frozen after initialize({freezeAfterInitialize: true}).`,
            );
        }

        const compiled = this.compileProvider(provider);
        const existingIds = this.tokenIndex.get(provider.provide);

        if (existingIds && existingIds.length > 0) {
            const existingIsMulti = this.compiled.get(existingIds[0]!)!.multi;
            if (existingIsMulti !== compiled.multi) {
                throw new InvalidProviderError(
                    `Token ${describeToken(provider.provide)} cannot mix multi and non-multi providers.`,
                    provider.provide,
                );
            }
            if (!compiled.multi) {
                // Non-multi re-registration replaces the previous provider (last write wins).
                // This is what makes test overrides (register a fake after the real provider) work.
                // Explicit registration precedence over refresh()/loadBeans() output is enforced by
                // refresh() itself skipping tokens already in explicitlyRegistered - see refresh().
                for (const oldId of existingIds) this.compiled.delete(oldId);
                existingIds.length = 0;
            }
        }

        if (compiled.scope === "request") {
            this.hasRequestScopedProviders = true;
        }

        this.compiled.set(compiled.id, compiled);
        const ids = this.tokenIndex.get(provider.provide) ?? [];
        ids.push(compiled.id);
        this.tokenIndex.set(provider.provide, ids);

        if (explicit) this.explicitlyRegistered.add(provider.provide);
    }

    /**
     * Shortcut for `register({provide: token, useValue: value})`.
     *
     * @param token - The token to register the value under.
     * @param value - The value to resolve for `token`.
     */
    registerValue<T>(token: Token<T>, value: T): void {
        this.register({provide: token, useValue: value});
    }

    /**
     * Shortcut for `register({provide: token, useFactory: factory, inject})`.
     *
     * @param token - The token to register the factory's result under.
     * @param inject - Tokens to resolve and pass as `factory`'s arguments, in order.
     * @param factory - Produces the value for `token`, synchronously or asynchronously.
     */
    registerFactory<T>(
        token: Token<T>,
        inject: readonly Token[],
        factory: (...args: unknown[]) => T | Promise<T>,
    ): void {
        this.register({provide: token, useFactory: factory, inject});
    }

    /** Whether any provider is registered for `token`. */
    has(token: Token): boolean {
        return this.tokenIndex.has(token);
    }

    /**
     * Debug/introspection snapshot for a token - not intended for use on a hot path.
     *
     * @param token - The token to inspect.
     * @returns The registration's diagnostics, or `undefined` if `token` was never registered.
     */
    inspect(token: Token): Inspection | undefined {
        const ids = this.tokenIndex.get(token);
        if (!ids || ids.length === 0) return undefined;
        return this.inspectId(ids[0]!);
    }

    /**
     * Like {@link Injector.inspect}, but returns one entry per registration for a multi-provider token.
     *
     * @param token - The token to inspect.
     * @returns One {@link Inspection} per registration (empty if `token` was never registered).
     */
    inspectAll(token: Token): readonly Inspection[] {
        const ids = this.tokenIndex.get(token);
        if (!ids) return [];
        return ids.map(id => this.inspectId(id));
    }

    private inspectId(id: RegistrationId): Inspection {
        const compiled = this.compiled.get(id)!;
        return {
            token: compiled.token,
            scope: compiled.scope,
            kind: compiled.kind,
            multi: compiled.multi,
            eager: compiled.eager,
            isAsync: compiled.isAsync,
            dependencies: compiled.dependencies().map(dep => dep.token),
            instantiated: compiled.scope === "singleton" && this.singletons.has(id),
        };
    }

    /**
     * Resolves the single provider registered for `token`, synchronously.
     *
     * @param token - The token to resolve.
     * @returns The resolved instance/value.
     * @throws {@link InjectorDestroyedError} if the injector has been destroyed.
     * @throws {@link ProviderNotFoundError} if no provider is registered for `token`.
     * @throws {@link InvalidProviderError} if `token` is a `multi: true` token (use {@link Injector.getAll} instead) or has an unresolved constructor dependency.
     * @throws {@link AsyncProviderError} if the provider requires async construction (use {@link Injector.getAsync} instead).
     * @throws {@link CircularDependencyError} if resolving `token` would require resolving itself again.
     * @throws {@link ScopeError} if `token` is request-scoped and this is called outside {@link Injector.runInScope}.
     */
    get<T>(token: Token<T>): T {
        if (this.destroyed) throw new InjectorDestroyedError(token);
        return this.resolveToken(token, newResolutionPath());
    }

    /**
     * Like {@link Injector.get}, but returns `undefined` instead of throwing
     * {@link ProviderNotFoundError} when `token` isn't registered. Every other error `get()` can
     * throw still propagates.
     *
     * @param token - The token to resolve.
     */
    getOptional<T>(token: Token<T>): T | undefined {
        try {
            return this.get(token);
        } catch (error) {
            if (error instanceof ProviderNotFoundError) return undefined;
            throw error;
        }
    }

    /**
     * Resolves every provider registered for `token` (intended for `multi: true` tokens),
     * synchronously, in registration order.
     *
     * @param token - The token to resolve.
     * @returns Every resolved instance/value for `token` (empty if none are registered).
     */
    getAll<T>(token: Token<T>): readonly T[] {
        if (this.destroyed) throw new InjectorDestroyedError(token);
        const ids = this.tokenIndex.get(token);
        if (!ids || ids.length === 0) return [];
        return ids.map(id => this.buildFromId(id, token, newResolutionPath()) as T);
    }

    /**
     * Resolves the single provider registered for `token`, asynchronously.
     *
     * @remarks
     * Unlike {@link Injector.get}, this works for providers that require asynchronous
     * construction (an async `useFactory`, or a class with an async `onInit()`).
     *
     * @param token - The token to resolve.
     * @returns The resolved instance/value.
     * @throws Everything {@link Injector.get} can throw, except {@link AsyncProviderError}.
     */
    async getAsync<T>(token: Token<T>): Promise<T> {
        if (this.destroyed) throw new InjectorDestroyedError(token);
        return this.resolveTokenAsync(token, []);
    }

    /**
     * Async counterpart to {@link Injector.getAll} - resolves every provider registered for
     * `token` concurrently.
     *
     * @param token - The token to resolve.
     * @returns Every resolved instance/value for `token` (empty if none are registered).
     */
    async getAllAsync<T>(token: Token<T>): Promise<readonly T[]> {
        if (this.destroyed) throw new InjectorDestroyedError(token);
        const ids = this.tokenIndex.get(token);
        if (!ids || ids.length === 0) return [];
        return Promise.all(ids.map(id => this.buildFromIdAsync(id, token, []) as Promise<T>));
    }

    /**
     * Validates the registered graph (missing required providers, singleton→request scope
     * violations), then eagerly instantiates every `eager: true` provider so startup failures
     * surface here instead of on the first request. `freezeAfterInitialize` blocks any further
     * `register()` calls once initialization completes.
     *
     * @remarks
     * Eager providers are kicked off without awaiting each one individually, then awaited
     * together via `Promise.all()`: independent eager providers (e.g. a DB pool and an unrelated
     * message-broker client) initialize concurrently instead of serially, and any eager providers
     * that share a dependency still only construct it once - `buildFromIdAsync()`'s existing
     * in-flight-promise cache (see singletonPromises) already deduplicates that, since each
     * `buildFromIdAsync()` call below runs synchronously up to its first genuine suspension point
     * before control returns to this loop.
     *
     * @param options - `freezeAfterInitialize: true` blocks any further `register()` calls once this resolves.
     * @throws {@link InjectorDestroyedError} if the injector has been destroyed.
     * @throws {@link InvalidProviderError} if a required dependency is missing or unresolved.
     * @throws {@link ScopeError} if a singleton transitively depends on a request-scoped provider.
     */
    async initialize(options?: {freezeAfterInitialize?: boolean}): Promise<void> {
        if (this.destroyed) throw new InjectorDestroyedError();

        this.validateMissingDependencies();
        this.validateScopes();

        const eagerBuilds: Promise<unknown>[] = [];
        for (const provider of this.compiled.values()) {
            if (provider.eager) {
                eagerBuilds.push(this.buildFromIdAsync(provider.id, provider.token, []));
            }
        }
        await Promise.all(eagerBuilds);

        if (options?.freezeAfterInitialize) {
            this.frozen = true;
        }
    }

    /**
     * Stops accepting new resolutions immediately, then destroys singleton instances in reverse
     * creation order, aggregating any onDestroy() failures into one LifecycleError rather than
     * bailing on the first. Idempotent - calling destroy() twice is a no-op the second time.
     *
     * @throws {@link LifecycleError} if one or more `onDestroy()` hooks threw or rejected.
     */
    async destroy(): Promise<void> {
        if (this.destroyed) return;
        this.destroyed = true;

        try {
            await destroyInReverseOrder(
                this.singletonCreationOrder,
                this.singletons,
                id => this.compiled.get(id)!.token,
            );
        } finally {
            this.compiled.clear();
            this.tokenIndex.clear();
            this.singletons.clear();
            this.singletonPromises.clear();
            this.singletonCreationOrder.length = 0;
        }
    }

    /**
     * Runs `fn` inside a fresh request scope: request-scoped tokens resolved anywhere during
     * `fn` (including in nested async calls, via ContextStorage/AsyncLocalStorage) share one
     * instance for the duration of this call, then get destroyed in reverse creation order.
     *
     * If `fn` returns a Promise, destruction is awaited before this method's own Promise
     * settles. If `fn` is synchronous, destruction still may need to await async onDestroy()
     * hooks - that cleanup runs in the background rather than blocking the synchronous return
     * (there would be nothing left to attach the result to). Prefer an async callback, as the
     * spec's own examples do, when request-scoped instances have async lifecycle hooks.
     *
     * When no request-scoped provider has ever been registered, this skips AsyncLocalStorage
     * entirely and just calls `fn()` directly - there is nothing to isolate, so paying for
     * context propagation on every call (a real, measurable cost under load) would be pure waste.
     * One observable consequence: `currentScopeId()` returns `undefined` inside `fn` in that case
     * (there's no scope to report an id for), where it previously returned an id nobody could
     * meaningfully use for isolation anyway.
     *
     * @param fn - The function to run inside the fresh request scope.
     * @returns Whatever `fn` returns.
     * @throws {@link InjectorDestroyedError} if the injector has been destroyed.
     */
    runInScope<T>(fn: () => T | Promise<T>): T | Promise<T> {
        if (this.destroyed) throw new InjectorDestroyedError();

        if (!this.hasRequestScopedProviders) {
            return fn();
        }

        const store: RequestScopeStore = {id: `scope-${this.nextScopeId++}`, instances: new Map(), creationOrder: []};
        const result = this.requestStorage.run(store, fn);

        if (result instanceof Promise) {
            return result.then(
                async value => {
                    await this.destroyRequestScope(store);
                    return value;
                },
                async error => {
                    await this.destroyRequestScope(store);
                    throw error;
                },
            );
        }

        void this.destroyRequestScope(store);
        return result;
    }

    /** The id of the active {@link Injector.runInScope} scope, or `undefined` outside of one. */
    currentScopeId(): string | undefined {
        return this.requestStorage.getStore()?.id;
    }

    private async destroyRequestScope(store: RequestScopeStore): Promise<void> {
        await destroyInReverseOrder(store.creationOrder, store.instances, id => this.compiled.get(id)!.token);
    }

    /**
     * Pulls class registrations from the global decorator registry (populated by
     * @Injectable()/@Service()) into this injector's local registry. Explicit register() calls
     * always win: a token already in `explicitlyRegistered` is left untouched. Re-running
     * refresh() for a token whose decorator-registered class hasn't changed is a no-op, so it
     * doesn't reset an already-created singleton every time it's called.
     *
     * @throws {@link InjectorDestroyedError} if the injector has been destroyed.
     */
    refresh(): void {
        if (this.destroyed) throw new InjectorDestroyedError();

        for (const registration of getGlobalRegistrations()) {
            if (this.explicitlyRegistered.has(registration.token)) continue;
            if (this.refreshedFrom.get(registration.token) === registration.target) continue;

            this.registerInternal(
                {
                    provide: registration.token,
                    useClass: registration.target,
                    scope: registration.scope,
                    eager: registration.eager,
                },
                false,
            );
            this.refreshedFrom.set(registration.token, registration.target);
        }
    }

    /**
     * Dynamically imports every bean module so its decorators run and populate the global
     * registry, then calls refresh(). `manifest` is either a path to a JSON manifest file (an
     * array of module path strings, resolved relative to the manifest's own directory) or an
     * already-resolved list of module paths/specifiers.
     *
     * @param manifest - A path to a JSON manifest file, or an already-resolved list of module paths/specifiers.
     * @throws {@link InjectorDestroyedError} if the injector has been destroyed.
     * @throws {@link BeanManifestError} if the manifest file or one of its listed modules can't be read/imported/parsed.
     */
    async loadBeans(manifest: string | readonly string[]): Promise<void> {
        if (this.destroyed) throw new InjectorDestroyedError();

        const modulePaths = typeof manifest === "string" ? await this.readBeanManifest(manifest) : manifest;

        for (const modulePath of modulePaths) {
            try {
                const specifier = path.isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath;
                await dynamicImport(specifier);
            } catch (error) {
                throw new BeanManifestError(
                    `Failed to load bean module "${modulePath}".`,
                    typeof manifest === "string" ? manifest : undefined,
                    {cause: error},
                );
            }
        }

        this.refresh();
    }

    private async readBeanManifest(manifestPath: string): Promise<string[]> {
        let raw: string;
        try {
            raw = await readFile(manifestPath, "utf-8");
        } catch (error) {
            throw new BeanManifestError(`Could not read bean manifest at "${manifestPath}".`, manifestPath, {
                cause: error,
            });
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            throw new BeanManifestError(`Bean manifest at "${manifestPath}" is not valid JSON.`, manifestPath, {
                cause: error,
            });
        }

        if (!Array.isArray(parsed) || !parsed.every(entry => typeof entry === "string")) {
            throw new BeanManifestError(
                `Bean manifest at "${manifestPath}" must be a JSON array of module path strings.`,
                manifestPath,
            );
        }

        const baseDir = path.dirname(manifestPath);
        return (parsed as string[]).map(entry => (path.isAbsolute(entry) ? entry : path.resolve(baseDir, entry)));
    }

    private validateMissingDependencies(): void {
        const missing: string[] = [];
        const unresolved = new Set<string>();

        const checkDependency = (consumerLabel: string, dep: Dependency): void => {
            if (isUnresolved(dep)) {
                if (!dep.optional) unresolved.add(consumerLabel);
                return;
            }
            if (dep.optional) return;
            const ids = this.tokenIndex.get(dep.token);
            if (!ids || ids.length === 0) {
                missing.push(`${consumerLabel} → ${describeToken(dep.token)}`);
            }
        };

        for (const provider of this.compiled.values()) {
            const consumerLabel = describeToken(provider.token);
            for (const dep of provider.dependencies()) {
                checkDependency(consumerLabel, dep);
            }
            for (const [propertyKey, dep] of provider.fieldDependencies() ?? []) {
                checkDependency(`${consumerLabel}.${String(propertyKey)}`, dep);
            }
        }

        if (unresolved.size > 0) {
            throw new InvalidProviderError(
                `The following classes have unresolved constructor dependencies (no @Inject() and the AOT compiler ` +
                    `did not run): ${[...unresolved].join(", ")}. Add @Inject(TOKEN) or run @nonna/compiler.`,
            );
        }
        if (missing.length > 0) {
            throw new InvalidProviderError(
                `Missing required provider(s):\n${missing.map(line => `  ${line}`).join("\n")}`,
            );
        }
    }

    /**
     * Rejects a singleton that transitively depends on a request-scoped provider. The closure
     * only needs to walk through "transient" hops: a request-scoped dependency reached through
     * another singleton is already caught independently by that singleton's own check, and
     * "transient → request" is a valid combination on its own (see spec's scope table) - the
     * danger is specifically a transient being resolved once, at singleton-construction time,
     * silently freezing whatever request-scoped value was live at that moment.
     */
    private validateScopes(): void {
        for (const provider of this.compiled.values()) {
            if (provider.scope !== "singleton") continue;

            const queue: Dependency[] = [...provider.dependencies(), ...(provider.fieldDependencies()?.values() ?? [])];
            const visited = new Set<RegistrationId>();

            while (queue.length > 0) {
                const dep = queue.shift()!;
                const depIds = this.tokenIndex.get(dep.token) ?? [];
                for (const depId of depIds) {
                    if (visited.has(depId)) continue;
                    visited.add(depId);

                    const depProvider = this.compiled.get(depId);
                    if (!depProvider) continue;

                    if (depProvider.scope === "request") {
                        throw new ScopeError(
                            `Singleton ${describeToken(provider.token)} cannot depend on request-scoped ${describeToken(
                                dep.token,
                            )}.`,
                            provider.token,
                            [provider.token, dep.token],
                        );
                    }
                    if (depProvider.scope === "transient") {
                        queue.push(...depProvider.dependencies(), ...(depProvider.fieldDependencies()?.values() ?? []));
                    }
                }
            }
        }
    }

    private compileProvider<T>(provider: Provider<T>): CompiledProvider<T> {
        const token = provider.provide;
        const id: RegistrationId = this.nextRegistrationId++;
        const eager = provider.eager ?? false;
        const multi = provider.multi ?? false;

        if (isValueProvider(provider)) {
            return this.finish(
                id,
                token,
                "value",
                "singleton",
                eager,
                multi,
                () => [],
                () => undefined,
                () => provider.useValue,
                false,
                false,
            );
        }

        if (isClassProvider(provider)) {
            const target = provider.useClass;
            const scope = provider.scope ?? "singleton";
            // Memoized after the first read instead of recomputed on every instantiate() call:
            // a WeakMap lookup per transient/request resolution adds up under load, and the
            // dependency list for a given class never changes after it's first defined (whether
            // by @Injectable() or by the AOT compiler's defineDependencies() call).
            let cachedDeps: readonly Dependency[] | undefined;
            // Same memoization idea for field dependencies, but "no fields declared" is itself a
            // valid (falsy) result, so a plain `??=` can't distinguish "not computed yet" from
            // "computed, and there are none" - hence the separate `fieldDepsComputed` flag.
            let cachedFieldDeps: ReadonlyMap<PropertyKey, Dependency> | undefined;
            let fieldDepsComputed = false;
            return this.finish(
                id,
                token,
                "class",
                scope,
                eager,
                multi,
                () => cachedDeps ?? (cachedDeps = getDependencies(target) ?? []),
                () => {
                    if (!fieldDepsComputed) {
                        cachedFieldDeps = getFieldDependencies(target);
                        fieldDepsComputed = true;
                    }
                    return cachedFieldDeps;
                },
                (args: unknown[]) => new target(...args),
                false,
                classOnInitIsAsync(target),
            );
        }

        if (isFactoryProvider(provider)) {
            const scope = provider.scope ?? "singleton";
            const deps: Dependency[] = (provider.inject ?? []).map(t => ({token: t}));
            const isAsync = provider.async ?? looksAsync(provider.useFactory);
            return this.finish(
                id,
                token,
                "factory",
                scope,
                eager,
                multi,
                () => deps,
                () => undefined,
                (args: unknown[]) => provider.useFactory(...args),
                isAsync,
                false,
            );
        }

        if (isExistingProvider(provider)) {
            return this.finish(
                id,
                token,
                "existing",
                "singleton",
                eager,
                multi,
                () => [{token: provider.useExisting}],
                () => undefined,
                (args: unknown[]) => args[0] as T,
                false,
                false,
            );
        }

        throw new InvalidProviderError(
            `Provider for ${describeToken(token)} must specify useClass, useValue, useFactory, or useExisting.`,
            token,
        );
    }

    private finish<T>(
        id: RegistrationId,
        token: Token<T>,
        kind: ProviderKind,
        scope: CompiledProvider["scope"],
        eager: boolean,
        multi: boolean,
        dependencies: () => readonly Dependency[],
        fieldDependencies: () => ReadonlyMap<PropertyKey, Dependency> | undefined,
        invoke: (args: unknown[]) => T | Promise<T>,
        isAsync: boolean,
        onInitIsAsync: boolean,
    ): CompiledProvider<T> {
        return {id, token, kind, scope, eager, multi, dependencies, fieldDependencies, invoke, isAsync, onInitIsAsync};
    }

    private resolveToken<T>(token: Token<T>, path: ResolutionPath): T {
        const ids = this.tokenIndex.get(token);
        if (!ids || ids.length === 0) {
            throw new ProviderNotFoundError(token, path.stack);
        }
        if (ids.length > 1) {
            throw new InvalidProviderError(
                `Token ${describeToken(
                    token,
                )} has multiple providers registered (multi: true). Use getAll() instead of get().`,
                token,
            );
        }
        return this.buildFromId(ids[0]!, token, path) as T;
    }

    private buildFromId(id: RegistrationId, token: Token, path: ResolutionPath): unknown {
        if (path.seen.has(token)) {
            throw new CircularDependencyError([...path.stack, token]);
        }

        const compiled = this.compiled.get(id)!;

        if (compiled.scope === "singleton") {
            if (this.singletons.has(id)) return this.singletons.get(id);
            const instance = this.instantiate(compiled, token, path);
            this.singletons.set(id, instance);
            this.singletonCreationOrder.push(id);
            return instance;
        }

        if (compiled.scope === "transient") {
            return this.instantiate(compiled, token, path);
        }

        // compiled.scope === "request"
        const store = this.requireRequestScope(token);
        if (store.instances.has(id)) return store.instances.get(id);
        const instance = this.instantiate(compiled, token, path);
        store.instances.set(id, instance);
        store.creationOrder.push(id);
        return instance;
    }

    private requireRequestScope(token: Token): RequestScopeStore {
        const store = this.requestStorage.getStore();
        if (!store) {
            throw new ScopeError(
                `${describeToken(token)} is request-scoped and was resolved outside of runInScope().`,
                token,
            );
        }
        return store;
    }

    private instantiate(compiled: CompiledProvider, token: Token, path: ResolutionPath): unknown {
        if (compiled.isAsync) {
            throw new AsyncProviderError(token);
        }
        // Checked before construction (not after, via runOnInitSync) specifically for class
        // providers, since compileProvider() already knows this statically from the prototype -
        // so the constructor never runs at all for an instance that's just going to be thrown
        // away because its onInit() can't be awaited from a sync get().
        if (compiled.kind === "class" && compiled.onInitIsAsync) {
            throw new AsyncProviderError(token);
        }

        path.stack.push(token);
        path.seen.add(token);
        try {
            const deps = compiled.dependencies();
            const args = new Array(deps.length);
            for (let i = 0; i < deps.length; i++) {
                const dep = deps[i]!;
                if (isUnresolved(dep)) {
                    if (dep.optional) {
                        args[i] = undefined;
                        continue;
                    }
                    throw this.unresolvedDependencyError(token);
                }
                try {
                    args[i] = this.resolveToken(dep.token, path);
                } catch (error) {
                    if (dep.optional && error instanceof ProviderNotFoundError) {
                        args[i] = undefined;
                        continue;
                    }
                    throw error;
                }
            }
            const instance = compiled.invoke(args);
            if (compiled.kind === "class") {
                this.injectFieldsSync(compiled, instance, path);
            }
            this.runOnInitSync(compiled, instance, token);
            return instance;
        } finally {
            path.stack.pop();
            path.seen.delete(token);
        }
    }

    /**
     * Assigns `@Inject()`/`@Optional()`-declared field values onto `instance`, synchronously,
     * right after construction and before `onInit()` runs. Only ever called for `kind === "class"`
     * providers - see {@link CompiledProvider.fieldDependencies}.
     *
     * @remarks
     * Reuses the same {@link ResolutionPath} the constructor arguments were resolved with (still
     * active at this point, since `instantiate()` hasn't reached its `finally` pop yet), so a
     * field that circularly depends back on the class being constructed is caught exactly like a
     * circular constructor dependency would be.
     */
    private injectFieldsSync(compiled: CompiledProvider, instance: unknown, path: ResolutionPath): void {
        const fields = compiled.fieldDependencies();
        if (!fields) return;

        for (const [propertyKey, dep] of fields) {
            if (isUnresolved(dep)) continue; // bare @Optional() on a field - no AOT inference exists to fall back on
            try {
                (instance as Record<PropertyKey, unknown>)[propertyKey] = this.resolveToken(dep.token, path);
            } catch (error) {
                if (dep.optional && error instanceof ProviderNotFoundError) continue;
                throw error;
            }
        }
    }

    /**
     * Runs onInit() synchronously right after construction. Class providers with an async
     * onInit() never reach here - instantiate() already rejected them before construction (see
     * the static compiled.onInitIsAsync check there). Factory/value/existing providers have no
     * prototype to pre-inspect (invoke() is what produces the instance in the first place), so
     * this is where their onInit is checked instead - after construction has already happened,
     * matching how AsyncProviderError already works for other provider kinds.
     */
    private runOnInitSync(compiled: CompiledProvider, instance: unknown, token: Token): void {
        if (!hasOnInit(instance)) return;
        if (compiled.kind !== "class" && looksAsync(instance.onInit as (...args: any[]) => unknown)) {
            throw new AsyncProviderError(token);
        }
        instance.onInit();
    }

    private unresolvedDependencyError(consumer: Token): InvalidProviderError {
        return new InvalidProviderError(
            `${describeToken(consumer)} has an unresolved constructor dependency. Add @Inject(TOKEN) ` +
                `(or @Optional()/@Optional(TOKEN) if it's optional), or run the AOT compiler ` +
                `(@nonna/compiler) to infer concrete-class dependencies automatically.`,
            consumer,
        );
    }

    private async resolveTokenAsync<T>(token: Token<T>, path: readonly Token[]): Promise<T> {
        const ids = this.tokenIndex.get(token);
        if (!ids || ids.length === 0) {
            throw new ProviderNotFoundError(token, path);
        }
        if (ids.length > 1) {
            throw new InvalidProviderError(
                `Token ${describeToken(
                    token,
                )} has multiple providers registered (multi: true). Use getAllAsync() instead of getAsync().`,
                token,
            );
        }
        return this.buildFromIdAsync(ids[0]!, token, path) as Promise<T>;
    }

    private async buildFromIdAsync(id: RegistrationId, token: Token, path: readonly Token[]): Promise<unknown> {
        if (path.includes(token)) {
            throw new CircularDependencyError([...path, token]);
        }

        const compiled = this.compiled.get(id)!;

        if (compiled.scope === "singleton") {
            if (this.singletons.has(id)) return this.singletons.get(id);
            const inFlight = this.singletonPromises.get(id);
            if (inFlight) return inFlight;

            const promise = this.instantiateAsync(compiled, token, path)
                .then(instance => {
                    this.singletons.set(id, instance);
                    this.singletonCreationOrder.push(id);
                    this.singletonPromises.delete(id);
                    return instance;
                })
                .catch(error => {
                    // Remove the failed in-flight promise so a later getAsync() can retry.
                    this.singletonPromises.delete(id);
                    throw error;
                });
            this.singletonPromises.set(id, promise);
            return promise;
        }

        if (compiled.scope === "transient") {
            return this.instantiateAsync(compiled, token, path);
        }

        // compiled.scope === "request"
        const store = this.requireRequestScope(token);
        if (store.instances.has(id)) return store.instances.get(id);
        const instance = await this.instantiateAsync(compiled, token, path);
        store.instances.set(id, instance);
        store.creationOrder.push(id);
        return instance;
    }

    private async instantiateAsync(compiled: CompiledProvider, token: Token, path: readonly Token[]): Promise<unknown> {
        const nextPath = [...path, token];
        const args = await Promise.all(
            compiled.dependencies().map(async dep => {
                if (isUnresolved(dep)) {
                    if (dep.optional) return undefined;
                    throw this.unresolvedDependencyError(token);
                }
                try {
                    return await this.resolveTokenAsync(dep.token, nextPath);
                } catch (error) {
                    if (dep.optional && error instanceof ProviderNotFoundError) return undefined;
                    throw error;
                }
            }),
        );
        const instance = await compiled.invoke(args);
        if (compiled.kind === "class") {
            await this.injectFieldsAsync(compiled, instance, nextPath);
        }
        if (hasOnInit(instance)) {
            await instance.onInit();
        }
        return instance;
    }

    /**
     * Async counterpart to {@link Injector.injectFieldsSync} - resolves every field dependency
     * concurrently via `Promise.all`, matching how constructor arguments are resolved in
     * {@link Injector.instantiateAsync}.
     */
    private async injectFieldsAsync(
        compiled: CompiledProvider,
        instance: unknown,
        path: readonly Token[],
    ): Promise<void> {
        const fields = compiled.fieldDependencies();
        if (!fields) return;

        await Promise.all(
            [...fields].map(async ([propertyKey, dep]) => {
                if (isUnresolved(dep)) return;
                try {
                    (instance as Record<PropertyKey, unknown>)[propertyKey] = await this.resolveTokenAsync(
                        dep.token,
                        path,
                    );
                } catch (error) {
                    if (dep.optional && error instanceof ProviderNotFoundError) return;
                    throw error;
                }
            }),
        );
    }
}
