---
"@nonnajs/compiler": major
---

Initial release of `@nonnajs/compiler`:

-   **Ahead-of-Time (AOT) Compilation**: Statically analyzes TypeScript source code using the official TypeScript `TypeChecker` to infer constructor dependency tokens at build time.
-   **Reflection-Free DI**: Eliminates the need for `reflect-metadata` and `emitDecoratorMetadata` compiler options.
-   **CLI Tool (`nonna-compile`)**:
    -   Zero-config execution: automatically reads `tsconfig.json` and outputs generated metadata to `src/__generated__/nonna-dependencies.generated.ts`.
    -   Configurable CLI flags: `--project` / `-p` and `--output` / `-o`.
-   **Code Generation**: Generates strongly-typed `defineDependencies(...)` metadata registrations.
-   **Diagnostics**: Emits compile-time diagnostics with actionable error messages for unresolvable interfaces, union types, or primitives requiring explicit `@Inject()` tokens.
