---
name: update-deps
description: Triage and merge Dependabot PRs for n8n-nodes-parseur, resolving lockfile conflicts and verifying lint/typecheck/test/build. Use weekly or when asked to update dependencies.
---

# Update dependencies

Human runbook: MAINTAINING.md § 1. Keep both in sync.

## Rules

- Never merge a bump that breaks `npm run lint`, `npm run typecheck`, `npm test` or `npm run build`. Comment on the PR with the exact error and leave it open instead.
- Everything here is a devDependency; the published package has no runtime deps. Audit findings only matter if `npm audit fix` (never `--force`) can fix them.
- Known structural blockers (2026-09-15): ESLint 10 / @eslint/js 10 (node-cli plugins call removed ESLint APIs; node-cli pins eslint 9.29.0), TypeScript 7 (typescript-eslint peer `<6.1`). Re-test only when upstream changes.
- Do not touch `eslint.config.mjs`; do not pin `n8n-workflow` in `peerDependencies`.
- Report what was merged, what was skipped and why. Ask before closing a PR that is not clearly superseded.

## Procedure

1. Baseline on `master`: `git pull`, `npm ci --ignore-scripts`, `npm run lint && npm run build && npm test`, `find dist -type f | sort > /tmp/dist-before.txt`.
2. Triage: `gh pr list --author app/dependabot --json number,title,mergeStateStatus`, `gh pr checks <n>`. Group: same package at several versions → keep the newest; `eslint` + `@eslint/js` go together; `@n8n/*` go together.
3. Merge green minor/patch PRs first, riskiest last. GitHub-side: `gh pr merge <n> --merge --delete-branch`, then wait for Dependabot to rebase the others. Locally when several PRs conflict on the lockfile:
   ```bash
   git fetch origin
   git merge --no-ff --no-edit origin/dependabot/npm_and_yarn/<branch>
   # conflict? edit package.json by hand keeping both bumps, then:
   git checkout --ours package-lock.json
   npm install --package-lock-only --ignore-scripts
   git add package.json package-lock.json && git commit --no-edit
   npm ci --ignore-scripts && npm run lint && npm run typecheck && npm test && npm run build
   find dist -type f | sort | diff - /tmp/dist-before.txt
   ```
   Roll back a failed bump with `git reset --hard <sha before merge>` then `npm ci --ignore-scripts`.
4. Push `master` (or open a PR if the user wants review). Pushed merge commits mark the Dependabot PRs as merged. PRs whose target version is already in the lockfile: comment "superseded" and close.
5. `npm audit` for the summary; mention what remains and where it comes from (`npm ls <pkg>`).

## Gotchas

- `n8n-node lint` runs the project's local `eslint` binary, so the root `eslint` version matters even though node-cli nests its own.
- After a `@n8n/node-cli` bump, read the lint output for new rules; fix code rather than disabling rules.
- vitest's peer range on `@types/node` lets npm drift to the newest major on a fresh install; keep `@types/node` pinned to the `.nvmrc` major.
- `npm install` prints "vulnerabilities" for transitive LangChain deps under `@n8n/ai-node-sdk`; that is expected noise, not a regression.
