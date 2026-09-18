import type {Constructor, Dependency, DependencyDeclaration, Token} from "./types";

/**
 * The convergence point between decorator-driven metadata (`@Injectable`/`@Service`/`@Inject`/
 * `@Optional`, see decorators.ts) and AOT-generated code (`@nonnajs/compiler`): both ultimately
 * call {@link defineDependencies} to describe a class's constructor dependencies. The
 * {@link Injector} never inspects TypeScript types itself - it only ever reads from this store.
 */
const dependencyStore = new WeakMap<Constructor, readonly Dependency[]>();

/**
 * Marks a constructor parameter that decorators alone could not resolve to a token (no
 * `@Inject`/`@Optional(token)` was applied to it).
 *
 * @remarks
 * Left in place, it means "the AOT compiler needs to run to infer this concrete-class
 * dependency." The {@link Injector} treats a required `UNRESOLVED` dependency as a clear,
 * actionable error, and an optional one as `undefined`.
 */
export const UNRESOLVED: unique symbol = Symbol("nonna.di.unresolved");

/** Whether `dependency` is still waiting on the AOT compiler (or an explicit `@Inject`/`@Optional`) to resolve its token. */
export function isUnresolved(dependency: Dependency): boolean {
    return (dependency.token as unknown) === UNRESOLVED;
}

/**
 * Declares (or overwrites) the constructor dependencies for `target`.
 *
 * @remarks
 * This is the codegen target for the AOT compiler and is also called internally by
 * `@Injectable()`/`@Service()` to finalize decorator-only metadata. A later call (e.g.
 * AOT-generated code importing after decorators ran) always overwrites an earlier one for the
 * same constructor.
 *
 * @param target - The class whose constructor dependencies are being declared.
 * @param dependencies - One entry per constructor parameter, in order.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function defineDependencies(target: Constructor, dependencies: readonly DependencyDeclaration[]): void {
    const normalized: Dependency[] = dependencies.map(dep => {
        if (dep !== null && typeof dep === "object" && "token" in dep) {
            return dep as Dependency;
        }
        return {token: dep as Token, optional: false};
    });
    dependencyStore.set(target, normalized);
}

/** Returns the dependencies previously declared for `target` via {@link defineDependencies}, if any. */
export function getDependencies(target: Constructor): readonly Dependency[] | undefined {
    return dependencyStore.get(target);
}

/**
 * Per-parameter overrides recorded incrementally by `@Inject()`/`@Optional()` as TypeScript
 * evaluates parameter decorators (which always run before the class decorator).
 */
const partialParamStore = new WeakMap<Constructor, Map<number, Dependency>>();

/** Records a single constructor parameter's explicit token/optionality, as recorded by `@Inject()`/`@Optional()`. */
export function recordParamDependency(target: Constructor, index: number, dependency: Dependency): void {
    const params = partialParamStore.get(target) ?? new Map<number, Dependency>();
    params.set(index, dependency);
    partialParamStore.set(target, params);
}

/**
 * Called by `@Injectable()`/`@Service()` once all parameter decorators for `target` have run.
 * Pads any constructor parameter with no explicit `@Inject`/`@Optional` into an `UNRESOLVED`
 * dependency - a safety net for classes that never get processed by the AOT compiler.
 */
export function finalizeDecoratorDependencies(target: Constructor): void {
    const partial = partialParamStore.get(target);
    const arity = countConstructorParams(target);
    const dependencies: Dependency[] = [];
    for (let index = 0; index < arity; index++) {
        dependencies.push(partial?.get(index) ?? {token: UNRESOLVED, optional: false});
    }
    defineDependencies(target, dependencies);
}

/**
 * Field/property dependencies declared by `@Inject()`/`@Optional()` on a class field, keyed by
 * the exact class the decorator ran on (not by any subclass that later extends it - see
 * {@link getFieldDependencies} for the inheritance-aware read side).
 */
const fieldDependencyStore = new WeakMap<Constructor, Map<PropertyKey, Dependency>>();

/**
 * Records a single field's explicit token/optionality, as recorded by `@Inject()`/`@Optional()`
 * applied to a class property.
 *
 * @remarks
 * Unlike constructor parameters, there is no AOT-inferred or arity-based fallback for fields -
 * `@nonnajs/compiler` only analyzes constructor parameters. A field with no `@Inject()`/`@Optional()`
 * is simply never touched by the injector, exactly as if it were never decorated.
 *
 * @param target - The class the field is declared on.
 * @param propertyKey - The field's name.
 * @param dependency - The token (and optionality) to resolve for this field.
 */
