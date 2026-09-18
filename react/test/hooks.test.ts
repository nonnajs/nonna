import {describe, it, afterEach, mock} from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import type {ReactNode} from "react";
import {cleanup, renderHook} from "@testing-library/react";
import {Injector, ProviderNotFoundError} from "@nonna/di";
import {NonnaProvider} from "../src/NonnaProvider";
import {useAllInjections, useInjection, useOptionalInjection} from "../src/hooks";

afterEach(cleanup);

function wrapperFor(injector: Injector) {
    return ({children}: {children?: ReactNode}) => createElement(NonnaProvider, {injector}, children);
}

describe("useInjection()", () => {
    it("resolves a registered singleton token", () => {
        class Logger {}
        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});

        const {result} = renderHook(() => useInjection(Logger), {wrapper: wrapperFor(injector)});
        assert.ok(result.current instanceof Logger);
    });

    it("memoizes across re-renders - a transient token is not reconstructed unless the token/injector changes", () => {
        let constructions = 0;
        class Handler {
            constructor() {
                constructions++;
            }
        }
        const injector = Injector.create();
        injector.register({provide: Handler, useClass: Handler, scope: "transient"});

        const {result, rerender} = renderHook(() => useInjection(Handler), {wrapper: wrapperFor(injector)});
        const first = result.current;

        rerender();
        rerender();

        assert.equal(result.current, first);
        assert.equal(constructions, 1);
    });

    it("propagates ProviderNotFoundError for a missing required token, exactly like Injector.get()", () => {
        const MISSING = Symbol("MISSING");
        const injector = Injector.create();

        // React logs the render-phase error to console.error even though it's caught below (no
        // error boundary in this test tree) - silence that expected noise, not a real failure.
        const consoleError = mock.method(console, "error", () => undefined);
        try {
            assert.throws(
                () => renderHook(() => useInjection(MISSING), {wrapper: wrapperFor(injector)}),
                (error: unknown) => {
                    assert.ok(error instanceof ProviderNotFoundError);
                    return true;
                },
            );
        } finally {
            consoleError.mock.restore();
        }
    });

    it("re-resolves when the token changes", () => {
        class A {}
        class B {}
        const injector = Injector.create();
        injector.register({provide: A, useClass: A});
        injector.register({provide: B, useClass: B});

        const {result, rerender} = renderHook(({token}: {token: typeof A | typeof B}) => useInjection(token), {
            wrapper: wrapperFor(injector),
            initialProps: {token: A},
        });
        assert.ok(result.current instanceof A);

        rerender({token: B});
        assert.ok(result.current instanceof B);
    });
});

describe("useOptionalInjection()", () => {
    it("resolves undefined instead of throwing for a missing token", () => {
        const MISSING = Symbol("MISSING");
        const injector = Injector.create();

        const {result} = renderHook(() => useOptionalInjection(MISSING), {wrapper: wrapperFor(injector)});
        assert.equal(result.current, undefined);
    });

    it("resolves the value when the token is registered", () => {
        const CONFIG = Symbol("CONFIG");
        const injector = Injector.create();
        injector.registerValue(CONFIG, {port: 8080});

        const {result} = renderHook(() => useOptionalInjection(CONFIG), {wrapper: wrapperFor(injector)});
        assert.deepEqual(result.current, {port: 8080});
    });
});

describe("useAllInjections()", () => {
    it("resolves every registration for a multi: true token, in registration order", () => {
        const PLUGIN = Symbol("PLUGIN");
        class AuthPlugin {}
        class MetricsPlugin {}
        const injector = Injector.create();
        injector.register({provide: PLUGIN, useClass: AuthPlugin, multi: true});
        injector.register({provide: PLUGIN, useClass: MetricsPlugin, multi: true});

        const {result} = renderHook(() => useAllInjections(PLUGIN), {wrapper: wrapperFor(injector)});
        assert.equal(result.current.length, 2);
        assert.ok(result.current[0] instanceof AuthPlugin);
        assert.ok(result.current[1] instanceof MetricsPlugin);
    });

    it("resolves to an empty array when nothing is registered for the token", () => {
        const PLUGIN = Symbol("PLUGIN");
        const injector = Injector.create();

        const {result} = renderHook(() => useAllInjections(PLUGIN), {wrapper: wrapperFor(injector)});
        assert.deepEqual(result.current, []);
    });
});
