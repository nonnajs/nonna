# `@nonna/stencil`

> StencilJS bindings for [`@nonna/di`](../di) - `@Inject()`/`@OptionalInject()`/`@AllInject()` property decorators, plus the standard W3C Context Protocol provider and resolution functions from [`@nonna/web-components`](../web-components).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Installation

```sh
npm install @nonna/stencil @nonna/di @nonna/web-components @stencil/core
```

`@nonna/di`, `@nonna/web-components`, and `@stencil/core` (`>=4.0.0`) are peer dependencies.

---

## Why a Stencil component needs `getElement()`, not `this`

A Stencil component compiles down to a real custom element, so _providing_/_requesting_ an
`Injector` over the DOM is not Stencil-specific at all - it's exactly the
[W3C Context Protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md)
implementation `@nonna/web-components` already ships (`<nonna-provider>`, `provideInjector()`,
`requestInjection()`/`requestOptionalInjection()`/`requestAllInjections()`), re-exported here as-is.

What _is_ Stencil-specific is how a component gets hold of its own host element to pass to those
functions: `this` inside a Stencil component class is not guaranteed to be the actual
`HTMLElement` - it depends on the build's output target. `@Inject()`/`@OptionalInject()`/
`@AllInject()` resolve this internally via `getElement()` (a public, documented `@stencil/core`
API for exactly this - the same mechanism community libraries like `@stencil/redux` rely on), so
you don't need a separate `@Element()` field just to read a dependency.

---

## Quick Example

```tsx
// src/components/user-list.tsx
import {Component, h, State} from "@stencil/core";
import {Inject} from "@nonna/stencil";
import {UserService} from "../services/user.service";
import type {User} from "../services/user.repository";

@Component({tag: "user-list", shadow: false})
export class UserList {
    // `declare` is required - see the `@Inject()` API docs below for why.
    @Inject(UserService)
    private declare readonly userService: UserService;

    @State() users: User[] = [];

    componentWillLoad() {
        this.users = this.userService.getUsers();
    }

    render() {
        return (
            <ul>
                {this.users.map(u => (
                    <li>{u.name}</li>
                ))}
            </ul>
        );
    }
}
```

```html
<!-- src/index.html -->
<nonna-provider id="app-provider"></nonna-provider>

<script type="module">
    import {defineNonnaProvider} from "@nonna/stencil";
    import {Nonna} from "@nonna/di";

    defineNonnaProvider();

    const injector = await Nonna.injector().scan().build();
    const provider = document.getElementById("app-provider");
    provider.injector = injector;

    // Only define/append the Stencil consumer components *after* the provider is ready -
    // see the sample app for why (the same DOM-upgrade-timing trap `@nonna/web-components`
    // documents applies here too).
    await import("./build/app.esm.js");
    provider.innerHTML = "<user-list></user-list>";
</script>
```

Prefer an explicit `@Element()` field instead? `requestInjection()`/`requestOptionalInjection()`/
`requestAllInjections()` take any `EventTarget`, so `requestInjection(this.el, UserService)` inside
`componentWillLoad()` works exactly the same way - both are re-exported here.

---

## API

### Decorators

-   `@Inject(token)`: Property decorator resolving a required dependency on property access.
-   `@OptionalInject(token)`: Property decorator resolving an optional dependency.
-   `@AllInject(token)`: Property decorator resolving a `multi: true` binding array.

**The decorated field must use the `declare` modifier.** These decorators install a getter on the
class prototype; without `declare`, TypeScript/esbuild (with `useDefineForClassFields`, the default
once `target` is `ES2022`+) also emit a per-instance field initializer that defines an own
`undefined` property on every instance, silently shadowing the prototype getter and making the
property resolve to `undefined` forever.

### Context Protocol Functions (re-exported from `@nonna/web-components`)

-   `provideInjector(host: EventTarget, injector: Injector): () => void`
-   `requestInjector(element: EventTarget): Injector`
-   `requestInjection<T>(element: EventTarget, token: Token<T>): T`
-   `requestOptionalInjection<T>(element: EventTarget, token: Token<T>): T | undefined`
-   `requestAllInjections<T>(element: EventTarget, token: Token<T>): readonly T[]`
-   `defineNonnaProvider(tagName?: string): void` / `<nonna-provider>` (`NonnaProviderElement`)
-   `CONTEXT_REQUEST_EVENT`, `NONNA_INJECTOR_CONTEXT`, `ContextRequestDetail<T>`

---

## License

MIT © Manuel Santos
