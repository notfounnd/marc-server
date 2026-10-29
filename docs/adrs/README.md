# Architecture Decision Records (ADR)

This directory records the main decisions behind mARC's current architecture.

Architecture Decision Records (ADR) are intentionally short. They explain the decision, the context, and the consequence so a new contributor can understand why the project works the way it does.

## Records

- [0001 - Markdown is the source of truth](0001-markdown-source-of-truth.md)
- [0002 - MCP is configured per target repository](0002-mcp-per-target-repository.md)
- [0003 - Bootstrap gates workspace tools](0003-bootstrap-gates-workspace-tools.md)
- [0004 - mARC does not route agent work automatically](0004-no-automatic-agent-routing.md)
- [0005 - `marc://` is the canonical reference scheme](0005-marc-reference-scheme.md)
- [0006 - The daemon is optional infrastructure for MCP](0006-daemon-optional-for-mcp.md)
- [0007 - RULES.md uses a managed baseline and Custom Rules boundary](0007-rules-managed-baseline-and-custom-rules.md)
- [0008 - Localization is scoped to the browser UI](0008-ui-only-localization-boundary.md)
- [0009 - Markdown writes use cooperative locks and atomic file replacement](0009-cooperative-locks-and-atomic-markdown-writes.md)
- [0010 - Memory source layers share one index per generation](0010-memory-source-layers.md)
- [0011 - Memory confidence bands are heuristic, and calibration is deferred](0011-memory-confidence-bands.md)
- [0012 - Memory depth counts corpus layers, and the funnel stays out of production](0012-memory-depth-as-corpus-layers.md)
- [0013 - memory_deep returns scoped passages with a reranker budget of 232](0013-memory-deep-scoped-passages.md)
