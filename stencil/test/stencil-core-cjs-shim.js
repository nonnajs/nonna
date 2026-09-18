// `@stencil/core`'s package.json "exports" map deliberately points its "require" condition at a
// near-empty stub (only `h` is exported) - Stencil's public API is ESM-only by design, and a
// CommonJS `require("@stencil/core")` is expected to be a no-op, not a real client runtime.
//
// This repo's test suite runs `.ts` files through `ts-node/register`, a CJS `require()` hook, so
// `src/decorators.ts`'s `import {getElement} from "@stencil/core"` would otherwise resolve
// `getElement` to `undefined` here - not because our code is wrong, but purely because of how
// this test harness loads TypeScript. `@stencil/core/internal/client` has a *working* CommonJS
// require condition and is the exact same implementation the public "." export re-exports under
// ESM (`internal/stencil-core/index.js` literally does `export {getElement, ...} from
// '../client/index.js'`) - so pre-seeding `require.cache` for the resolved "." path with that
// real module's exports (loaded here, before ts-node/register or any test file) makes
// `require("@stencil/core")` return the genuine implementation instead of the stub, without
// touching or mocking any Stencil behavior.
const stencilCorePath = require.resolve("@stencil/core");
const realClient = require("@stencil/core/internal/client");

require.cache[stencilCorePath] = {
    id: stencilCorePath,
    filename: stencilCorePath,
    loaded: true,
    exports: realClient,
};
