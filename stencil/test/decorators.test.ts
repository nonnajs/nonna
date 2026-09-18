import {describe, it, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";
import {Injector} from "@nonna/di";
import {provideInjector, Inject, OptionalInject, AllInject} from "../src";

// `@stencil/core`'s published `getElement()` defaults to an identity function outside Stencil's
// own compiler pipeline (`BUILD.lazyLoad` is `false` by default - see stencil.config.ts's
// `dist-custom-elements` output target in sample-stencil, which compiles to the same shape: the
// component class extends `HTMLElement` directly, so `getElement(this) === this`). That means a
// plain class extending `HTMLElement`, used exactly like a real Stencil component under that
// build target, exercises the *real*, unmocked `@stencil/core` API end-to-end here.
describe("@nonna/stencil property decorators", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it("@Inject() resolves property on access without a separate @Element() field", () => {
        class GreeterService {
            greet(name: string) {
                return `Hello ${name}`;
            }
        }

        class StencilLikeElement extends HTMLElement {
            @Inject(GreeterService)
            declare readonly greeter: GreeterService;
        }

        if (!customElements.get("test-stencil-inject")) {
            customElements.define("test-stencil-inject", StencilLikeElement);
        }

        const injector = Injector.create();
        injector.register({provide: GreeterService, useClass: GreeterService});
        provideInjector(container, injector);

        const el = document.createElement("test-stencil-inject") as StencilLikeElement;
        container.appendChild(el);

        assert.equal(el.greeter.greet("World"), "Hello World");
    });

    it("@OptionalInject() resolves undefined for an unregistered token", () => {
        const CONFIG = Symbol("CONFIG");

        class StencilLikeOptionalElement extends HTMLElement {
            @OptionalInject(CONFIG)
            declare readonly config: {apiUrl?: string} | undefined;
        }

        if (!customElements.get("test-stencil-optional")) {
            customElements.define("test-stencil-optional", StencilLikeOptionalElement);
        }

        const injector = Injector.create();
        provideInjector(container, injector);

        const el = document.createElement("test-stencil-optional") as StencilLikeOptionalElement;
        container.appendChild(el);

        assert.equal(el.config, undefined);
    });

    it("@AllInject() resolves every multi-provider in order", () => {
        const HOOK = Symbol("HOOK");
        class HookA {
            name = "A";
        }
        class HookB {
            name = "B";
        }

        class StencilLikeAllElement extends HTMLElement {
            @AllInject(HOOK)
            declare readonly hooks: readonly (HookA | HookB)[];
        }

        if (!customElements.get("test-stencil-all")) {
            customElements.define("test-stencil-all", StencilLikeAllElement);
        }

        const injector = Injector.create();
        injector.register({provide: HOOK, useClass: HookA, multi: true});
        injector.register({provide: HOOK, useClass: HookB, multi: true});
        provideInjector(container, injector);

        const el = document.createElement("test-stencil-all") as StencilLikeAllElement;
        container.appendChild(el);

        assert.equal(el.hooks.length, 2);
        assert.ok(el.hooks[0] instanceof HookA);
        assert.ok(el.hooks[1] instanceof HookB);
    });
});