export function recordFieldDependency(target: Constructor, propertyKey: PropertyKey, dependency: Dependency): void {
    const fields = fieldDependencyStore.get(target) ?? new Map<PropertyKey, Dependency>();
    fields.set(propertyKey, dependency);
    fieldDependencyStore.set(target, fields);
}

/**
 * Returns every field dependency declared for `target`, merged across its prototype chain so a
 * subclass inherits (and can override) a parent class's `@Inject()`/`@Optional()` fields -
 * matching how a real subclass instance actually carries its parent's fields at runtime.
 *
 * @param target - The most-derived class to look up (typically `instance.constructor`).
 * @returns A map of property name/symbol to {@link Dependency}, or `undefined` if `target` (and its ancestors) declare none.
 */
export function getFieldDependencies(target: Constructor): ReadonlyMap<PropertyKey, Dependency> | undefined {
    const chain: Constructor[] = [];
    for (let current: Constructor | undefined = target; current && current !== Object; ) {
        chain.push(current);
        const parentProto: unknown = Object.getPrototypeOf(current.prototype);
        current = (parentProto as {constructor?: Constructor} | null)?.constructor;
    }

    let merged: Map<PropertyKey, Dependency> | undefined;
    // Walk base-to-derived so a subclass's own declaration overrides its parent's for the same key.
    for (let i = chain.length - 1; i >= 0; i--) {
        const own = fieldDependencyStore.get(chain[i]!);
        if (!own) continue;
        merged ??= new Map();
        for (const [key, dependency] of own) merged.set(key, dependency);
    }
    return merged;
}

/**
 * Counts constructor parameters by parsing the class's own source text instead of trusting
 * `Function.prototype.length`.
 *
 * @remarks
 * `.length` silently stops counting at the first parameter with a default value -
 * `constructor(a, b = new B())` reports `1`, not `2` - which would leave `b` permanently
 * un-padded (and therefore never even `UNRESOLVED`, just silently absent) for any class relying
 * on decorator-only metadata instead of the AOT compiler. Falls back to `target.length` when no
 * explicit `constructor(...)` is found in source (e.g. a subclass that inherits its parent's
 * implicit `constructor(...args) { super(...args); }`).
 *
 * This is source-text scanning, not `reflect-metadata` or a TypeScript AST - it only ever looks
 * at the function's own compiled JS text, so it stays consistent with this package's
 * zero-reflection, zero-dependency design.
 *
 * @param target - The class whose constructor arity is being counted.
 * @returns The number of top-level constructor parameters.
 */
export function countConstructorParams(target: Constructor): number {
    const source = Function.prototype.toString.call(target);
    const params = extractConstructorParamSlices(source);
    return params === undefined ? target.length : params.length;
}

/**
 * Returns the top-level, comma-separated slices of a class's `constructor(...)` parameter list,
 * or `undefined` if no explicit constructor is found.
 *
 * @remarks
 * Tracks paren/bracket/brace depth and string literals so that commas inside default values
 * (`b = fn(1, 2)`), destructured parameters (`{a, b}`), or default string/template literals
 * never get mistaken for parameter separators.
 */
function extractConstructorParamSlices(source: string): string[] | undefined {
    const match = /(?:^|[\s{;])constructor\s*\(/.exec(source);
    if (!match) return undefined;

    const start = match.index + match[0].length; // just past the opening "("
    let depth = 1; // already inside the constructor's own parens
    let quote: string | undefined;
    let current = "";
    const params: string[] = [];

    for (let i = start; i < source.length; i++) {
        const char = source[i]!;

        if (quote) {
            current += char;
            if (char === "\\") current += source[++i] ?? "";
            else if (char === quote) quote = undefined;
            continue;
        }

        if (char === '"' || char === "'" || char === "`") {
            quote = char;
            current += char;
            continue;
        }

        if (char === "(" || char === "[" || char === "{") {
            depth++;
            current += char;
            continue;
        }

        if (char === ")" || char === "]" || char === "}") {
            depth--;
            if (depth === 0) {
                if (current.trim().length > 0) params.push(current.trim());
                return params;
            }
            current += char;
            continue;
        }

        if (char === "," && depth === 1) {
            params.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    // Unbalanced source (should never happen for a real class) - fall back to arity-by-length.
    return undefined;
}
