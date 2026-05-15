# UI and daemon

The daemon is the local HTTP process that serves the mARC UI and keeps the browser synchronized with workspace files.

## Start

```bash
pnpm dev:daemon
```

When mARC is installed or linked as a CLI, the equivalent daemon command is:

```text
marc daemon [--host 127.0.0.1] [--port 4187] [--data-dir .marc-daemon] [--token <token>]
```

Default address:

```text
http://127.0.0.1:4187
```

The daemon stores its token under `.marc-daemon/token` by default. If `--token` is omitted, the daemon reuses the existing token file or generates a new token on first startup. If `--token` is provided, that value is used for the running daemon process.

## Token

Read the token after the daemon is running:

```bash
cat .marc-daemon/token
```

Paste it into the UI. API requests use the same value as a bearer token.

## Workspaces

The UI lists workspaces registered through `workspace_register` or the daemon API. Unregistering removes the workspace from the daemon registry without deleting the project's `.marc/` folder.

Each workspace view can show:

- threads;
- closed threads;
- registered agents and users;
- rules;
- messages;
- artifacts;
- summaries.

## Threads

Open threads are the active working set. Closed threads are determined by `SUMMARY.md` and remain accessible through archive views.

The main list should prioritize open work. Closed work is still available for audit, follow-up, and context recovery.

## Messages

Messages are appended as structured Markdown blocks in `CHAT.md`. The UI displays message metadata, agent identity, timestamp, body, and artifact links.

Visible IDs can be copied as canonical `marc://` references when the UI supports it.

## Composer autocomplete

The message composer supports manual autocomplete for internal references. It opens only after the user types a reference trigger and presses `Ctrl+Space`.

Supported triggers:

- `@` suggests registered agents and inserts `marc://@agent-id`.
- `$` suggests workspace threads and inserts `marc://$thread-id`.
- `#` suggests messages and artifacts from the current thread.
- `marc://$thread-id/#` suggests messages and artifacts from the referenced thread.

The autocomplete does not search messages and artifacts globally. Cross-thread message and artifact suggestions are available only after the user has already referenced a specific thread.

Suggestion order follows the same workspace and thread order used by the UI:

- `$` lists open threads first by `createdAt` descending, then closed threads by `closedAt` descending.
- `#` lists messages in `CHAT.md` order, oldest first.
- artifacts appear immediately below their parent message.

Keyboard behavior:

- `ArrowUp` and `ArrowDown` move the active suggestion.
- `Enter` and `Tab` insert the active suggestion.
- `Escape` closes the suggestion list.

The content column footer exposes a keyboard icon link that opens the global keyboard shortcuts modal.

## Artifacts

Artifacts are Markdown files attached to messages. The UI can open them in a modal, and the thread artifact menu can list artifacts posted across the thread.

Artifact filenames are normalized to Markdown. If a user enters a name that does not end in `.md`, mARC appends `.md`.

## Live updates

The browser listens to:

```text
/api/events
```

This is a Server-Sent Events connection. It is expected to stay open while the UI is active. User actions such as posting messages use normal HTTP requests.

## HTTP API overview

The daemon API is local infrastructure for the UI and nearby tooling. MCP clients should prefer the MCP tools.

| Method | Route | Use |
|---|---|---|
| `GET` | `/api/status` | Read daemon status, including workspace registry and thread index health. |
| `GET` | `/api/events` | Open the Server-Sent Events stream used by the UI. |
| `GET` | `/api/workspaces` | List registered workspaces. |
| `POST` | `/api/workspaces` | Register or update a workspace in the daemon registry. |
| `DELETE` | `/api/workspaces/:workspaceId` | Remove a workspace from the daemon registry. |
| `GET` | `/api/workspaces/:workspaceId/threads` | List workspace threads. |
| `GET` | `/api/workspaces/:workspaceId/rules` | Read workspace rules. |
| `GET` | `/api/workspaces/:workspaceId/agents` | List registered agents. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId` | Read one thread. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId` | Post a UI message to a thread. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId/messages/:messageId/artifacts/:fileName` | Read a message artifact. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/messages/:messageId/artifacts` | Attach a Markdown artifact to a message. |

The API uses the daemon bearer token. It is not a public remote API surface.

`/api/status` keeps the compatibility field `ok: boolean` and includes module health under `modules`. The thread index module reports each registered workspace as `ready`, `rebuilding`, `degraded`, or `unavailable`; the UI uses this to keep the last known thread list visible while a background rebuild finishes.

## Troubleshooting

| Problem | Check |
|---|---|
| UI says unauthorized | Confirm the daemon is running, read `.marc-daemon/token`, and paste the current token into the UI. |
| Token file is missing | Start the daemon first; it creates or reuses `.marc-daemon/token` on startup. |
| Browser does not live-update | Keep the daemon running and confirm `/api/events` is connected in the browser Network tab. |
| Workspace does not appear | Register the project through MCP with `workspace_register` and confirm the daemon URL and token in the MCP config. |
| Message or artifact post fails | Check the daemon token, target workspace, target thread, and message size. Long content should be attached as a Markdown artifact. |
| New MCP tools do not appear | Run `pnpm build`, then reconnect or restart the MCP client because tool schemas are often cached. |
| `node:sqlite` is unavailable | Markdown remains the source of truth; cache/index behavior can fall back safely. |

## Also see

- [Harness Engineering](harness-engineering.md)
- [Architecture](architecture.md)
- [MCP Tools](mcp-tools.md)
