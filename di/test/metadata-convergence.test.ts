import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Injectable} from "../src/decorators";
import {Injector} from "../src/injector";

describe("Metadata convergence and registration precedence", () => {
    it("refresh() pulls decorator-registered classes into the injector's local registry", () => {
        @Injectable()
        class Widget {}

        const injector = Injector.create();
        assert.equal(injector.has(Widget), false);

        injector.refresh();
        assert.equal(injector.has(Widget), true);
        assert.ok(injector.get(Widget) instanceof Widget);
    });

    it("an explicit register() call is never clobbered by a later refresh()", () => {
        @Injectable()
        class RealRepo {
            label = "real";
        }
        class FakeRepo {
            label = "fake";
        }

        const injector = Injector.create();
        injector.register({provide: RealRepo, useClass: FakeRepo});
        injector.refresh();

        assert.equal(injector.get(RealRepo).label, "fake");
    });

    it("re-running refresh() for an unchanged decorator-registered class preserves the singleton cache", () => {
        @Injectable()
        class Widget {}

        const injector = Injector.create();
        injector.refresh();
        const first = injector.get(Widget);

        injector.refresh();
        const second = injector.get(Widget);

        assert.equal(first, second);
    });
});
