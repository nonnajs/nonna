import {InjectorBuilder} from "./builder";

/**
 * Fluent, discoverable entry point into the framework:
 *
 * ```ts
 * const injector = await Nonna.injector()
 *     .withContextStorage(customStorage)
 *     .register({provide: Logger, useClass: ConsoleLogger})
 *     .scan()
 *     .build();
 * ```
 *
 * This is sugar over `new InjectorBuilder()` / `Injector.create()` - it doesn't add capability,
 * only a memorable, chainable starting point. `Injector.create()` and its imperative
 * register()/refresh()/initialize() methods remain the lower-level API this is built on.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export const Nonna = {
    /** Starts a new fluent {@link InjectorBuilder} chain. */
    injector(): InjectorBuilder {
        return new InjectorBuilder();
    },
};
