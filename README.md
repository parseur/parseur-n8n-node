# Parseur n8n Node

> 🧩 Official [n8n](https://n8n.io) community node for [Parseur](https://parseur.com): trigger workflows when Parseur extracts data from a document, and send documents to Parseur from your workflows.

[![npm version](https://img.shields.io/npm/v/n8n-nodes-parseur.svg)](https://www.npmjs.com/package/n8n-nodes-parseur)
[![CI](https://github.com/parseur/parseur-n8n-node/actions/workflows/ci.yml/badge.svg)](https://github.com/parseur/parseur-n8n-node/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

Parseur is a no-code data extraction platform that turns emails, PDFs and other documents into structured data. This package adds two nodes to n8n:

| Node                | What it does                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Parseur Trigger** | Starts a workflow when Parseur processes a document or a table row, fails to find a template, or fails an export. Uses webhooks. |
| **Parseur**         | Sends a file or a text/HTML document to a Parseur mailbox for processing. Can be used as a tool by AI agents.                    |

## Quick start

1. **Install the node** in n8n: _Settings → Community Nodes → Install_, package name `n8n-nodes-parseur`.
   Other installation methods: [n8n docs](https://docs.n8n.io/integrations/community-nodes/installation/).
2. **Create a "Parseur API" credential** with your Parseur API key and a webhook token of your choice.
   → [Setup guide](docs/setup.md)
3. **Add a Parseur Trigger** to a workflow, pick an event and a mailbox, activate the workflow.
   Parseur now calls n8n every time a document is processed.
   → [Parseur Trigger reference](docs/nodes/parseur-trigger.md)
4. **Add a Parseur node** to send documents to Parseur from any workflow.
   → [Parseur node reference](docs/nodes/parseur.md)

Something not working? See [Troubleshooting](docs/troubleshooting.md).

## Documentation

| Guide                                            | For                                                       |
| ------------------------------------------------ | --------------------------------------------------------- |
| [Setup and credentials](docs/setup.md)           | Connecting n8n to your Parseur account                    |
| [Parseur Trigger](docs/nodes/parseur-trigger.md) | Events, mailboxes, table fields, how webhooks are managed |
| [Parseur node](docs/nodes/parseur.md)            | Upload File and Upload Text operations                    |
| [Troubleshooting](docs/troubleshooting.md)       | Common errors and how to fix them                         |
| [Development](docs/development.md)               | Building, testing and changing the node                   |
| [Maintaining](MAINTAINING.md)                    | Dependency updates, tests, releasing a new version        |
| [Changelog](CHANGELOG.md)                        | What changed in each version                              |

## Compatibility

- n8n 1.91 or later (community nodes with `n8nNodesApiVersion` 1)
- Node.js 22 or later on the n8n host

## Contributing

Issues and pull requests are welcome at [github.com/parseur/parseur-n8n-node](https://github.com/parseur/parseur-n8n-node). Read [docs/development.md](docs/development.md) first: it explains the layout, the test suite and the checks CI runs.

## License

[MIT](LICENSE.md) — © Parseur
