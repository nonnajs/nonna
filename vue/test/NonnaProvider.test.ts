import {afterEach, describe, it, mock} from "node:test";
import assert from "node:assert/strict";
import {defineComponent, h} from "vue";
import {mount} from "@vue/test-utils";
import {Injector} from "@nonnajs/di";
import {NonnaProvider, useInjector} from "../src";

let activeWrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
    activeWrapper?.unmount();
    activeWrapper = undefined;
});

/** Mounts a throwaway child that runs `useInjector()` from its own `setup()`, capturing the result. */
function mountReader(injector?: Injector): {read: () => Injector} {
    let result!: Injector;
    const Reader = defineComponent({
        setup() {
            result = useInjector();
            return () => null;
        },
    });

    activeWrapper = injector
        ? mount(NonnaProvider, {props: {injector}, slots: {default: () => h(Reader)}})
        : mount(Reader);
    return {read: () => result};
}

describe("NonnaProvider / useInjector()", () => {
    it("throws a descriptive error when called outside a NonnaProvider", () => {
        // Vue's default (no app.config.errorHandler) dev-mode error handling logs the setup()
        // error to console.error and then rethrows it - silence that expected noise, not a real
        // failure, same as @nonnajs/react's equivalent test does for React's render-phase errors.
        const consoleError = mock.method(console, "error", () => undefined);
        try {
            assert.throws(() => mountReader(), /must be called.*inside.*NonnaProvider/s);
        } finally {
            consoleError.mock.restore();
        }
    });

    it("returns the exact Injector instance passed to NonnaProvider", () => {
        const injector = Injector.create();
        const {read} = mountReader(injector);
        assert.equal(read(), injector);
    });

    it("makes the injector available to nested components, several levels deep", () => {
        const injector = Injector.create();
        let result!: Injector;
        const Grandchild = defineComponent({
            setup() {
                result = useInjector();
                return () => null;
            },
        });
        const Child = defineComponent({setup: () => () => h(Grandchild)});

        activeWrapper = mount(NonnaProvider, {props: {injector}, slots: {default: () => h(Child)}});
        assert.equal(result, injector);
    });
});
