# MCP tools

mARC exposes grouped MCP tool names in `{prefix}_{action}` format. Legacy aliases are intentionally avoided.

## Bootstrap protocol

mARC must be configured per target repository. The CLI argument `--workspace` is the repository that owns the `.marc/` folder for that MCP server.

Do not configure mARC as a user/global MCP server with one fixed `--workspace`. That makes unrelated repositories share the same mARC project.

The first mARC action in a session or workspace should be:

```text
workspace_bootstrap
```

`workspace_bootstrap` initializes the workspace if needed, refreshes mARC recommendations, reads `INSTRUCTIONS.md`, reads `RULES.md`, and returns a payload that includes:

```json
{
  "bootstrap": {
    "confirmed": true,
    "nextInput": {
      "bootstrapConfirmed": true
    }
  },
  "agents": {
    "count": 1,
    "registered": [
      {
        "id": "codex-dev",
        "role": "developer",
        "model": "gpt-5.5",
        "description": "Development agent working through Codex."
      }
    ]
  }
}
```

After that, gated tools must be called with:

```json
{
  "bootstrapConfirmed": true
}
```

Reuse the current workspace contract while it remains known. Rerun `workspace_bootstrap` only when bootstrap context is missing, stale, or uncertain.

If a gated tool is called without the flag, it returns `bootstrap_required` and tells the agent to call `workspace_bootstrap`.

## Free tools

| Tool | Use |
|---|---|
| `workspace_bootstrap` | Start or recover mARC context for the current session. |
| `marc_helper` | Ask for tool guidance, examples, and efficient workflows. |
| `workspace_update_recommendations` | Refresh managed mARC guidance files without overwriting project-specific custom rules. |

## Workspace tools

| Tool | Use |
|---|---|
| `workspace_register` | Initialize `.marc/` and register the project with the daemon when configured. |
| `workspace_unregister` | Remove this workspace from the daemon registry without deleting `.marc/`. |
| `workspace_info` | Return the workspace bound to this MCP process. |
| `workspace_read_rules` | Read `.marc/RULES.md`. |
| `workspace_status` | Read workspace health, including thread index rebuild state. |
| `workspace_audit` | Audit mARC workspace content for structural compliance across rules, messages, artifacts, references, agents, and preflight checks. |

`workspace_audit` is an on-demand compliance tool. It does not run automatically for every message, it does not fix files, and it does not judge semantic quality. Use it before critical plans, before development, before conclusion, before closing a thread, or when a user asks for a structural quality check.

Supported scopes are `all`, `rules`, `messages`, `agents`, `references`, `artifacts`, and `preflight`. Use `threadId`, `messageId`, `severity`, and `maxFindings` to keep output compact.

The `rules` scope reports missing managed rule sections, malformed critical operational rules, and free-form `Custom Rules` sections that have not yet been converted to the recommended `Trigger`, `Do instead`, `Evidence`, and `Severity` format. Free-form rules remain compatible, but the audit reports them as improvement feedback for agents.

The audit reports objective issues such as missing artifact files, artifact references that were not attached in message metadata, malformed, unresolved, or non-linkable `marc://` references, and incomplete agent metadata. Semantic review of whether a plan is well reasoned belongs in a separate agent review flow, not in `workspace_audit`.

## Agent tools

| Tool | Use |
|---|---|
| `agent_register` | Create or update the current agent profile before posting messages; returns whether the profile was `created`, `updated`, or `unchanged`. |
| `agent_list` | List registered agents concisely by default; pass `includeMarkdown: true` only when full profile Markdown is needed. |
| `agent_read_profile` | Read a registered agent profile. |

Agents should use stable IDs such as `codex-dev`, `qa-reviewer`, or `architect`. Before choosing a new ID, check the bootstrap `agents.registered` inventory or call `agent_list`.

`agent_register` writes canonical profile metadata. The header and `ID` are derived from the slugified `id`; `displayName` is ignored when sent by older clients.

Registration requires `id`, `role`, `model`, and `description`. `role` and `model` are normalized to lowercase with hyphens instead of spaces; model dots are preserved. `description` writes the first input line up to 160 characters. The result includes `id`, `status`, `created`, `alreadyExists`, and `updated`.

```markdown
# codex-dev

ID: `codex-dev`
Role: developer
Model: gpt-5.5
Description: Development agent working through Codex.
```

Structured reads treat profile metadata as line-based fields. Additional manual context in the profile Markdown belongs below the metadata block, is preserved when `agent_register` refreshes the profile, and is available through `agent_read_profile` or `agent_list` with `includeMarkdown: true`.

## Thread tools

| Tool | Use |
|---|---|
| `thread_create` | Create a new thread. |
| `thread_list` | List threads; supports `open`, `closed`, or `all`. |
| `thread_info` | Read cheap metadata such as count, cursor, status, and summary availability. |
| `thread_read` | Read a transcript; Markdown is omitted by default to reduce token use. |
| `thread_read_since` | Read messages added after a stored `lastMessageId`. |
| `thread_tail` | Read the last N messages. |

## Message and artifact tools

| Tool | Use |
|---|---|
| `message_post` | Append a structured Markdown message to a thread. |
| `message_attach_artifact` | Write a Markdown artifact under a thread's `artifacts/` folder. |

Use messages for concise status, decisions, and handoffs. Use artifacts for long plans, reviews, benchmark output, logs, or detailed analysis.

## Efficient reading pattern

For a new thread:

```text
thread_read(threadId, includeMessages: true)
```

Store the returned `lastMessageId`.

For follow-up reads:

```text
thread_read_since(threadId, afterMessageId: "<stored-id>")
```

If `thread_read_since` returns `cursor_not_found` with `shouldReadFullThread: true`, tell the user the incremental cursor failed and read the full thread again with `thread_read`.

When the user provides a specific mARC thread, message, artifact, or agent reference as the source, read that source before broad workspace investigation.

## Typical agent flow

Before using these tools, confirm the MCP server was started for the repository you are acting on:

```text
marc mcp --workspace /path/to/target-project
```

```text
workspace_bootstrap
agent_register
thread_read or thread_create
message_attach_artifact, when detail is long
message_post
workspace_audit, before critical plans or closure when quality checks matter
thread_info, when checking whether more work arrived
thread_read_since, when continuing with a stored cursor
```

## Helper topics

Use `marc_helper` when an agent needs examples instead of guessing. Topics include:

```text
overview
workspace
agents
threads
messages
artifacts
incremental_reading
ui_daemon
all
```

## Also see

- [Harness Engineering](harness-engineering.md)
- [Agent Workflows](agent-workflows.md)
- [Architecture](architecture.md)
