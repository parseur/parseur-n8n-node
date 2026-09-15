# Development

Everything you need to change the node and prove it still works. For releasing and dependency updates see [MAINTAINING.md](../MAINTAINING.md).

## Requirements

- Node.js 22 (`.nvmrc`), npm 10.
- A Parseur account for manual testing (the automated tests need none).

## Layout

```
credentials/ParseurApi.credentials.ts   credential: fields, Bearer auth, GET /user test
nodes/Parseur/
  Parseur.node.ts                        regular node: dispatches to the two operations
  UploadFile.operation.ts                "Upload File" parameters + execute
  UploadText.operation.ts                "Upload Text" parameters + execute
  ParseurTrigger.node.ts                 trigger: events, loadOptions, webhook lifecycle
  GenericFunctions.ts                    parseurApiRequest / getParsers shared helpers
  *.node.json                            n8n "codex" metadata (categories, docs links)
  parseur.{light,dark}.svg               icons, copied into dist by the build
test/                                    vitest suite (never shipped, see below)
docs/                                    this documentation
.github/workflows/ci.yml                 lint + typecheck + test + build on push/PR
.github/workflows/publish.yml            npm publish with provenance on version tags
```

All API traffic goes through `parseurApiRequest` in `GenericFunctions.ts`, which wraps n8n's `httpRequestWithAuthentication` with the `parseurApi` credential and turns failures into `NodeApiError`. Add new endpoints there rather than calling the helper directly.

## Everyday commands

| Command                 | What it does                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm install`           | Install dependencies (`.npmrc` disables lifecycle scripts).                                                        |
| `npm run build`         | `n8n-node build`: cleans `dist/`, runs `tsc`, copies icons. What gets published.                                   |
| `npm run dev`           | `n8n-node dev`: starts a local n8n with the node linked and rebuilds on change. Data lives in `~/.n8n-node-cli`.   |
| `npm run lint`          | `n8n-node lint`: ESLint with n8n's community-node rules over `nodes/`, `credentials/`, `test/` and `package.json`. |
| `npm run lint:fix`      | Same with auto-fix.                                                                                                |
| `npm test`              | Vitest, once.                                                                                                      |
| `npm run test:watch`    | Vitest in watch mode.                                                                                              |
| `npm run test:coverage` | Vitest with a coverage report (`coverage/`, git-ignored).                                                          |
| `npm run typecheck`     | Type-checks the tests and config with `tsconfig.test.json` (the build config deliberately excludes `test/`).       |

CI runs lint → typecheck → test → build; run the same four locally before pushing.

## Testing against a real n8n

`npm run dev` is the quickest way. If you prefer your own n8n instance, link the package into n8n's custom nodes folder (keep n8n **outside** this directory, otherwise n8n's loader follows the symlink into its own `node_modules` and crashes):

```bash
npm run build                      # in this repo
mkdir -p ~/.n8n/custom && cd ~/.n8n/custom && npm init -y && npm link /path/to/parseur-n8n-node
npx n8n                            # from a separate directory where n8n is installed
```

Rebuild and restart n8n after each change. For the trigger you also need a public URL: see [Setup](setup.md#making-n8n-reachable-by-parseur-trigger-only).

## The test suite

Tests live in `test/` and mirror the source tree. They are unit tests with **no network**: n8n's execution context is replaced by a mock, and the HTTP helper is a `vi.fn()` whose calls the tests inspect. That way the real `parseurApiRequest` (URL building, `json`/`FormData` handling, error wrapping) runs on every test.

```
test/helpers/mockContext.ts                 createMockContext(), fixtures, requestOptions()
test/nodes/Parseur/GenericFunctions.test.ts
test/nodes/Parseur/UploadFile.operation.test.ts
test/nodes/Parseur/UploadText.operation.test.ts
test/nodes/Parseur/Parseur.node.test.ts
test/nodes/Parseur/ParseurTrigger.node.test.ts
test/credentials/ParseurApi.credentials.test.ts
test/package.test.ts                        package.json manifest ↔ source classes
```

A typical test:

```ts
const { ctx, http } = createMockContext({
	params: { operation: 'uploadText', recipient: 'r@example.test', subject: 's' },
	httpResponse: { DocumentID: 'd1' },
});

const [output] = await new Parseur().execute.call(ctx);

expect(requestOptions(http)).toMatchObject({
	method: 'POST',
	url: 'https://api.example.test/email',
});
expect(output[0].json.message).toBe('Text sent successfully');
```

`createMockContext` options: `params` (flat, or one object per item), `items`, `credentials`, `continueOnFail`, `httpResponse` / `httpResponses` (one per call) / `httpError`, `binaryBuffers`, `staticData`, `headers`, `body`, `webhookUrl`. Call node methods with `.call(ctx)` exactly as n8n would bind `this`.

Things to know when writing tests:

- Import `describe/it/expect/vi` from `vitest` explicitly; globals are off so `eslint.config.mjs` stays the untouched n8n default.
- The n8n lint rules also apply to tests: no `any`, no `process`/`setTimeout`/`__dirname`, no `crypto`/`lodash` imports, no realistic-looking secrets (use `dummy-…` values), no `throw` inside a `catch`.
- `vitest.config.mts` aliases `n8n-workflow` to its CommonJS build. Its ESM build uses extensionless imports Node cannot resolve, and the alias guarantees a single `NodeApiError` class so `instanceof` works.
- Do not put `.png`/`.svg` fixtures under `test/`: the build copies every image in the repo into `dist/`. Use `Buffer.from(...)`.
- `NodeApiError`/`NodeOperationError` return the **same instance** when asked to wrap an error of their own type, ignoring the options passed. Assert with `toBe(original)` when that is the behaviour under test.

## Adding an operation to the Parseur node

1. Create `nodes/Parseur/<Name>.operation.ts` exporting `<name>Description: INodeProperties[]` (every property with `displayOptions.show.operation: ['<value>']`) and `<name>Execute(this: IExecuteFunctions)`.
2. Register the option in the `operation` property of `Parseur.node.ts`, spread the description into `properties`, add the dispatch branch in `execute()`.
3. Add `test/nodes/Parseur/<Name>.operation.test.ts` (happy path, multi-item, missing input, API error with and without _continue on fail_) and extend the dispatch/description tests in `Parseur.node.test.ts`.
4. Document it in [docs/nodes/parseur.md](nodes/parseur.md).
5. `npm run lint && npm run typecheck && npm test && npm run build`.

## Adding an event to the trigger

1. Add the option to `event` in `ParseurTrigger.node.ts` (keep the list sorted by display name; a lint rule and a test check it). If it is a table event, add it to `tableFieldId.displayOptions.show.event` and to the `startsWith('table')` logic if the naming differs.
2. Extend `ParseurTrigger.node.test.ts` (`EVENTS` list, `create` route).
3. Document it in [docs/nodes/parseur-trigger.md](nodes/parseur-trigger.md).
