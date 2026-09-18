import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";
import {AsyncProviderError} from "../src/errors";
import {defineDependencies} from "../src/metadata";

describe("OnInit lifecycle hook", () => {
    it("calls onInit() once, synchronously, right after a singleton is constructed via get()", () => {
        const order: string[] = [];
        class Database {
            constructor() {
                order.push("constructed");
            }
            onInit() {
                order.push("initialized");
            }
        }

        const injector = Injector.create();
        injector.register({provide: Database, useClass: Database});
        injector.get(Database);
        injector.get(Database);

        assert.deepEqual(order, ["constructed", "initialized"]);
    });

    it("calls onInit() on every instance for transient providers", () => {
        let inits = 0;
        class Handler {
            onInit() {
                inits++;
            }
        }

        const injector = Injector.create();
        injector.register({provide: Handler, useClass: Handler, scope: "transient"});
        injector.get(Handler);
        injector.get(Handler);
        injector.get(Handler);

        assert.equal(inits, 3);
    });

    it("ignores instances without onInit()", () => {
        class Plain {}
        const injector = Injector.create();
        injector.register({provide: Plain, useClass: Plain});

        assert.doesNotThrow(() => injector.get(Plain));
    });

    it("awaits async onInit() via getAsync()", async () => {
        const order: string[] = [];
        class RedisService {
            async onInit() {
                await new Promise(resolve => setTimeout(resolve, 1));
                order.push("initialized");
            }
        }

        const injector = Injector.create();
        injector.register({provide: RedisService, useClass: RedisService});

        await injector.getAsync(RedisService);
        assert.deepEqual(order, ["initialized"]);
    });

    it("throws AsyncProviderError from sync get() when onInit() is async, without ever constructing the instance", () => {
        let constructed = false;
        class RedisService {
            constructor() {
                constructed = true;
            }
            async onInit() {
                /* never reached */
            }
        }

        const injector = Injector.create();
        injector.register({provide: RedisService, useClass: RedisService});

        assert.throws(() => injector.get(RedisService), AsyncProviderError);
        assert.equal(constructed, false, "constructor must not run when onInit() is statically known to be async");
    });

    it("eager providers are pre-warmed (onInit run) during initialize()", async () => {
        const order: string[] = [];
        class AppInitService {
            onInit() {
                order.push("initialized");
            }
        }

        const injector = Injector.create();
        injector.register({provide: AppInitService, useClass: AppInitService, eager: true});

        await injector.initialize();
        assert.deepEqual(order, ["initialized"]);
    });

    it("runs onInit() for a resolved dependency chain in construction order", () => {
        const order: string[] = [];
        class Logger {
            onInit() {
                order.push("Logger");
            }
        }
        class UserService {
            constructor(public logger: Logger) {}
            onInit() {
                order.push("UserService");
            }
        }
        defineDependencies(UserService, [{token: Logger}]);

        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});
        injector.register({provide: UserService, useClass: UserService});
        injector.get(UserService);

        assert.deepEqual(order, ["Logger", "UserService"]);
    });
});
