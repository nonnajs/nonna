import type {Token} from "@nonna/di";
import {getElement} from "@stencil/core";
import {requestAllInjections, requestInjection, requestOptionalInjection} from "@nonna/web-components";

/**
 * Property decorator for Stencil components that resolves `token` from the nearest ancestor
 * {@link Injector} on property access - no `@Element()` field required.
 *
 * @remarks
 * Uses `getElement()` from `@stencil/core` (its public, documented API for getting a component's
 * host element from anywhere in the instance, e.g. `@stencil/redux`/`@stencil/store` rely on the
 * same mechanism) rather than `this`, since `this` inside a Stencil component class is not
 * guaranteed to be the actual `HTMLElement` - it depends on the build's output target.
 *
 * The decorated field **must** use the `declare` modifier (see example). This decorator installs
 * a getter on the class prototype; without `declare`, TypeScript/esbuild (with
 * `useDefineForClassFields`, the default once `target` is `ES2022`+) also emit a per-instance
 * field initializer that defines an own `undefined` property on every instance, silently shadowing
 * the prototype getter and making the property resolve to `undefined` forever - see
 * `@nonna/web-components`'s `inject()` docs for the full explanation of this trap.
 *
 * @param token - The dependency token to resolve.
 *
 * @example
 * ```tsx
 * @Component({tag: "user-list"})
 * export class UserList {
 *     @Inject(UserService)
 *     private declare readonly userService: UserService;
 *
 *     componentWillLoad() {
 *         this.users = this.userService.getUsers();
 *     }
 * }
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function Inject<T>(token: Token<T>) {
    return function (target: object, propertyKey: string | symbol): void {
        Object.defineProperty(target, propertyKey, {
            get(this: object) {
                return requestInjection(getElement(this), token);
            },
            enumerable: true,
            configurable: true,
        });
    };
}

/**
 * Property decorator for Stencil components that resolves an optional `token` from the nearest
 * ancestor {@link Injector}, returning `undefined` if unregistered.
 *
 * @remarks
 * The decorated field **must** use the `declare` modifier - see {@link Inject}'s remarks for why.
 *
 * @param token - The dependency token to resolve.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function OptionalInject<T>(token: Token<T>) {
    return function (target: object, propertyKey: string | symbol): void {
        Object.defineProperty(target, propertyKey, {
            get(this: object) {
                return requestOptionalInjection(getElement(this), token);
            },
            enumerable: true,
            configurable: true,
        });
    };
}

/**
 * Property decorator for Stencil components that resolves every provider registered for `token`
 * (intended for `multi: true` tokens) from the nearest ancestor {@link Injector}.
 *
 * @remarks
 * The decorated field **must** use the `declare` modifier - see {@link Inject}'s remarks for why.
 *
 * @param token - The dependency token to resolve.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function AllInject<T>(token: Token<T>) {
    return function (target: object, propertyKey: string | symbol): void {
        Object.defineProperty(target, propertyKey, {
            get(this: object) {
                return requestAllInjections(getElement(this), token);
            },
            enumerable: true,
            configurable: true,
        });
    };
}
