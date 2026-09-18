import {Injector} from "./injector";
import type {ContextStorage, InjectorOptions, Provider, RequestScopeStore, Token} from "./types";

/**
 * Fluent, deferred configuration surface over `Injector`.
 *
 * Every configuration method (`register*`, `scan`, `loadBeans`, `freeze`, `withContextStorage`)
 * just records intent and returns `this` - nothing touches a real `Injector` until the terminal
 * `build()` call, which is what lets `withContextStorage()` be chained *before* registration even
 * though `Injector.create()` itself takes the context storage as a constructor option:
 *
 * ```ts
 * const injector = await Nonna.injector()
 *     .withContextStorage(customStorage)
 *     .register({provide: Logger, useClass: ConsoleLogger})
 *     .registerValue(CONFIG_TOKEN, config)
 *     .scan()                               // pulls in @Injectable()/@Service() classes
 *     .loadBeans("./beans.manifest.json")
 *     .freeze()                             // freezeAfterInitialize
 *     .build();                             // refresh + validate + eager-init, returns Injector
 * ```
 *
 * `build()` always runs `Injector.initialize()` under the hood, so the returned `Injector` is
 * validated and eager providers are already warm - there is no separate "configured but not yet
 * initialized" state to remember to call `initialize()` on. Callers who explicitly want that
 * lower-level control can keep using `Injector.create()` and its imperative methods directly;
 * this builder never removes that path, it only adds a more ergonomic one on top of it.
 *
 * @see Nonna.injector
 * @author Manuel Santos (https://github.com/manusant)
 */
export class InjectorBuilder {
    private options: InjectorOptions = {};
    private readonly operations: Array<(injector: Injector) => void> = [];
    private readonly beanManifests: Array<string | readonly string[]> = [];
    private shouldScan = false;
    private shouldFreeze = false;

    /**
     * Supplies a custom request-scope {@link ContextStorage} instead of the default
     * `AsyncLocalStorage`-backed one.
     *
     * @param contextStorage - The custom context storage implementation to use.
     * @returns `this`, for chaining.
     */
    withContextStorage(contextStorage: ContextStorage<RequestScopeStore>): this {
        this.options = {...this.options, contextStorage};
        return this;
    }

    /**
     * Queues a provider registration, applied at `build()` time.
     *
     * @param provider - Any of the four provider shapes (`useClass`/`useValue`/`useFactory`/`useExisting`).
     * @returns `this`, for chaining.
     */
    register<T>(provider: Provider<T>): this {
        this.operations.push(injector => injector.register(provider));
        return this;
    }

    /**
     * Queues a value-provider registration, applied at `build()` time.
     *
     * @param token - The token to register the value under.
     * @param value - The value to resolve for `token`.
     * @returns `this`, for chaining.
     */
    registerValue<T>(token: Token<T>, value: T): this {
        this.operations.push(injector => injector.registerValue(token, value));
        return this;
    }

    /**
     * Queues a factory-provider registration, applied at `build()` time.
     *
     * @param token - The token to register the factory's result under.
     * @param inject - Tokens to resolve and pass as `factory`'s arguments, in order.
     * @param factory - Produces the value for `token`, synchronously or asynchronously.
     * @returns `this`, for chaining.
     */
    registerFactory<T>(
        token: Token<T>,
        inject: readonly Token[],
        factory: (...args: unknown[]) => T | Promise<T>,
    ): this {
        this.operations.push(injector => injector.registerFactory(token, inject, factory));
        return this;
    }

    /**
     * Pulls in every `@Injectable()`/`@Service()`-registered class at `build()` time - equivalent
     * to calling `Injector.refresh()`.
     *
     * @returns `this`, for chaining.
     */
    scan(): this {
        this.shouldScan = true;
        return this;
    }

    /**
     * Queues a bean manifest (path or explicit module list) to be loaded at `build()` time,
     * before `scan()`.
     *
     * @param manifest - A path to a JSON manifest file, or an already-resolved list of module paths/specifiers.
     * @returns `this`, for chaining.
     */
    loadBeans(manifest: string | readonly string[]): this {
        this.beanManifests.push(manifest);
        return this;
    }

    /**
     * Blocks further `register()` calls on the built `Injector` once `build()` completes
     * (`Injector.initialize({freezeAfterInitialize: true})`).
     *
     * @returns `this`, for chaining.
     */
    freeze(): this {
        this.shouldFreeze = true;
        return this;
    }

    /**
     * Applies every queued configuration step against a fresh `Injector`, in the order a manual
     * bootstrap would: bean manifests first (so their decorators run before scanning), then
     * `scan()`, then every `register()`/`registerValue()`/`registerFactory()` call in call order,
     * then `initialize()`.
     *
     * @returns The configured, validated, eager-warm `Injector`.
     * @throws Whatever `Injector.loadBeans()`/`Injector.initialize()` throw - see their docs.
     */
    async build(): Promise<Injector> {
        const injector = Injector.create(this.options);

        for (const manifest of this.beanManifests) {
            await injector.loadBeans(manifest);
        }
        if (this.shouldScan) {
            injector.refresh();
        }
        for (const apply of this.operations) {
            apply(injector);
        }

        await injector.initialize({freezeAfterInitialize: this.shouldFreeze});
        return injector;
    }
}
