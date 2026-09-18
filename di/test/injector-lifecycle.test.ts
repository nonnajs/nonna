import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injector} from "../src/injector";
import {LifecycleError} from "../src/errors";

describe("Injector lifecycle", () => {
    it("calls onDestroy() on singleton instances in reverse creation order", async () => {
        const order: string[] = [];
        class Database {
            onDestroy() {
                order.push("Database");
            }
        }
        class Repository {
            onDestroy() {
                order.push("Repository");
            }
        }
        class Service {
            onDestroy() {
                order.push("Service");
            }
        }

        const injector = Injector.create();
        injector.register({provide: Database, useClass: Database});
        injector.register({provide: Repository, useClass: Repository});
        injector.register({provide: Service, useClass: Service});

        // Creation order: Database, then Repository, then Service.
        injector.get(Database);
        injector.get(Repository);
        injector.get(Service);

        await injector.destroy();
        assert.deepEqual(order, ["Service", "Repository", "Database"]);
    });

    it("aggregates multiple onDestroy() failures into one LifecycleError", async () => {
        class A {
            onDestroy() {
                throw new Error("A failed");
            }
        }
        class B {
            onDestroy() {
                throw new Error("B failed");
            }
        }

        const injector = Injector.create();
        injector.register({provide: A, useClass: A});
        injector.register({provide: B, useClass: B});
        injector.get(A);
        injector.get(B);

        await assert.rejects(injector.destroy(), (error: unknown) => {
            assert.ok(error instanceof LifecycleError);
            assert.equal(error.failures.length, 2);
            return true;
        });
    });

    it("destroy() is idempotent", async () => {
        class Database {}
        const injector = Injector.create();
        injector.register({provide: Database, useClass: Database});
        injector.get(Database);

        await injector.destroy();
        await assert.doesNotReject(injector.destroy());
    });

    it("ignores instances without onDestroy()", async () => {
        class Plain {}
        const injector = Injector.create();
        injector.register({provide: Plain, useClass: Plain});
        injector.get(Plain);

        await assert.doesNotReject(injector.destroy());
    });
});
