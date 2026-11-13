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

Notifications use the local Neobrutalism Toast component backed by Base UI. The application mounts one toaster at the lower right, and its adapter maps success, warning, and error messages to 2.4-second toasts. Base UI provides accessible dismissal, stacking, and pause-on-interaction behavior; notifications remain visible above open dialogs and sheets, and dismissing a toast does not dismiss its underlying dialog or sheet.

The three-column workspace layout remains application-owned. Sidebar modes, independent column scrolling, the content footer, Markdown rendering, and reference autocomplete are mARC behaviors rather than library-provided navigation patterns.

Markdown rendering displays raw HTML source as escaped text, preserving source line breaks and allowing long lines to wrap without interpreting the HTML.

## Threads

Open threads are the active working set. Closed threads are determined by `SUMMARY.md` and remain accessible through archive views.

The main list should prioritize open work. Closed work is still available for audit, follow-up, and context recovery.

The Threads sidebar can create an empty thread in the selected workspace. The right-side sheet asks only for a single-line title; the user writes the first message through the existing composer. The title is trimmed before submission, and an empty title or one containing a line break receives `400 Bad Request`. While creation is pending, Close, Cancel, Escape, and backdrop dismissal are disabled. Creation writes the canonical `CHAT.md` thread before its derived index is refreshed and does not create a profile or an initial message. The UI keeps a newly created thread visible while the index catches up, then removes its temporary entry once a list response includes its ID. A thread read failure can be retried without submitting creation again.

### Thread activation policy and workspace pause

The thread header has an activation trigger (`Zap`) between the artifacts and sessions triggers, in that order. An open thread shows it; a closed thread does not. It opens a panel of the same width as the sessions menu, and the trigger stays pressed while the panel is open. The app loads the thread's activation view once per thread selection and refreshes it on each workspace-changed event. The panel, the message stamps and the paused banner read that one view, so the thread makes one activation request per selection. The panel shows the saved status as a pill (`On`, `Off`, `Waiting for you`, `Paused`, or `Unreadable policy`) and the switch that allows mentions to activate participants. When the switch is off, the panel shows only the switch and its note. When it is on, the panel shows no note, because the confirm mode it would describe belongs to the F3c supervisor, and it shows one stage badge with the current stage (Planning, Execution or Review), `N of M cycles` with a segmented bar, the budget lines, and the reservations that wait, each with the author and time of the message that mentioned it. The participants list marks the lead with `Leads`, and each other architect offers `Make lead`. The panel does not show stage or lead history; both stay in the thread state and the activity section. At exhaustion the panel offers `More N cycles` (N is the authorized cycles per stage) and `Advance stage`. `Advance stage` opens a choice of the stages ahead, with `Cancel`; when reservations wait, the choice says how many the new stage drops. A stage changed by someone else, a lead changed by someone else, and any other refusal show their line and reload the view, so nothing is overwritten. The panel shows a last-cycle line when exactly one cycle remains in a stage of at least two cycles. A policy saved by F3a shows `Save the policy again to use the new stages.`, and the first save shows the explicit move to Planning before it is confirmed. Save validates the draft before it sends the form, and a daemon `400` or `409` shows its message inline. A refusal whose state the panel already shows above the footer is reported there as "Nothing was saved", so each failure appears once. Save never approves an activation by itself, and a saved change creates a new revision.

The panel lists the rows that wait for the human in one section, `Waiting for you`, between `Stage` and `Participants`. The section appears only with at least one row. Its rows are: the starts to approve (`Approve` and `Decline`, with the mention that asked for the start, the stage and the time left before the card expires), the open permission requests of a running turn (`Allow` and `Deny`, with the tool, a summary of its input, when it was asked and when it is denied without an answer), the failed turns (`Continue` for a turn that timed out, `Retry` for another failure the start rule accepts, with the attempt and the estimated cost), the running turns with the time left, the waits with their reason and what resolves them, and the reservations the daemon holds. Waits, running turns, failures without an action, and holds show no action. Final states leave the panel. The number beside the title counts only the rows that ask for an action. Each row links to the message that mentioned the recipient, and the panel closes before it scrolls there. Every action calls its existing route. A refusal shows its line in the footer, as the rest of the panel does, and the view reloads after every action.

