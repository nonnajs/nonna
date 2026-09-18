import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {findInjectableClasses, getConstructorParameters} from "../src/scanner";
import {createDiagnostic, formatDiagnostics, UNRESOLVED_DEPENDENCY_CODE} from "../src/diagnostics";
import {createFixtureProgram, fixturePath} from "./helpers";

describe("diagnostics", () => {
    it("creates a diagnostic anchored at the parameter's source location", () => {
        const {program, checker, symbols} = createFixtureProgram([fixturePath("app/unresolved-interface.ts")]);
        const classes = findInjectableClasses(program, checker, symbols);
        const target = classes.find(c => c.declaration.name!.text === "BrokenConsumer")!;
        const [param] = getConstructorParameters(target.declaration);

        const diagnostic = createDiagnostic(param!, "Cannot resolve DI token for parameter 'logger'.");
        assert.equal(diagnostic.code, UNRESOLVED_DEPENDENCY_CODE);
        assert.equal(diagnostic.file, target.sourceFile);
        assert.ok(diagnostic.start >= 0);
        assert.ok(diagnostic.length > 0);
    });

    it("formats diagnostics with source context and no throw", () => {
        const {program, checker, symbols} = createFixtureProgram([fixturePath("app/unresolved-interface.ts")]);
        const classes = findInjectableClasses(program, checker, symbols);
        const target = classes.find(c => c.declaration.name!.text === "BrokenConsumer")!;
        const [param] = getConstructorParameters(target.declaration);

        const diagnostic = createDiagnostic(param!, "Cannot resolve DI token for parameter 'logger'.");
        const formatted = formatDiagnostics([diagnostic]);
        assert.match(formatted, /Cannot resolve DI token/);
    });
});
