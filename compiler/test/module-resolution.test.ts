import {describe, it} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {createInjectorModuleMatcher} from "../src";

describe("createInjectorModuleMatcher", () => {
    it("recognizes the real @nonnajs/di package resolved through a pnpm workspace symlink", () => {
        // di/compiler depends on @nonnajs/di via workspace:*, which pnpm
        // symlinks directly to di/di - TypeScript (like Node's require) reports the
        // *real* path (di/di/dist/...), which never contains "/node_modules/" at
        // all. This is the exact scenario that broke a naive node_modules-path-only matcher.
        const matcher = createInjectorModuleMatcher(__dirname, "@nonnajs/di");
        const realEntry = require.resolve("@nonnajs/di");

        assert.ok(
            realEntry.includes(`${path.sep}di${path.sep}`),
            "sanity check: resolves through the workspace symlink's real path",
        );
        assert.equal(matcher(realEntry), true);
    });

    it("still matches a plain node_modules path for packages without a resolvable package root", () => {
        const matcher = createInjectorModuleMatcher(__dirname, "@some/nonexistent-package");
        assert.equal(matcher("/repo/node_modules/@some/nonexistent-package/dist/index.js"), true);
        assert.equal(matcher("/repo/src/unrelated.ts"), false);
    });
});
