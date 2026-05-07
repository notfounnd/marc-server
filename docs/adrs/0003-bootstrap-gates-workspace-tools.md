# 0003 - Bootstrap gates workspace tools

## Decision

Agents must call `workspace_bootstrap` before using gated mARC tools, then pass `bootstrapConfirmed: true`.

## Context

MCP cannot push project context into an agent by itself. The tool contract must make the agent fetch instructions and rules before acting on thread context.

## Consequences

- `workspace_bootstrap`, `marc_helper`, and `workspace_update_recommendations` remain free tools.
- Workspace, thread, message, and agent tools are gated.
- Gated tools remind agents how to recover if bootstrap context is lost after compaction or resume.
