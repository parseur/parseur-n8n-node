# Working in this repository as Claude

This is `n8n-nodes-parseur`, Parseur's official n8n community node (two nodes + one credential, TypeScript, published to npm). Humans discuss it in the Slack channel `#n8n-node`.

## Read first

- `MAINTAINING.md`: runbooks for dependency updates, tests and releases, plus every known toolchain quirk.
- `docs/development.md`: repo layout, commands, how the test suite works.
- `.claude/skills/`: `update-deps`, `run-tests`, `release`. Follow them for those jobs.

## Always

- Verify with `npm ci && npm run lint && npm run typecheck && npm test && npm run build` before pushing or declaring something safe. Every source change comes with tests.
- Work on a branch and open a pull request. `master` requires a PR, one approval and green CI. Never bypass a ruleset, approve your own work, or approve a deployment: those are human actions.
- Say what you did, what you skipped and why, in plain language. Ask before anything outward-facing that is not covered by a runbook (closing PRs, publishing, changing repository settings).
- Keep `MAINTAINING.md`, the skills and `docs/` in sync when you learn a new gotcha or change a process.

## Never

- Merge a dependency bump that breaks lint, typecheck, tests or build. Comment on the PR with the error instead.
- Change `eslint.config.mjs`, the `n8n-workflow: "*"` peer dependency, or the pinned `eslint` / `@eslint/js` 9.x and `typescript` 6.x versions without reading the reasons in `MAINTAINING.md`.
- Put anything under `test/` that is an image (the build copies every `*.png`/`*.svg` into `dist/`).
- Commit secrets or real Parseur identifiers. Test fixtures use `dummy-…` values.
