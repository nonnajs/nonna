import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";
import {ScopeError} from "../src/errors";

describe("Request scope", () => {
    it("resolves the same instance for the same token within one runInScope() call", async () => {
        class RequestContext {}
        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});

        await injector.runInScope(async () => {
            const a = injector.get(RequestContext);
            const b = injector.get(RequestContext);
            assert.equal(a, b);
        });
    });

    it("gives two concurrent runInScope() calls isolated instances", async () => {
        class RequestContext {}
        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});

        const [a, b] = await Promise.all([
            injector.runInScope(async () => {
                await new Promise(resolve => setTimeout(resolve, 5));
                return injector.get(RequestContext);
            }),
            injector.runInScope(async () => {
                return injector.get(RequestContext);
            }),
        ]);

        assert.notEqual(a, b);
    });

    it("throws ScopeError when a request-scoped token is resolved outside runInScope()", () => {
        class RequestContext {}
        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});

        assert.throws(() => injector.get(RequestContext), ScopeError);
    });

    it("destroys request-scoped instances in reverse creation order when the async scope ends", async () => {
        const order: string[] = [];
        class A {
            onDestroy() {
                order.push("A");
            }
        }
        class B {
            constructor(public a: A) {}
            onDestroy() {
                order.push("B");
            }
        }
        const {defineDependencies} = await import("../src/metadata");
        defineDependencies(B, [{token: A}]);

        const injector = Injector.create();
        injector.register({provide: A, useClass: A, scope: "request"});
        injector.register({provide: B, useClass: B, scope: "request"});

        await injector.runInScope(async () => {
            injector.get(A);
            injector.get(B);
        });

        assert.deepEqual(order, ["B", "A"]);
    });

    it("supports request-scoped getAsync()", async () => {
        const DATABASE = Symbol("DATABASE");
        const injector = Injector.create();
        injector.register({provide: DATABASE, useFactory: async () => ({id: Math.random()}), scope: "request"});

        await injector.runInScope(async () => {
            const a = await injector.getAsync(DATABASE);
            const b = await injector.getAsync(DATABASE);
            assert.equal(a, b);
        });
    });

    it("currentScopeId() reflects the active scope, undefined outside one", async () => {
        // runInScope() only opens a real (AsyncLocalStorage-backed) scope when at least one
        // request-scoped provider is registered - see the perf note on Injector.runInScope().
        // Without one, there's nothing to isolate, so currentScopeId() has nothing to report.
        class RequestContext {}
        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});
        assert.equal(injector.currentScopeId(), undefined);

        await injector.runInScope(async () => {
            const id = injector.currentScopeId();
            assert.equal(typeof id, "string");
            assert.ok(id!.length > 0);
        });

        assert.equal(injector.currentScopeId(), undefined);
    });

    it("runInScope() skips AsyncLocalStorage entirely when no request-scoped provider is registered", async () => {
        const injector = Injector.create();

        const result = await injector.runInScope(async () => {
            assert.equal(injector.currentScopeId(), undefined);
            return "ok";
        });

        assert.equal(result, "ok");
    });

    it("rejects a singleton depending on a request-scoped provider (validated at initialize())", async () => {
        class RequestContext {}
        class UserService {
            constructor(public context: RequestContext) {}
        }
        const {defineDependencies} = await import("../src/metadata");
        defineDependencies(UserService, [{token: RequestContext}]);

        const injector = Injector.create();
        injector.register({provide: RequestContext, useClass: RequestContext, scope: "request"});
        injector.register({provide: UserService, useClass: UserService});

        await assert.rejects(injector.initialize(), ScopeError);
    });
});
