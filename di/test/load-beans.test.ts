import {describe, it} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {Injector} from "../src/injector";
import {BeanManifestError} from "../src/errors";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures/beans");

describe("Injector.loadBeans()", () => {
    it("imports each module path directly and refreshes the registry", async () => {
        const injector = Injector.create();
        const modulePath = path.join(FIXTURES_DIR, "plain-widget.js");

        await injector.loadBeans([modulePath]);

        const {PlainWidget} = require(modulePath);
        assert.ok(injector.has(PlainWidget));
        assert.ok(injector.get(PlainWidget) instanceof PlainWidget);
    });

    it("reads a JSON manifest file, resolving entries relative to its directory", async () => {
        const injector = Injector.create();
        const manifestPath = path.join(FIXTURES_DIR, "manifest.json");

        await injector.loadBeans(manifestPath);

        const {PlainWidget} = require(path.join(FIXTURES_DIR, "plain-widget.js"));
        assert.ok(injector.get(PlainWidget) instanceof PlainWidget);
    });

    it("wraps a missing module path in BeanManifestError", async () => {
        const injector = Injector.create();
        await assert.rejects(injector.loadBeans(["/nonexistent/path/to/module.js"]), BeanManifestError);
    });

    it("wraps a missing manifest file in BeanManifestError", async () => {
        const injector = Injector.create();
        await assert.rejects(injector.loadBeans("/nonexistent/manifest.json"), BeanManifestError);
    });

    it("rejects a manifest that isn't a JSON array of strings", async () => {
        const injector = Injector.create();
        const badManifest = path.join(FIXTURES_DIR, "bad-manifest.json");
        await assert.rejects(injector.loadBeans(badManifest), BeanManifestError);
    });
});
