import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {render} from "svelte/server";
import {Injector, ProviderNotFoundError} from "@nonnajs/di";
import {
    setInjector,
    hasInjector,
    useInjector,
    useInjection,
    useOptionalInjection,
    useAllInjections,
    NONNA_INJECTOR_KEY,
} from "../src";

type AnyRenderer = {
    component: (fn: ($$renderer: AnyRenderer) => void) => void;
    push: (html: string) => void;
};

/** Helper to render a component function and trigger execution */
function renderComponent(fn: ($$renderer: AnyRenderer) => void) {
    const Component = ($$renderer: AnyRenderer) => {
        $$renderer.component($$r => {
            fn($$r);
            $$r.push("<div></div>");
        });
    };
    const res = render(Component as unknown as Parameters<typeof render>[0], {props: {}} as never);
    // Accessing body triggers synchronous render evaluation
    void res.body;
}

describe("@nonnajs/svelte context & hooks", () => {
    it("NONNA_INJECTOR_KEY is a symbol", () => {
        assert.equal(typeof NONNA_INJECTOR_KEY, "symbol");
    });

    it("setInjector() returns the passed injector", () => {
        const injector = Injector.create();
        let returned: Injector | undefined;

        renderComponent(() => {
            returned = setInjector(injector);
        });

        assert.equal(returned, injector);
    });

    it("hasInjector() returns true when injector is in context, false otherwise", () => {
        const injector = Injector.create();
        let hasBefore: boolean | undefined;
        let hasAfter: boolean | undefined;

        renderComponent(() => {
            hasBefore = hasInjector();
            setInjector(injector);
            hasAfter = hasInjector();
        });

        assert.equal(hasBefore, false);
        assert.equal(hasAfter, true);
    });

    it("useInjector() returns the active injector from context", () => {
        const injector = Injector.create();
        let readInjector: Injector | undefined;

        renderComponent(() => {
            setInjector(injector);
            readInjector = useInjector();
        });

        assert.equal(readInjector, injector);
    });

    it("useInjector() throws descriptive error when called outside injector context", () => {
        assert.throws(
            () => {
                renderComponent(() => {
                    useInjector();
                });
            },
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.match(err.message, /must be called during component initialization/);
                return true;
            },
        );
    });

    it("passes injector down to child components in the tree", () => {
        const injector = Injector.create();
        class TestService {
            value = 42;
        }
        injector.register({provide: TestService, useClass: TestService});

        let childValue: number | undefined;

        const ChildComponent = ($$renderer: AnyRenderer) => {
            $$renderer.component(() => {
                const svc = useInjection(TestService);
                childValue = svc.value;
            });
        };

        renderComponent($$r => {
            setInjector(injector);
            ChildComponent($$r);
        });

        assert.equal(childValue, 42);
    });

    describe("useInjection()", () => {
        it("resolves a registered singleton token", () => {
            class Logger {
                id = "logger-1";
            }
            const injector = Injector.create();
            injector.register({provide: Logger, useClass: Logger});

            let logger: Logger | undefined;

            renderComponent(() => {
                setInjector(injector);
                logger = useInjection(Logger);
            });

            assert.ok(logger instanceof Logger);
            assert.equal(logger?.id, "logger-1");
        });

        it("propagates ProviderNotFoundError for missing required token", () => {
            const MISSING = Symbol("MISSING");
            const injector = Injector.create();

            assert.throws(
                () => {
                    renderComponent(() => {
                        setInjector(injector);
                        useInjection(MISSING);
                    });
                },
                (err: unknown) => {
                    assert.ok(err instanceof ProviderNotFoundError);
                    return true;
                },
            );
        });
    });

    describe("useOptionalInjection()", () => {
        it("resolves undefined for missing token", () => {
            const MISSING = Symbol("MISSING");
            const injector = Injector.create();
            let resolved: unknown = "not-undefined";

            renderComponent(() => {
                setInjector(injector);
                resolved = useOptionalInjection(MISSING);
            });

            assert.equal(resolved, undefined);
        });

        it("resolves registered value when present", () => {
            const CONFIG = Symbol("CONFIG");
            const injector = Injector.create();
            injector.registerValue(CONFIG, {apiUrl: "https://example.com/api"});

            let resolved: unknown;

            renderComponent(() => {
                setInjector(injector);
                resolved = useOptionalInjection(CONFIG);
            });

            assert.deepEqual(resolved, {apiUrl: "https://example.com/api"});
        });
    });

    describe("useAllInjections()", () => {
        it("resolves all multi: true registrations in order", () => {
            const PLUGIN = Symbol("PLUGIN");
            class PluginA {
                name = "A";
            }
            class PluginB {
                name = "B";
            }
            const injector = Injector.create();
            injector.register({provide: PLUGIN, useClass: PluginA, multi: true});
            injector.register({provide: PLUGIN, useClass: PluginB, multi: true});

            let plugins: readonly (PluginA | PluginB)[] = [];

            renderComponent(() => {
                setInjector(injector);
                plugins = useAllInjections(PLUGIN);
            });

            assert.equal(plugins.length, 2);
            assert.ok(plugins[0] instanceof PluginA);
            assert.ok(plugins[1] instanceof PluginB);
        });

        it("resolves empty array when no providers are registered for token", () => {
            const PLUGIN = Symbol("PLUGIN");
            const injector = Injector.create();
            let plugins: readonly unknown[] = ["initial"];

            renderComponent(() => {
                setInjector(injector);
                plugins = useAllInjections(PLUGIN);
            });

            assert.deepEqual(plugins, []);
        });
    });
});
