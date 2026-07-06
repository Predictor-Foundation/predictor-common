# @predictor-foundation/git-hooks

Opinionated husky-based git hooks. Two hooks, fixed behaviour, fast-fail
on any failure:

### `pre-commit` (four steps, fixed order)

1. **format** - `biome format --write .` then re-stage modified files
2. **lint** - `biome check .` (warnings non-blocking; errors blocking)
3. **typecheck** - `pnpm -r exec tsc --noEmit`
4. **audit** - `pnpm audit --prod --audit-level=high`

### `commit-msg` (Conventional Commits shape check)

Validates the commit subject against:

```
<type>[(scope)][!]: <subject>
```

- `type` is one of `feat`, `fix`, `refactor`, `perf`, `deps`, `docs`,
  `chore`, `test`, `build`, `ci`, `style`, `revert`.
- `scope` is optional (the local hook doesn't enforce specific scope
  values - that's the server-side PR-title check's job).
- `subject` must start with a lowercase letter and not end with `.`.
- Merge / revert / fixup / squash / amend subjects pass through
  unchanged - they're either rewritten on squash-merge or are git
  plumbing, not user intent.

This is the **local** enforcement layer - it can be bypassed with
`git commit --no-verify`. For real enforcement, pair this with a
server-side check (a PR-title lint action with the same regex, gated as
a required status check on `main`).

No configurability. Every repo in the family gets the same hooks. If a
step becomes a bottleneck, the package is updated and consumers pick up
the new steps on the next `pnpm install`.

## Setup

```bash
pnpm add -D @predictor-foundation/git-hooks
```

```json
// package.json
{
  "scripts": { "prepare": "predictor-git-hooks install" }
}
```

Running `pnpm install` runs `prepare`, which:

1. Installs `husky` (a transitive dep - consumers don't declare it).
2. Drops `.husky/pre-commit` and `.husky/commit-msg` into the repo.

Each dropped hook is a one-liner that delegates to
`predictor-git-hooks run <step>`. Bumping this package's version changes
the actual steps without touching consumer `.husky/` files.

## Behaviour notes

- **CI safe.** `install` no-ops if `CI=true`.
- **Not a git repo?** `install` no-ops if `.git/` is absent.
- **Re-stage after format.** `pre-commit` step 1 may rewrite files; the
  runner issues `git update-index --again` before the next step so the
  commit sees the fixed content.
- **No pre-push.** If you need a heavier gate before push, add it via
  a separate package or server-side check.
