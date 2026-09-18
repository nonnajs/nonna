import {describe, it, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";
import {Injector} from "@nonnajs/di";
import {provideInjector, inject, optionalInject, allInject} from "../src";

describe("Custom Elements Property Decorators", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it("@inject() resolves property on access", () => {
        class GreeterService {
            greet(name: string) {
                return `Hello ${name}`;
            }
        }

        class TestElement extends HTMLElement {
            @inject(GreeterService)
            declare readonly greeter: GreeterService;
        }

        if (!customElements.get("test-inject-el")) {
            customElements.define("test-inject-el", TestElement);
        }

        const injector = Injector.create();
        injector.register({provide: GreeterService, useClass: GreeterService});
        provideInjector(container, injector);

        const el = document.createElement("test-inject-el") as TestElement;
        container.appendChild(el);

        assert.equal(el.greeter.greet("World"), "Hello World");
    });

    it("@optionalInject() resolves optional property", () => {
        const CONFIG = Symbol("CONFIG");

        class TestOptionalElement extends HTMLElement {
            @optionalInject(CONFIG)
            declare readonly config: {apiUrl?: string} | undefined;
        }

        if (!customElements.get("test-optional-el")) {
            customElements.define("test-optional-el", TestOptionalElement);
        }

        const injector = Injector.create();
        provideInjector(container, injector);

        const el = document.createElement("test-optional-el") as TestOptionalElement;
        container.appendChild(el);

        assert.equal(el.config, undefined);

        const injectorWithConfig = Injector.create();
        injectorWithConfig.registerValue(CONFIG, {apiUrl: "https://api.test"});
        const container2 = document.createElement("div");
        document.body.appendChild(container2);
        provideInjector(container2, injectorWithConfig);

        const el2 = document.createElement("test-optional-el") as TestOptionalElement;
        container2.appendChild(el2);

        assert.deepEqual(el2.config, {apiUrl: "https://api.test"});
        container2.remove();
    });

    it("@allInject() resolves multi-binding array", () => {
        const HOOK = Symbol("HOOK");
        class HookA {
            name = "A";
        }
        class HookB {
            name = "B";
        }

        class TestAllElement extends HTMLElement {
            @allInject(HOOK)
            declare readonly hooks: readonly (HookA | HookB)[];
        }

        if (!customElements.get("test-all-el")) {
            customElements.define("test-all-el", TestAllElement);
        }

        const injector = Injector.create();
        injector.register({provide: HOOK, useClass: HookA, multi: true});
        injector.register({provide: HOOK, useClass: HookB, multi: true});
        provideInjector(container, injector);

        const el = document.createElement("test-all-el") as TestAllElement;
        container.appendChild(el);

        assert.equal(el.hooks.length, 2);
        assert.ok(el.hooks[0] instanceof HookA);
        assert.ok(el.hooks[1] instanceof HookB);
    });
});
