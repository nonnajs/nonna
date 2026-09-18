import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";

describe("Injector async resolution", () => {
    it("resolves an async factory via getAsync()", async () => {
        const DATABASE = Symbol("DATABASE");
        const injector = Injector.create();
        injector.register({provide: DATABASE, useFactory: async () => ({connected: true})});

        assert.deepEqual(await injector.getAsync(DATABASE), {connected: true});
    });

    it("resolves a chain of async and sync dependencies via getAsync()", async () => {
        const CONFIG = Symbol("CONFIG");
        const DATABASE = Symbol("DATABASE");
        class Repository {
            constructor(public db: unknown) {}
        }
        const {defineDependencies} = await import("../src/metadata");
        defineDependencies(Repository, [{token: DATABASE}]);

        const injector = Injector.create();
        injector.registerValue(CONFIG, {url: "postgres://localhost"});
        injector.registerFactory(DATABASE, [CONFIG], async (config: unknown) => ({config, connected: true}));
        injector.register({provide: Repository, useClass: Repository});

        const repo = await injector.getAsync(Repository);
        assert.deepEqual(repo.db, {config: {url: "postgres://localhost"}, connected: true});
    });

    it("caches the in-flight promise so concurrent getAsync() calls share one instance", async () => {
        const DATABASE = Symbol("DATABASE");
        let creations = 0;
        const injector = Injector.create();
        injector.register({
            provide: DATABASE,
            useFactory: async () => {
                creations++;
                await new Promise(resolve => setTimeout(resolve, 5));
                return {id: creations};
            },
        });

        const [a, b] = await Promise.all([injector.getAsync(DATABASE), injector.getAsync(DATABASE)]);
        assert.equal(creations, 1);
        assert.equal(a, b);
    });

    it("removes a rejected in-flight promise so a later getAsync() can retry", async () => {
        const DATABASE = Symbol("DATABASE");
        let attempt = 0;
        const injector = Injector.create();
        injector.register({
            provide: DATABASE,
            useFactory: async () => {
                attempt++;
                if (attempt === 1) throw new Error("boom");
                return {ok: true};
            },
        });

        await assert.rejects(injector.getAsync(DATABASE), /boom/);
        assert.deepEqual(await injector.getAsync(DATABASE), {ok: true});
        assert.equal(attempt, 2);
    });

    it("getAllAsync() resolves all providers for a multi token", async () => {
        const PLUGINS = Symbol("PLUGINS");
        const injector = Injector.create();
        injector.register({provide: PLUGINS, useFactory: async () => "a", multi: true});
        injector.register({provide: PLUGINS, useFactory: async () => "b", multi: true});

        assert.deepEqual(await injector.getAllAsync(PLUGINS), ["a", "b"]);
    });
});
