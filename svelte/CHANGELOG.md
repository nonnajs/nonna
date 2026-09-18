# @nonnajs/svelte

## 2.0.1

### Patch Changes

-   c35af11: Testing full cicd release process
-   Updated dependencies
    -   @nonnajs/di@1.1.1

## 2.0.0

### Minor Changes

-   5acafec: Initial release of `@nonnajs/svelte`:

    -   **Svelte 5 / Svelte 4 Integration**: Dependency injection bindings for Svelte component hierarchies.
    -   **Context Management**: `setInjector(injector)` to bind a container instance to the Svelte component context.
    -   **Injection Functions**:
        -   `useInjection(token)`: Injects a required service from the active context.
        -   `useOptionalInjection(token)`: Injects an optional service or returns `undefined`.
        -   `useAllInjections(token)`: Injects all multi-provider instances.
        -   `useInjector()`: Accesses the active `Injector` instance.

### Patch Changes

-   Updated dependencies
    -   @nonnajs/di@1.1.0
