import type {Injector, Token} from "@nonna/di";

/**
 * Standard W3C Context Protocol event name.
 * @see https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md
 */
export const CONTEXT_REQUEST_EVENT = "context-request";

/**
 * Unique identifier for Nonna Injector context in the W3C Context Protocol.
 */
export const NONNA_INJECTOR_CONTEXT = Symbol.for("@nonna/di/injector");

/**
 * Event detail payload for standard W3C Context Protocol requests.
 */
export interface ContextRequestDetail<T = unknown> {
    context: unknown;
    callback: (value: T, unsubscribe?: () => void) => void;
    subscribe?: boolean;
}

/**
 * Attaches an event listener on `host` to provide `injector` to any descending custom elements
 * via the standard W3C Context Protocol.
 *
 * @param host - DOM node or EventTarget that acts as the provider boundary (e.g. document, window, or container element).
 * @param injector - An already configured and initialized {@link Injector}.
 * @returns A teardown function that removes the event listener.
 *
 * @example
 * ```ts
 * const injector = await Nonna.injector().scan().build();
 * const cleanup = provideInjector(document.body, injector);
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function provideInjector(host: EventTarget, injector: Injector): () => void {
    const handler = (event: Event): void => {
        const customEvent = event as CustomEvent<ContextRequestDetail<Injector>>;
        if (customEvent.detail && customEvent.detail.context === NONNA_INJECTOR_CONTEXT) {
            customEvent.stopImmediatePropagation();
            customEvent.detail.callback(injector);
        }
    };

    host.addEventListener(CONTEXT_REQUEST_EVENT, handler);
    return () => {
        host.removeEventListener(CONTEXT_REQUEST_EVENT, handler);
    };
}

/**
 * Requests the active {@link Injector} from the nearest ancestor provider in the DOM tree
 * using the standard W3C Context Protocol.
 *
 * @param element - The custom element or EventTarget requesting the injector.
 * @returns The resolved {@link Injector}.
 * @throws {@link Error} if no ancestor provider responds to the context request.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function requestInjector(element: EventTarget): Injector {
    let resolved: Injector | undefined;

    const CustomEventCtor =
        (typeof (element as Node).ownerDocument !== "undefined" &&
            (element as Node).ownerDocument?.defaultView?.CustomEvent) ||
        globalThis.CustomEvent ||
        CustomEvent;

    const event = new CustomEventCtor<ContextRequestDetail<Injector>>(CONTEXT_REQUEST_EVENT, {
        detail: {
            context: NONNA_INJECTOR_CONTEXT,
            callback: injector => {
                resolved = injector;
            },
        },
        bubbles: true,
        composed: true,
        cancelable: true,
    });

    element.dispatchEvent(event);

    if (!resolved) {
        throw new Error(
            "requestInjector() (and requestInjection()/requestOptionalInjection()/requestAllInjections()) " +
                "must be called on an element within a DOM tree where provideInjector() or <nonna-provider> was configured.",
        );
    }

    return resolved;
}

/**
 * Synchronously resolves a required `token` from the nearest ancestor {@link Injector}.
 *
 * @param element - The custom element requesting the injection.
 * @param token - The dependency token to resolve.
 * @returns The resolved instance or value.
 * @throws Whatever `Injector.get()` throws (`ProviderNotFoundError`, `AsyncProviderError`, `ScopeError`, ...).
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function requestInjection<T>(element: EventTarget, token: Token<T>): T {
    return requestInjector(element).get(token);
}

/**
 * Resolves an optional `token` from the nearest ancestor {@link Injector}, returning `undefined`
 * if unregistered.
 *
 * @param element - The custom element requesting the injection.
 * @param token - The dependency token to resolve.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function requestOptionalInjection<T>(element: EventTarget, token: Token<T>): T | undefined {
    return requestInjector(element).getOptional(token);
}

/**
 * Resolves all contributions for a `multi: true` token from the nearest ancestor {@link Injector}.
 *
 * @param element - The custom element requesting the injection.
 * @param token - The dependency token to resolve.
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function requestAllInjections<T>(element: EventTarget, token: Token<T>): readonly T[] {
    return requestInjector(element).getAll(token);
}
