import type {Token} from "@nonnajs/di";
import {requestAllInjections, requestInjection, requestOptionalInjection} from "./context";

/**
 * Property decorator for custom elements that resolves `token` from the nearest ancestor {@link Injector}
 * on property access.
 *
 * @remarks
 * The decorated field **must** use the `declare` modifier (see example). This decorator installs a getter
 * on the class prototype; without `declare`, TypeScript/esbuild (with `useDefineForClassFields`, the
 * default once `target` is `ES2022`+) also emit a per-instance field initializer that defines an own
 * `undefined` property on every instance, silently shadowing the prototype getter and making the
 * property resolve to `undefined` forever. `declare` tells the compiler the field has no runtime
 * initializer of its own to emit.
 *
 * @param token - The dependency token to resolve.
 *
 * @example
 * ```ts
 * class UserListElement extends HTMLElement {
 *     @inject(UserService)
 *     private declare readonly userService: UserService;
 *
 *     connectedCallback() {
 *         const users = this.userService.getUsers();
 *     }
 * }
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function inject<T>(token: Token<T>) {
    return function (target: object, propertyKey: string | symbol): void {
        Object.defineProperty(target, propertyKey, {
            get(this: EventTarget) {
                return requestInjection(this, token);
            },
            enumerable: true,
            configurable: true,
        });
    };
}

/**
 * Property decorator for custom elements that resolves an optional `token` from the nearest ancestor {@link Injector}.
 *
 * @remarks
 * The decorated field **must** use the `declare` modifier - see {@link inject}'s remarks for why.
 *
 * @param token - The dependency token to resolve.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function optionalInject<T>(token: Token<T>) {
    return function (target: object, propertyKey: string | symbol): void {
        Object.defineProperty(target, propertyKey, {
            get(this: EventTarget) {
                return requestOptionalInjection(this, token);
            },
            enumerable: true,
            configurable: true,
        });
    };
}

/**
 * Property decorator for custom elements that resolves all `multi: true` providers for `token`
 * from the nearest ancestor {@link Injector}.
 *
 * @remarks
 * The decorated field **must** use the `declare` modifier - see {@link inject}'s remarks for why.
 *
 * @param token - The dependency token to resolve.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function allInject<T>(token: Token<T>) {
    return function (target: object, propertyKey: string | symbol): void {
        Object.defineProperty(target, propertyKey, {
            get(this: EventTarget) {
                return requestAllInjections(this, token);
            },
            enumerable: true,
            configurable: true,
        });
    };
}
