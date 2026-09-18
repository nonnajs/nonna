import type {Injector} from "@nonnajs/di";
import {provideInjector} from "./context";

/**
 * Custom HTML element that acts as a dependency injection boundary for any child elements in the DOM.
 * Implements the standard W3C Context Protocol.
 *
 * @example
 * ```html
 * <nonna-provider id="app-provider">
 *     <user-list></user-list>
 * </nonna-provider>
 *
 * <script type="module">
 *     import {defineNonnaProvider} from "@nonnajs/web-components";
 *     defineNonnaProvider();
 *     document.getElementById("app-provider").injector = injector;
 * </script>
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export class NonnaProviderElement extends HTMLElement {
    private _injector?: Injector;
    private _cleanup?: () => void;

    get injector(): Injector | undefined {
        return this._injector;
    }

    set injector(value: Injector | undefined) {
        this._injector = value;
        this._updateProvider();
    }

    connectedCallback(): void {
        this._updateProvider();
    }

    disconnectedCallback(): void {
        this._cleanup?.();
        this._cleanup = undefined;
    }

    private _updateProvider(): void {
        this._cleanup?.();
        this._cleanup = undefined;

        if (this._injector && this.isConnected) {
            this._cleanup = provideInjector(this, this._injector);
        }
    }
}

/**
 * Registers the `<nonna-provider>` custom element in the global `customElements` registry.
 *
 * @param tagName - Custom element tag name (defaults to "nonna-provider").
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export function defineNonnaProvider(tagName = "nonna-provider"): void {
    if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
        customElements.define(tagName, NonnaProviderElement);
    }
}
