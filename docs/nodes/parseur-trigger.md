# Parseur Trigger

Starts a workflow when something happens in a Parseur mailbox. Parseur pushes the event to n8n through a webhook; no polling.

## Parameters

| Parameter              | Description                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event**              | Which Parseur event starts the workflow (see below).                                                                                                                                                                            |
| **Mailbox Name or ID** | The Parseur mailbox (parser) to listen to. The list is loaded from your account; you can also pass an ID with an expression.                                                                                                    |
| **Table Name or ID**   | Only for `table.*` events: the table field whose rows you want. Select the mailbox first, the list depends on it. If a mailbox has no table fields, the node tells you and you should pick another mailbox or a document event. |

## Events

| Event                          | When Parseur sends it                                                        | Payload                                                           |
| ------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `document.processed`           | A document was parsed successfully.                                          | The document's extracted fields, nested as defined in the mailbox |
| `document.processed.flattened` | Same, with nested data flattened to a single level.                          | One flat object                                                   |
| `document.template_needed`     | Parsing failed: no template matched (shown as _Document Processing Failed_). | Document metadata                                                 |
| `document.export_failed`       | An export configured in Parseur failed for a document.                       | Document and error metadata                                       |
| `table.processed`              | A row of the selected table field was extracted.                             | One row, with the parent document's fields                        |
| `table.processed.flattened`    | Same, flattened.                                                             | One flat object per row                                           |

Every event produces **one n8n item** whose `json` is exactly the body Parseur sent. Use a _Set_ or _Edit Fields_ node after the trigger to pick what you need.

## How the webhook is managed

You never create webhooks in Parseur by hand; the node does it:

| Moment                                       | What the node does                                                                                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow activated / _Listen for test event_ | Calls `POST /parser/{mailbox}/n8n/{event}` (or `POST /table/{tableField}/n8n/{event}` for table events) with the n8n webhook URL and your webhook token, then remembers the webhook id in the workflow's static data. |
| Workflow deactivated                         | Calls `DELETE /webhook/{id}` and forgets the id. A `404` (already gone) is treated as success.                                                                                                                        |
| Every incoming call                          | Checks that `X-Parseur-Token` equals the credential's webhook token and that `X-Parseur-Event` equals the selected event. Anything else is rejected and never reaches the workflow.                                   |

Because the webhook id lives in the workflow, **duplicating a workflow** and activating the copy registers a second webhook: Parseur will call both. Delete the one you do not need in Parseur if you deactivate a workflow without n8n being able to reach Parseur.

## Requirements

- n8n must be reachable from the internet over HTTPS: see [Setup → Making n8n reachable](../setup.md#making-n8n-reachable-by-parseur-trigger-only).
- The API key needs the **Admin** or **Editor** role: see [Setup → Permissions](../setup.md#permissions).

## Example

_Invoice mailbox → n8n → Google Sheets_

1. Parseur Trigger: event `document.processed`, mailbox _Invoices_.
2. Google Sheets: _Append row_, mapping `{{ $json.InvoiceNumber }}`, `{{ $json.Total }}`, … to columns.
3. Activate. Forward an invoice to the mailbox's email address; a row appears within seconds.

Related: [Troubleshooting → Trigger](../troubleshooting.md#parseur-trigger)
