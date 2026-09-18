import {UNRESOLVED, finalizeDecoratorDependencies, recordFieldDependency, recordParamDependency} from "./metadata";
import {registerGlobal} from "./registry";
import type {Constructor, Dependency, Scope, Token} from "./types";

/**
 * Applies `dependency` either as a constructor-parameter dependency or a field dependency,
 * depending on how TypeScript invoked the decorator: a parameter decorator always passes a
 * numeric `parameterIndex` and an `undefined` `propertyKey` for constructor parameters
 * specifically; a property decorator passes a defined `propertyKey` and no `parameterIndex` at
 * all. This is what lets `@Inject()`/`@Optional()` be a single decorator usable on either.
 */
function applyDependency(
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number | undefined,
    dependency: Dependency,
): void {
    if (propertyKey === undefined && typeof parameterIndex === "number") {
        recordParamDependency(target as unknown as Constructor, parameterIndex, dependency);
        return;
    }
    if (propertyKey !== undefined && parameterIndex === undefined) {
        // For an instance field, `target` is the class prototype - `target.constructor` is the class itself.
        const ctor = (target as {constructor: Constructor}).constructor;
        recordFieldDependency(ctor, propertyKey, dependency);
    }
}

/** Options accepted by {@link Injectable}/{@link Service}. */
export interface InjectableOptions {
    scope?: Scope;
    eager?: boolean;
}

/**
 * Registers a class into the global decorator registry and finalizes its constructor
 * dependency metadata.
 *
 * @remarks
 * Does NOT inspect TypeScript types - a constructor parameter with no `@Inject()`/`@Optional()`
 * stays `UNRESOLVED` until either overwritten by AOT-generated {@link defineDependencies} (see
 * metadata.ts) or resolved as an error at `get()`-time.
 *
 * @param options - `scope` (default `"singleton"`) and `eager` (default `false`) for the registration.
 * @returns A `ClassDecorator` to apply to the target class.
 *
 * @example
 * ```ts
 * @Injectable({scope: "request"})
 * class OrderService {
 *     constructor(private readonly repo: OrderRepository) {}
 * }
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function Injectable(options: InjectableOptions = {}): ClassDecorator {
    return (target: Function) => {
        const ctor = target as unknown as Constructor;
        registerGlobal({
            token: ctor,
            target: ctor,
            scope: options.scope ?? "singleton",
            eager: options.eager ?? false,
        });
        finalizeDecoratorDependencies(ctor);
    };
}

/** Exact alias of {@link Injectable} - no separate semantics. */
export const Service = Injectable;

/**
 * Explicitly pins a DI token for a constructor parameter *or* a class field, overriding whatever
 * the AOT compiler would otherwise infer (constructor parameters only - see remarks).
 *
 * @remarks
 * Required on a constructor parameter because `@Inject()` means "use this token", not "make this
 * parameter injectable" - inference (or its absence) is what makes a parameter injectable.
 *
 * Applied to a class field instead, it enables **field injection**: the injector assigns the
 * resolved value to that property immediately after constructing the instance (before `onInit()`
 * runs), for `useClass` providers only. There is no AOT/type inference for fields - a field
 * decorator always needs an explicit `token`, unlike a constructor parameter.
 *
 * @param token - The token to resolve this parameter/field from.
 * @returns A decorator usable on either a constructor parameter or an instance field.
 *
 * @example
 * ```ts
 * @Injectable()
 * class OrderService {
 *     @Inject(MetricsClient)
 *     private metrics!: MetricsClient;
 * }
 * ```
 */
export function Inject(token: Token): PropertyDecorator & ParameterDecorator {
    return ((target: object, propertyKey: string | symbol | undefined, parameterIndex?: number) => {
        applyDependency(target, propertyKey, parameterIndex, {token, optional: false});
    }) as PropertyDecorator & ParameterDecorator;
}

/**
 * Marks a constructor parameter or class field as optional.
 *
 * @remarks
 * With an explicit token, behaves like `@Inject()` plus `optional: true` - and works on a field
 * exactly like `@Inject()` does (field injection, see {@link Inject}). Without a token, it only
 * has an effect on a constructor parameter: the parameter stays `UNRESOLVED`+optional until the
 * AOT compiler infers the concrete class, resolving to `undefined` rather than erroring if it
 * never does. A bare `@Optional()` (no token) on a *field* is a no-op - there is no AOT inference
 * for fields to fall back on, so an explicit token is required for field injection to do anything.
 *
 * @param token - The token to resolve this parameter/field from, if known. Omit on a constructor parameter to let the AOT compiler infer it.
 * @returns A decorator usable on either a constructor parameter or an instance field.
 */
export function Optional(token?: Token): PropertyDecorator & ParameterDecorator {
    return ((target: object, propertyKey: string | symbol | undefined, parameterIndex?: number) => {
        const dependency: Dependency =
            token !== undefined
                ? {token, optional: true}
                : // Same shape finalizeDecoratorDependencies() would produce by default, except
                  // explicitly marked optional so it resolves to `undefined` instead of erroring.
                  {token: UNRESOLVED, optional: true};
        applyDependency(target, propertyKey, parameterIndex, dependency);
    }) as PropertyDecorator & ParameterDecorator;
}
