import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Inject, Injectable, Injector, InvalidProviderError, Optional, ProviderNotFoundError, ScopeError} from "../src";

describe("Field (property) injection", () => {
    it("injects a token into a class field decorated with @Inject(token)", () => {
        class Logger {}

        @Injectable()
        class UserService {
            @Inject(Logger)
            private readonly logger!: Logger;

            getLogger() {
                return this.logger;
            }
        }

        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});
        injector.register({provide: UserService, useClass: UserService});

        assert.ok(injector.get(UserService).getLogger() instanceof Logger);
    });

    it("field injection runs before onInit()", () => {
        class Logger {}

        @Injectable()
        class UserService {
            @Inject(Logger)
            private readonly logger!: Logger;
            initializedWithLogger = false;

            onInit() {
                this.initializedWithLogger = this.logger instanceof Logger;
            }
        }

        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});
        injector.register({provide: UserService, useClass: UserService});

        assert.equal(injector.get(UserService).initializedWithLogger, true);
    });

    it("@Optional(token) resolves to the value when registered, leaves the field alone when missing", () => {
        const METRICS = Symbol("METRICS");

        @Injectable()
        class UserService {
            @Optional(METRICS)
            metrics?: unknown = "default";
        }

        const withoutMetrics = Injector.create();
        withoutMetrics.register({provide: UserService, useClass: UserService});
        assert.equal(withoutMetrics.get(UserService).metrics, "default");

        const withMetrics = Injector.create();
        withMetrics.registerValue(METRICS, {enabled: true});
        withMetrics.register({provide: UserService, useClass: UserService});
        assert.deepEqual(withMetrics.get(UserService).metrics, {enabled: true});
    });

    it("a bare @Optional() (no token) on a field is a no-op - no AOT inference exists for fields", () => {
        @Injectable()
        class UserService {
            @Optional()
            metrics = "untouched";
        }

        const injector = Injector.create();
        injector.register({provide: UserService, useClass: UserService});
        assert.equal(injector.get(UserService).metrics, "untouched");
    });

    it("a required field with no registered provider throws ProviderNotFoundError", () => {
        class Logger {}

        @Injectable()
        class UserService {
            @Inject(Logger)
            logger!: Logger;
        }

        const injector = Injector.create();
        injector.register({provide: UserService, useClass: UserService});

        assert.throws(() => injector.get(UserService), ProviderNotFoundError);
    });

    it("initialize() fails fast when a required field dependency is missing", async () => {
        class Logger {}

        @Injectable()
        class UserService {
            @Inject(Logger)
            logger!: Logger;
        }

        const injector = Injector.create();
        injector.register({provide: UserService, useClass: UserService});

        await assert.rejects(injector.initialize(), InvalidProviderError);
    });

    it("initialize() rejects a singleton with a request-scoped field dependency", async () => {
        class RequestContext {}

        @Injectable()
        class UserService {
            @Inject(RequestContext)
            ctx!: RequestContext;
        }

        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});
        injector.register({provide: UserService, useClass: UserService});

        await assert.rejects(injector.initialize(), ScopeError);
    });

    it("subclasses inherit a parent class's field dependencies", () => {
        class Logger {}

        class BaseService {
            @Inject(Logger)
            protected readonly logger!: Logger;
        }

        @Injectable()
        class UserService extends BaseService {
            getLogger() {
                return this.logger;
            }
        }

        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});
        injector.register({provide: UserService, useClass: UserService});

        assert.ok(injector.get(UserService).getLogger() instanceof Logger);
    });

    it("a subclass's own field decoration overrides its parent's for the same property name", () => {
        const PARENT_LOGGER = Symbol("PARENT_LOGGER");
        const CHILD_LOGGER = Symbol("CHILD_LOGGER");

        class BaseService {
            @Inject(PARENT_LOGGER)
            logger: unknown = undefined;
        }

        @Injectable()
        class UserService extends BaseService {
            @Inject(CHILD_LOGGER)
            override logger: unknown = undefined;
        }

        const injector = Injector.create();
        injector.registerValue(PARENT_LOGGER, "parent");
        injector.registerValue(CHILD_LOGGER, "child");
        injector.register({provide: UserService, useClass: UserService});

        assert.equal(injector.get(UserService).logger, "child");
    });

    it("only applies to useClass providers, never useValue/useFactory/useExisting", () => {
        class Logger {}

        @Injectable()
        class Decorated {
            @Inject(Logger)
            logger!: Logger;
        }

        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});

        const VALUE_TOKEN = Symbol("VALUE_TOKEN");
        const plainInstance = new Decorated();
        injector.register({provide: VALUE_TOKEN, useValue: plainInstance});

        // A value provider hands back the object exactly as given - no field injection performed.
        assert.equal(injector.get(VALUE_TOKEN), plainInstance);
        assert.equal((injector.get(VALUE_TOKEN) as Decorated).logger, undefined);
    });

    it("resolves field dependencies asynchronously via getAsync()", async () => {
        const DATABASE = Symbol("DATABASE");

        @Injectable()
        class UserService {
            @Inject(DATABASE)
            private readonly db!: unknown;

            getDb() {
                return this.db;
            }
        }

        const injector = Injector.create();
        injector.register({provide: DATABASE, useFactory: async () => ({connected: true})});
        injector.register({provide: UserService, useClass: UserService});

        const service = await injector.getAsync(UserService);
        assert.deepEqual(service.getDb(), {connected: true});
    });

    it("supports both constructor injection and field injection on the same class", () => {
        class Repository {}
        class Logger {}

        @Injectable()
        class UserService {
            @Inject(Logger)
            logger!: Logger;

            constructor(@Inject(Repository) public repository: Repository) {}
        }

        const injector = Injector.create();
        injector.register({provide: Repository, useClass: Repository});
        injector.register({provide: Logger, useClass: Logger});
        injector.register({provide: UserService, useClass: UserService});

        const service = injector.get(UserService);
        assert.ok(service.repository instanceof Repository);
        assert.ok((service as unknown as {logger: Logger}).logger instanceof Logger);
    });
});
