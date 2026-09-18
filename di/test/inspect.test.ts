import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";
import {defineDependencies} from "../src/metadata";

describe("Injector.inspect()", () => {
    it("returns undefined for an unregistered token", () => {
        class Widget {}
        const injector = Injector.create();
        assert.equal(injector.inspect(Widget), undefined);
    });

    it("describes a class provider's scope, dependencies, and instantiation state", () => {
        const LOGGER = Symbol("LOGGER");
        class UserRepository {}
        class UserService {
            constructor(public repository: UserRepository, public logger: unknown) {}
        }
        defineDependencies(UserService, [{token: UserRepository}, {token: LOGGER}]);

        const injector = Injector.create();
        injector.registerValue(LOGGER, {log: () => {}});
        injector.register({provide: UserRepository, useClass: UserRepository});
        injector.register({provide: UserService, useClass: UserService});

        const before = injector.inspect(UserService)!;
        assert.equal(before.scope, "singleton");
        assert.equal(before.kind, "class");
        assert.equal(before.multi, false);
        assert.equal(before.eager, false);
        assert.equal(before.isAsync, false);
        assert.deepEqual(before.dependencies, [UserRepository, LOGGER]);
        assert.equal(before.instantiated, false);

        injector.get(UserService);
        assert.equal(injector.inspect(UserService)!.instantiated, true);
    });

    it("inspectAll() returns one entry per registration for a multi-provider token", () => {
        const MIDDLEWARE = Symbol("MIDDLEWARE");
        class AuthMiddleware {}
        class LoggingMiddleware {}
        const injector = Injector.create();
        injector.register({provide: MIDDLEWARE, useClass: AuthMiddleware, multi: true});
        injector.register({provide: MIDDLEWARE, useClass: LoggingMiddleware, multi: true});

        const all = injector.inspectAll(MIDDLEWARE);
        assert.equal(all.length, 2);
        assert.ok(all.every(entry => entry.multi));
    });
});
