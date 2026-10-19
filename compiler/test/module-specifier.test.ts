import {after, before, describe, it} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

import {moduleSpecifierForSourceFile} from "../src";

function sourceFileAt(fileName: string): ts.SourceFile {
    return ts.createSourceFile(fileName, "export class X {}", ts.ScriptTarget.ES2022);
}

describe("moduleSpecifierForSourceFile", () => {
    let root: string;
    let appDir: string;

    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "nonna-specifier-"));
        appDir = path.join(root, "apps", "app");
        fs.mkdirSync(path.join(appDir, "src", "__generated__"), {recursive: true});
        fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify({name: "app"}));
        const libDir = path.join(root, "packages", "lib");
        fs.mkdirSync(path.join(libDir, "dist"), {recursive: true});
        fs.writeFileSync(path.join(libDir, "package.json"), JSON.stringify({name: "@scope/lib"}));
    });

    after(() => fs.rmSync(root, {recursive: true, force: true}));

    const fromDir = () => path.join(appDir, "src", "__generated__");

    it("uses the package name for a plain node_modules install", () => {
        const file = path.join(appDir, "node_modules", "@scope", "pkg", "index.d.ts");
        assert.equal(moduleSpecifierForSourceFile(sourceFileAt(file), fromDir()), "@scope/pkg");
    });

    it("uses the innermost node_modules segment for pnpm's nested real paths", () => {
        const file = path.join(
            root,
            "node_modules",
            ".pnpm",
            "winston@3.10.0",
            "node_modules",
            "winston",
            "index.d.ts",
        );
        assert.equal(moduleSpecifierForSourceFile(sourceFileAt(file), fromDir()), "winston");

        const scoped = path.join(root, "node_modules", ".pnpm", "x@1", "node_modules", "@scope", "x", "index.d.ts");
        assert.equal(moduleSpecifierForSourceFile(sourceFileAt(scoped), fromDir()), "@scope/x");
    });

    it("uses the package.json name for a workspace-linked package resolved to its real path", () => {
        const file = path.join(root, "packages", "lib", "dist", "service.d.ts");
        assert.equal(moduleSpecifierForSourceFile(sourceFileAt(file), fromDir()), "@scope/lib");
    });

    it("imports files from the project's own package relatively", () => {
        const file = path.join(appDir, "src", "services", "users.service.ts");
        assert.equal(moduleSpecifierForSourceFile(sourceFileAt(file), fromDir()), "../services/users.service");
    });
});
