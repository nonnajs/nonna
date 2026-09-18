import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";
import {AsyncProviderError, CircularDependencyError} from "../src/errors";
import {defineDependencies} from "../src/metadata";

describe("Injector scopes", () => {
    it("singleton scope returns the exact same instance across get() calls", () => {
        class Database {}
        const injector = Injector.create();
        injector.register({provide: Database, useClass: Database});

        assert.equal(injector.get(Database), injector.get(Database));
    });

    it("transient scope returns a new instance on every get() call", () => {
        class RequestHandler {}
        const injector = Injector.create();
        injector.register({provide: RequestHandler, useClass: RequestHandler, scope: "transient"});

        assert.notEqual(injector.get(RequestHandler), injector.get(RequestHandler));
    });

    it("wires constructor dependencies declared via defineDependencies", () => {
        class UserRepository {}
        class UserService {
            constructor(public repository: UserRepository) {}
        }
        defineDependencies(UserService, [{token: UserRepository}]);

        const injector = Injector.create();
        injector.register({provide: UserRepository, useClass: UserRepository});
        injector.register({provide: UserService, useClass: UserService});

        const service = injector.get(UserService);
        assert.ok(service.repository instanceof UserRepository);
    });

    it("detects circular dependencies and reports the full chain", () => {
        class A {}
        class B {}
        class C {}
        defineDependencies(A, [{token: B}]);
        defineDependencies(B, [{token: C}]);
        defineDependencies(C, [{token: A}]);

        const injector = Injector.create();
        injector.register({provide: A, useClass: A});
        injector.register({provide: B, useClass: B});
        injector.register({provide: C, useClass: C});

        assert.throws(
            () => injector.get(A),
            (error: unknown) => {
                assert.ok(error instanceof CircularDependencyError);
                assert.match(error.message, /A.*→.*B.*→.*C.*→.*A/);
                return true;
            },
        );
    });

    it("throws AsyncProviderError from sync get() when the provider is async", () => {
        const DATABASE = Symbol("DATABASE");
        const injector = Injector.create();
        injector.register({provide: DATABASE, useFactory: async () => ({connected: true}), async: true});

        assert.throws(() => injector.get(DATABASE), AsyncProviderError);
    });

    it("auto-detects an async-keyword factory without an explicit async flag", () => {
        const DATABASE = Symbol("DATABASE");
        const injector = Injector.create();
        injector.register({provide: DATABASE, useFactory: async () => ({connected: true})});

        assert.throws(() => injector.get(DATABASE), AsyncProviderError);
    });
});
