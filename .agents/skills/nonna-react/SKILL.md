---
name: nonna-react
description: Use when integrating @nonnajs/di into a React application — <NonnaProvider>, useInjection()/useOptionalInjection()/useAllInjections()/useInjector() hooks, or building the injector once at app bootstrap with Vite. Load nonna-di (and nonna-compiler if using AOT) first; this skill covers the React-specific binding package and links to the full GitHub sample for bootstrap.
---

# Nonna on React

> Load [`nonna-di`](../nonna-di/SKILL.md) first — this skill assumes it. Also read
> [`nonna-compiler`](../nonna-compiler/SKILL.md) if the app uses AOT constructor injection.

Package: [`@nonnajs/react`](https://github.com/nonnajs/nonna/tree/main/react). Full working sample:
[`github.com/nonnajs/sample-react`](https://github.com/nonnajs/sample-react) — fetch and adapt it
rather than hand-wiring the Vite/provider boilerplate from scratch.

## Minimal setup

Build the injector once, before the first render, and wrap the tree in `<NonnaProvider>`:

```tsx
// main.tsx
const injector = await Nonna.injector()
    .register({provide: GREETER, useClass: FriendlyGreeter, multi: true})
    .register({provide: GREETER, useClass: FormalGreeter, multi: true})
    .scan()
    .build();

createRoot(document.getElementById("root")!).render(
    <NonnaProvider injector={injector}>
        <App />
    </NonnaProvider>,
);
```

Any component below it resolves services with hooks — no prop-drilling, same singleton every
render:

```tsx
export function UserList() {
    const userService = useInjection(UserService);
    const users = userService.getUsers();
    return (
        <ul>
            {users.map(u => (
                <li key={u.id}>
                    {u.name} &lt;{u.email}&gt;
                </li>
            ))}
        </ul>
    );
}
```

## Hooks

-   `useInjection(Token)` — required dependency, throws if unresolvable.
-   `useOptionalInjection(Token)` — returns `undefined` instead of throwing.
-   `useAllInjections(Token)` — resolves every `multi: true` provider for a token.
-   `useInjector()` — escape hatch for the raw `Injector` instance (e.g. `runInScope` in an event
    handler).

## Required Vite wiring

`@nonnajs/di`'s bundle statically imports a few Node builtins; add
[`@nonnajs/vite-plugin`](https://github.com/nonnajs/nonna/tree/main/vite-plugin) so Rollup can
resolve them for the browser:

```ts
// vite.config.ts
import {nonna} from "@nonnajs/vite-plugin";
export default defineConfig({plugins: [react(), nonna()]});
```

## Decision points

-   **Build the injector before the first render**, not inside a component — `NonnaProvider` takes
    an already-built `Injector`, it does not build one for you.
-   **Multi-providers + `useAllInjections`** is the idiomatic pattern for pluggable strategy lists
    (e.g. multiple `GREETER` implementations) instead of prop-based composition.
-   **`@nonnajs/compiler` still applies** — plain constructor-injected service classes
    (`UserService(userRepo: UserRepository)`) get their tokens inferred at build time exactly as on
    the server; only components use the hooks.
