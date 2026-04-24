# Parseur n8n Node

> 🧩 Official n8n Node to interact with [Parseur](https://parseur.com): receive events, upload text or upload files.

[![npm version](https://badge.fury.io/js/n8n-nodes-parseur.svg)](https://badge.fury.io/js/n8n-nodes-parseur)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[About](#about)  
[Operations](#operations)  
[Installation](#installation)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Resources](#resources)  
[License](#license)

## About

**Parseur** is a powerful no-code data extraction platform that helps you turn emails, PDFs, and other documents into structured data.

This custom **n8n Node** allows you to:

✅ Trigger workflows when documents or tables are processed (via webhook)  
✅ Upload new documents as text (via API)  
✅ Upload files to a parser (via API)

## Operations

- Upload File: send binary files (PDF, EML, etc.) to a Mailbox
- Upload Text: send plain or HTML content as a document to a Mailbox
- Supports webhook events from Parseur:

| Event                          | Type     | Description                         |
| ------------------------------ | -------- | ----------------------------------- |
| `document.processed`           | document | Document processed successfully     |
| `document.processed.flattened` | document | Document processed as flat data     |
| `document.template_needed`     | document | Processing failed (template needed) |
| `document.export_failed`       | document | Export failed                       |
| `table.processed`              | table    | A table field row was processed     |
| `table.processed.flattened`    | table    | A table field row (flattened)       |

## Installation

### Install from npm

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Install from source

1. Clone and build the node

```bash
git clone https://github.com/parseur/parseur-n8n-node <parseur-n8n-node>
cd <parseur-n8n-node>
npm install
npm run build
```

2. Set up a local n8n instance — **outside** `<parseur-n8n-node>`, otherwise the custom-node loader will follow the step-3 symlink into n8n's own `node_modules` and crash on `*.node.js` files.

```bash
mkdir <n8n>  # NOT in <parseur-n8n-node>
cd <n8n>
npm init -y
npm install sqlite3
npm install n8n
```

3. Link the Parseur node to n8n

```bash
cd ~/.n8n
mkdir -p custom
cd custom
npm init -y
npm link <parseur-n8n-node>
```

4. Start n8n — you will see Parseur Trigger available.

```bash
cd <n8n>
npx n8n
```

## Credentials

To connect n8n with your Parseur account, you'll need two values: an **API Key** and a **Webhook Token**.

### API Key

Get your API key in the [Parseur account settings](https://app.parseur.com/account).  
This key is required to authenticate API requests to the Parseur platform.

1. Log in to your [Parseur](https://app.parseur.com/login).
2. Navigate to **Account**.
3. Copy your **API Key**.

In n8n:

- Click **"Add Credential"** and search for **"Parseur API"**.
- Paste your API Key into the **API Key** field.

### Webhook Token

The **Webhook Token** is used to verify that incoming webhook requests (e.g. from n8n to Parseur) are legitimate.

You can generate a secure random token using a service like [uuidgenerator.net](https://www.uuidgenerator.net/), or generate one yourself using a tool or script of your choice.

1. Go to [uuidgenerator.net](https://www.uuidgenerator.net/).
2. Copy a generated UUID or token string.
3. Paste it into the **Webhook Token** field in your Parseur credential in n8n.

This token will be expected in the HTTP header `X-Parseur-Token` of all webhook requests.

## Compatibility

Compatible with n8n v1.91.2.

Requires **Node.js v22** or later.

## Resources

- [Parseur](https://parseur.com) — Document processing & data extraction
- [n8n](https://n8n.io) — Workflow automation

## Version history

Check CHANGELOG.md for more detailed history.

#### v0.0.7

- Bumped `@n8n/node-cli` to v0.28.0 (beta track)
- Pinned minimum versions for langchain dependencies (`@langchain/community` ≥1.1.18, `@langchain/core` ≥1.1.38, `@langchain/classic` ≥1.0.31, `langsmith` ≥0.5.19) via npm overrides
- Added `subtitle` to the Parseur Trigger node — selected event is now shown under the node name in the workflow canvas
- Documented Node.js v22 requirement

#### v0.0.6

- Added GitHub Action publishing workflow
- Switched package manager from PNPM to NPM
- Enabled Dependabot and applied multiple dependency updates (langchain, typescript, prettier, undici, release-it, minimatch, gulp, eslint-plugin-n8n-nodes-base)

#### v0.0.4

- Removed debug log

#### v0.0.3

- Replaced `this.helpers.request` with `this.helpers.requestWithAuthentication` for credential-scoped API calls
- README updates

#### v0.0.2

- Version bump (no functional changes)

#### v0.0.1

Initial release

## Contributing

We welcome contributions and ideas!

Please [open an issue](https://github.com/parseur/parseur-n8n-node/issues) or [submit a pull request](https://github.com/parseur/parseur-n8n-node/pulls) if you want to improve this node.

## License

[MIT](LICENSE.md)
