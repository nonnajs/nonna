import {describe, it} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {findInjectableClasses, getConstructorParameters, resolveParameter} from "../src";
import {createFixtureProgram, fixturePath} from "./helpers";

function resolveFirstParam(fixtureFile: string, className: string) {
    const {program, checker, symbols} = createFixtureProgram([fixturePath(fixtureFile)]);
    const classes = findInjectableClasses(program, checker, symbols);
    const target = classes.find(c => c.declaration.name!.text === className)!;
    const [param] = getConstructorParameters(target.declaration);
    return resolveParameter(checker, param!, symbols, path.dirname(fixturePath(fixtureFile)));
}

describe("resolver decision tree", () => {
    it("infers a concrete class with no decorator", () => {
        const result = resolveFirstParam("app/concrete.ts", "UserService");
        assert.equal(result.kind, "resolved");
        if (result.kind === "resolved") {
            assert.equal(result.dependency.optional, false);
            assert.deepEqual(result.dependency.token, {
                kind: "import",
                moduleSpecifier: "./concrete",
                exportName: "UserRepository",
            });
        }
    });

    it("infers an abstract class with no decorator", () => {
        const result = resolveFirstParam("app/abstract.ts", "AbstractConsumer");
        assert.equal(result.kind, "resolved");
        if (result.kind === "resolved") {
            assert.deepEqual(result.dependency.token, {
                kind: "import",
                moduleSpecifier: "./abstract",
                exportName: "Logger",
            });
        }
    });

    it("an explicit @Inject(token) wins over inference, even on an interface type", () => {
        const result = resolveFirstParam("app/explicit-token.ts", "ExplicitTokenConsumer");
        assert.equal(result.kind, "resolved");
        if (result.kind === "resolved") {
            assert.equal(result.dependency.optional, false);
            assert.deepEqual(result.dependency.token, {
                kind: "import",
                moduleSpecifier: "./explicit-token",
                exportName: "LOGGER",
            });
        }
    });

    it("rejects an un-decorated interface parameter", () => {
        const result = resolveFirstParam("app/unresolved-interface.ts", "BrokenConsumer");
        assert.equal(result.kind, "error");
        if (result.kind === "error") {
            assert.match(result.error.message, /interface/);
            assert.match(result.error.message, /@Inject/);
        }
    });

    it("a same-named Inject from a different module does not count as explicit, and inference then fails on the interface", () => {
        const result = resolveFirstParam("app/collision.ts", "CollisionConsumer");
        assert.equal(result.kind, "error");
    });

    it("rejects a generic class instantiation instead of silently inferring the raw generic", () => {
        const result = resolveFirstParam("app/generic.ts", "GenericConsumer");
        assert.equal(result.kind, "error");
        if (result.kind === "error") {
            assert.match(result.error.message, /generic/);
        }
    });

    it("@Optional() with no token stays optional and infers the concrete class", () => {
        const result = resolveFirstParam("app/optional.ts", "OptionalNoTokenConsumer");
        assert.equal(result.kind, "resolved");
        if (result.kind === "resolved") {
            assert.equal(result.dependency.optional, true);
            assert.deepEqual(result.dependency.token, {
                kind: "import",
                moduleSpecifier: "./optional",
                exportName: "Metrics",
            });
        }
    });

    it("@Optional(token) resolves the explicit token and stays optional", () => {
        const result = resolveFirstParam("app/optional.ts", "OptionalWithTokenConsumer");
        assert.equal(result.kind, "resolved");
        if (result.kind === "resolved") {
            assert.equal(result.dependency.optional, true);
            assert.deepEqual(result.dependency.token, {
                kind: "import",
                moduleSpecifier: "./optional",
                exportName: "METRICS_TOKEN",
            });
        }
    });

    it("supports a string literal token", () => {
        const result = resolveFirstParam("app/string-literal.ts", "StringTokenConsumer");
        assert.equal(result.kind, "resolved");
        if (result.kind === "resolved") {
            assert.deepEqual(result.dependency.token, {kind: "literal", value: "some-string-token"});
        }
    });
});
