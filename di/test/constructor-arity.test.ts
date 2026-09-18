import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injectable} from "../src/decorators";
import {countConstructorParams} from "../src/metadata";
import {Injector} from "../src/injector";
import {InvalidProviderError} from "../src/errors";

describe("countConstructorParams()", () => {
    it("counts plain required parameters (matches Function.prototype.length)", () => {
        class Service {
            constructor(_a: unknown, _b: unknown) {}
        }
        assert.equal(countConstructorParams(Service), 2);
    });

    it("counts a trailing parameter with a default value, unlike Function.prototype.length", () => {
        class Cache {}
        class Service {
            constructor(_a: unknown, _b: unknown = new Cache()) {}
        }
        // Function.prototype.length would report 1 here - the bug this function fixes.
        assert.equal(Service.length, 1);
        assert.equal(countConstructorParams(Service), 2);
    });

    it("counts multiple defaulted parameters, including ones whose default contains commas", () => {
        class Service {
            constructor(_a: unknown = {x: 1, y: 2}, _b: unknown = [1, 2, 3], _c: unknown = "no,commas,here") {}
        }
        assert.equal(countConstructorParams(Service), 3);
    });

    it("counts a destructured parameter as a single parameter", () => {
        class Service {
            constructor(_config: {a: unknown; b: unknown}) {}
        }
        assert.equal(countConstructorParams(Service), 1);
    });

    it("falls back to Function.prototype.length when there is no explicit constructor", () => {
        class Base {
            constructor(public a: unknown, public b: unknown) {}
        }
        class Derived extends Base {}
        assert.equal(countConstructorParams(Derived), Derived.length);
    });

    it("returns 0 for a class with no parameters", () => {
        class Service {
            constructor() {}
        }
        assert.equal(countConstructorParams(Service), 0);
    });
});

describe("@Injectable() padding uses the fixed arity count", () => {
    it("pads a defaulted trailing constructor parameter into an UNRESOLVED slot instead of silently dropping it", () => {
        class Cache {}

        @Injectable()
        class Service {
            constructor(public repo: unknown, public cache: unknown = new Cache()) {}
        }

        const injector = Injector.create();
        injector.register({provide: Service, useClass: Service});

        // Both parameters are UNRESOLVED (no @Inject/@Optional, no AOT) - get() must report the
        // clear "unresolved dependency" error for the class, not silently construct it with only
        // one (or zero) injected arguments.
        assert.throws(() => injector.get(Service), InvalidProviderError);
    });
});
