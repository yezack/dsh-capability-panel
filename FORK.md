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

The live profile (`~/.dsh/profiles/desktop`) installs the **published npm package**, not this fork:
`dsh-capability-panel: 1.4.0`, resolved from the registry with an integrity hash. Nothing here reaches
that install until it is pointed at the fork (`"dsh-capability-panel": "github:yezack/dsh-capability-panel#yezack/main"`)
or until this delta is published / upstreamed.

A git install needs `lib/` committed: upstream has no `prepare` script and pnpm runs only `prepare`
for a git dependency, so nothing would build the plugin on install. This branch therefore commits the
built bundles.

## Building

`pnpm install` resolves on this machine as of v1.4.0 (the earlier lockfile's auto-installed peers that
pulled the unpublished `@deepseek-ai/dsh-user-interaction` are gone), so no scratch-install dance is
needed any more:

```powershell
pnpm install
node_modules\.bin\tsdown.cmd          # writes lib/
git add -f lib/index.js lib/index.d.ts lib/client.js   # lib/ is gitignored upstream; .map files stay untracked
```

## Verifying

```powershell
node_modules\typescript\bin\tsc -p tsconfig.test.json --noEmit
node_modules\.bin\oxlint.cmd --type-aware --tsconfig tsconfig.test.json src tests
node_modules\vitest\vitest.mjs run
```

623 of 624 tests pass on Windows. The single failure is pre-existing and POSIX-only:
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
