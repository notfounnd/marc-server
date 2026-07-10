# UI and daemon

The daemon is the local HTTP process that serves the mARC UI and keeps the browser synchronized with workspace files.

## Start

```bash
pnpm dev:daemon
```

When mARC is installed or linked as a CLI, `marc daemon` keeps the same foreground/debug behavior:

```text
marc daemon [--host 127.0.0.1] [--port 4187] [--data-dir .marc-daemon] [--token <token>]
```

For normal CLI usage, run the detached lifecycle commands:

```text
marc daemon start [--host 127.0.0.1] [--port 4187] [--data-dir .marc-daemon]
marc daemon status [--data-dir .marc-daemon]
marc daemon stop [--data-dir .marc-daemon]
marc daemon restart [--host 127.0.0.1] [--port 4187] [--data-dir .marc-daemon]
```

Default address:

```text
http://127.0.0.1:4187
```

The daemon stores its token under `.marc-daemon/token` by default. If `--token` is omitted, the daemon reuses the existing token file or generates a new token on first startup. If `--token` is provided, that value is used for the running daemon process.

Detached mode also writes `.marc-daemon/daemon.json` and `.marc-daemon/daemon.log`. The state file records PID, URL, token path, log path, fingerprint, active leases, and idle information. `start` is idempotent for the same live fingerprint: running it again returns the existing daemon instead of spawning another process. `restart` is the explicit replacement flow.

Detached daemons auto-idle by default. When there are no MCP leases, no UI/SSE clients, and no recent activity, the daemon closes itself after the configured timeout. Foreground mode does not auto-idle by default.

`marc daemon status` uses detached runtime state when `.marc-daemon/daemon.json` exists. If no state file exists, it falls back to the local `/api/status` endpoint so foreground development daemons are reported as running instead of stopped.

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

## Visual foundation

The UI uses locally owned components sourced from the `neobrutalism.dev` registry on top of shadcn/ui and Tailwind CSS. The theme keeps the mARC teal accent, warm neutral surfaces, and monospace typography while using the registry component language for controls, cards, overlays, menus, and notifications.

The three-column workspace layout remains application-owned. Sidebar modes, independent column scrolling, the content footer, Markdown rendering, and reference autocomplete are mARC behaviors rather than library-provided navigation patterns.

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

Keyboard shortcuts open in a centered dialog. Artifact creation and artifact viewing open in a right-side sheet. Both overlay forms close from their close control, `Escape`, or a backdrop click, and block interaction and background scrolling while open.

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
| `GET` | `/api/status` | Read daemon status, including workspace registry, thread index health, and memory health. |
| `GET` | `/api/events` | Open the Server-Sent Events stream used by the UI. |
| `PUT` | `/api/leases/:clientId` | Create or renew an MCP lease for detached daemon idle tracking. |
| `DELETE` | `/api/leases/:clientId` | Remove an MCP lease. |
| `GET` | `/api/workspaces` | List registered workspaces. |
| `POST` | `/api/workspaces` | Register or update a workspace in the daemon registry. |
| `DELETE` | `/api/workspaces/:workspaceId` | Remove a workspace from the daemon registry. |
| `GET` | `/api/workspaces/:workspaceId/threads` | List workspace threads. |
| `GET` | `/api/workspaces/:workspaceId/rules` | Read workspace rules. |
| `GET` | `/api/workspaces/:workspaceId/agents` | List registered agents. |
| `GET` | `/api/workspaces/:workspaceId/settings` | Read workspace settings used by the UI. |
| `POST` | `/api/workspaces/:workspaceId/settings` | Update workspace settings such as `memory.autoRebuild`. |
| `POST` | `/api/workspaces/:workspaceId/memory/prepare` | Explicitly prepare the local memory embedding model for a workspace. |
| `POST` | `/api/workspaces/:workspaceId/memory/rebuild` | Start a background memory rebuild for a workspace. |
| `POST` | `/api/workspaces/:workspaceId/memory/recall` | Search the workspace summary-memory index for the UI. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId` | Read one thread. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId` | Post a UI message to a thread. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId/messages/:messageId/artifacts/:fileName` | Read a message artifact. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/messages/:messageId/artifacts` | Attach a Markdown artifact to a message. |

The API uses the daemon bearer token. It is not a public remote API surface.

`/api/status` keeps the compatibility field `ok: boolean` and includes module health under `modules`. The thread index module reports each registered workspace as `ready`, `rebuilding`, `degraded`, or `unavailable`; the UI uses this to keep the last known thread list visible while a background rebuild finishes.

The memory module reports each registered workspace under `modules.memory.workspaces`. Its status values are `ready`, `stale`, `missing`, `model_missing`, `incompatible`, `preparing`, `rebuilding`, or `degraded`. The health payload also includes `autoRebuild`, `preparing`, `rebuilding`, `lastPreparedAt`, `lastRebuildAt`, and `lastError`. The UI renders this as a compact database icon on each workspace card. Missing or stale memory does not make the daemon disconnected; it only indicates that agents may need model preparation or memory rebuild before relying on semantic recall.

Workspace memory settings are stored per workspace in `.marc/SETTINGS.md`. `memory.autoRebuild` defaults to `true`, but automatic rebuild only runs when the local model is already prepared. The daemon never downloads or prepares the model automatically.

The UI memory search uses `POST /api/workspaces/:workspaceId/memory/recall`, which delegates to the same core recall flow as the MCP tool. It is enabled only for `ready` and `stale` memory. The route requires the daemon bearer token, validates a non-empty `query`, and returns the recall result with `indexStatus`, `results`, and `nextActions`.

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
| Detached daemon has stale state | Run `marc daemon status`; stale PID state is cleaned automatically when the process is gone. |
| Detached daemon has a different fingerprint | Run `marc daemon restart`; `start` does not replace a live daemon implicitly. |
| Detached daemon is idle | It exits automatically after the auto-idle timeout when no MCP lease, UI/SSE client, or recent activity remains. |

## Also see

- [Harness Engineering](harness-engineering.md)
- [Architecture](architecture.md)
- [MCP Tools](mcp-tools.md)
