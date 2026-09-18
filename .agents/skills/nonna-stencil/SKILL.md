---
name: nonna-stencil
description: Use when integrating @nonnajs/di into a StencilJS application — @Inject()/@OptionalInject()/@AllInject() property decorators (backed by getElement()), the shared <nonna-provider> element, or the two-stage Stencil+Vite build. Load nonna-di, nonna-compiler, and nonna-web-components first, since Stencil bindings are built directly on the W3C Context Protocol primitives from @nonnajs/web-components. Links to the full GitHub sample for bootstrap.
---

# Nonna on StencilJS

> Load [`nonna-di`](../nonna-di/SKILL.md) and
> [`nonna-web-components`](../nonna-web-components/SKILL.md) first — Stencil bindings reuse the
> same `<nonna-provider>` element and W3C Context Protocol underneath. Also read
> [`nonna-compiler`](../nonna-compiler/SKILL.md) if the app uses AOT constructor injection.

Package: [`@nonnajs/stencil`](https://github.com/nonnajs/nonna/tree/main/stencil). Full working
sample: [`github.com/nonnajs/sample-stencil`](https://github.com/nonnajs/sample-stencil) — fetch
and adapt it rather than hand-wiring the Stencil/Vite build boilerplate from scratch.

## Minimal setup

`@Inject()` resolves on property access — no `@Element()` field needed. The `declare` modifier is
**required** or the property silently resolves to `undefined`:

```tsx
@Component({tag: "user-list", shadow: false})
export class UserList {
    @Inject(UserService)
    private declare readonly userService: UserService;

    @State() users: User[] = [];

    componentWillLoad() {
        this.users = this.userService.getUsers();
    }

    render() {
        return (
            <ul>
                {this.users.map(u => (
                    <li key={u.id}>{u.name}</li>
                ))}
            </ul>
        );
    }
}
```

`main.ts` builds the injector, assigns it to `<nonna-provider>`, and **only then** defines/appends
the Stencil components — same deterministic-ordering requirement as
[`nonna-web-components`](../nonna-web-components/SKILL.md):

```ts
const injector = await Nonna.injector()
    .register({provide: GREETER, useClass: FriendlyGreeter, multi: true})
    .register({provide: GREETER, useClass: FormalGreeter, multi: true})
    .scan()
    .build();

const provider = document.getElementById("app-provider") as NonnaProviderElement;
provider.injector = injector;

const [{defineCustomElement: defineUserList}] = await Promise.all([import("../stencil-dist/components/user-list")]);
defineUserList();
provider.appendChild(document.createElement("user-list"));
```

## Highlights

-   `@Inject(Token)`, `@OptionalInject(Token)`, `@AllInject(Token)` — property decorators, no
    separate `@Element()` lookup unlike calling `requestInjection()` directly.
-   `<nonna-provider>` is the **same vanilla custom element** from `@nonnajs/web-components` — no
    Stencil-specific provider exists or is needed.
-   **`@services/*` alias**: `vite.config.ts`/`stencil.config.ts` must resolve it to the same
    absolute files so Stencil's bundler and Vite share one module instance per service class — two
    copies of a service class means two distinct, mutually unrecognized DI tokens.
-   **Two-stage build**: `stencil build` compiles `.tsx` components to individually-importable
    custom element modules (`dist-custom-elements` output target, `stencil-dist/components/*.js`);
    Vite then serves/bundles the app shell around them.
-   **AOT metadata** still comes from `@nonnajs/compiler` (`pnpm compile-deps`) for plain
    constructor-injected service classes.

## Decision points

-   **Ordering is load-bearing**: build injector → assign to `<nonna-provider>` → define/append
    Stencil components. Reversing this races the async injector build against Custom Elements
    upgrade semantics.
-   **Keep the `@services/*` alias in sync between `stencil.config.ts` and `vite.config.ts`** — a
    mismatch is the most common source of "injected property is undefined" bugs in Stencil apps.
-   **`declare` on injected properties is mandatory**, same reason as
    [`nonna-web-components`](../nonna-web-components/SKILL.md).
