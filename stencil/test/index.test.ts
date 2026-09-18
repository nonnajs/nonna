import {describe, it, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";
import {Injector, ProviderNotFoundError} from "@nonna/di";
import {
    CONTEXT_REQUEST_EVENT,
    NONNA_INJECTOR_CONTEXT,
    provideInjector,
    requestInjector,
    requestInjection,
    requestOptionalInjection,
    requestAllInjections,
    defineNonnaProvider,
    NonnaProviderElement,
} from "../src";

// `@nonna/stencil` re-exports `@nonna/web-components`'s context-protocol implementation as-is -
// these tests confirm the re-export wires up correctly end-to-end (constants, provider element,
// and every resolution function), simulating a Stencil component by using its host `HTMLElement`
// directly, exactly as `@Element()` would hand it to `componentWillLoad()`.
describe("@nonna/stencil re-exports", () => {
    let host: HTMLDivElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
    });

    afterEach(() => {
        host.remove();
    });

    it("re-exports the context protocol constants", () => {
        assert.equal(CONTEXT_REQUEST_EVENT, "context-request");
        assert.equal(typeof NONNA_INJECTOR_CONTEXT, "symbol");
    });

    it("provideInjector() + requestInjector() round-trip through a Stencil-style host element", () => {
        const injector = Injector.create();
        const cleanup = provideInjector(host, injector);

        const stencilComponentHost = document.createElement("user-list");
        host.appendChild(stencilComponentHost);

        assert.equal(requestInjector(stencilComponentHost), injector);
        cleanup();
    });

    it("requestInjection() resolves a registered service from the host element (as @Element() would provide)", () => {
        class UserService {
            getUsers() {
                return ["Alice", "Bob"];
            }
        }
        const injector = Injector.create();
        injector.register({provide: UserService, useClass: UserService});
        provideInjector(host, injector);

        const stencilComponentHost = document.createElement("user-list");
        host.appendChild(stencilComponentHost);

        const userService = requestInjection(stencilComponentHost, UserService);
        assert.deepEqual(userService.getUsers(), ["Alice", "Bob"]);
    });

    it("requestInjection() propagates ProviderNotFoundError for an unregistered token", () => {
        const MISSING = Symbol("MISSING");
        const injector = Injector.create();
        provideInjector(host, injector);

        const stencilComponentHost = document.createElement("debug-panel");
        host.appendChild(stencilComponentHost);

        assert.throws(
            () => requestInjection(stencilComponentHost, MISSING),
            (err: unknown) => err instanceof ProviderNotFoundError,
        );
    });

    it("requestOptionalInjection() resolves undefined for an unregistered token", () => {
        const FEATURE_FLAGS = Symbol("FEATURE_FLAGS");
        const injector = Injector.create();
        provideInjector(host, injector);

        const stencilComponentHost = document.createElement("greeting-banner");
        host.appendChild(stencilComponentHost);

        assert.equal(requestOptionalInjection(stencilComponentHost, FEATURE_FLAGS), undefined);
    });

    it("requestAllInjections() resolves every multi-provider in order", () => {
        const GREETER = Symbol("GREETER");
        class FriendlyGreeter {
            greet = () => "Hey there!";
        }
        class FormalGreeter {
            greet = () => "Good day.";
        }
        const injector = Injector.create();
        injector.register({provide: GREETER, useClass: FriendlyGreeter, multi: true});
        injector.register({provide: GREETER, useClass: FormalGreeter, multi: true});
        provideInjector(host, injector);

        const stencilComponentHost = document.createElement("greeting-banner");
        host.appendChild(stencilComponentHost);

        const greeters = requestAllInjections<{greet(): string}>(stencilComponentHost, GREETER);
        assert.equal(greeters.length, 2);
        assert.equal(greeters[0]?.greet(), "Hey there!");
        assert.equal(greeters[1]?.greet(), "Good day.");
    });

    describe("<nonna-provider> custom element", () => {
        beforeEach(() => {
            defineNonnaProvider();
        });

        it("provides the injector to a Stencil component host connected beneath it", () => {
            const injector = Injector.create();
            const provider = document.createElement("nonna-provider") as NonnaProviderElement;
            provider.injector = injector;

            const stencilComponentHost = document.createElement("add-user-form");
            provider.appendChild(stencilComponentHost);
            document.body.appendChild(provider);

            assert.equal(requestInjector(stencilComponentHost), injector);
            provider.remove();
        });
    });
});
