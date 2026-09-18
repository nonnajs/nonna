import {afterEach, describe, it, mock} from "node:test";
import assert from "node:assert/strict";
import {defineComponent, h, nextTick, ref} from "vue";
import {mount} from "@vue/test-utils";
import {Injector, ProviderNotFoundError} from "@nonnajs/di";
import {NonnaProvider} from "../src/NonnaProvider";
import {useAllInjections, useInjection, useOptionalInjection} from "../src/hooks";

let activeWrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
    activeWrapper?.unmount();
    activeWrapper = undefined;
});

/** Mounts `useComposable` from a throwaway child's `setup()`, inside a NonnaProvider for `injector`. */
function mountReader<T>(injector: Injector, useComposable: () => T): {result: () => T} {
    let result!: T;
    const Reader = defineComponent({
        setup() {
            result = useComposable();
            return () => null;
        },
    });
    activeWrapper = mount(NonnaProvider, {props: {injector}, slots: {default: () => h(Reader)}});
    return {result: () => result};
}

describe("useInjection()", () => {
    it("resolves a registered singleton token", () => {
        class Logger {}
        const injector = Injector.create();
        injector.register({provide: Logger, useClass: Logger});

        const {result} = mountReader(injector, () => useInjection(Logger));
        assert.ok(result() instanceof Logger);
    });

    it("resolves a transient-scoped token once per component instance - setup() runs once, unlike a React re-render", async () => {
        let constructions = 0;
        class Handler {
            constructor() {
                constructions++;
            }
        }
        const injector = Injector.create();
        injector.register({provide: Handler, useClass: Handler, scope: "transient"});

        let resolved!: Handler;
        let bump!: () => void;
        const Reader = defineComponent({
            setup() {
                resolved = useInjection(Handler);
                const count = ref(0);
                bump = () => count.value++;
                return () => h("div", String(count.value));
            },
        });
        activeWrapper = mount(NonnaProvider, {props: {injector}, slots: {default: () => h(Reader)}});
        const first = resolved;

        bump();
        await nextTick();
        bump();
        await nextTick();

        assert.equal(resolved, first);
        assert.equal(constructions, 1);
    });

    it("propagates ProviderNotFoundError for a missing required token, exactly like Injector.get()", () => {
        const MISSING = Symbol("MISSING");
        const injector = Injector.create();

        // Vue logs the setup()-phase error to console.error even though it's caught below - see
        // NonnaProvider.test.ts for why this is expected noise, not a real failure.
        const consoleError = mock.method(console, "error", () => undefined);
        try {
            assert.throws(
                () => mountReader(injector, () => useInjection(MISSING)),
                (error: unknown) => {
                    assert.ok(error instanceof ProviderNotFoundError);
                    return true;
                },
            );
        } finally {
            consoleError.mock.restore();
        }
    });

    it("resolves independently per component instance - a new instance re-resolves for a different token", () => {
        class A {}
        class B {}
        const injector = Injector.create();
        injector.register({provide: A, useClass: A});
        injector.register({provide: B, useClass: B});

        const a = mountReader(injector, () => useInjection(A));
        assert.ok(a.result() instanceof A);
        activeWrapper?.unmount();

        const b = mountReader(injector, () => useInjection(B));
        assert.ok(b.result() instanceof B);
    });
});

describe("useOptionalInjection()", () => {
    it("resolves undefined instead of throwing for a missing token", () => {
        const MISSING = Symbol("MISSING");
        const injector = Injector.create();

        const {result} = mountReader(injector, () => useOptionalInjection(MISSING));
        assert.equal(result(), undefined);
    });

    it("resolves the value when the token is registered", () => {
        const CONFIG = Symbol("CONFIG");
        const injector = Injector.create();
        injector.registerValue(CONFIG, {port: 8080});

        const {result} = mountReader(injector, () => useOptionalInjection(CONFIG));
        assert.deepEqual(result(), {port: 8080});
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

        const {result} = mountReader(injector, () => useAllInjections(PLUGIN));
        assert.equal(result().length, 2);
        assert.ok(result()[0] instanceof AuthPlugin);
        assert.ok(result()[1] instanceof MetricsPlugin);
    });

    it("resolves to an empty array when nothing is registered for the token", () => {
        const PLUGIN = Symbol("PLUGIN");
        const injector = Injector.create();

        const {result} = mountReader(injector, () => useAllInjections(PLUGIN));
        assert.deepEqual(result(), []);
    });
});
