# 0002 - MCP is configured per target repository

## Decision

mARC MCP configuration must be local to the repository being managed.

## Context

The MCP server receives `--workspace`, and that path determines which `.marc/` folder it reads and writes. A user/global MCP configuration with a fixed `--workspace` would make unrelated repositories share the same mARC project.

## Consequences

- Documentation must steer users toward local/project MCP configuration.
- `--workspace` points to the target repository, not to the `marc-server` repository.
- The `marc-server` path is only the executable path.
