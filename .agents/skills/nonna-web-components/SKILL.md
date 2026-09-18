---
name: nonna-web-components
description: Use when integrating @nonnajs/di into vanilla Web Components / Custom Elements — the <nonna-provider> element, W3C Context Protocol provideInjector()/requestInjection() primitives, or the @inject()/@optionalInject()/@allInject() property decorators. Load nonna-di (and nonna-compiler if using AOT) first; this skill covers the framework-agnostic W3C Context Protocol binding and links to the full GitHub sample for bootstrap. Also load this before nonna-stencil, since Stencil bindings are built on top of it.
---

# Nonna on Web Components

> Load [`nonna-di`](../nonna-di/SKILL.md) first — this skill assumes it. Also read
> [`nonna-compiler`](../nonna-compiler/SKILL.md) if the app uses AOT constructor injection.

Package: [`@nonnajs/web-components`](https://github.com/nonnajs/nonna/tree/main/web-components).
Full working sample:
[`github.com/nonnajs/sample-web-components`](https://github.com/nonnajs/sample-web-components) —
fetch and adapt it rather than hand-wiring the provider/Vite boilerplate from scratch.

## Minimal setup

`@inject()` resolves on property access — no constructor, no `@Element()`-style lookup. The
`declare` modifier is **required** or the property silently resolves to `undefined`:

```ts
export class UserListElement extends HTMLElement {
    @inject(UserService)
    private declare readonly userService: UserService;

    connectedCallback(): void {
        const users = this.userService.getUsers();
        this.innerHTML = `<ul>${users.map(u => `<li>${u.name}</li>`).join("")}</ul>`;
    }
}
customElements.define("user-list", UserListElement);
```

`main.ts` builds the injector, assigns it to `<nonna-provider>`, and **only then** defines/imports
the consumer elements — defining them earlier would synchronously upgrade any already-parsed
matching elements and race the async injector build (per the Custom Elements spec):

```ts
const injector = await Nonna.injector()
    .register({provide: GREETER, useClass: FriendlyGreeter, multi: true})
    .register({provide: GREETER, useClass: FormalGreeter, multi: true})
    .scan()
    .build();

document.getElementById("app-provider")!.injector = injector;
await import("./components/UserListElement"); // now safe to define/upgrade
```

## API

-   `<nonna-provider>` — custom element that holds the DI boundary; assign `.injector` once built.
-   `@inject(Token)` / `@optionalInject(Token)` / `@allInject(Token)` — property decorators that
    resolve via bubbling `"context-request"` events (W3C Context Protocol).
-   `requestInjection()`/`requestOptionalInjection()`/`requestAllInjections()` — the underlying
    imperative functions the decorators call, for use without decorators.
-   `provideInjector()` — lower-level primitive `<nonna-provider>` is built on, for custom provider
    elements.

## Decision points

-   **Ordering is load-bearing**: build injector → assign to `<nonna-provider>` → define/import
    consumer custom elements. Getting this backwards causes silently-undefined injected properties.
-   **`declare` on injected properties is mandatory** — without it, the class field initializer
    (even implicit, from `useDefineForClassFields`) overwrites the decorator-installed getter.
-   **This is the foundation for Stencil** — if the task is a Stencil app, open
    [`nonna-stencil`](../nonna-stencil/SKILL.md) instead, which layers Stencil-specific decorators
    on these same primitives.

## Required Vite wiring

```ts
// vite.config.ts
import {nonna} from "@nonnajs/vite-plugin";
export default defineConfig({plugins: [nonna()]});
```
