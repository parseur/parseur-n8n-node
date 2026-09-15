# Setup and credentials

Both nodes use one credential type, **Parseur API**. Create it once in n8n and reuse it in every workflow.

## What you need

| Field             | Where it comes from                                                                                                           | Used for                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Base URL**      | Leave the default `https://api.parseur.com` unless Parseur gave you a dedicated endpoint.                                     | Every API call.                                                            |
| **API Key**       | Parseur → [Account](https://app.parseur.com/account) → _API Key_.                                                             | Authenticating calls from n8n to Parseur (`Authorization: Bearer <key>`).  |
| **Webhook Token** | A secret **you invent**, for example a UUID from [uuidgenerator.net](https://www.uuidgenerator.net/) or `uuidgen` in a shell. | Proving that a webhook call really comes from Parseur (`X-Parseur-Token`). |

The webhook token never leaves n8n and Parseur: when the trigger registers a webhook, it asks Parseur to send this token back in the `X-Parseur-Token` header of every call, and rejects calls without it.

## Creating the credential

1. In n8n open **Credentials → Add credential** and search for **Parseur API**.
2. Paste your **API Key**.
3. Paste your **Webhook Token**.
4. Click **Save**. n8n tests the credential by calling `GET /user` on the Parseur API; a green check means the API key works.

## Permissions

The API key inherits the permissions of the Parseur user it belongs to:

- **Sending documents** (Parseur node) works for any role that can add documents to the mailbox.
- **Registering webhooks** (Parseur Trigger) requires the **Admin** or **Editor** role on the account that owns the mailbox. With a **Viewer** key, activating a workflow fails with `You do not have permission to perform this action.`
- If the user belongs to several Parseur accounts, the key acts on the **currently selected account** in the Parseur web app. Switch account in Parseur if the mailbox list in n8n looks wrong.

## Making n8n reachable by Parseur (trigger only)

Parseur's servers call your n8n webhook URL, so it must be a **public HTTPS URL**. `http://localhost:5678` is rejected.

- **n8n Cloud or a server behind a reverse proxy:** nothing to do.
- **Local n8n:** open a tunnel and tell n8n its public URL:

  ```bash
  # any tunnel works, for example:
  ngrok http 5678
  # cloudflared tunnel --url http://localhost:5678
  # npx localtunnel --port 5678
  # tailscale funnel 5678

  N8N_WEBHOOK_URL=https://your-public-host.example.com npx n8n
  ```

  Restart n8n whenever the tunnel URL changes, then deactivate and re-activate the workflows that use the trigger so the webhook is registered with the new URL.

Next: [Parseur Trigger](nodes/parseur-trigger.md) · [Parseur node](nodes/parseur.md)
