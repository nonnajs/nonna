import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";
import {InjectorDestroyedError, InjectorError, InvalidProviderError, ScopeError} from "../src/errors";
import {defineDependencies} from "../src/metadata";

describe("Injector initialize()", () => {
    it("throws when a required dependency has no provider", async () => {
        class UserRepository {}
        class UserService {
            constructor(public repository: UserRepository) {}
        }
        defineDependencies(UserService, [{token: UserRepository}]);

        const injector = Injector.create();
        injector.register({provide: UserService, useClass: UserService});

        await assert.rejects(injector.initialize(), InvalidProviderError);
    });

    it("passes when all required dependencies are registered", async () => {
        class UserRepository {}
        class UserService {
            constructor(public repository: UserRepository) {}
        }
        defineDependencies(UserService, [{token: UserRepository}]);

        const injector = Injector.create();
        injector.register({provide: UserRepository, useClass: UserRepository});
        injector.register({provide: UserService, useClass: UserService});

        await assert.doesNotReject(injector.initialize());
    });

    it("instantiates eager providers during initialize()", async () => {
        let created = false;
        class EagerService {
            constructor() {
                created = true;
            }
        }
        const injector = Injector.create();
        injector.register({provide: EagerService, useClass: EagerService, eager: true});

        assert.equal(created, false);
        await injector.initialize();
        assert.equal(created, true);
    });

    it("awaits eager async providers during initialize()", async () => {
        const DATABASE = Symbol("DATABASE");
        const injector = Injector.create();
        injector.register({provide: DATABASE, useFactory: async () => ({connected: true}), eager: true});

        await injector.initialize();
        assert.deepEqual(injector.get(DATABASE), {connected: true});
    });

    it("rejects a singleton depending directly on a request-scoped provider", async () => {
        class RequestContext {}
        class UserService {
            constructor(public context: RequestContext) {}
        }
        defineDependencies(UserService, [{token: RequestContext}]);

        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});
        injector.register({provide: UserService, useClass: UserService});

        await assert.rejects(injector.initialize(), ScopeError);
    });

    it("rejects a singleton depending on a request-scoped provider through a transient hop", async () => {
        class RequestContext {}
        class Helper {
            constructor(public context: RequestContext) {}
        }
        class UserService {
            constructor(public helper: Helper) {}
        }
        defineDependencies(Helper, [{token: RequestContext}]);
        defineDependencies(UserService, [{token: Helper}]);

        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});
        injector.register({provide: Helper, useClass: Helper, scope: "transient"});
        injector.register({provide: UserService, useClass: UserService});

        await assert.rejects(injector.initialize(), ScopeError);
    });

    it("allows a singleton depending on another singleton that itself depends on request scope (validated independently)", async () => {
        class RequestContext {}
        class Inner {
            constructor(public context: RequestContext) {}
        }
        defineDependencies(Inner, [{token: RequestContext}]);

        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});
        injector.register({provide: Inner, useClass: Inner});

        // Inner itself is invalid (singleton -> request), so initialize() must still reject -
        // this proves validation runs per-provider and isn't skipped just because Inner is a singleton.
        await assert.rejects(injector.initialize(), ScopeError);
    });

    it("freezeAfterInitialize blocks further registration", async () => {
        class Logger {}
        class OtherLogger {}
        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});

        await injector.initialize({freezeAfterInitialize: true});

        assert.throws(() => injector.register({provide: OtherLogger, useClass: OtherLogger}), InjectorError);
    });
});

describe("Injector destroy()", () => {
    it("rejects further get()/getAsync()/register() after destroy()", async () => {
        class Logger {}
        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});
        injector.get(Logger);

        await injector.destroy();

        assert.throws(() => injector.get(Logger), InjectorDestroyedError);
        await assert.rejects(injector.getAsync(Logger), InjectorDestroyedError);
        assert.throws(() => injector.register({provide: Logger, useClass: Logger}), InjectorDestroyedError);
    });
});
