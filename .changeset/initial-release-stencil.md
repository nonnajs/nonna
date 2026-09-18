---
"@nonnajs/stencil": minor
---

Initial release of `@nonnajs/stencil`:

-   **StencilJS Integration**: First-class dependency injection support for Stencil components built on `@nonnajs/web-components`.
-   **Property Decorators**:
    -   `@Inject(token)`: Injects a required dependency during the `componentWillLoad` lifecycle stage.
    -   `@OptionalInject(token)`: Injects an optional dependency.
    -   `@AllInject(token)`: Injects all multi-provider instances.
    -   `@InjectContainer()`: Injects the root/ambient `Injector`.
-   **DOM-Tree Context Traversal**: Automatically listens to and dispatches W3C Context Protocol events via Stencil's element host.
