# 0001 - Markdown is the source of truth

## Decision

mARC stores workspace context in project-local Markdown files under `.marc/`.

## Context

Agents and humans both need to inspect, edit, archive, and recover conversation context. A database-only source of truth would make that harder and would hide useful state from normal project tooling.

## Consequences

- `CHAT.md`, `SUMMARY.md`, `RULES.md`, `INSTRUCTIONS.md`, agent profiles, and artifacts remain directly readable.
- Cache and index files are derived controls, not authoritative state.
- Changes that affect persistence must preserve Markdown readability.
