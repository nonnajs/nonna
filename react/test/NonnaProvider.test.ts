import {afterEach, describe, it, mock} from "node:test";
import assert from "node:assert/strict";
import type {ReactNode} from "react";
import {createElement} from "react";
import {cleanup, renderHook} from "@testing-library/react";
import {Injector} from "@nonna/di";
import {NonnaProvider, useInjector} from "../src";

afterEach(cleanup);

describe("NonnaProvider / useInjector()", () => {
    it("throws a descriptive error when called outside a NonnaProvider", () => {
        // React logs render-phase errors to console.error even though they're caught below (no
        // error boundary in this test tree) - silence that expected noise, not a real failure.
        const consoleError = mock.method(console, "error", () => undefined);
        try {
            assert.throws(() => renderHook(() => useInjector()), /must be called.*inside.*NonnaProvider/s);
        } finally {
            consoleError.mock.restore();
        }
    });

    it("returns the exact Injector instance passed to NonnaProvider", () => {
        const injector = Injector.create();
        const wrapper = ({children}: {children?: ReactNode}) => createElement(NonnaProvider, {injector}, children);

        const {result} = renderHook(() => useInjector(), {wrapper});
        assert.equal(result.current, injector);
    });

    it("makes the injector available to nested components, several levels deep", () => {
        const injector = Injector.create();
        const Outer = ({children}: {children?: ReactNode}) =>
            createElement(NonnaProvider, {injector}, createElement("div", null, children));
        const wrapper = ({children}: {children?: ReactNode}) => createElement(Outer, null, children);

        const {result} = renderHook(() => useInjector(), {wrapper});
        assert.equal(result.current, injector);
    });
});
