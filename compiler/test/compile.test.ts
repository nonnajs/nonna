import {describe, it} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {compile} from "../src/compile";
import {FIXTURES_DIR, INJECTOR_LIKE_FILE} from "./helpers";

const OUTPUT_DIR = path.join(FIXTURES_DIR, "__generated__");

function cleanOutput(): void {
    fs.rmSync(OUTPUT_DIR, {recursive: true, force: true});
}

describe("compile() end-to-end", () => {
    it("generates an aggregator file for a project with only resolvable dependencies", () => {
        cleanOutput();
        const outputFile = path.join(OUTPUT_DIR, "success.generated.ts");

        const result = compile({
            project: path.join(FIXTURES_DIR, "tsconfig.success.json"),
            outputFile,
            matchInjectorModule: fileName => fileName === INJECTOR_LIKE_FILE,
        });

        assert.equal(result.success, true);
        if (result.success) {
            assert.ok(fs.existsSync(result.outputFile));
            const contents = fs.readFileSync(result.outputFile, "utf-8");
            assert.match(contents, /defineDependencies\(UserService, \[[\s\S]*UserRepository[\s\S]*\]\);/);
            assert.match(contents, /defineDependencies\(ExplicitTokenConsumer, \[[\s\S]*LOGGER[\s\S]*\]\);/);
        }
        cleanOutput();
    });

    it("writes no output file and returns diagnostics when a dependency can't be resolved", () => {
        cleanOutput();
        const outputFile = path.join(OUTPUT_DIR, "failure.generated.ts");

        const result = compile({
            project: path.join(FIXTURES_DIR, "tsconfig.failure.json"),
            outputFile,
            matchInjectorModule: fileName => fileName === INJECTOR_LIKE_FILE,
        });

        assert.equal(result.success, false);
        assert.equal(fs.existsSync(outputFile), false);
        if (!result.success) {
            assert.ok(result.diagnostics.length > 0);
        }
        cleanOutput();
    });

    it("recognizes classes/params decorated via an additional decorator source", () => {
        cleanOutput();
        const outputFile = path.join(OUTPUT_DIR, "additional.generated.ts");

        const result = compile({
            project: path.join(FIXTURES_DIR, "tsconfig.additional.json"),
            outputFile,
            matchInjectorModule: fileName => fileName === INJECTOR_LIKE_FILE,
            additionalInjectableDecorators: [{moduleSpecifier: "nodeboot-like", exportName: "Component"}],
            additionalInjectDecorators: [{moduleSpecifier: "nodeboot-like", exportName: "Inject"}],
        });

        assert.equal(result.success, true);
        if (result.success) {
            assert.equal(result.classCount, 1);
            const contents = fs.readFileSync(result.outputFile, "utf-8");
            assert.match(contents, /defineDependencies\(AdditionalSourceConsumer, \[[\s\S]*LOGGER[\s\S]*\]\);/);
        }
        cleanOutput();
    });
});
