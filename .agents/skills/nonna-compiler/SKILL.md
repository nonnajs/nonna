---
name: nonna-compiler
description: Use when configuring or troubleshooting @nonnajs/compiler — the nonna-compile CLI, AOT constructor-token inference via the TypeScript TypeChecker, the generated __generated__/nonna-dependencies.generated.ts file, or build script wiring (prebuild/compile-deps steps). Load alongside nonna-di whenever setting up dependency injection for a new Nonna app so constructor injection works without reflect-metadata.
---

# `@nonnajs/compiler` — AOT Dependency Compiler

Package: [`compiler/`](https://github.com/nonnajs/nonna/tree/main/compiler) in `nonnajs/nonna`.

## What it does

Scans your TypeScript source for `@Injectable()`-decorated classes, uses the real TypeScript
`TypeChecker` to resolve each constructor parameter's concrete class (or `@Inject(TOKEN)` token),
and emits plain `defineDependencies(Target, [...])` calls to a generated file — no runtime
reflection, no `reflect-metadata`, no `emitDecoratorMetadata` needed.

## Zero-config setup

```json
// package.json
{
    "scripts": {
        "prebuild": "nonna-compile",
        "build": "tsc -p tsconfig.json"
    }
}
```

Defaults: reads `tsconfig.json`, writes `src/__generated__/nonna-dependencies.generated.ts`.
Import it once at bootstrap, before anything resolves from the container:

```ts
// src/index.ts
import "./__generated__/nonna-dependencies.generated";
import {Nonna} from "@nonnajs/di";

const injector = await Nonna.injector().scan().build();
```

Alternative: load it dynamically instead of a static import, via
`.loadBeans(["./src/__generated__/nonna-dependencies.generated"])` on the `Nonna.injector()`
builder (useful in environments without top-level static import ordering guarantees).

## CLI customization

```sh
# Custom tsconfig and/or output path
nonna-compile -p tsconfig.build.json -o dist/deps.generated.ts
```

## Decision points an agent should get right

-   **Compiler is optional but recommended.** Without it, every constructor dependency on a
    concrete class needs an explicit `@Inject(Token)` — the compiler exists so plain constructor
    parameter types are enough.
-   **Run it before `tsc`/bundling, not after.** It's a source-to-source step (`prebuild`), not a
    runtime step — the generated file must exist and be imported before the app boots.
-   **Non-Node runtimes (Deno/Bun) still run it via Node/npm tooling at build time** even though the
    compiled app itself runs on Deno/Bun — see [`nonna-deno`](../nonna-deno/SKILL.md) and
    [`nonna-bun`](../nonna-bun/SKILL.md) for how their sample `package.json`/`deno.json` wire this.
-   **`@Optional()`** parameters are still emitted, just marked not-required — don't treat compiler
    output diffs there as a bug.
-   **Regenerate after adding/removing constructor dependencies** — stale generated files cause
    `get()` to fail with missing-token errors that look like DI bugs but are actually a stale build.

## Full reference

For the scanner/resolver/codegen internals and edge cases (generic tokens, re-exports, barrel
files), read [`compiler/README.md`](https://github.com/nonnajs/nonna/blob/main/compiler/README.md).
For the DI runtime this feeds into, see [`nonna-di`](../nonna-di/SKILL.md).
