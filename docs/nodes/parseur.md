# Parseur node

Sends documents to a Parseur mailbox from a workflow. Two operations are available. The node processes every incoming item, so one input item = one document sent.

The node is marked **usable as a tool**, so an n8n _AI Agent_ can call it (n8n requires the `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` environment variable for community nodes to be offered as tools).

## Upload File

Uploads a binary file (PDF, image, EML, spreadsheet, …) carried by the incoming item.

| Parameter              | Description                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mailbox Name or ID** | Target mailbox. Loaded from your account; an ID can be given with an expression.                                                                                                |
| **File Property**      | Name of the binary property holding the file on the incoming item. Default `data`, which is what most n8n nodes (HTTP Request, Read Binary File, Gmail attachments, …) produce. |

Parseur receives a `multipart/form-data` request at `POST /parser/{mailbox}/upload` with one `file` part. The file name and MIME type come from the binary property; when missing they default to `upload.dat` and `application/octet-stream`.

**Output**, one item per input item:

```json
{
	"message": "File uploaded successfully",
	"response": { "...": "the document object returned by Parseur" }
}
```

## Upload Text

Creates a document from text or HTML, as if an email had been sent to the mailbox.

| Parameter         | Required | Description                                                       |
| ----------------- | -------- | ----------------------------------------------------------------- |
| **Mailbox Email** | yes      | The mailbox's Parseur email address (`something@in.parseur.com`). |
| **Subject**       | yes      | Subject line of the document.                                     |
| **Sender**        | no       | Email address recorded as the sender.                             |
| **HTML Content**  | no       | The document body, HTML or plain text.                            |

Parseur receives `POST /email` with `{ recipient, subject, from, body_html }`.

**Output**, one item per input item:

```json
{
	"message": "Text sent successfully",
	"response": { "...": "the document object returned by Parseur" }
}
```

## Errors

| Situation                                      | Behaviour                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| The item has no binary under **File Property** | `No binary data property "data" found on item N`. Check the previous node's output or change **File Property**.   |
| Parseur rejects the request (4xx/5xx)          | `Error while communicating with the Parseur API`. The HTTP status and Parseur's message are in the error details. |
| **Settings → On Error → Continue** is enabled  | The failing item becomes `{ "error": "<message>" }` and the remaining items are still processed.                  |

Related: [Troubleshooting → Parseur node](../troubleshooting.md#parseur-node)
