# Troubleshooting

## Credential test fails

| Message                                                | Cause / fix                                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `401` / `Authentication credentials were not provided` | The API key is wrong or was regenerated in Parseur. Copy it again from [Account](https://app.parseur.com/account).      |
| `ENOTFOUND` / `ECONNREFUSED`                           | **Base URL** is wrong, or the n8n host cannot reach the internet. Keep `https://api.parseur.com` unless told otherwise. |

## Parseur Trigger

| Symptom                                                                | Cause / fix                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activation fails: `You do not have permission to perform this action.` | The API key's user is a **Viewer**, or has another Parseur account selected. Use an Admin/Editor key, or switch account in Parseur.                                                                  |
| Activation fails mentioning the target URL                             | Parseur only accepts public HTTPS URLs. Expose n8n and set `N8N_WEBHOOK_URL` ([setup](setup.md#making-n8n-reachable-by-parseur-trigger-only)).                                                       |
| `For table events, you must select a Table Field.`                     | You chose a `table.*` event without a table. Select the mailbox, then a table, or switch to a document event.                                                                                        |
| `This Mailbox has no table fields configured…`                         | The selected mailbox has no table field. Pick another mailbox or a `document.*` event.                                                                                                               |
| `Select a Mailbox first.`                                              | The table list depends on the mailbox. Pick the mailbox, then reopen the table dropdown.                                                                                                             |
| Workflow never fires                                                   | Check the Parseur mailbox → **Webhooks**: an entry pointing at your n8n URL must exist and be enabled. If not, deactivate and re-activate the workflow. Check the tunnel is still up if you use one. |
| Executions show `Unauthorized webhook: token mismatch`                 | The webhook in Parseur was created with an older webhook token. Deactivate, then re-activate the workflow so it is re-registered with the current token.                                             |
| Executions show `Unauthorized webhook: event mismatch`                 | A webhook for another event points at this node's URL (often a duplicated workflow). Remove the extra webhook in Parseur.                                                                            |
| Two executions per document                                            | Two webhooks target the same URL (duplicated/renamed workflow). Delete the stale one in Parseur → mailbox → Webhooks.                                                                                |

## Parseur node

| Symptom                                          | Cause / fix                                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No binary data property "data" found on item 0` | The previous node did not output a binary, or used another property name. Inspect its output's **Binary** tab and set **File Property** accordingly.           |
| `Error while communicating with the Parseur API` | Open the error details: the HTTP code and Parseur's message are there. `403` → permissions or wrong account; `404` → wrong mailbox ID; `413` → file too large. |
| Document lands in the wrong mailbox              | For **Upload Text**, **Mailbox Email** must be the mailbox's own `@in.parseur.com` address, not a forwarding alias.                                            |

## Still stuck?

- Parseur help centre: <https://help.parseur.com/>
- Open an issue with the n8n version, the node version (`npm ls n8n-nodes-parseur` on the n8n host or _Settings → Community Nodes_) and the exact error: <https://github.com/parseur/parseur-n8n-node/issues>
