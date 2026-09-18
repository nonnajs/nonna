---
"@nonnajs/web-components": major
---

Initial release of `@nonnajs/web-components`:

-   **W3C Context Protocol**: Standards-compliant dependency injection via `context-request` DOM events.
-   **`<nonna-provider>` Custom Element**: `<nonna-provider>` (`NonnaProviderElement`) component to host and scope `Injector` instances in HTML/DOM trees.
-   **Custom Element Decorators**:
    -   `@inject(token)`: Property decorator that automatically resolves and assigns dependencies upon element attachment.
    -   `@optionalInject(token)`: Resolves optional dependencies without throwing when missing.
    -   `@allInject(token)`: Resolves all multi-provider instances.
    -   `@injector()`: Injects the active `Injector`.
-   **Low-level Helpers**: `provideInjector()`, `requestInjection()`, `requestOptionalInjection()`, `requestAllInjections()`, and `requestInjector()`.
-   **Cross-Framework Compatibility**: Works with vanilla Web Components, Lit, Fast, Stencil, and any W3C Context Protocol consumer.
