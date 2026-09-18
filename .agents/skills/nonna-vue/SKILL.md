---
name: nonna-vue
description: Use when integrating @nonnajs/di into a Vue 3 application — <NonnaProvider>, useInjection()/useOptionalInjection()/useAllInjections()/useInjector() composables, or building the injector once at app bootstrap with Vite. Load nonna-di (and nonna-compiler if using AOT) first; this skill covers the Vue-specific binding package and links to the full GitHub sample for bootstrap.
---

# Nonna on Vue 3

> Load [`nonna-di`](../nonna-di/SKILL.md) first — this skill assumes it. Also read
> [`nonna-compiler`](../nonna-compiler/SKILL.md) if the app uses AOT constructor injection.

Package: [`@nonnajs/vue`](https://github.com/nonnajs/nonna/tree/main/vue). Full working sample:
[`github.com/nonnajs/sample-vue`](https://github.com/nonnajs/sample-vue) — fetch and adapt it
rather than hand-wiring the Vite/provider boilerplate from scratch.

## Minimal setup

Build the injector once, before `app.mount()`, and render `<NonnaProvider>` around the root:

```ts
// main.ts
const injector = await Nonna.injector()
    .register({provide: GREETER, useClass: FriendlyGreeter, multi: true})
    .register({provide: GREETER, useClass: FormalGreeter, multi: true})
    .scan()
    .build();

const Root = {render: () => h(NonnaProvider, {injector}, {default: () => h(App)})};
createApp(Root).mount("#app");
```

Any component below it resolves services with composables inside `<script setup>` — no
prop-drilling, same singleton every time:

```vue
<script setup lang="ts">
import {useInjection} from "@nonnajs/vue";
import {UserService} from "../services/user.service";

const userService = useInjection(UserService);
const users = userService.getUsers();
</script>

<template>
    <ul>
        <li v-for="user in users" :key="user.id">{{ user.name }} &lt;{{ user.email }}&gt;</li>
    </ul>
</template>
```

## Composables

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
export default defineConfig({plugins: [vue(), nonna()]});
```

## Decision points

-   **Build the injector before `app.mount()`**, not inside a component — `<NonnaProvider>` takes an
    already-built `Injector` as a prop, it does not build one for you.
-   **Composables must be called during `setup()`/`<script setup>` synchronous execution**, same
    rule as Vue's own `inject()`/`provide()`.
-   **`@nonnajs/compiler` still applies** to plain constructor-injected service classes exactly as
    on the server; only components use the composables.
