---
name: release
description: Cut and publish a new version of n8n-nodes-parseur (release-it via n8n-node release, npm publish through GitHub Actions with provenance, n8n package scan). Use when asked to release, publish or bump the version.
---

# Release a new version

Human runbook: MAINTAINING.md § 3. Keep both in sync. Releasing is outward-facing: confirm the version number with the user before running `npm run release`, and report each external step as it happens.

## Preflight

1. On `master`, clean tree, up to date: `git status`, `git pull`. CI green for the latest commit: `gh run list --branch master --limit 1`.
2. `npm ci && npm run lint && npm run typecheck && npm test && npm run build`.
3. `npx @n8n/scan-community-package@beta n8n-nodes-parseur` → must pass for the currently published version; if not, fix first.
4. `export GITHUB_TOKEN=$(gh auth token)` so release-it creates the GitHub release via API. Without it, it opens a browser URL that GitHub rejects as too long (manual workaround: cut the URL after `tag=x.y.z`, retry, paste the latest CHANGELOG block as description, tag as title).
5. Decide the semver bump from `git log <last-tag>..HEAD --oneline` and `CHANGELOG.md` conventions; agree it with the user.

## Release

```bash
npm run release          # interactive: pick the version when prompted
```

What `n8n-node release` does (via release-it): `npm run lint && npm run build` → version prompt → `npx auto-changelog -p` updates CHANGELOG.md → commit `Release x.y.z` → tag `x.y.z` → push commit + tag → GitHub release with changelog notes. It does not publish to npm (`--npm.publish=false`).

## After

1. Tag push triggers `.github/workflows/publish.yml`: `gh run watch` / `gh run list --workflow publish.yml --limit 1`. In CI, `npm run release` runs lint, build and `npm publish` with provenance.
2. Confirm on npm: `npm view n8n-nodes-parseur version` (may lag a minute). dev@parseur.com receives npm's email.
3. `npx @n8n/scan-community-package@beta n8n-nodes-parseur` against the new version. Errors → fix → patch release.
4. `gh release view x.y.z` shows the changelog. n8n reviews the version and may email dev@parseur.com; it then appears in the n8n Creator portal.

## Gotchas

- Only repository admins can push `x.y.z` tags (ruleset _Release tags: admins only_), and npm accepts publishes only from `publish.yml` runs of this repo (Trusted Publishing, no `NPM_TOKEN`). If a release is refused at tag push, check the ruleset and your role rather than working around it.

- node-cli passes `--git.requireBranch main` to release-it in a form release-it ignores, which is why releasing from `master` works. If a node-cli update makes it effective, the release aborts with "Must be on branch main": rename the default branch to `main` (update `ci.yml`, `dependabot.yml`), do not bypass the check.
- `prepublishOnly` → `n8n-node prerelease` blocks any `npm publish` without `RELEASE_MODE`; that is intentional.
- Tags are bare `x.y.z`; `publish.yml` matches `*.*.*`.
- Publish failed before `npm publish`: fix on master and re-run the workflow for the same tag, or cut a patch. Broken version on npm: `npm deprecate n8n-nodes-parseur@x.y.z "reason"`, then patch release; never unpublish.
