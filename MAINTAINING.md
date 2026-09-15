# Maintaining n8n-nodes-parseur

Runbooks for the three recurring jobs: **keeping dependencies current**, **keeping the tests green**, and **shipping a release**. Each one also exists as a Claude Code skill in [`.claude/skills/`](.claude/skills) so the work can be delegated; the skills and this file must say the same thing, update both.

For day-to-day code changes see [docs/development.md](docs/development.md).

## The toolchain in one minute

| Piece                            | Role                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@n8n/node-cli` (`n8n-node …`)   | n8n's official CLI: `build` (`tsc` + copy icons), `lint` (ESLint with n8n's rules), `dev`, `release` (wraps release-it), `prerelease` (blocks a bare `npm publish`).            |
| `eslint` 9.29.0 + `@eslint/js`   | **Pinned on purpose.** node-cli's lint plugins break on ESLint 10 (verified 2026-09-15). Dependabot ignores ESLint majors.                                                      |
| `typescript` 6.x                 | TS 7 compiles the package fine, but typescript-eslint (used by `n8n-node lint`) supports `< 6.1` only. Stay on 6 until typescript-eslint supports 7.                            |
| `@types/node` ^22                | Matches `.nvmrc`. Pinned because vitest's peer range otherwise lets npm install the newest major, which changed `Buffer`/`Blob` typings and broke `tsc`.                        |
| `vitest` + `@vitest/coverage-v8` | Test runner. `n8n-workflow` is an explicit devDependency so tests compile against a known version (it stays `*` in `peerDependencies`, a lint rule requires that).              |
| `release-it` + `auto-changelog`  | Driven by `n8n-node release`: version bump, `CHANGELOG.md`, commit, tag, push, GitHub release.                                                                                  |
| `.github/workflows/ci.yml`       | Lint, typecheck, test, build on pushes to `master` and on every PR.                                                                                                             |
| `.github/workflows/publish.yml`  | On a `x.y.z` tag: `npm run release` in CI mode = lint, build, `npm publish` with provenance (required by n8n since May 2026).                                                   |
| `.github/dependabot.yml`         | Weekly npm updates, grouped: `n8n-toolchain` (`@n8n/*`, `n8n-workflow`) and `dev-minor-patch` (everything else minor/patch). Majors come alone. Monthly GitHub Actions updates. |

The full local check, run it before pushing anything:

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

## 1. Applying dependency updates

Dependabot opens PRs weekly; CI runs on each. Once a week (or when notified):

1. **Triage.** `gh pr list --author app/dependabot`. Read titles; check CI status with `gh pr checks <n>`.
2. **Green PR, minor/patch, or grouped PR:** merge it (`gh pr merge <n> --merge --delete-branch`). Prefer `--merge` over squash so the branch history stays linear with Dependabot's rebases.
3. **Several PRs touching the lockfile** conflict with each other after the first merge. Either wait for Dependabot to rebase (a few minutes) or merge locally:
   ```bash
   git fetch origin
   git merge --no-ff origin/dependabot/npm_and_yarn/<branch>
   # on conflict: fix package.json by hand (keep both bumps), then regenerate the lockfile
   git checkout --ours package-lock.json
   npm install --package-lock-only --ignore-scripts
   npm ci --ignore-scripts && npm run lint && npm run typecheck && npm test && npm run build
   git add package.json package-lock.json && git commit --no-edit
   ```
   Pushing `master` afterwards marks the PRs as merged on GitHub (their head commits are in the history).
4. **Major bumps:** check the PR body for breaking changes, then run the full local check on the branch. If tooling breaks, do not merge: comment on the PR with the exact error and what upstream change would unblock it, and leave it open (or close it and add an `ignore` rule in `dependabot.yml` when the block is structural, as done for ESLint majors).
5. **`@n8n/node-cli` bumps** deserve a look at `npm run lint` output: new rules may flag existing code. Fix the code rather than disabling rules; n8n's cloud verification runs the same rules.
6. **Security advisories:** `npm audit`. Most findings are transitive under `@n8n/node-cli` (its AI SDK pulls LangChain). If `npm audit fix` (never `--force`) does not fix them and the vulnerable package is not in our runtime dependency tree (we have none: everything is `devDependencies`), note it and move on.
7. Compare `dist/` before/after (`find dist -type f | sort`) when a toolchain package changes; the file list must not change.

Known blockers as of 2026-09-15: ESLint 10 (#100, #92) and TypeScript 7 (#74). Re-test them when `@n8n/node-cli` releases mention ESLint 10 or typescript-eslint announces TS 7 support.

## 2. Running and updating the tests

- `npm test` runs the suite (~1 s). `npm run test:coverage` prints coverage; the target is 100% lines on `nodes/` and `credentials/`.
- `npm run typecheck` type-checks `test/` and `vitest.config.mts` with `tsconfig.test.json`; the build config excludes `test/` so nothing test-related can reach `dist/` or the npm package.
- Tests use a hand-rolled mock of n8n's execution context (`test/helpers/mockContext.ts`) and assert on the HTTP request the node builds. How to write one, and the lint rules that apply to test files, are in [docs/development.md](docs/development.md#the-test-suite).
- When a test fails after a dependency bump, first decide whether the **node's behaviour** changed (n8n-workflow update changed `NodeApiError` semantics, for instance) or only the **test tooling**. Update the assertion only when the new behaviour is the intended one.
- When you change the node: every operation, event and webhook method has a test file section; extend it in the same PR. CI enforces lint + typecheck + tests + build.

## 3. Publishing a new version

Releases are cut from `master` on a maintainer's machine; npm publishing happens in GitHub Actions.

### Before

1. `master` is green in CI and your working tree is clean and up to date (`git status`, `git pull`).
2. Run the full local check (above).
3. Run n8n's package scanner against the **current** published version to make sure nothing regressed on their side:
   `npx @n8n/scan-community-package@beta n8n-nodes-parseur`
4. Have a GitHub token in the environment so release-it can create the GitHub release through the API instead of opening a browser:
   `export GITHUB_TOKEN=$(gh auth token)`
   Without it release-it opens a pre-filled "new release" web page whose URL is too long for GitHub; the historical workaround was to truncate the URL after `tag=x.y.z`, retry, and paste the latest `CHANGELOG.md` block into the description by hand.

### Release

```bash
npm run release
```

`n8n-node release` runs release-it, which: runs `npm run lint && npm run build`, asks for the new version (semver prompt), writes `CHANGELOG.md` with auto-changelog, commits `Release x.y.z`, tags `x.y.z`, pushes commit and tag, and creates the GitHub release with the changelog as notes. It does **not** publish to npm.

Quirks worth knowing:

- release-it is told `--git.requireBranch main` by node-cli, yet releases from `master` work because the flag is passed in a form release-it does not parse. If a future node-cli version fixes that, releases will refuse to run from `master`; the fix is renaming the default branch to `main` (and updating `ci.yml` and `dependabot.yml`), not skipping the check.
- `prepublishOnly` runs `n8n-node prerelease`, which fails unless `RELEASE_MODE` is set. That is intentional: it stops accidental `npm publish` from a laptop.
- Tags are bare `x.y.z` (no `v`); `publish.yml` triggers on `*.*.*`.

### After

1. Open the **Publish** run at <https://github.com/parseur/parseur-n8n-node/actions>: it waits for approval. Click **Review deployments → npm-publish → Approve and deploy**. It then runs lint and build again and `npm publish --provenance` (OIDC trusted publishing; no `NPM_TOKEN` is configured).
2. `dev@parseur.com` receives npm's publication email. Then verify the published package:
   `npx @n8n/scan-community-package@beta n8n-nodes-parseur`
   If the scan reports errors: fix them, and cut a patch release (lint → release → scan again).
3. Check the GitHub release exists with the changelog as description and the tag as title: `gh release view x.y.z`.
4. n8n's team reviews new versions of verified community nodes and contacts `dev@parseur.com` with questions. The new version shows up in the [n8n Creator portal](https://n8n.io/creators/) once approved.

### Who can release

Publishing is possible only through `publish.yml`, and `publish.yml` only runs on a `x.y.z` tag pushed to this repository:

- **npm side:** the package is published with npm **Trusted Publishing** (OIDC). npm accepts a publish only from a GitHub Actions run of `publish.yml` in `parseur/parseur-n8n-node`; there is no long-lived `NPM_TOKEN` in the repository secrets. The npm package owner is the `parseur` npm account.
- **GitHub side:** the repository ruleset _Release tags: admins only_ (Settings → Rules) restricts creating, moving and deleting `*.*.*` tags to repository admins. Access to the repository is granted through the `devs` team of the Parseur org (org members only, 2FA enforced, no outside collaborators). Workflows get a read-only `GITHUB_TOKEN` by default; `publish.yml` requests `id-token: write` explicitly.
- **Approval gate:** the publish job runs in the `npm-publish` GitHub environment, which requires a review by a member of the `devs` team before it starts (Actions → the Publish run → _Review deployments_). The environment only accepts `x.y.z` tags. The npm Trusted Publisher configuration must name this environment, otherwise npm rejects the OIDC token.
- **`master` protection:** the ruleset _Protect master: PR + CI required_ requires changes to arrive by pull request with one approval and a green **Lint, test and build** check. Repository admins may bypass it; this is what lets `npm run release` push the `Release x.y.z` commit directly, and what lets a lone admin merge a Dependabot PR (`gh pr merge --admin`). Bypasses are logged in the repository's rule insights.
- Pull requests from forks run CI with a read-only token and no secrets or OIDC, so they cannot publish.

Review the collaborator list and the ruleset when someone joins or leaves the team.

### If something went wrong

- Publish workflow failed before `npm publish`: fix on `master`, then re-run the workflow from the Actions tab (same tag) or cut a patch release.
- A broken version reached npm: `npm deprecate n8n-nodes-parseur@x.y.z "reason"` and release a fixed patch. Do not unpublish.
