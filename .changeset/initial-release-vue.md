---
"@nonnajs/vue": minor
---

Initial release of `@nonnajs/vue`:

-   **Vue 3 Integration**: Seamless dependency injection binding for Vue 3 applications.
-   **`<NonnaProvider>` Component**: Vue component providing an `Injector` context to child components.
-   **Composition API**:
    -   `useInjection(token)`: Injects a required service from the container.
    -   `useOptionalInjection(token)`: Injects an optional service or returns `undefined`.
    -   `useAllInjections(token)`: Injects all multi-provider instances.
    -   `useInjector()`: Accesses the active `Injector`.
    -   `provideNonnaInjector()` / `useNonnaInjector()` helper functions for custom provider setups.
