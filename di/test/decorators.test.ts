import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injectable, Inject, Optional, Service} from "../src/decorators";
import {Injector} from "../src/injector";
import {InvalidProviderError} from "../src/errors";
import {defineDependencies, getDependencies} from "../src/metadata";
import {clearGlobalRegistry, getGlobalRegistrations} from "../src/registry";

describe("Decorators", () => {
    it("@Injectable() registers the class in the global registry", () => {
        @Injectable()
        class Widget {}

        const registrations = getGlobalRegistrations();
        assert.ok(registrations.some(r => r.target === Widget && r.scope === "singleton"));
    });

    it("@Service() behaves as an exact alias of @Injectable()", () => {
        assert.equal(Service, Injectable);
    });

    it("@Inject(token) pins an explicit token, overriding the unresolved default", () => {
        const LOGGER = Symbol("LOGGER");

        @Injectable()
        class UserService {
            constructor(@Inject(LOGGER) public logger: unknown) {}
        }

        assert.deepEqual(getDependencies(UserService), [{token: LOGGER, optional: false}]);
    });

    it("@Optional() with no token stays unresolved-but-optional until AOT overrides it", () => {
        @Injectable()
        class UserService {
            constructor(@Optional() public metrics?: unknown) {}
        }

        const injector = Injector.create();
        injector.register({provide: UserService, useClass: UserService});
        const service = injector.get(UserService);
        assert.equal(service.metrics, undefined);
    });

    it("@Optional(token) resolves the token when registered, undefined when missing", () => {
        const METRICS = Symbol("METRICS");

        @Injectable()
        class UserService {
            constructor(@Optional(METRICS) public metrics?: unknown) {}
        }

        const injectorWithout = Injector.create();
        injectorWithout.register({provide: UserService, useClass: UserService});
        assert.equal(injectorWithout.get(UserService).metrics, undefined);

        const injectorWith = Injector.create();
        injectorWith.registerValue(METRICS, {enabled: true});
        injectorWith.register({provide: UserService, useClass: UserService});
        assert.deepEqual(injectorWith.get(UserService).metrics, {enabled: true});
    });

    it("a required, unresolved (no @Inject, no AOT) constructor dependency throws a clear error at get()", () => {
        class UserRepository {}

        @Injectable()
        class UserService {
            constructor(public repository: UserRepository) {}
        }

        const injector = Injector.create();
        injector.register({provide: UserRepository, useClass: UserRepository});
        injector.register({provide: UserService, useClass: UserService});

        assert.throws(() => injector.get(UserService), InvalidProviderError);
    });

    it("AOT-style defineDependencies() overrides the decorator-finalized unresolved entry", () => {
        class UserRepository {}

        @Injectable()
        class UserService {
            constructor(public repository: UserRepository) {}
        }

        // Simulates the AOT compiler running after decorators and overwriting the metadata.
        defineDependencies(UserService, [{token: UserRepository}]);

        const injector = Injector.create();
        injector.register({provide: UserRepository, useClass: UserRepository});
        injector.register({provide: UserService, useClass: UserService});

        assert.ok(injector.get(UserService).repository instanceof UserRepository);
    });

    it("clearGlobalRegistry() is a test-isolation helper only, never called by the Injector itself", () => {
        clearGlobalRegistry();
        assert.deepEqual(getGlobalRegistrations(), []);
    });
});
