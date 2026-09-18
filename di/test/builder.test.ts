import {describe, it} from "node:test";
import assert from "node:assert/strict";

import type {ContextStorage, RequestScopeStore} from "../src";
import {Injectable, InjectorBuilder, InjectorError, Nonna} from "../src";

describe("Nonna.injector() fluent builder", () => {
    it("Nonna.injector() returns an InjectorBuilder", () => {
        assert.ok(Nonna.injector() instanceof InjectorBuilder);
    });

    it("chains register()/registerValue()/registerFactory() and returns a ready, initialized Injector from build()", async () => {
        const CONFIG = Symbol("CONFIG");
        const DB = Symbol("DB");
        class Logger {}

        const injector = await Nonna.injector()
            .register({provide: Logger, useClass: Logger})
            .registerValue(CONFIG, {port: 8080})
            .registerFactory(DB, [CONFIG], (config: unknown) => ({config, connected: true}))
            .build();

        assert.ok(injector.get(Logger) instanceof Logger);
        assert.deepEqual(injector.get(DB), {config: {port: 8080}, connected: true});
    });

    it("scan() pulls in @Injectable()-registered classes at build() time", async () => {
        @Injectable()
        class Widget {}

        const injector = await Nonna.injector().scan().build();
        assert.ok(injector.get(Widget) instanceof Widget);
    });

    it("freeze() blocks further registration on the built Injector", async () => {
        class Logger {}
        const injector = await Nonna.injector().register({provide: Logger, useClass: Logger}).freeze().build();

        assert.throws(() => injector.register({provide: Symbol("x"), useValue: 1}), InjectorError);
    });

    it("withContextStorage() supplies a custom ContextStorage to the built Injector", async () => {
        let runCalls = 0;
        const custom: ContextStorage<RequestScopeStore> = {
            run(_store, fn) {
                runCalls++;
                return fn();
            },
            getStore() {
                return undefined;
            },
        };

        class RequestContext {}
        const injector = await Nonna.injector()
            .withContextStorage(custom)
            .register({provide: RequestContext, useClass: RequestContext, scope: "request"})
            .build();

        injector.runInScope(() => undefined);
        assert.equal(runCalls, 1);
    });

    it("build() runs initialize(), so eager providers are already warm and missing deps fail fast", async () => {
        let created = false;
        class EagerService {
            constructor() {
                created = true;
            }
        }

        await Nonna.injector().register({provide: EagerService, useClass: EagerService, eager: true}).build();
        assert.equal(created, true);
    });

    it("loadBeans() is applied before scan(), so decorators from the loaded module are picked up", async () => {
        const modulePath = require.resolve("./fixtures/decorated-widget.js");

        const injector = await Nonna.injector().loadBeans([modulePath]).scan().build();

        const {DecoratedWidget} = require(modulePath);
        assert.ok(injector.get(DecoratedWidget) instanceof DecoratedWidget);
    });
});
