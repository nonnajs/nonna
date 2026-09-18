# `@nonnajs/react`

> React bindings for [`@nonnajs/di`](../di) - a `<NonnaProvider>` context component plus `useInjection()`/`useOptionalInjection()`/`useAllInjections()`/`useInjector()` hooks, in the spirit of `inversify-react`.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Installation

```sh
npm install @nonnajs/react @nonnajs/di react
```

`@nonnajs/di` and `react` are peer dependencies - bring your own versions (React `>=16.8`, any `@nonnajs/di` `1.x`).

---

## Quick Example

```tsx
import {createRoot} from "react-dom/client";
import {Nonna} from "@nonnajs/di";
import {NonnaProvider, useInjection} from "@nonnajs/react";
import {UserService} from "./user.service";

// 1. Configure and boot the container once, at your app's entry point - not inside the tree.
const injector = await Nonna.injector().scan().build();

function UserList() {
    const userService = useInjection(UserService);
    const users = userService.getUsers();
    return (
        <ul>
            {users.map(user => (
                <li key={user.id}>{user.name}</li>
            ))}
        </ul>
    );
}

createRoot(document.getElementById("root")!).render(
    <NonnaProvider injector={injector}>
        <UserList />
    </NonnaProvider>,
);
```

---

## Why an already-built `Injector`?

`NonnaProvider` takes a ready `Injector` - never a builder, and never a `Promise<Injector>`. Bootstrapping (`await Nonna.injector()...build()`) is async, and belongs in your app's own entry point, before the first render - not something the provider does on your behalf. This keeps `NonnaProvider` itself trivial (a single `Context.Provider`, no implicit loading state, no suspense boundary you didn't ask for) and matches how `inversify-react`'s `<Provider container={container}>` works: you own the container's lifecycle, the binding component just makes it available to the tree.

If you want a loading screen while the injector boots, render it yourself around the `await`:

```tsx
async function bootstrap() {
    const injector = await Nonna.injector().scan().build();
    createRoot(document.getElementById("root")!).render(
        <NonnaProvider injector={injector}>
            <App />
        </NonnaProvider>,
    );
}
bootstrap();
```

---

## API

### `<NonnaProvider injector={injector}>`

Makes `injector` available to every hook below it in the tree, via React context. Safe to nest (an inner `NonnaProvider` shadows an outer one, e.g. for a request-scoped sub-tree with its own child injector).

### `useInjector(): Injector`

Returns the `Injector` from the nearest `NonnaProvider`. Throws if called outside one - every other hook here is built on top of this and inherits that behavior.

### `useInjection<T>(token: Token<T>): T`

Resolves `token` via `injector.get(token)`, memoized on `[injector, token]` so a `transient`-scoped token isn't reconstructed on every render. Throws exactly what `Injector.get()` throws (`ProviderNotFoundError`, `AsyncProviderError`, `ScopeError`, ...) - nothing is swallowed or converted.

```tsx
const logger = useInjection(Logger);
```

### `useOptionalInjection<T>(token: Token<T>): T | undefined`

Like `useInjection()`, but resolves to `undefined` instead of throwing when `token` isn't registered - mirrors `Injector.getOptional()`.

### `useAllInjections<T>(token: Token<T>): readonly T[]`

Resolves every provider registered for `token` (for `multi: true` tokens) - mirrors `Injector.getAll()`. Resolves to `[]` if none are registered.

---

## What this package deliberately doesn't do

-   **No class-component decorators / `connect()` HOC.** Unlike `inversify-react`, there's no property-injection-onto-a-class-component story to bridge here - Nonna's own field injection (see the `@nonnajs/di` README) already covers "inject into a class", and React function components plus hooks are the idiomatic target for everything else.
-   **No async resolution hook.** `useInjection()` is sync-only, matching `injector.get()`. If a token needs `getAsync()`, resolve it during your own bootstrap (before `build()` finishes, or via an eager provider) rather than inside a component.
-   **No request-scope integration with the render tree.** `Injector.runInScope()` is designed around a request/call lifecycle (an HTTP request, a job run), not a component's render lifecycle - nest a `NonnaProvider` with a differently-scoped child `Injector` if you need per-subtree isolation.

---

## License

MIT © Manuel Santos
