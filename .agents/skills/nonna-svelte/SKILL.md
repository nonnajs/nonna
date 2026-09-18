---
name: nonna-svelte
description: Use when integrating @nonnajs/di into a Svelte 5 application — setInjector() context helper, useInjection()/useOptionalInjection()/useAllInjections()/useInjector() functions, or building the injector once at app bootstrap with Vite. Load nonna-di (and nonna-compiler if using AOT) first; this skill covers the Svelte-specific binding package and links to the full GitHub sample for bootstrap.
---

# Nonna on Svelte 5

> Load [`nonna-di`](../nonna-di/SKILL.md) first — this skill assumes it. Also read
> [`nonna-compiler`](../nonna-compiler/SKILL.md) if the app uses AOT constructor injection.

Package: [`@nonnajs/svelte`](https://github.com/nonnajs/nonna/tree/main/svelte). Full working
sample: [`github.com/nonnajs/sample-svelte`](https://github.com/nonnajs/sample-svelte) — fetch and
adapt it rather than hand-wiring the Vite/context boilerplate from scratch.

## Minimal setup

Build the injector once, before `mount()`, and pass it down as a prop:

```ts
// main.ts
const injector = await Nonna.injector()
    .register({provide: GREETER, useClass: FriendlyGreeter, multi: true})
    .register({provide: GREETER, useClass: FormalGreeter, multi: true})
    .scan()
    .build();

mount(App, {target: document.getElementById("app")!, props: {injector}});
```

`App.svelte` calls `setInjector()` once, at the root, to put it into Svelte's context:

```svelte
<script lang="ts">
let {injector} = $props<{injector: Injector}>();
setInjector(injector);
</script>
```

Any component below it resolves services with `useInjection()` during initialization — no
prop-drilling, same singleton every time:

```svelte
<script lang="ts">
import {useInjection} from "@nonnajs/svelte";
import {UserService} from "../services/user.service";

const userService = useInjection(UserService);
let users = $derived.by(() => userService.getUsers());
</script>
```

## Functions

-   `setInjector(injector)` — call once at the component tree root to put the injector in context.
-   `useInjection(Token)` — required dependency, throws if unresolvable.
-   `useOptionalInjection(Token)` — returns `undefined` instead of throwing.
-   `useAllInjections(Token)` — resolves every `multi: true` provider for a token.
-   `useInjector()` — escape hatch for the raw `Injector` instance.

## Required Vite wiring

`@nonnajs/di`'s bundle statically imports a few Node builtins; add
[`@nonnajs/vite-plugin`](https://github.com/nonnajs/nonna/tree/main/vite-plugin) so Rollup can
resolve them for the browser:

```ts
// vite.config.ts
import {nonna} from "@nonnajs/vite-plugin";
export default defineConfig({plugins: [svelte(), nonna()]});
```

## Decision points

-   **`useInjection()`-family functions must run during component initialization** (top-level of
    `<script>`), same rule as Svelte's own `getContext()` — don't call them inside callbacks or
    `$effect`.
-   **`setInjector()` must run before any descendant calls `useInjection()`** — build the injector
    fully (including `await ...build()`) before `mount()`, not inside `App.svelte`.
-   **`@nonnajs/compiler` still applies** to plain constructor-injected service classes exactly as
    on the server; only components use the context functions.
