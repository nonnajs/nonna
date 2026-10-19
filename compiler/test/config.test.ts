import {describe, it} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {compileOptionsFromConfig, loadNonnaConfig, mergeNonnaConfigs, parseDecoratorSource} from "../src/config";

function writeJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
}

describe("parseDecoratorSource", () => {
    it("parses a <module>#<export> spec, including scoped packages", () => {
        assert.deepEqual(parseDecoratorSource("@scope/core#Component"), {
            moduleSpecifier: "@scope/core",
            exportName: "Component",
        });
    });

    it("rejects malformed specs", () => {
        assert.throws(() => parseDecoratorSource("Component"), /expected "<module>#<exportName>"/);
        assert.throws(() => parseDecoratorSource("#Component"), /expected/);
        assert.throws(() => parseDecoratorSource("pkg#"), /expected/);
    });
});

describe("mergeNonnaConfigs / compileOptionsFromConfig", () => {
    it("concatenates and de-duplicates decorator lists, and lets a later defineDependenciesModule win", () => {
        const merged = mergeNonnaConfigs([
            {injectableDecorators: ["a#B", "a#C"], defineDependenciesModule: "first"},
            {injectableDecorators: ["a#B"], injectDecorators: ["c#D"], defineDependenciesModule: "second"},
        ]);
        assert.deepEqual(merged.injectableDecorators, ["a#B", "a#C"]);
        assert.deepEqual(merged.injectDecorators, ["c#D"]);
        assert.equal(merged.defineDependenciesModule, "second");
    });

    it("maps a config into compile() options, defaulting to empty lists and no import override", () => {
        assert.deepEqual(compileOptionsFromConfig(undefined), {
            additionalInjectableDecorators: [],
            additionalInjectDecorators: [],
            additionalOptionalDecorators: [],
        });
        const mapped = compileOptionsFromConfig({injectableDecorators: ["a#B"], defineDependenciesModule: "fw"});
        assert.deepEqual(mapped.additionalInjectableDecorators, [{moduleSpecifier: "a", exportName: "B"}]);
        assert.equal(mapped.generatedImportSpecifier, "fw");
    });
});

describe("loadNonnaConfig", () => {
    function project(): string {
        return fs.mkdtempSync(path.join(os.tmpdir(), "nonna-config-"));
    }

    it("is empty when there is no package.json and no .nonna.json", () => {
        const dir = project();
        try {
            assert.deepEqual(loadNonnaConfig(dir), mergeNonnaConfigs([]));
        } finally {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("picks up the .nonna.json shipped by dependencies (declared in any section), then the project's own", () => {
        const dir = project();
        try {
            writeJson(path.join(dir, "package.json"), {
                dependencies: {"@fw/di": "1.0.0"},
                devDependencies: {"@fw/core": "1.0.0", "no-config": "1.0.0"},
            });
            writeJson(path.join(dir, "node_modules/@fw/di/.nonna.json"), {
                injectDecorators: ["@fw/di#Inject"],
                defineDependenciesModule: "@fw/di",
            });
            writeJson(path.join(dir, "node_modules/@fw/core/.nonna.json"), {
                injectableDecorators: ["@fw/core#Service"],
            });
            writeJson(path.join(dir, "node_modules/no-config/package.json"), {name: "no-config"});
            writeJson(path.join(dir, ".nonna.json"), {injectableDecorators: ["./local#Thing"]});

            const config = loadNonnaConfig(dir);
            assert.deepEqual(config.injectDecorators, ["@fw/di#Inject"]);
            assert.deepEqual(config.injectableDecorators, ["@fw/core#Service", "./local#Thing"]);
            assert.equal(config.defineDependenciesModule, "@fw/di");
        } finally {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("finds dependencies hoisted into a parent node_modules", () => {
        const root = project();
        try {
            const app = path.join(root, "apps", "app");
            writeJson(path.join(app, "package.json"), {dependencies: {"@fw/core": "1.0.0"}});
            writeJson(path.join(root, "node_modules/@fw/core/.nonna.json"), {
                injectableDecorators: ["@fw/core#Service"],
            });
            assert.deepEqual(loadNonnaConfig(app).injectableDecorators, ["@fw/core#Service"]);
        } finally {
            fs.rmSync(root, {recursive: true, force: true});
        }
    });

    it("reports an unparsable .nonna.json", () => {
        const dir = project();
        try {
            writeJson(path.join(dir, ".nonna.json"), "{not json");
            assert.throws(() => loadNonnaConfig(dir), /Could not parse/);
        } finally {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });
});
