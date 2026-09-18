import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";
import {defineDependencies} from "../src/metadata";

describe("Hot path: no rebuild on cached singleton resolution", () => {
    it("never re-invokes the constructor once a singleton is cached, across many get() calls", () => {
        let constructions = 0;
        class Database {
            constructor() {
                constructions++;
            }
        }

        const injector = Injector.create();
        injector.register({provide: Database, useClass: Database});

        const first = injector.get(Database);
        for (let i = 0; i < 1000; i++) {
            assert.equal(injector.get(Database), first);
        }
        assert.equal(constructions, 1, "constructor must run exactly once regardless of resolution count");
    });

    it("a singleton with dependencies is only ever constructed once, proving dependency resolution isn't repeated on cache hits", () => {
        let loggerConstructions = 0;
        let serviceConstructions = 0;

        class Logger {
            constructor() {
                loggerConstructions++;
            }
        }
        class UserService {
            constructor(public logger: Logger) {
                serviceConstructions++;
            }
        }
        defineDependencies(UserService, [{token: Logger}]);

        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});
        injector.register({provide: UserService, useClass: UserService});

        for (let i = 0; i < 500; i++) {
            injector.get(UserService);
        }
        assert.equal(loggerConstructions, 1);
        assert.equal(serviceConstructions, 1);
    });

    it("transient resolution constructs exactly once per get() call, with no shared cache", () => {
        let constructions = 0;
        class RequestHandler {
            constructor() {
                constructions++;
            }
        }

        const injector = Injector.create();
        injector.register({provide: RequestHandler, useClass: RequestHandler, scope: "transient"});

        for (let i = 0; i < 200; i++) {
            injector.get(RequestHandler);
        }
        assert.equal(constructions, 200);
    });
});
