# `@nonnajs/web-components`

> Web Components & Custom Elements bindings for [`@nonnajs/di`](../di) - standard W3C Context Protocol provider, `<nonna-provider>` custom element, resolution functions, and `@inject()` decorators.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Installation

```sh
npm install @nonnajs/web-components @nonnajs/di
```

`@nonnajs/di` is a peer dependency (any `@nonnajs/di` `1.x`).

---

## Quick Example (Vanilla Custom Elements)

```ts
// src/components/user-list.ts
import {requestInjection} from "@nonnajs/web-components";
import {UserService} from "../services/user.service";

export class UserListElement extends HTMLElement {
    connectedCallback(): void {
        const userService = requestInjection(this, UserService);
        const users = userService.getUsers();

        this.innerHTML = `
            <h2>Users</h2>
            <ul>
                ${users.map(u => `<li>${u.name} &lt;${u.email}&gt;</li>`).join("")}
            </ul>
        `;
    }
}
customElements.define("user-list", UserListElement);
```

```html
<!-- index.html -->
<nonna-provider id="app-provider">
    <user-list></user-list>
</nonna-provider>

<script type="module">
    import {defineNonnaProvider} from "@nonnajs/web-components";
    import {Nonna} from "@nonnajs/di";

    defineNonnaProvider();

    const injector = await Nonna.injector().scan().build();
    document.getElementById("app-provider").injector = injector;

    // Import consumer custom elements only *after* the provider is ready. Defining
    // them earlier would upgrade any already-parsed matching elements immediately
    // (synchronously, per the Custom Elements spec) and they'd request injection
    // before any provider is listening - `provideInjector()`/`<nonna-provider>`
    // answer a `context-request` at most once, synchronously, so an early request
    // fails permanently instead of waiting for the injector to be ready.
    await import("./components/user-list");
</script>
```

---

## Lit / Class Decorators Example

```ts
import {LitElement, html} from "lit";
import {customElement} from "lit/decorators.js";
import {inject} from "@nonnajs/web-components";
import {UserService} from "../services/user.service";

@customElement("lit-user-list")
export class LitUserList extends LitElement {
    // `declare` is required - see the `@inject()` API docs below for why.
    @inject(UserService)
    private declare readonly userService: UserService;

    render() {
        const users = this.userService.getUsers();
        return html`
            <ul>
                ${users.map(u => html`<li>${u.name}</li>`)}
            </ul>
        `;
    }
}
```

---

## API

### Context Protocol Functions

#### `provideInjector(host: EventTarget, injector: Injector): () => void`

Listens for W3C Context Protocol `"context-request"` events on `host` and responds with `injector`. Returns a cleanup teardown function.

#### `requestInjector(element: EventTarget): Injector`

Dispatches a `"context-request"` event up the DOM tree and returns the responding `Injector`. Throws if unhandled.

#### `requestInjection<T>(element: EventTarget, token: Token<T>): T`

Resolves `token` via `injector.get(token)`. Throws whatever `Injector.get()` throws.

#### `requestOptionalInjection<T>(element: EventTarget, token: Token<T>): T | undefined`

Resolves optional `token` via `injector.getOptional(token)`.

#### `requestAllInjections<T>(element: EventTarget, token: Token<T>): readonly T[]`

Resolves multi-providers for `token` via `injector.getAll(token)`.

---

### Custom Element

#### `<nonna-provider>` (`NonnaProviderElement`)

Custom element implementing `provideInjector` automatically when attached to DOM.

```ts
import {defineNonnaProvider} from "@nonnajs/web-components";
defineNonnaProvider(); // registers <nonna-provider>
```

---

### Decorators

-   `@inject(token)`: Property decorator resolving required dependency on property access.
-   `@optionalInject(token)`: Property decorator resolving optional dependency.
-   `@allInject(token)`: Property decorator resolving multi-binding array.

---

## License

MIT © Manuel Santos
