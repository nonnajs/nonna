# `@nonnajs/stencil`

> StencilJS bindings for [`@nonnajs/di`](../di) - `@Inject()`/`@OptionalInject()`/`@AllInject()` property decorators, plus the standard W3C Context Protocol provider and resolution functions from [`@nonnajs/web-components`](../web-components).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Installation

```sh
# npm
npm install @nonnajs/stencil @nonnajs/di @nonnajs/web-components @stencil/core

# Optional: Build-time AOT compiler
npm install --save-dev @nonnajs/compiler
```

`@nonnajs/di`, `@nonnajs/web-components`, and `@stencil/core` (`>=4.0.0`) are peer dependencies.

---

## Working Sample

A fully functional, runnable sample application is available on GitHub:
👉 **[`nonnajs/sample-stencil`](https://github.com/nonnajs/sample-stencil)** (StencilJS + `@nonnajs/stencil`)

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
        "build": "stencil build"
    }
}
```

### 3. Application Bootstrap & Provider Setup

```html
<!-- src/index.html -->
<!DOCTYPE html>
<html lang="en">
    <body>
        <nonna-provider id="app-provider"></nonna-provider>

        <script type="module">
            import {defineNonnaProvider} from "@nonnajs/stencil";
            import {Nonna} from "@nonnajs/di";

            // Import AOT-generated dependencies metadata (if using @nonnajs/compiler)
            import "./__generated__/nonna-dependencies.generated";

            defineNonnaProvider();

            const injector = await Nonna.injector().scan().build();
            const provider = document.getElementById("app-provider");
            provider.injector = injector;

            // Define/append Stencil consumer components *after* the provider is ready
            await import("./build/app.esm.js");
            provider.innerHTML = "<user-list></user-list>";
        </script>
    </body>
</html>
```

### 4. Component Injection with Stencil Decorators

```tsx
// src/components/user-list.tsx
import {Component, h, State} from "@stencil/core";
import {Inject} from "@nonnajs/stencil";
import {UserService} from "../services/user.service";
import type {User} from "../services/user.repository";

@Component({
    tag: "user-list",
    shadow: false,
})
export class UserList {
    // `declare` is required for prototype getter decorators in TypeScript/esbuild
    @Inject(UserService)
    private declare readonly userService: UserService;

    @State() users: User[] = [];

    componentWillLoad() {
        this.users = this.userService.getUsers();
    }

    render() {
        return (
            <div>
                <h2>User Directory</h2>
                <ul>
                    {this.users.map(u => (
                        <li key={u.id}>
                            <strong>{u.name}</strong> ({u.email})
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
}
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

### Context Protocol Functions (re-exported from `@nonnajs/web-components`)

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
