# @nonnajs/stencil

## 2.0.0

### Minor Changes

-   5acafec: Initial release of `@nonnajs/stencil`:

    -   **StencilJS Integration**: First-class dependency injection support for Stencil components built on `@nonnajs/web-components`.
    -   **Property Decorators**:
        -   `@Inject(token)`: Injects a required dependency during the `componentWillLoad` lifecycle stage.
        -   `@OptionalInject(token)`: Injects an optional dependency.
        -   `@AllInject(token)`: Injects all multi-provider instances.
        -   `@InjectContainer()`: Injects the root/ambient `Injector`.
    -   **DOM-Tree Context Traversal**: Automatically listens to and dispatches W3C Context Protocol events via Stencil's element host.

### Patch Changes

-   Updated dependencies
    -   @nonnajs/di@1.1.0
    -   @nonnajs/web-components@2.0.0
