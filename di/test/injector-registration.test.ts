import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";
import {ProviderNotFoundError, InvalidProviderError} from "../src/errors";
import {defineDependencies} from "../src/metadata";

class Logger {
    logs: string[] = [];
    log(message: string) {
        this.logs.push(message);
    }
}

describe("Injector registration", () => {
    it("resolves a class provider", () => {
        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});

        const logger = injector.get(Logger);
        assert.ok(logger instanceof Logger);
    });

    it("resolves a value provider", () => {
        const CONFIG = Symbol("CONFIG");
        const injector = Injector.create();
        injector.register({provide: CONFIG, useValue: {port: 8080}});

        assert.deepEqual(injector.get(CONFIG), {port: 8080});
    });

    it("resolves a factory provider with injected dependencies", () => {
        const CONFIG = Symbol("CONFIG");
        const DATABASE = Symbol("DATABASE");
        const injector = Injector.create();

        injector.registerValue(CONFIG, {url: "postgres://localhost"});
        injector.registerFactory(DATABASE, [CONFIG], (...args: unknown[]) => {
            const config = args[0] as {url: string};
            return {connectionString: config.url};
        });

        assert.deepEqual(injector.get(DATABASE), {connectionString: "postgres://localhost"});
    });

    it("resolves an existing provider to the exact same instance", () => {
        const LOGGER = Symbol("LOGGER");
        const AUDIT_LOGGER = Symbol("AUDIT_LOGGER");
        const injector = Injector.create();

        injector.register({provide: LOGGER, useClass: Logger});
        injector.register({provide: AUDIT_LOGGER, useExisting: LOGGER});

        assert.equal(injector.get(LOGGER), injector.get(AUDIT_LOGGER));
    });

    it("throws ProviderNotFoundError for an unregistered token", () => {
        const injector = Injector.create();
        assert.throws(() => injector.get(Logger), ProviderNotFoundError);
    });

    it("getOptional returns undefined for an unregistered token", () => {
        const injector = Injector.create();
        assert.equal(injector.getOptional(Logger), undefined);
    });

    it("has() reflects registration state", () => {
        const injector = Injector.create();
        assert.equal(injector.has(Logger), false);
        injector.register({provide: Logger, useClass: Logger});
        assert.equal(injector.has(Logger), true);
    });

    it("supports multi providers via getAll(), in registration order", () => {
        const MIDDLEWARE = Symbol("MIDDLEWARE");
        class AuthMiddleware {}
        class LoggingMiddleware {}
        const injector = Injector.create();

        injector.register({provide: MIDDLEWARE, useClass: AuthMiddleware, multi: true});
        injector.register({provide: MIDDLEWARE, useClass: LoggingMiddleware, multi: true});

        const all = injector.getAll(MIDDLEWARE);
        assert.equal(all.length, 2);
        assert.ok(all[0] instanceof AuthMiddleware);
        assert.ok(all[1] instanceof LoggingMiddleware);
    });

    it("throws when get() is called on a multi-provider token", () => {
        const MIDDLEWARE = Symbol("MIDDLEWARE");
        class AuthMiddleware {}
        class LoggingMiddleware {}
        const injector = Injector.create();

        injector.register({provide: MIDDLEWARE, useClass: AuthMiddleware, multi: true});
        injector.register({provide: MIDDLEWARE, useClass: LoggingMiddleware, multi: true});

        assert.throws(() => injector.get(MIDDLEWARE), InvalidProviderError);
    });

    it("rejects mixing multi and non-multi providers for the same token", () => {
        const MIDDLEWARE = Symbol("MIDDLEWARE");
        class AuthMiddleware {}
        class LoggingMiddleware {}
        const injector = Injector.create();

        injector.register({provide: MIDDLEWARE, useClass: AuthMiddleware, multi: true});
        assert.throws(
            () => injector.register({provide: MIDDLEWARE, useClass: LoggingMiddleware}),
            InvalidProviderError,
        );
    });

    it("last non-multi registration for a token wins (override)", () => {
        class RealRepo {}
        class FakeRepo {}
        const injector = Injector.create();

        injector.register({provide: RealRepo, useClass: RealRepo});
        injector.register({provide: RealRepo, useClass: FakeRepo});

        assert.ok(injector.get(RealRepo) instanceof FakeRepo);
    });

    it("resolves optional dependencies to undefined when missing", () => {
        const METRICS = Symbol("METRICS");
        class UserService {
            constructor(public metrics?: unknown) {}
        }
        const injector = Injector.create();
        defineDependencies(UserService, [{token: METRICS, optional: true}]);
        injector.register({provide: UserService, useClass: UserService});

        const service = injector.get(UserService);
        assert.equal(service.metrics, undefined);
    });
});
