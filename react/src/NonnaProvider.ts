import type {Injector} from "@nonnajs/di";
import {createContext, createElement, useContext} from "react";
import type {ReactElement, ReactNode} from "react";

/**
 * React context carrying the active {@link Injector}. Not exported directly - always go through
 * {@link NonnaProvider} to set it and {@link useInjector} (or the `useInjection`/
 * `useOptionalInjection`/`useAllInjections` hooks built on top of it) to read it.
 */
const NonnaContext = createContext<Injector | undefined>(undefined);
NonnaContext.displayName = "NonnaContext";

/** Props accepted by {@link NonnaProvider}. */
export interface NonnaProviderProps {
    /**
     * An already-configured, already-`initialize()`d {@link Injector} - e.g. the result of
     * `await Nonna.injector()...build()`. `NonnaProvider` never builds or initializes an
     * injector itself; resolve/await that once in your app's own bootstrap code (outside the
     * render tree) and pass the ready instance down.
     */
    injector: Injector;
    children?: ReactNode;
}

/**
 * Makes an {@link Injector} available to `useInjection()`/`useOptionalInjection()`/
 * `useAllInjections()`/`useInjector()` anywhere below it in the tree, via React context.
 *
 * @remarks
 * Deliberately takes a ready `Injector`, not a builder or a `Promise<Injector>` - bootstrapping
 * (`await Nonna.injector()...build()`) is async and belongs in your app's entry point, before the
 * first render, not inside the component tree. This keeps `NonnaProvider` itself trivial (a
 * single `Context.Provider`) and leaves loading-state handling (if you need one at all) entirely
 * up to you, the same way `inversify-react`'s `<Provider container={container}>` does.
 *
 * @example
 * ```tsx
 * const injector = await Nonna.injector().scan().build();
 *
 * createRoot(document.getElementById("root")!).render(
 *     <NonnaProvider injector={injector}>
 *         <App />
 *     </NonnaProvider>,
 * );
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function NonnaProvider({injector, children}: NonnaProviderProps): ReactElement {
    return createElement(NonnaContext.Provider, {value: injector}, children);
}

/**
 * Reads the {@link Injector} supplied by the nearest ancestor {@link NonnaProvider}.
 *
 * @throws {@link Error} if called outside a {@link NonnaProvider}.
 */
export function useInjector(): Injector {
    const injector = useContext(NonnaContext);
    if (!injector) {
        throw new Error(
            "useInjector() (and useInjection()/useOptionalInjection()/useAllInjections()) must be called from a component rendered inside <NonnaProvider injector={...}>.",
        );
    }
    return injector;
}
