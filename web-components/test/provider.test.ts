import {describe, it, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";
import {Injector} from "@nonnajs/di";
import {defineNonnaProvider, NonnaProviderElement, requestInjector} from "../src";

describe("<nonna-provider> Custom Element", () => {
    beforeEach(() => {
        defineNonnaProvider();
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("defineNonnaProvider() defines nonna-provider in customElements", () => {
        assert.ok(customElements.get("nonna-provider"));
        defineNonnaProvider(); // Calling again is a no-op
    });

    it("handles undefined injector", () => {
        const provider = document.createElement("nonna-provider") as NonnaProviderElement;
        assert.equal(provider.injector, undefined);
        provider.injector = undefined;
        document.body.appendChild(provider);
        assert.equal(provider.injector, undefined);
    });

    it("provides injector to child elements when connected", () => {
        const injector = Injector.create();
        const provider = document.createElement("nonna-provider") as NonnaProviderElement;
        provider.injector = injector;

        const child = document.createElement("p");
        provider.appendChild(child);
        document.body.appendChild(provider);

        const resolved = requestInjector(child);
        assert.equal(resolved, injector);
    });

    it("updates provider when injector property changes", () => {
        const injector1 = Injector.create();
        const injector2 = Injector.create();

        const provider = document.createElement("nonna-provider") as NonnaProviderElement;
        provider.injector = injector1;

        const child = document.createElement("p");
        provider.appendChild(child);
        document.body.appendChild(provider);

        assert.equal(requestInjector(child), injector1);

        provider.injector = injector2;
        assert.equal(requestInjector(child), injector2);
    });

    it("cleans up when disconnected from DOM", () => {
        const injector = Injector.create();
        const provider = document.createElement("nonna-provider") as NonnaProviderElement;
        provider.injector = injector;

        const child = document.createElement("p");
        provider.appendChild(child);
        document.body.appendChild(provider);

        assert.equal(requestInjector(child), injector);

        provider.remove();

        assert.throws(() => requestInjector(child));
    });
});