The ⚡ button shows the same count as the section title: the starts to approve, the open permission requests, and the failed turns with `Continue` or `Retry`. Waits, running turns, and holds never count. The count comes from the activation view the app already loads for the thread, so it adds no request. The sessions button keeps its own count.

The workspace settings panel has a `Cycles per stage` field (1 to 20, default 5) with the help line "How many architect round trips a stage may use before mARC asks you." The field loads the value in force from the daemon, and a save records the UI authorization that the thread policies require.

The same panel has `Supervised turn time limit (minutes)`, beside `Cycles per stage`. It accepts a whole number from 15 to 480 and defaults to 60. It saves on blur or Enter, when the value changed, through the settings route, and the daemon records the authorization as it does for the cycles. The help line says that the last 10 minutes of a turn are warned, that the turn is stopped 2 minutes after the limit, and that sessions the human opens are never stopped.

The panel shows a plain line for each fail-closed state: a revision changed outside mARC, a policy edited by hand, a missing or unreadable thread state file, a paused workspace, and an unreadable policy file. A missing or unreadable state file offers `Recover` behind a confirm step. An unreadable policy file offers `Replace unreadable policy` behind a confirm step, and Save stays available, because saving is the way out.

Closing a thread ends its activation. When its `SUMMARY.md` appears, the daemon removes the thread's state and its `policy.json`, at startup too, so a closed folder keeps no policy that could read as changed outside mARC. The Activity section of `SUMMARY.md` keeps the policy revision, the stage outcomes and the lead changes. Removing a file that is already gone is not an error, and a policy file that cannot be removed stays until the next pass.

The workspace view shows a pause control beside the settings button, with the `Pause` icon. It toggles `POST .../activation/pause` and `.../resume`, and it is pressed and amber while the workspace is paused. An open thread shows an amber banner while the workspace is paused, with a `Resume` link. The activation UI writes only through the policy route, the stage routes (`extend` and `advance`), the lead route, and the workspace pause routes; the form never carries `version`, `mode`, or `revision`.

Each message card shows its stamp, `stage · cycle N` (or the stage alone when the message has no cycle), only on a stamped message. The message that advanced the thread shows only its mark, `Advanced to <stage>`, taken from the view's `stageHistory[].messageId`, and no stamp. Without a loaded view, the card shows no mark and no error.

A restored state (`ledger_restored`) pauses the thread and hides the stage and the participants until the human recovers it; `Recover` then raises each stage's count to the highest stamped cycle, and no count goes down.

The sessions menu marks a developer profile with no session with a tooltip that explains both cases: a developer subagent runs inside an architect's session and is never bound, and a fixed developer session is bound through `marc open`. The sessions menu does not show in a closed thread, as the activation trigger does not, and the sessions view of a closed thread returns no pending warnings. The view keeps its slots and its response shape; only the warnings are empty.

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

The content column footer exposes a keyboard icon link that opens the global keyboard shortcuts sheet.

The same footer displays the version of the loaded UI bundle. Vite injects the `version` field from the project `package.json`; this value does not identify the daemon process and does not require a daemon request.

## Artifacts

Artifacts are Markdown files attached to messages. The UI can open them in a modal, and the thread artifact menu can list artifacts posted across the thread.

Artifact filenames are normalized to Markdown. If a user enters a name that does not end in `.md`, mARC appends `.md`.

