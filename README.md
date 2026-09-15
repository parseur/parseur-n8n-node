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

The examples below use `~/parseur-n8n-node` for the node source and `~/n8n-local` for the n8n instance. Adjust the paths if you prefer other locations, but keep the two directories separate: if n8n is installed inside the node directory, the custom-node loader follows the symlink created in step 3 into n8n's own `node_modules` and crashes on `*.node.js` files.

1. Clone and build the node

```bash
git clone https://github.com/parseur/parseur-n8n-node ~/parseur-n8n-node
cd ~/parseur-n8n-node
npm install
npm run build
```

2. Set up a local n8n instance in a separate directory

```bash
mkdir ~/n8n-local
cd ~/n8n-local
npm init -y
npm install n8n
```

3. Link the Parseur node into n8n's custom nodes directory

```bash
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y
npm link ~/parseur-n8n-node
```

4. Start n8n and look for the **Parseur** and **Parseur Trigger** nodes in the editor

```bash
cd ~/n8n-local
npx n8n
```

After changing the node source, run `npm run build` in `~/parseur-n8n-node` and restart n8n to pick up the changes.

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

The **Webhook Token** is used to verify that incoming webhook requests (from Parseur to n8n) are legitimate.

You can generate a secure random token using a service like [uuidgenerator.net](https://www.uuidgenerator.net/), or generate one yourself using a tool or script of your choice.

1. Go to [uuidgenerator.net](https://www.uuidgenerator.net/).
2. Copy a generated UUID or token string.
3. Paste it into the **Webhook Token** field in your Parseur credential in n8n.

This token will be expected in the HTTP header `X-Parseur-Token` of all webhook requests.

## Using the Parseur Trigger

When you activate a workflow (or click **Listen for test event**), the Parseur Trigger node registers a webhook on Parseur pointing to your n8n webhook URL. Two conditions must be met for this to work.

### Your n8n instance must be reachable from the internet

Parseur's servers call your n8n webhook URL, so it must be a public HTTPS URL. A local address such as `http://localhost:5678` is rejected by Parseur.

If n8n is already hosted on a public domain (n8n Cloud, a server behind a reverse proxy), nothing else is needed.

If you run n8n locally, expose it through a tunnel and tell n8n its public URL with the `N8N_WEBHOOK_URL` environment variable. Any tunneling tool works, for example:

- [ngrok](https://ngrok.com/): `ngrok http 5678`
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/): `cloudflared tunnel --url http://localhost:5678`
- [localtunnel](https://github.com/localtunnel/localtunnel): `npx localtunnel --port 5678`
- [Tailscale Funnel](https://tailscale.com/kb/1223/funnel): `tailscale funnel 5678`

Then start n8n with the public URL the tool gave you:

```bash
N8N_WEBHOOK_URL=https://your-public-host.example.com npx n8n
```

Restart n8n whenever the tunnel URL changes, and re-activate workflows using the trigger so the webhook is re-registered with the new URL.

### Your API key must have permission to manage webhooks

Creating a webhook requires the **Admin** or **Editor** role on the Parseur account that owns the mailbox. If the API key belongs to a user with the **Viewer** role, or if that user currently has another account selected in Parseur, registration fails with `You do not have permission to perform this action.`

## Compatibility

Compatible with n8n v1.91.2.

Requires **Node.js v22** or later.

## Resources

- [Parseur](https://parseur.com) — Document processing & data extraction
- [n8n](https://n8n.io) — Workflow automation

## Version history

Check [CHANGELOG.md](CHANGELOG.md).

## Contributing

We welcome contributions and ideas!

Please [open an issue](https://github.com/parseur/parseur-n8n-node/issues) or [submit a pull request](https://github.com/parseur/parseur-n8n-node/pulls) if you want to improve this node.

## License

[MIT](LICENSE.md)
