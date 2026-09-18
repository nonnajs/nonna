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
} from "../src";

describe("@nonna/web-components context protocol", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it("constants are defined properly", () => {
        assert.equal(CONTEXT_REQUEST_EVENT, "context-request");
        assert.equal(typeof NONNA_INJECTOR_CONTEXT, "symbol");
    });

    it("provideInjector() responds to requestInjector() dispatched by descendant element", () => {
        const injector = Injector.create();
        const cleanup = provideInjector(container, injector);

        const child = document.createElement("span");
        container.appendChild(child);

        const resolved = requestInjector(child);
        assert.equal(resolved, injector);

        cleanup();
    });

    it("ignores context-request events for different contexts", () => {
        const injector = Injector.create();
        const cleanup = provideInjector(container, injector);

        let callbackCalled = false;
        const CustomEventCtor = container.ownerDocument.defaultView?.CustomEvent || CustomEvent;
        const otherEvent = new CustomEventCtor(CONTEXT_REQUEST_EVENT, {
            detail: {
                context: "OTHER_CONTEXT",
                callback: () => {
                    callbackCalled = true;
                },
            },
            bubbles: true,
        });

        container.dispatchEvent(otherEvent);
        assert.equal(callbackCalled, false);

        cleanup();
    });

    it("cleanup removes event listener", () => {
        const injector = Injector.create();
        const cleanup = provideInjector(container, injector);

        const child = document.createElement("span");
        container.appendChild(child);

        cleanup();

        assert.throws(
            () => requestInjector(child),
            /requestInjector\(\) .* must be called on an element within a DOM tree where provideInjector\(\) or <nonna-provider> was configured\./,
        );
    });

    it("requestInjector() throws when called on unattached or unprovided element", () => {
        const orphan = document.createElement("div");
        assert.throws(
            () => requestInjector(orphan),
            /must be called on an element within a DOM tree where provideInjector\(\) or <nonna-provider> was configured\./,
        );
    });

    it("works across Shadow DOM boundaries (composed event)", () => {
        const injector = Injector.create();
        provideInjector(container, injector);

        const host = document.createElement("div");
        container.appendChild(host);
        const shadow = host.attachShadow({mode: "open"});

        const shadowChild = document.createElement("button");
        shadow.appendChild(shadowChild);

        const resolved = requestInjector(shadowChild);
        assert.equal(resolved, injector);
    });

    describe("requestInjection()", () => {
        it("resolves registered singleton token", () => {
            class Logger {
                id = "wc-logger";
            }
            const injector = Injector.create();
            injector.register({provide: Logger, useClass: Logger});
            provideInjector(container, injector);

            const child = document.createElement("div");
            container.appendChild(child);

            const logger = requestInjection(child, Logger);
            assert.ok(logger instanceof Logger);
            assert.equal(logger.id, "wc-logger");
        });

        it("propagates ProviderNotFoundError for missing required token", () => {
            const MISSING = Symbol("MISSING");
            const injector = Injector.create();
            provideInjector(container, injector);

            const child = document.createElement("div");
            container.appendChild(child);

            assert.throws(
                () => requestInjection(child, MISSING),
                (err: unknown) => {
                    assert.ok(err instanceof ProviderNotFoundError);
                    return true;
                },
            );
        });
    });

    describe("requestOptionalInjection()", () => {
        it("resolves undefined for missing token", () => {
            const MISSING = Symbol("MISSING");
            const injector = Injector.create();
            provideInjector(container, injector);

            const child = document.createElement("div");
            container.appendChild(child);

            const result = requestOptionalInjection(child, MISSING);
            assert.equal(result, undefined);
        });

        it("resolves registered value when present", () => {
            const CONFIG = Symbol("CONFIG");
            const injector = Injector.create();
            injector.registerValue(CONFIG, {theme: "dark"});
            provideInjector(container, injector);

            const child = document.createElement("div");
            container.appendChild(child);

            const result = requestOptionalInjection(child, CONFIG);
            assert.deepEqual(result, {theme: "dark"});
        });
    });

    describe("requestAllInjections()", () => {
        it("resolves all multi-providers in order", () => {
            const PLUGIN = Symbol("PLUGIN");
            class PluginA {}
            class PluginB {}
            const injector = Injector.create();
            injector.register({provide: PLUGIN, useClass: PluginA, multi: true});
            injector.register({provide: PLUGIN, useClass: PluginB, multi: true});
            provideInjector(container, injector);

            const child = document.createElement("div");
            container.appendChild(child);

            const plugins = requestAllInjections(child, PLUGIN);
            assert.equal(plugins.length, 2);
            assert.ok(plugins[0] instanceof PluginA);
            assert.ok(plugins[1] instanceof PluginB);
        });

        it("resolves empty array when no providers registered", () => {
            const PLUGIN = Symbol("PLUGIN");
            const injector = Injector.create();
            provideInjector(container, injector);

            const child = document.createElement("div");
            container.appendChild(child);

            const plugins = requestAllInjections(child, PLUGIN);
            assert.deepEqual(plugins, []);
        });
    });
});
