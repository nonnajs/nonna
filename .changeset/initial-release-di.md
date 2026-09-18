---
"@nonnajs/di": minor
---

Initial release of `@nonnajs/di`:

-   **Zero Runtime Dependencies**: Ultra-lightweight micro DI container with 0 external dependencies and no `reflect-metadata` requirement.
-   **Runtime Agnostic**: First-class support across Node.js (18+), Bun, and Deno with unified `ContextStorage` / `AsyncLocalStorage` scoping.
-   **Core Decorators**:
    -   `@Injectable()` / `@Service()` for registering classes with configurable scopes (`singleton`, `transient`, `request`) and eager instantiation.
    -   `@Inject()` and `@Optional()` for explicit constructor and field injection with string or symbol tokens.
-   **Fluent & Imperative APIs**:
    -   `Nonna.injector()` builder with `.scan()`, `.register()`, `.registerValue()`, `.registerFactory()`, `.loadBeans()`, `.freeze()`, and `.build()`.
    -   `Injector` instance methods: `get()`, `getAll()`, `getAsync()`, `getAllAsync()`, `runInScope()`, `destroy()`, and `inspect()`.
-   **Lifecycle Management**: `OnInit` and `OnDestroy` lifecycle hooks with reverse-order teardown and aggregated `LifecycleError` handling.
-   **Advanced Features**: Multi-provider registration (`multi: true`), circular dependency detection, and hierarchical scope isolation.
