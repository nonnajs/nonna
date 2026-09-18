import type {Injector} from "@nonnajs/di";
import type {InjectionKey, PropType, Slots, VNode} from "vue";
import {defineComponent, inject, provide, toRaw} from "vue";

/**
 * Vue injection key carrying the active {@link Injector}.
 */
export const NONNA_INJECTOR_KEY: InjectionKey<Injector> = Symbol.for("nonna:vue:injector");

/**
 * Renderless component that makes an {@link Injector} available to `useInjection()`/
 * `useOptionalInjection()`/`useAllInjections()`/`useInjector()` anywhere below it in the tree, via
 * Vue's `provide`/`inject`.
 *
 * @remarks
 * Deliberately takes a ready `Injector`, not a builder or a `Promise<Injector>` - bootstrapping
 * (`await Nonna.injector()...build()`) is async and belongs in your app's entry point, before the
 * first `app.mount()`, not inside the component tree. This keeps `NonnaProvider` itself trivial (a
 * single `provide()` call) and leaves loading-state handling (if you need one at all) entirely up
 * to you, the same way `@nonnajs/react`'s `<NonnaProvider>` works.
 *
 * @example
 * ```vue
 * <!-- App.vue -->
 * <script setup lang="ts">
 * import type {Injector} from "@nonnajs/di";
 * import {NonnaProvider} from "@nonnajs/vue";
 * defineProps<{injector: Injector}>();
 * </script>
 *
 * <template>
 *     <NonnaProvider :injector="injector">
 *         <UserList />
 *     </NonnaProvider>
 * </template>
 * ```
 *
 * @author Manuel Santos (https://github.com/manusant)
 */
export const NonnaProvider = defineComponent({
    name: "NonnaProvider",
    props: {
        /** An already-configured, already-`initialize()`d {@link Injector}. */
        injector: {
            type: Object as PropType<Injector>,
            required: true,
        },
    },
    setup(props, {slots}: {slots: Slots}) {
        provide(NONNA_INJECTOR_KEY, toRaw(props.injector));
        return (): VNode[] | undefined => slots["default"]?.();
    },
});

/**
 * Reads the {@link Injector} supplied by the nearest ancestor {@link NonnaProvider}.
 *
 * @remarks
 * Like every other Vue `inject()`-based composable, this only works when called synchronously
 * from a component's `setup()` (or another composable itself called from `setup()`) - not from a
 * callback, `onMounted()`, or anywhere else Vue has lost track of the current component instance.
 *
 * @throws {@link Error} if called outside a {@link NonnaProvider}.
 */
export function useInjector(): Injector {
    const injector = inject(NONNA_INJECTOR_KEY);
    if (!injector) {
        throw new Error(
            "useInjector() (and useInjection()/useOptionalInjection()/useAllInjections()) must be called from " +
                'setup() of a component rendered inside <NonnaProvider :injector="...">.',
        );
    }
    return injector;
}
