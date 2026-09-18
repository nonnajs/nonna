import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {nonna} from "../src";

type ResolveIdHook = (id: string) => string | undefined;
type LoadHook = (id: string) => string | undefined;

function hooks(plugin: ReturnType<typeof nonna>) {
    return {
        resolveId: plugin.resolveId as unknown as ResolveIdHook,
        load: plugin.load as unknown as LoadHook,
    };
}

describe("nonna() Vite plugin", () => {
    it("configures enforce: pre so shims resolve before Vite internal browser-external resolver", () => {
        const plugin = nonna();
        assert.equal(plugin.enforce, "pre");
    });

    it("resolves both the bare and node: prefixed specifier for every default shim", () => {
        const {resolveId} = hooks(nonna());

        for (const name of ["async_hooks", "fs/promises", "path", "url"]) {
            const bare = resolveId(name);
            const prefixed = resolveId(`node:${name}`);
            assert.ok(bare, `expected ${name} to resolve`);
            assert.ok(prefixed, `expected node:${name} to resolve`);
            assert.equal(bare, prefixed);
        }
    });

    it("leaves unrelated specifiers unresolved", () => {
        const {resolveId} = hooks(nonna());
        assert.equal(resolveId("react"), undefined);
        assert.equal(resolveId("node:crypto"), undefined);
    });

    it("loads real, non-empty ES module source for a resolved virtual id", () => {
        const {resolveId, load} = hooks(nonna());
        const resolved = resolveId("node:async_hooks")!;
        const source = load(resolved);
        assert.ok(source?.includes("class AsyncLocalStorage"));
    });

    it("returns undefined from load() for an id it didn't resolve", () => {
        const {load} = hooks(nonna());
        assert.equal(load("/some/real/file.ts"), undefined);
    });

    it("only shims the builtins listed in options.shims when provided", () => {
        const {resolveId} = hooks(nonna({shims: ["path"]}));
        assert.ok(resolveId("path"));
        assert.ok(resolveId("node:path"));
        assert.equal(resolveId("url"), undefined);
        assert.equal(resolveId("async_hooks"), undefined);
    });

    it("the fs/promises shim's readFile() rejects instead of touching the real filesystem", () => {
        const {resolveId, load} = hooks(nonna());
        const source = load(resolveId("fs/promises")!)!;
        assert.match(source, /not available in the browser/);
    });

    it("the path shim exports isAbsolute/dirname/resolve on both the default and named exports", () => {
        const {resolveId, load} = hooks(nonna());
        const source = load(resolveId("path")!)!;
        assert.match(source, /export default \{isAbsolute, dirname, resolve\}/);
        assert.match(source, /export \{isAbsolute, dirname, resolve\}/);
    });

    it("the url shim exports pathToFileURL()", () => {
        const {resolveId, load} = hooks(nonna());
        const source = load(resolveId("url")!)!;
        assert.match(source, /export function pathToFileURL/);
    });
});
