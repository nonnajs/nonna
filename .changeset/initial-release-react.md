---
"@nonnajs/react": minor
---

Initial release of `@nonnajs/react`:

-   **React 18+ Integration**: Seamless integration between `@nonnajs/di` and React component trees.
-   **`<NonnaProvider>` Component**: Context provider component that establishes an `Injector` hierarchy across React subtrees.
-   **Custom Hooks**:
    -   `useInjection(token)`: Resolves a required dependency from the ambient container.
    -   `useOptionalInjection(token)`: Resolves an optional dependency or returns `undefined` if unregistered.
    -   `useAllInjections(token)`: Resolves all instances registered under a multi-provider token.
    -   `useInjector()`: Provides direct access to the ambient `Injector` instance.
