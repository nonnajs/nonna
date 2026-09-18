import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";

describe("initialize() runs independent eager providers concurrently", () => {
    it("two unrelated eager async factories overlap in time instead of running strictly sequentially", async () => {
        const DB_POOL = Symbol("DB_POOL");
        const REDIS_CLIENT = Symbol("REDIS_CLIENT");
        const DELAY_MS = 30;

        const injector = Injector.create();
        injector.register({
            provide: DB_POOL,
            useFactory: async () => {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                return {kind: "db"};
            },
            async: true,
            eager: true,
        });
        injector.register({
            provide: REDIS_CLIENT,
            useFactory: async () => {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                return {kind: "redis"};
            },
            async: true,
            eager: true,
        });

        const start = Date.now();
        await injector.initialize();
        const elapsed = Date.now() - start;

        // Sequential execution would take >= 2 * DELAY_MS; concurrent execution should finish in
        // roughly one DELAY_MS window. Generous margin to keep this robust under CI jitter.
        assert.ok(elapsed < DELAY_MS * 2, `expected concurrent init (~${DELAY_MS}ms), took ${elapsed}ms`);
        assert.deepEqual(injector.get(DB_POOL), {kind: "db"});
        assert.deepEqual(injector.get(REDIS_CLIENT), {kind: "redis"});
    });

    it("an eager provider shared by two other eager providers is only constructed once", async () => {
        const CONFIG = Symbol("CONFIG");
        let configBuilds = 0;

        const injector = Injector.create();
        injector.register({
            provide: CONFIG,
            useFactory: async () => {
                configBuilds++;
                await new Promise(resolve => setTimeout(resolve, 5));
                return {port: 8080};
            },
            async: true,
        });

        class ServiceA {
            static deps = [CONFIG];
        }
        class ServiceB {
            static deps = [CONFIG];
        }
        const {defineDependencies} = await import("../src/metadata");
        defineDependencies(ServiceA, [{token: CONFIG}]);
        defineDependencies(ServiceB, [{token: CONFIG}]);

        injector.register({provide: ServiceA, useClass: ServiceA, eager: true});
        injector.register({provide: ServiceB, useClass: ServiceB, eager: true});

        await injector.initialize();
        assert.equal(configBuilds, 1);
    });
});
