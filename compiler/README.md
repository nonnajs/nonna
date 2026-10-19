# `@nonnajs/compiler`

> Build-time, TypeScript `TypeChecker`-based Ahead-of-Time (AOT) dependency compiler for [`@nonnajs/di`](../di).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Compiler](https://img.shields.io/badge/Compiler-TypeScript%20AST-blue.svg)](https://www.typescriptlang.org/)

`@nonnajs/compiler` statically inspects your TypeScript code using the official TypeScript `TypeChecker` API and automatically emits `defineDependencies(...)` metadata. This completely eliminates the need for `@Inject()` parameter annotations on concrete or abstract classes, all without runtime reflection (`reflect-metadata`), runtime file scanning, or overhead in your production bundle.

---

## Installation

```sh
# npm
npm install --save-dev @nonnajs/compiler

# pnpm
pnpm add -D @nonnajs/compiler

# Bun
bun add -d @nonnajs/compiler
```

---

## Why AOT Compilation?

| Approach                      | Bundle Overhead              | Runtime Performance          | Reflection Dependency                                        | Type Safety                              |
| ----------------------------- | ---------------------------- | ---------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| `reflect-metadata`            | High (pollutes global scope) | Slower startup               | Required (`experimentalDecorators`, `emitDecoratorMetadata`) | Lossy (erased types)                     |
| Manual `@Inject()`            | Low                          | Fast                         | None                                                         | Verbose & error-prone                    |
| **`@nonnajs/compiler` (AOT)** | **Zero (build-time only)**   | **Fastest (direct imports)** | **None**                                                     | **Full TypeScript TypeChecker analysis** |

---

## How It Resolves Constructor Tokens

For each parameter in an `@Injectable()` or `@Service()` class constructor:

1. **Explicit Decorators First**: An explicit `@Inject(token)` or `@Optional(token)` always wins, resolved by symbol identity (never by string name alone).
2. **Class Inference**: If unadorned, the declared TypeScript type is checked:
    - **Concrete `class` & `abstract class`**: Inferred directly as the DI token.
    - **Interfaces**: Emits a build error asking for an explicit `@Inject(TOKEN)` (since interfaces do not exist at runtime in JavaScript).
    - **Primitives & Unions (`string`, `number`, `User | Admin`)**: Emits a build error asking for an explicit `@Inject(TOKEN)`.
    - **Generic Class Instantiations (`Repository<User>`)**: Rejected at build-time to avoid ambiguous DI collision (type arguments are erased at runtime). Hoist to an explicit token like `@Inject(USER_REPOSITORY)`.
3. **Symbol Hoisting Guardrail**: Literal inline tokens like `@Inject(Symbol("x"))` are rejected; hoist them to exported constants `export const X = Symbol("x")` to ensure stable identity.

---

## Usage in `package.json`

`nonna-compile` works out of the box with zero arguments:

```json
{
    "scripts": {
        "compile-deps": "nonna-compile",
        "prebuild": "npm run compile-deps",
        "build": "tsc -p tsconfig.json"
    }
}
```

### Frameworks built on `@nonnajs/di`

A framework teaches the compiler about its own decorators (e.g. a `@Component()` that wraps `@Injectable()`) by
shipping a `.nonna.json` in its published package (add it to `files`). `nonna-compile` reads the `.nonna.json` of every
package listed in the project's `dependencies`, `devDependencies` and `peerDependencies`, so applications need no
configuration of their own:

```json
{
    "injectableDecorators": ["@my-framework/core#Component", "@my-framework/core#Service"],
    "injectDecorators": ["@my-framework/di#Inject"],
    "optionalDecorators": [],
    "defineDependenciesModule": "@my-framework/di"
}
```

Decorator entries are `"<module>#<exportName>"` strings. `defineDependenciesModule` is the module the generated file
imports `defineDependencies` from; it must re-export it, which lets applications avoid a direct `@nonnajs/di`
dependency. A `.nonna.json` in the project itself is merged on top, for app-specific additions.

### CLI Options

| Flag               | Short | Default                                             | Description                                 |
| ------------------ | ----- | --------------------------------------------------- | ------------------------------------------- |
| `--project <path>` | `-p`  | `tsconfig.json`                                     | Path to your TypeScript configuration file  |
| `--output <path>`  | `-o`  | `src/__generated__/nonna-dependencies.generated.ts` | Target path for the emitted dependency file |

#### Custom Path Example:

```sh
nonna-compile -p tsconfig.build.json -o src/generated/deps.ts
```

---

## Bootstrapping in Application Code

Import the generated dependency file once, before `injector.initialize()` or resolving services:

```ts
// src/index.ts
import "./__generated__/nonna-dependencies.generated";
import {Injector} from "@nonnajs/di";
import {UserService} from "./user.service";

async function main() {
    const injector = Injector.create();
    injector.refresh();
    await injector.initialize();

    const service = injector.get(UserService);
    // Dependencies are wired automatically!
}
```

---

## Generated File Structure

The generated file contains only clean imports and `defineDependencies()` calls:

```ts
// AUTO-GENERATED by @nonnajs/compiler - do not edit by hand.
import {defineDependencies} from "@nonnajs/di";
import {UserService} from "./user.service";
import {UserRepository} from "./user.repository";
import {LoggerService} from "./logger.service";
import {NotificationService} from "./notification.service";

defineDependencies(UserService, [UserRepository, LoggerService, {token: NotificationService, optional: true}]);
```

---

## Programmatic API

You can also execute the compiler programmatically (e.g., inside Vite, Webpack, esbuild plugins, or custom scripts):

```ts
import {compile} from "@nonnajs/compiler";

const result = compile({
    project: "tsconfig.json",
    outputFile: "src/__generated__/nonna-dependencies.generated.ts",
});

if (!result.success) {
    console.error("Compilation failed with diagnostics:", result.diagnostics);
    process.exit(1);
}

console.log(`Successfully compiled metadata for ${result.classCount} classes.`);
```

---

## License

MIT © Manuel Santos
