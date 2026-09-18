# `@nonnajs/web-components`

> Web Components & Custom Elements bindings for [`@nonnajs/di`](../di) - standard W3C Context Protocol provider, `<nonna-provider>` custom element, resolution functions, and `@inject()` decorators.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Installation

```sh
# npm
npm install @nonnajs/web-components @nonnajs/di

# Optional: Build-time AOT compiler
npm install --save-dev @nonnajs/compiler

# If using Vite in the browser
npm install --save-dev @nonnajs/vite-plugin
```

`@nonnajs/di` is a peer dependency (any `@nonnajs/di` `1.x`).

---

## Working Sample

A fully functional, runnable sample application is available on GitHub:
👉 **[`nonnajs/sample-web-components`](https://github.com/nonnajs/sample-web-components)** (Custom Elements + Vite + `@nonnajs/web-components`)

---

## Complete Example

### 1. Define Services

Services are standard TypeScript classes decorated with `@Injectable()` from `@nonnajs/di`.

```ts
// src/services/user.repository.ts
import {Injectable} from "@nonnajs/di";

export interface User {
    id: string;
    name: string;
    email: string;
}

@Injectable()
export class UserRepository {
    private readonly users: User[] = [
        {id: "1", name: "Alice", email: "alice@example.com"},
        {id: "2", name: "Bob", email: "bob@example.com"},
    ];

    findAll(): User[] {
        return this.users;
    }
}
```

```ts
// src/services/user.service.ts
import {Injectable} from "@nonnajs/di";
import {UserRepository, User} from "./user.repository";

@Injectable()
export class UserService {
    // Constructor dependency is inferred automatically at build time with @nonnajs/compiler
    constructor(private readonly userRepo: UserRepository) {}

    getUsers(): User[] {
        return this.userRepo.findAll();
    }
}
```

### 2. AOT Dependency Compilation (Optional, Recommended)

With `@nonnajs/compiler`, constructor dependencies are inferred at build time using TypeScript's `TypeChecker` with **zero runtime reflection**:

```json
// package.json
{
    "scripts": {
        "prebuild": "nonna-compile",
        "build": "tsc && vite build"
    }
}
```

### 3. Application Bootstrap & Provider Setup

Register `<nonna-provider>`, boot the container, and assign it to the DOM provider element:

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
    <body>
        <nonna-provider id="app-provider">
            <user-list></user-list>
        </nonna-provider>

        <script type="module" src="/src/main.ts"></script>
    </body>
</html>
```

```ts
// src/main.ts
import {defineNonnaProvider} from "@nonnajs/web-components";
import {Nonna} from "@nonnajs/di";

// Import AOT-generated dependencies metadata (if using @nonnajs/compiler)
import "./__generated__/nonna-dependencies.generated";

async function bootstrap() {
    // 1. Register <nonna-provider> custom element
    defineNonnaProvider();

    // 2. Configure and build injector
    const injector = await Nonna.injector().scan().build();

    // 3. Attach injector to DOM provider
    const provider = document.getElementById("app-provider") as any;
    provider.injector = injector;

    // 4. Import consumer components *after* the provider is ready
    await import("./components/user-list");
}

bootstrap();
```

### 4. Component Injection

#### Option A: Vanilla Custom Elements (`requestInjection`)

```ts
// src/components/user-list.ts
import {requestInjection} from "@nonnajs/web-components";
import {UserService} from "../services/user.service";

export class UserListElement extends HTMLElement {
    connectedCallback(): void {
        // Dispatches standard W3C Context Protocol event to resolve service from nearest <nonna-provider>
        const userService = requestInjection(this, UserService);
        const users = userService.getUsers();

        this.innerHTML = `
            <h2>User Directory</h2>
            <ul>
                ${users.map(u => `<li><strong>${u.name}</strong> (${u.email})</li>`).join("")}
            </ul>
        `;
    }
}

customElements.define("user-list", UserListElement);
```

#### Option B: Class Decorators (`@inject`) / Lit

```ts
import {LitElement, html} from "lit";
import {customElement} from "lit/decorators.js";
import {inject} from "@nonnajs/web-components";
import {UserService} from "../services/user.service";

@customElement("lit-user-list")
export class LitUserList extends LitElement {
    // Injects service when element connects to DOM (use `declare` for TypeScript class fields)
    @inject(UserService)
    private declare readonly userService: UserService;

    render() {
        const users = this.userService.getUsers();
        return html`
            <ul>
                ${users.map(u => html`<li><strong>${u.name}</strong> (${u.email})</li>`)}
            </ul>
        `;
    }
}
```

---

## Bundling For The Browser

`@nonnajs/di` uses Node.js `AsyncLocalStorage` by default for request scoping. When building for the browser with Vite, use [`@nonnajs/vite-plugin`](../vite-plugin) to automatically provide browser-safe shims:

```ts
// vite.config.ts
import {defineConfig} from "vite";
import nonna from "@nonnajs/vite-plugin";

export default defineConfig({
    plugins: [nonna()],
});
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
