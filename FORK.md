# Fork notes (`yezack/dsh-capability-panel`)

A personal fork of [pure-craft/dsh-capability-panel](https://github.com/pure-craft/dsh-capability-panel)
(MIT). `main` tracks upstream; the delta lives on `yezack/main`.

- **Base**: upstream `c89c2b2` — *feat: plugin card icon, clearer row glyphs, no tool-type guessing*
  (v1.4.0, 2026-09-30). The fork previously sat on `336635f` (v1.1.1) and was 22 commits behind.
- **Why a fork**: the alternative would be a `pnpm patch` against the published bundle. That patch was
  already rolled and dropped once on an upstream version bump, and the published package ships no
  `src/` — so the delta is maintained in TypeScript here instead.

## Delta

| Change | Where |
|---|---|
| A server whose every registered tool is a stored default of the session's preset is marked `defaultDisabled` (read from the preset's own list, never from the session's masks) | `src/host/catalog.ts`, `src/host/route.ts`, `src/contract.ts`, `src/wire.ts` |
| The composer's MCP tab hides those rows by default — the panel answers "what can this session reach", and a preset-off server is off before the session acts — behind a count line and a Show/Hide switch; a filter query still searches every row | `src/client/index.ts`, `src/client/locale.ts`, `src/client/styles.ts` |

Tests: `tests/host/catalog.spec.ts` (*defaultDisabled marks the servers the preset switches off*),
`tests/wire.spec.ts` (*carries the preset-off marker…*).

### Absorbed by upstream (no longer carried here)

- Declared-but-tool-less MCP server rows + a Reconnect entry, and re-seeding live sessions after a
  restart. Upstream shipped its own version in 1.2.0 (`9c5ce00`, `312820c`, `a2674d5`), which re-applies
  stored masks from the registry's `tools/change` broadcast instead of an explicit per-session reseed.
- Matching the MCP client entry by plugin name rather than by a `serverName` config key.

## Installing

Published to npm as **`@yezack/dsh-capability-panel`** — the unscoped name belongs to the upstream
maintainer, so this fork cannot publish under it. The live profile (`~/.dsh/profiles/desktop`) is wired
to that scoped package (dependency + `dsh.profile.bundles` entry + the profile patch's `name`), and its
`pnpm-workspace.yaml` lists the version under `minimumReleaseAgeExclude` so the supply-chain age policy
does not reject a fresh publish.

A git install works too, and needs `lib/` committed: upstream has no `prepare` script and pnpm runs only
`prepare` for a git dependency, so nothing would build the plugin on install. This branch therefore
commits the built bundles.

### Renaming the package — read this first

The **client bundle's module id is baked in at build time** and must equal the package name: the host
mounts a bundle by name and then asks `__ModuleLoader__` for exactly that id. A `lib/` built before a
rename registers itself under the OLD name, and the boot dies with:

```
web boot: 1 entry did not activate
@yezack/dsh-capability-panel: import failed
renderer: client-modules: duplicate factory registration for "dsh-capability-panel"
```

`tsdown.config.ts` now derives the id from `package.json`, and
`tests/integration/composition.spec.ts` asserts both the patch name and the built bundle's own id — but
**rebuild `lib/` after any rename**. Keep `cordis.patch.yml`'s `id: capability-panel` pinned: it is the
settings namespace (`entryNamespace()` reads the fiber entry id, with that literal as its fallback), so
moving it strands every stored preset and session switch.

## Building

`pnpm install` resolves on this machine as of v1.4.0 (the earlier lockfile's auto-installed peers that
pulled the unpublished `@deepseek-ai/dsh-user-interaction` are gone), so no scratch-install dance is
needed any more:

```powershell
pnpm install
node_modules\.bin\tsdown.cmd          # writes lib/; the client module id comes from package.json
git add -f lib/index.js lib/index.d.ts lib/client.js   # lib/ is gitignored upstream; .map files stay untracked
```

## Versions and releasing

Version rule: **minor and major track upstream; the patch digit is this fork's own revision.**

| Fork | Upstream base | What it carries |
|---|---|---|
| `1.4.0` | `c89c2b2` (v1.4.0) | the delta, but built before the rename — its client bundle still registered itself as `dsh-capability-panel`. **Broken**, deprecated on npm. |
| `1.4.1` | `c89c2b2` (v1.4.0) | the delta, correct module id. |

So upstream's 1.5.0 becomes this fork's `1.5.1` (never plain `1.5.0`), and a second fix on the same
upstream base becomes `1.4.2`. npm's `latest` tag and ordinary semver ranges keep working, and the
minor number still says which upstream release this is built on.

Releasing, from the package root (the user-level `.npmrc` registry is a read mirror, so publishes must
name the real registry explicitly, through the local proxy):

```powershell
node_modules\.bin\tsdown.cmd          # rebuild lib/ FIRST — the client module id is baked in
node_modules\vitest\vitest.mjs run    # 625/626 on Windows; see Verifying below
git add -f lib/index.js lib/index.d.ts lib/client.js
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'
npm publish --ignore-scripts --access public --registry=https://registry.npmjs.org
```

`--ignore-scripts` is deliberate: `prepublishOnly` runs `pnpm run check`, which cannot pass on Windows
(the `$HOME` test) and whose `pnpm run` fails under the DSH sandbox anyway. Run the checks by hand.

Consuming a fresh publish: **pnpm 11 refuses packages younger than 24 hours** unless the package is
exempted by `minimumReleaseAgeExclude` in the consuming project's `pnpm-workspace.yaml`, and the entry
**must be the bare package name** — an `name@version` entry does not match (measured: with
`'@yezack/dsh-capability-panel@1.4.0'` listed, the policy still rejected `1.4.0`; with
`'@yezack/dsh-capability-panel'` it passed). The profile's list already carries the bare name; its two
older `name@version` entries are presumably inert for the same reason.

## Verifying

```powershell
node_modules\typescript\bin\tsc -p tsconfig.test.json --noEmit
node_modules\.bin\oxlint.cmd --type-aware --tsconfig tsconfig.test.json src tests
node_modules\vitest\vitest.mjs run
```

625 of 626 tests pass on Windows. The single failure is pre-existing and POSIX-only:
`displayPath > abbreviates the user home as ~` asserts on `process.env['HOME']`, which does not exist
here (the test and the function are both untouched by the delta — the only hunk in that spec file is
the appended `defaultDisabled` block).

Two environment notes: `pnpm run <script>` fails under the DSH file sandbox with *unable to open
database file*, and vitest/vite need `exec` for Windows path probing (`spawn EPERM`), so run the
binaries directly and outside the confined sandbox.

## Rebasing on upstream

```powershell
git fetch upstream
git rebase upstream/main          # then rebuild lib/ and commit it (see Building)
git push --force-with-lease origin yezack/main
```

If upstream ever grows this feature, drop the commit and let `main` carry everything.
