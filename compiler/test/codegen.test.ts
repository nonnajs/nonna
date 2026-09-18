import {describe, it} from "node:test";
import assert from "node:assert/strict";

import type {AggregatorEntry} from "../src";
import {generateAggregatorSource} from "../src";

describe("codegen", () => {
    it("emits imports plus defineDependencies() calls, nothing else", () => {
        const entries: AggregatorEntry[] = [
            {
                classImport: {kind: "import", moduleSpecifier: "./services/UserService", exportName: "UserService"},
                dependencies: [
                    {
                        token: {
                            kind: "import",
                            moduleSpecifier: "./repos/UserRepository",
                            exportName: "UserRepository",
                        },
                        optional: false,
                    },
                ],
            },
        ];

        const source = generateAggregatorSource(entries, "@nonna/di");

        assert.match(source, /AUTO-GENERATED/);
        assert.match(source, /import \{ ?defineDependencies ?\} from "@nonna\/di";/);
        assert.match(source, /import \{ ?UserService ?\} from "\.\/services\/UserService";/);
        assert.match(source, /import \{ ?UserRepository ?\} from "\.\/repos\/UserRepository";/);
        assert.match(source, /defineDependencies\(UserService, \[[\s\S]*UserRepository[\s\S]*\]\);/);
        assert.doesNotMatch(source, /export /);
    });

    it("wraps optional dependencies in {token, optional: true}", () => {
        const entries: AggregatorEntry[] = [
            {
                classImport: {kind: "import", moduleSpecifier: "./UserService", exportName: "UserService"},
                dependencies: [
                    {token: {kind: "import", moduleSpecifier: "./Metrics", exportName: "Metrics"}, optional: true},
                ],
            },
        ];

        const source = generateAggregatorSource(entries, "@nonna/di");
        assert.match(
            source,
            /defineDependencies\(UserService, \[[\s\S]*\{ ?token: Metrics, ?optional: true ?\}[\s\S]*\]\);/,
        );
    });

    it("aliases colliding local names from different modules", () => {
        const entries: AggregatorEntry[] = [
            {
                classImport: {kind: "import", moduleSpecifier: "./a/Repository", exportName: "Repository"},
                dependencies: [],
            },
            {
                classImport: {kind: "import", moduleSpecifier: "./b/Repository", exportName: "Repository"},
                dependencies: [],
            },
        ];

        const source = generateAggregatorSource(entries, "@nonna/di");
        assert.match(source, /import \{ ?Repository ?\} from "\.\/a\/Repository";/);
        assert.match(source, /import \{ ?Repository as Repository_1 ?\} from "\.\/b\/Repository";/);
        assert.match(source, /defineDependencies\(Repository, \[\]\);/);
        assert.match(source, /defineDependencies\(Repository_1, \[\]\);/);
    });

    it("supports literal string tokens", () => {
        const entries: AggregatorEntry[] = [
            {
                classImport: {kind: "import", moduleSpecifier: "./UserService", exportName: "UserService"},
                dependencies: [{token: {kind: "literal", value: "some-token"}, optional: false}],
            },
        ];

        const source = generateAggregatorSource(entries, "@nonna/di");
        assert.match(source, /defineDependencies\(UserService, \[[\s\S]*"some-token"[\s\S]*\]\);/);
    });
});
