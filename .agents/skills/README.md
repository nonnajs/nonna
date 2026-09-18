# Nonna Agent Skills

This directory contains an [Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)-compatible
skill family for developing with (and extending) the [Nonna](https://github.com/nonnajs/nonna)
framework. Skills are auto-discovered by agents (GitHub Copilot CLI, Claude, etc.) by scanning every
`SKILL.md`'s YAML frontmatter — the `description` field is what gets matched against the user's
request, so read it before loading a skill's full body.

**This skill family is meant to be copied into other repositories** — apps built _with_ Nonna, not
just this monorepo — so every skill treats the `nonnajs/nonna` repo and its sample applications as
external references, not a local checkout (see the link convention below).

## Conventions

These conventions keep the family token-efficient and consistent. Follow them when adding a new
skill or editing an existing one.

1. **One directory per skill**, flat under `.agents/skills/<skill-name>/`, containing:
    - `SKILL.md` — required. YAML frontmatter (`name`, `description`) + a short Markdown body.
    - `resources/*.md` — optional. Anything long (full API tables, extended code samples,
      step-by-step guides) that isn't needed to _decide_ whether the skill applies, only to
      _execute_ it. Linked from the body by relative path, not inlined.
2. **Frontmatter rules:**
    - `name` matches the directory name exactly.
    - `description` is written in the **third person**, states **when to use this skill**
      concretely (trigger phrases/keywords a user or agent would naturally use), and is a single
      dense paragraph — this is the only part of the skill loaded during discovery, so it carries
      the most weight per token.
3. **Progressive disclosure / token savings:**
    - Keep `SKILL.md` bodies short — a working target is **under ~150 lines**. If a topic needs more,
      split the extra depth into `resources/` and link it.
    - **Never duplicate** content that already lives in a package `README.md` or a sample project.
      Link to it instead of copy-pasting (see link convention below). The skill body is a distilled
      _recipe_ (a minimal example + the decision points), not a copy of the docs.
4. **Link convention — two tiers.** A link's correct form depends on what it points at, because
   this skill family gets copied into other repos while the Nonna monorepo does not:
    - **Within the skill family** — one `SKILL.md` linking to another skill's `SKILL.md`, or to its
      _own_ `resources/*.md` — use a **relative path**, e.g. `../nonna-di/SKILL.md`. The whole
      `.agents/skills/` directory always travels together, so these keep resolving wherever it's
      copied.
    - **Into the Nonna monorepo or sample repos itself** — a package `README.md`, or any sample
      project source file — use an **absolute GitHub URL pinned to `main`**, e.g.
      `https://github.com/nonnajs/nonna/blob/main/README.md` or
      `https://github.com/nonnajs/sample-node-http`. A relative path like `../../../di/README.md`
      only resolves while the skill lives inside the monorepo checkout; it 404s once copied into a
      consumer app's own repo, which is the primary intended use case for this skill family.
5. **Orchestrator → concrete pattern:** the parent `nonna` skill acts as the root router whose job
   is to:
    - understand intent (which platform / runtime / UI framework / server flavour),
    - state a one-line "use when" for each concrete option,
    - tell the agent exactly which concrete skill directory to open next.
      Orchestrators **never** inline platform-specific detail — that belongs in the concrete skill.
      This keeps the always-scanned frontmatter (and the router body itself) tiny, so an agent only
      ever loads the one concrete skill it actually needs.
6. **Bootstrap via sample links:** every runtime/framework skill references the GitHub URL of its
   full working sample repo (e.g. `github.com/nonnajs/sample-react`,
   `github.com/nonnajs/sample-node-http`) so an agent can fetch or `degit` it for bootstrapping
   instead of generating all aspects from scratch.
7. **Server runtimes have two flavours:** server runtime skills (`nonna-node`, `nonna-deno`,
   `nonna-bun`) each cover both a plain process / background service sample and an HTTP REST sample
   with per-request DI scoping.

## Inventory

The table below lists every skill currently in this family:

### Foundational

| Skill                  | Role                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `nonna` (orchestrator) | Root router — framework overview, architectural pillars, and platform skill picker       |
| `nonna-di`             | `@nonnajs/di` runtime container — decorators, builder, scopes, lifecycle, `runInScope()` |
| `nonna-compiler`       | `@nonnajs/compiler` AOT compiler — `nonna-compile` CLI, TypeChecker token inference      |

### Server Runtimes

| Skill        | Flavour 1: Plain / Service                                                     | Flavour 2: HTTP REST Server                                                               |
| ------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `nonna-node` | [`sample-node`](https://github.com/nonnajs/sample-node)                        | [`sample-node-http`](https://github.com/nonnajs/sample-node-http) (native `node:http`)    |
| `nonna-deno` | [`sample-deno`](https://github.com/nonnajs/sample-deno) (async providers)      | [`sample-deno-http`](https://github.com/nonnajs/sample-deno-http) (Hono + `Deno.serve`)   |
| `nonna-bun`  | [`sample-bun`](https://github.com/nonnajs/sample-bun) (multi-provider plugins) | [`sample-bun-http`](https://github.com/nonnajs/sample-bun-http) (`Bun.serve` + Fetch API) |

### Frontend & Web Components

| Skill                  | Package                   | Reference Sample                                                                                   |
| ---------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `nonna-react`          | `@nonnajs/react`          | [`sample-react`](https://github.com/nonnajs/sample-react) (Vite + `<NonnaProvider>`)               |
| `nonna-vue`            | `@nonnajs/vue`            | [`sample-vue`](https://github.com/nonnajs/sample-vue) (Vite + Vue 3 composables)                   |
| `nonna-svelte`         | `@nonnajs/svelte`         | [`sample-svelte`](https://github.com/nonnajs/sample-svelte) (Vite + Svelte 5 context)              |
| `nonna-web-components` | `@nonnajs/web-components` | [`sample-web-components`](https://github.com/nonnajs/sample-web-components) (W3C Context Protocol) |
| `nonna-stencil`        | `@nonnajs/stencil`        | [`sample-stencil`](https://github.com/nonnajs/sample-stencil) (StencilJS + Vite)                   |

## Publishing and installing with the skills CLI

This skill family is distributable through [skills.sh](https://www.skills.sh/), the open
agent-skills ecosystem, using the [`skills` CLI](https://github.com/vercel-labs/skills)
(`vercel-labs/skills`). It works with any Git host (GitHub, GitLab, or a local path) and over 70
supported agents, including GitHub Copilot CLI.

### Installing this skill family

From a consumer app repo (not this monorepo), install directly from GitHub:

```bash
# Install every skill in this family into the current project
npx skills add nonnajs/nonna --skill '*' -a copilot-cli

# Or point at the skills subdirectory directly
npx skills add https://github.com/nonnajs/nonna/tree/main/.agents/skills --all

# Install just a few skills
npx skills add nonnajs/nonna --skill nonna --skill nonna-di --skill nonna-compiler --skill nonna-react -a copilot-cli

# Install globally (user directory) instead of per-project
npx skills add nonnajs/nonna --skill '*' -g -a copilot-cli

# List what's available without installing
npx skills add nonnajs/nonna --list
```

Use a skill one-off without installing it:

```bash
npx skills use nonnajs/nonna@nonna-di | copilot
npx skills use nonnajs/nonna --skill nonna-react --agent copilot-cli
```

### Publishing updates

There is no separate "publish" step — `skills.sh` and the CLI resolve skills straight from this
Git repository. To ship an update to consumers:

1. Edit the relevant `SKILL.md`/`resources/*.md` under `.agents/skills/` following the
   [Conventions](#conventions) above, and update this README's inventory if you added, removed, or
   renamed a skill.
2. Merge to `main` — `npx skills add nonnajs/nonna ...` always resolves the latest commit on the
   default branch (or a specific ref if the consumer pinned one).
3. Consumers re-run `npx skills add nonnajs/nonna --skill '*' -y` (or their original install
   command) to pull the update; `skills` diffs and re-links/copies changed files.
4. Optionally add an install-count badge to this README or the top-level project README:
    ```md
    [![skills.sh](https://skills.sh/b/nonnajs/nonna)](https://skills.sh/nonnajs/nonna)
    ```

See the CLI's own docs for private-repo auth, `--copy` vs. symlink installs, and the full list of
supported agents/options: [github.com/vercel-labs/skills](https://github.com/vercel-labs/skills).