Keyboard shortcuts, artifact creation, and artifact viewing open in right-side sheets. Each sheet closes from its close control, `Escape`, or a backdrop click, and blocks interaction and background scrolling while open.

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
| `POST` | `/api/workspaces/:workspaceId/threads` | Create an empty thread from a JSON `{ "title": string }` payload and return its `ThreadInfo` with status `201`. |
| `GET` | `/api/workspaces/:workspaceId/rules` | Read workspace rules. |
| `GET` | `/api/workspaces/:workspaceId/agents` | List registered agents. |
| `GET` | `/api/workspaces/:workspaceId/settings` | Read workspace settings used by the UI. |
| `POST` | `/api/workspaces/:workspaceId/settings` | Update workspace settings such as `memory.autoRebuild` and `memory.embeddingBatchSize`. |
| `POST` | `/api/workspaces/:workspaceId/memory/prepare` | Explicitly prepare and validate the workspace's three local memory model caches without rebuilding its index. |
| `POST` | `/api/workspaces/:workspaceId/memory/rebuild` | Start a background incremental rebuild by default. Pass `{ "mode": "full" }` for an explicit full rebuild. |
| `POST` | `/api/workspaces/:workspaceId/memory/recall` | Search the workspace memory index. The UI uses the default depth. |
| `POST` | `/api/workspaces/:workspaceId/memory/purge` | Remove unused memory generations and model files while preserving the active generation and configured production models. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId` | Read one thread. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId` | Post a UI message to a thread. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId/messages/:messageId/artifacts/:fileName` | Read a message artifact. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/messages/:messageId/artifacts` | Attach a Markdown artifact to a message. |
| `GET` | `/api/workspaces/:workspaceId/activation` | Read the workspace pause alone: `{ paused, pausedAt }`, with `pausedAt` `null` while running. Refused with `409` (`ledger_lost` or `ledger_invalid`) when the workspace file is lost or invalid. The workspace view reads it on load, because it has no thread to read the pause from. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId/activation` | Read the thread's activation view: `policyState` (`none`, `outdated`, `ready`, or `invalid`), `enabled`, the policy or `null`, `participants` (the architect profiles, computed live), the budget (`currentStage`, `cyclesUsed`, `cyclesPerStage`, `granted`, `max`, `remaining`, `warnings`), `legacyStage` (an F3a stage still on the thread, or `null`), the pause flag, `threadPaused`, and the warnings: `budget_last_cycle`, `budget_exhausted`, `settings_tampered`, `policy_outdated`, `policy_tampered`, `revision_mismatch`, `ledger_lost`, `ledger_invalid`, `ledger_restored`. The view also carries `lead`, `leadChanges`, `nextStages` (the stages ahead of the current one), `holds` (the retained reservations, each with its `identityCheck` when an identity hold names the check that failed) and `stageHistory` (each move, with its `messageId` when it names one). |
| `PUT` | `/api/workspaces/:workspaceId/threads/:threadId/activation/policy` | Save the policy from the UI form: `enabled`, `attemptCap`, `pendingTtlMinutes`, and an optional `stageMapping` `{ from, to: "planning" }` that the human confirmed for an F3a stage. The daemon assigns the revision and `updatedAt`. Returns `400` with `errors` for an invalid form or an enabled policy with no architect profile, `409` with `stage_mapping_required` (`from`, `to`) when the confirmation is missing (nothing is written), `409` for a closed thread or a lost or invalid state file, and `200` with the new view otherwise. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/activation/extend` | Body `{ "expectedStage" }`. Adds the authorized cycles per stage to the current stage as a grant. Refused with `409` (`policy_disabled`, a not-ready reason, `stage_changed`, or a lost or invalid state) unless the thread is ready. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/activation/advance` | Body `{ "expectedStage", "to" }`. Moves the thread to any fixed stage strictly ahead of the one the human saw, skipping allowed. An exhausted stage does not refuse the human. Refused with `409` (`not_ahead`, `last_stage`, `stage_changed`, or a not-ready reason). Returns the new view. |
| `PUT` | `/api/workspaces/:workspaceId/threads/:threadId/activation/lead` | Human only. Body `{ "agentId", "expectedLead" }`, where `expectedLead` is the lead the panel saw, or `null`. Makes an architect profile the lead; the budget and the stage stay as they are. Returns `{ "decision": "changed", "lead" }`. Refused with `409` (`lead_changed`, `not_architect`, `same_lead`). |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/activation/reservations` | Used by `marc wait` in a governed thread, not by the UI. Body `{ "messageId", "recipient", "holder", "runId" }`. The daemon reads the author, the mentions and the stamp from the canonical message, grants, holds or refuses the reservation, and answers with the decision. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/activation/stamp` | Used by the MCP before it writes a message. Body `{ "agentId" }`. Read-only: returns the stage, the cycle, the open reservation key and the current stage for the author. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/activation/stamp/confirm` | Used by the MCP after the message is persisted. Body `{ "agentId", "messageId", "reservation" }`. Marks the grant answered by that message. Repeating the call changes nothing. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/activation/agent-advance` | Used by the MCP for `message_post` with `advanceTo`. Body `{ "agentId", "expectedStage", "advanceTo" }` plus the identity fields of the MCP session. Only the lead, with a verified identity, advances. Returns an operation identifier that the confirm route closes. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/activation/agent-advance/confirm` | Used by the MCP after the advancing message is written. Marks the operation with that message. An unconfirmed grant keeps its advance with a `null` reference. |
| `GET` / `POST` | `/api/workspaces/:workspaceId/settings` | `activation.cyclesPerStage` (integer 1 to 20) and `activation.turnTimeoutMinutes` (integer 15 to 480, default 60). A `POST` with a value writes `marc.config.json` and then records the UI authorization; a memory-only `POST` keeps the activation section as it is. The `GET` returns the value in force. |
| `POST` | `/api/workspaces/:workspaceId/activation/pause` | Pause activation for the workspace on this machine. Refused with `409` when the workspace file is lost or invalid. |
| `POST` | `/api/workspaces/:workspaceId/activation/resume` | Resume activation for the workspace. Refused with `409` in the same cases as pause. |
| `POST` | `/api/workspaces/:workspaceId/activation/recover` | Human recovery of lost or invalid state files in the workspace. Invalid content is moved aside, never deleted; recreated thread files carry no authorization; a recovered workspace starts paused. Refused with `409` (`nothing_to_recover`) when everything is healthy. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId/diagnostics` | Read-only view of one thread for local debugging, read by `marc diagnose`. See the paragraph below the table. |
| `GET` | `/api/workspaces/:workspaceId/threads/:threadId/activity` | Read the closing activity snapshot of a thread: profiles, stage outcomes, the policy revision, the pause history, and the conflict count. It never carries native session identifiers, process identifiers, hosts, or owner tokens. Returns `503` when the thread's state cannot be trusted. |
| `POST` | `/api/workspaces/:workspaceId/threads/:threadId/activation/supervision/approve` | Starts the supervised turn of a card in `awaiting_confirmation`. Body `{ "messageId", "recipient" }`. Answers `200` with `{ decision: "started", runId, attempt, mode }`, or `409` with `{ decision: "refused", reason }` and nothing written. |
| `POST` | `.../activation/supervision/retry` | Restarts a `failed` card whose reason is not `revoked` and whose attempts are below the cap, with the same holder and no new debit. Same body and answers as `approve`. |
| `POST` | `.../activation/supervision/continue` | Resumes the session of a `failed` card that timed out, below the cap, with the continuation prompt and no new debit. Same body and answers as `approve`. |
| `POST` | `.../activation/supervision/decline` | Declines a card in `awaiting_confirmation`. Body `{ "messageId", "recipient" }`. Answers `200` with `{ decision: "declined" }`, or `409` with `{ decision: "refused", reason }`. |
| `POST` | `.../activation/supervision/permissions/:requestId` | The panel's decision on an open permission request. Body `{ "decision": "allow" \| "deny" }`. Answers `200` with `{ status }`; a request already decided answers `409` (`already_decided`) and an unknown one `404` (`request_not_found`). Only the panel calls it. |
| `POST` | `/api/supervision/runs/:runId/permissions` | Used by the MCP permission prompt of a live supervised turn. Only the turn's own client process may open a request. Answers `201` with `{ requestId }`. |
| `GET` | `/api/supervision/runs/:runId/permissions/:requestId` | The MCP process reads the decision of its request here. |
| `GET` | `/api/supervision/runs/:runId/notice` | The MCP process reads the deadline notice of a live turn. Answers `404` (`run_not_found`) for a run that is not live. |

**Thread diagnostics.** `GET .../threads/:threadId/diagnostics` is a read-only view for local debugging, the one `marc diagnose` reads. It is kept apart from the UI views on purpose: the ⚡ and 👤 views and the Activity section never show native session ids, pids or hosts, and debugging needs them. It shows the binding each slot records (origin, generation, native session id, host, client pid and start, last heartbeat, bound, observed and ended times, conflicts), the state the slot derives now, the inventory processes that the binding links by session or pid, every reservation with its `identityCheck`, and every supervision card with its turn. It never shows the owner token, the run ids, the processes of other sessions, or the rows of the process table. A closed thread still answers. An unreadable state answers with `registry` set to `invalid` and its reason, with no slots or records. An unknown workspace or thread answers `404`.

State kept by the daemon lives under its data directory, outside the repository. Each thread has its own state file, `threads/<workspaceId>/<threadId>.json`, with its session slots and its activation counters, beside a `<threadId>.meta.json` marker. Each workspace has one `workspaces/<workspaceId>.json` file for the pause. Each file has its own write queue. A legacy `sessions.json` is split into the thread files once, and the original is kept under a `.migrated-<timestamp>` suffix. A thread whose `SUMMARY.md` exists accepts no daemon write, and its state file is removed.

The API uses the daemon bearer token. It is not a public remote API surface.

`/api/status` keeps the compatibility field `ok: boolean` and includes module health under `modules`. The thread index module reports each registered workspace as `ready`, `rebuilding`, `degraded`, or `unavailable`; the UI uses this to keep the last known thread list visible while a background rebuild finishes.

The memory module reports each registered workspace under `modules.memory.workspaces`. Its status values are `ready`, `stale`, `missing`, `model_missing`, `incompatible`, `preparing`, `rebuilding`, or `degraded`. The health payload also includes `autoRebuild`, `embeddingBatchSize`, `preparing`, `rebuilding`, `lastPreparedAt`, `lastRebuildAt`, and `lastError`. The UI renders this as a compact database icon on each workspace card. Missing or stale memory does not make the daemon disconnected; it only indicates that agents may need model preparation or memory rebuild before relying on semantic recall.

Workspace memory settings are stored per workspace in `.marc/marc.config.json`. This JSON file is structured machine configuration; Markdown remains the source of truth for mARC knowledge, threads, summaries, rules, messages, and artifacts. `memory.autoRebuild` defaults to `true`; automatic rebuild runs only for `missing` or `stale` memory when the retriever and reranker are ready, and always uses incremental mode. It does not retry `degraded` memory. `memory.embeddingBatchSize` defaults to `4` and accepts even values from `2` through `16`. The settings panel exposes that value with a slider and offers separate incremental and explicit full rebuild actions. The panel has no search-depth control: a `memory.searchRetryDepth` key left in an older file is ignored on read and removed on the next settings write. The daemon never downloads or prepares models automatically.

The UI memory search uses `POST /api/workspaces/:workspaceId/memory/recall`, which delegates to the same core recall flow as the MCP tool. The UI sends a single search without a `depth` field, so it runs at the default depth `0` and reads closed-thread summaries only, with no retry ladder and no search-depth control. Layers `1` and `2` stay available through the MCP and the CLI. It is enabled only when the index is `ready` or `stale` and all three model roles are ready. The route requires the daemon bearer token, validates a non-empty `query`, and returns the recall result, including `indexStatus`, `results`, `nextActions`, `abstained`, `layersSearched`, and `rerankPairs`. It accepts `depth` from `0` through `2`; depth counts corpus layers and does not relax semantic eligibility. `memory_deep` has no HTTP route. `minScore` has been removed from the recall contract. Rebuild operations coordinate through workspace-scoped cache locks shared with CLI and MCP, and a concurrent rebuild request does not queue a second rebuild. Manual purge is available through `POST /api/workspaces/:workspaceId/memory/purge` and the CLI; it preserves the active memory generation and configured production model files.

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
