# 0006 - The daemon is optional infrastructure for MCP

## Decision

The MCP server can operate directly on a project's `.marc/` folder without the daemon.

## Context

The daemon exists for the browser UI, workspace registry, local HTTP API, and live updates. Agents using MCP should not require the UI process to read or write project-local Markdown.

## Consequences

- MCP workflows can continue when the daemon is not running.
- UI workflows require the daemon.
- Registering a workspace can notify the daemon when daemon URL and token are configured.
- Documentation must distinguish MCP access from UI/daemon infrastructure.
