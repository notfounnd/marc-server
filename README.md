# mARC - markdown Agent Relay Chat

> Chatting is all you need.

<p align="center">
  <img src="./docs/assets/marc-logo.svg" alt="mARC logo" width="96">
</p>

**mARC is a local coordination layer for coding agents.** It gives humans and agents a shared Markdown workspace where tasks become threads, long context becomes artifacts, project guidance stays close to the code, and every participant can catch up without scraping an entire chat history.

It is built for teams that use multiple coding agents, subagents, reviewers, QA agents, or IDE assistants in the same project and need a durable conversation record that is readable by both people and tools.

mARC also supports **[harness engineering](docs/harness-engineering.md)** for coding agents: the project-local structure that makes AI work observable, repeatable, reviewable, and easier to coordinate.

As teams move from one-off prompts to agentic workflows, that harness becomes a core part of the system: it keeps context close to the code, gives every agent the same operating contract, and leaves a durable trail of decisions, evidence, and handoffs.

## Why

Coding agents are good at acting on context, but context often lives in the wrong place:

| Without mARC | With mARC |
|---|---|
| Work is trapped inside one terminal chat. | Work is stored in project-local Markdown threads. |
| A new agent rereads too much or misses what changed. | Agents can read by cursor and fetch only new messages. |
| Long plans and logs bloat the conversation. | Large details move into Markdown artifacts. |
| Subagents need orchestration hints in plain text. | Threads can mention agents and link references directly. |
| Project rules drift between sessions. | `.marc/INSTRUCTIONS.md` and `.marc/RULES.md` keep the contract nearby. |

## What you get

- **Threads**: task conversations stored as `CHAT.md` files inside `.marc/threads/`.
- **Artifacts**: Markdown attachments for plans, reviews, logs, proposals, and large notes.
- **Agent profiles**: registered identities for developers, planners, reviewers, QA agents, and UI users.
- **Bootstrap rules**: a first-call protocol that teaches agents how to use the workspace safely.
- **Incremental reads**: cursor-based tools so agents can read only what changed.
- **Internal references**: `marc://` links for agents, messages, threads, and message artifacts.
- **Thread summaries**: `SUMMARY.md` closes a thread and preserves an executive summary.
- **Local UI**: a daemon-served dashboard for browsing workspaces, threads, messages, and artifacts.
- **Harness support**: operational scaffolding for agent coordination, handoffs, reviews, and durable project context.

## Requirements

- Node.js 22+
- pnpm
- An MCP-compatible agent or IDE client
- On Windows, a Bash-compatible shell such as WSL, Git Bash, MSYS2, or Cygwin

## Quickstart

Install dependencies and build the server:

```bash
pnpm install
pnpm build
```

Start the local daemon in foreground for development:

```bash
pnpm dev:daemon
```

When using the built CLI, start it detached for day-to-day use:

```bash
marc daemon start
marc daemon status
```

Open the UI:

```text
http://127.0.0.1:4187
```

Get the UI/API token after the daemon is running. The daemon creates or reuses `.marc-daemon/token` on startup:

```bash
cat .marc-daemon/token
```

Paste the token into the UI.

Next, add the project where your agents work to mARC. See [Add your project to mARC](#add-your-project-to-marc), then ask your agent:

```text
Register this project in mARC.
```

## Add your project to mARC

A project becomes useful in mARC after an agent connects through MCP and registers it. Configure the mARC MCP server locally in the target repository, then ask the agent to register the project.

MCP is how agent tools reach mARC. 

In mARC, `--workspace` means the target project that owns the `.marc/` folder. It should point to the repository where the agent is working, not to the `marc-server` repository. The `marc-server` path is only the executable path.

> [!IMPORTANT]
> Configure mARC locally in each target repository. Do not use a user/global MCP configuration with a fixed `--workspace`, or unrelated repositories will share the same `.marc/` project.

<details>
<summary>Claude Code</summary>

From the project you want to connect:

```bash
claude mcp add marc --scope local -- node /path/to/marc/dist/cli.js mcp --workspace /path/to/project --daemon-url http://127.0.0.1:4187 --token <token-from-.marc-daemon/token>
```

Use `--scope local`. Do not use Claude's user scope for mARC.

Verify:

```bash
claude mcp list
```

</details>

<details>
<summary>Codex</summary>

Codex can scope MCP servers to a trusted project with `.codex/config.toml`. For mARC, use the project-scoped file inside the target repository.

```toml
[mcp_servers.marc]
command = "node"
args = ["/path/to/marc/dist/cli.js", "mcp", "--workspace", "/path/to/project", "--daemon-url", "http://127.0.0.1:4187", "--token", "<token-from-.marc-daemon/token>"]
```

Do not put this mARC server in `~/.codex/config.toml` unless the `--workspace` is intentionally tied to one repository and you understand that it will appear outside that repository.

Restart Codex from the target project and verify:

```bash
codex mcp list
```

</details>

<details>
<summary>VS Code / GitHub Copilot</summary>

Create `.vscode/mcp.json` in the target repository:

```json
{
  "servers": {
    "marc": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/marc/dist/cli.js", "mcp", "--workspace", "/path/to/project", "--daemon-url", "http://127.0.0.1:4187", "--token", "<token-from-.marc-daemon/token>"]
    }
  }
}
```

Restart the MCP server from VS Code, then ask Copilot Agent mode to register the project.

</details>

## Core workflow

1. Start the daemon.
2. Connect an agent through MCP.
3. Run `workspace_bootstrap` as the first mARC action in the session.
4. Register the workspace and agent.
5. Create or read a thread.
6. Use artifacts for long plans, reviews, logs, and large outputs.
7. Store `lastMessageId` and use `thread_read_since` when checking for updates.
8. Close finished threads by adding a `SUMMARY.md` executive summary.

## Documentation

- [Harness Engineering](docs/harness-engineering.md)
- [Architecture](docs/architecture.md)
- [MCP Tools](docs/mcp-tools.md)
- [Agent Workflows](docs/agent-workflows.md)
- [UI and Daemon](docs/ui-and-daemon.md)
- [Development](docs/development.md)

## Files created in a project

```text
.marc/
  INSTRUCTIONS.md
  RULES.md
  agents/
    <agent-id>.md
  threads/
    <thread-id>/
      CHAT.md
      SUMMARY.md
      artifacts/
  cache/
```

`CHAT.md` files are the source of truth for messages. `SUMMARY.md` marks a thread as closed. Artifacts live with the messages that reference them.

The daemon also creates a local data directory where it is started:

```text
.marc-daemon/
  token
  daemon.json
  daemon.log
```

## Troubleshooting

| Problem | Check |
|---|---|
| UI says unauthorized | Confirm the token from `.marc-daemon/token` and paste it again. |
| Workspace does not appear | Ask an agent to call `workspace_register` with the daemon URL and token configured. |
| Agent tools are missing | Restart the agent session and verify the MCP server list. |
| New tools do not appear | Run `pnpm build`, then reconnect or restart the MCP client. |
| Detached daemon looks stale | Run `marc daemon status`; use `marc daemon restart` when the status reports a different fingerprint. |
| Detached daemon remains after clients exit | New detached daemons auto-idle after the configured timeout when there are no MCP leases, UI/SSE clients, or recent activity. |
| `marc daemon status` during development | Foreground daemons started with `pnpm dev:daemon` are detected through the local `/api/status` fallback when no `daemon.json` exists. |

See [UI and Daemon](docs/ui-and-daemon.md) for daemon, token, UI, and local API details.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

Benchmarks are run with:

```bash
pnpm test:benchmark ./performance/<file>.benchmark.mjs
```
