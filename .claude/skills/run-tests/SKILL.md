---
name: run-tests
description: Run, debug and extend the vitest suite of n8n-nodes-parseur (node operations, trigger webhooks, credentials). Use when tests fail, when the node changes, or when asked to check the package.
---

# Run and update the tests

Human runbook: MAINTAINING.md § 2 and docs/development.md § "The test suite". Keep them in sync with this skill.

## Commands

```bash
npm test                 # vitest run (~1 s)
npm run test:watch
npm run test:coverage    # target: 100% lines on nodes/ and credentials/
npm run typecheck        # tsc -p tsconfig.test.json (tests + vitest.config.mts)
npm run lint             # n8n rules also apply to test/**/*.ts
```

Full pre-push check: `npm run lint && npm run typecheck && npm test && npm run build`.

## How the suite works

- No network. `test/helpers/mockContext.ts` → `createMockContext({...})` returns `{ ctx, http, staticData, ... }`; `ctx` stands in for `IExecuteFunctions` / `ILoadOptionsFunctions` / `IHookFunctions` / `IWebhookFunctions`. `http` is the `helpers.httpRequestWithAuthentication` mock; `requestOptions(http, n)` returns the request the node built.
- Call node methods with `.call(ctx)`: `new Parseur().execute.call(ctx)`, `trigger.webhookMethods.default.create.call(ctx)`, `trigger.methods.loadOptions.getTableFields.call(ctx)`.
- Options: `params` (flat or per-item array), `items`, `credentials`, `continueOnFail`, `httpResponse` | `httpResponses` (per call) | `httpError`, `binaryBuffers`, `staticData`, `headers`, `body`, `webhookUrl`, `node`. Helpers: `binaryItem()`, `errorWithStatus()`, `readFormDataFile()`.
- One test file per source file, mirrored under `test/`; plus `test/package.test.ts` for the manifest.

## When adding or changing behaviour

1. Extend the matching test file first (happy path, multi-item order + `pairedItem`, missing input, API error with and without `continueOnFail`).
2. Description changes: option lists, `displayOptions`, `loadOptionsMethod` wiring are asserted; update the expected arrays.
3. New trigger event: update `EVENTS` in `ParseurTrigger.node.test.ts` (list must stay sorted by display name).
4. Update docs/nodes/*.md for user-visible changes.

## Constraints that bite

- Import `describe/it/expect/vi` from `vitest`; globals are off so `eslint.config.mjs` stays the n8n default.
- Lint rules on tests: no `any` (cast via `unknown`), no `process`/`setTimeout`/`__dirname`/`globalThis`, no `crypto`/`lodash`/`zod` imports, no realistic secrets (use `dummy-…`), no `throw` inside `catch`, no `console`.
- `vitest.config.mts` aliases `n8n-workflow` → `n8n-workflow/dist/cjs/index.js`. Removing it breaks module resolution and `instanceof NodeApiError`.
- No image fixtures under `test/` (the build copies every `*.png`/`*.svg` into `dist/`).
- n8n-workflow error classes return the **same instance** when wrapping their own type and ignore the options (`itemIndex` is lost). Tests assert that as current behaviour; if it is fixed upstream, expect `toBe(original)` assertions to fail first.
- A test failing right after a dependency bump: decide whether n8n changed behaviour or only tooling before editing the assertion.
