import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {findInjectableClasses, findParameterDecorator, getConstructorParameters} from "../src/scanner";
import {createFixtureProgram, createFixtureProgramWithAdditionalSources, fixturePath} from "./helpers";

describe("scanner", () => {
    it("finds classes decorated with the real @Injectable() from injector-like", () => {
        const {program, checker, symbols} = createFixtureProgram([fixturePath("app/concrete.ts")]);
        const classes = findInjectableClasses(program, checker, symbols);
        const names = classes.map(c => c.declaration.name!.text);

        assert.ok(names.includes("UserRepository"));
        assert.ok(names.includes("UserService"));
    });

    it("does not mistake other libraries' Inject for @nonnajs/di's Inject", () => {
        const {program, checker, symbols} = createFixtureProgram([fixturePath("app/collision.ts")]);
        const classes = findInjectableClasses(program, checker, symbols);
        const consumer = classes.find(c => c.declaration.name!.text === "CollisionConsumer")!;
        const [param] = getConstructorParameters(consumer.declaration);

        const decorator = findParameterDecorator(checker, param!, symbols);
        assert.equal(decorator, undefined, "the fake-di Inject must not resolve as our Inject/Optional");
    });

    it("recognizes @Inject()/@Optional() applied via injector-like by symbol identity", () => {
        const {program, checker, symbols} = createFixtureProgram([fixturePath("app/explicit-token.ts")]);
        const classes = findInjectableClasses(program, checker, symbols);
        const consumer = classes.find(c => c.declaration.name!.text === "ExplicitTokenConsumer")!;
        const [param] = getConstructorParameters(consumer.declaration);

        const decorator = findParameterDecorator(checker, param!, symbols);
        assert.equal(decorator?.kind, "inject");
    });

    it("does not recognize a class decorated with @Component() from a source it wasn't told about", () => {
        const {program, checker, symbols} = createFixtureProgram([fixturePath("app/additional-source.ts")]);
        const classes = findInjectableClasses(program, checker, symbols);
        assert.equal(
            classes.find(c => c.declaration.name!.text === "AdditionalSourceConsumer"),
            undefined,
        );
    });

    it("recognizes @Component()/@Inject() from an additional decorator source", () => {
        const {program, checker, symbols} = createFixtureProgramWithAdditionalSources([
            fixturePath("app/additional-source.ts"),
        ]);
        const classes = findInjectableClasses(program, checker, symbols);
        const consumer = classes.find(c => c.declaration.name!.text === "AdditionalSourceConsumer");
        assert.ok(consumer, "AdditionalSourceConsumer must be recognized once nodeboot-like is an additional source");

        const [param] = getConstructorParameters(consumer!.declaration);
        const decorator = findParameterDecorator(checker, param!, symbols);
        assert.equal(decorator?.kind, "inject");
    });
});
