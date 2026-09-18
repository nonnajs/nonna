/**
 * `@nonna/stencil` - StencilJS bindings for `@nonna/di`.
 *
 * @remarks
 * A Stencil component compiles down to a real custom element, so it can be wired into the same
 * standard {@link https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md | W3C Context Protocol}
 * provider (`<nonna-provider>` / `provideInjector()`) that `@nonna/web-components` implements -
 * there is nothing Stencil-specific about *providing* or *requesting* an {@link Injector} over the
 * DOM, so those functions are re-exported here as-is rather than duplicated.
 *
 * What *is* Stencil-specific is `@Inject()`/`@OptionalInject()`/`@AllInject()`: property decorators
 * that resolve a dependency on access, the same ergonomics as `@nonna/web-components`'s
 * `@inject()`, but using `getElement()` from `@stencil/core` (its public API for getting a
 * component's host element from anywhere in the instance) instead of `this` - `this` inside a
 * Stencil component class is not guaranteed to be the actual `HTMLElement`, unlike a plain custom
 * element or Lit component.
 *
 * @example
 * ```tsx
 * import {Component, h, State} from "@stencil/core";
 * import {Inject} from "@nonna/stencil";
 * import {UserService} from "../services/user.service";
 * import type {User} from "../services/user.repository";
 *
 * @Component({tag: "user-list"})
 * export class UserList {
 *     @Inject(UserService)
 *     private declare readonly userService: UserService;
 *
 *     @State() users: User[] = [];
 *
 *     componentWillLoad() {
 *         this.users = this.userService.getUsers();
 *     }
 *
 *     render() {
 *         return (
 *             <ul>
 *                 {this.users.map((u) => <li>{u.name}</li>)}
 *             </ul>
 *         );
 *     }
 * }
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export {
    CONTEXT_REQUEST_EVENT,
    NONNA_INJECTOR_CONTEXT,
    provideInjector,
    requestInjector,
    requestInjection,
    requestOptionalInjection,
    requestAllInjections,
    defineNonnaProvider,
    NonnaProviderElement,
} from "@nonna/web-components";
export type {ContextRequestDetail} from "@nonna/web-components";
export {Inject, OptionalInject, AllInject} from "./decorators";
