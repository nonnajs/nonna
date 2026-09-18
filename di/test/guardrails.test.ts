import {describe, it} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(PACKAGE_ROOT, "src");

describe("Zero-runtime-dependency guardrail", () => {
    it("package.json declares no runtime dependencies", () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf-8"));
        assert.deepEqual(pkg.dependencies ?? {}, {}, "di/di must ship with zero runtime dependencies");
    });

    it("no source file imports typescript, reflect-metadata, or the AOT compiler package", () => {
        const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".ts"));
        assert.ok(files.length > 0);

        const forbidden = [
            /from ["']typescript["']/,
            /from ["']reflect-metadata["']/,
            /from ["']@nonnajs\/compiler["']/,
            /Reflect\.(get|define)Metadata/,
        ];

        for (const file of files) {
            const contents = fs.readFileSync(path.join(SRC_DIR, file), "utf-8");
            for (const pattern of forbidden) {
                assert.doesNotMatch(contents, pattern, `${file} must not match ${pattern}`);
            }
        }
    });
});
