# 0010 - Memory source layers share one index per generation

## Decision

The memory index holds records from several source types, grouped in layers: layer 0 for closed-thread summaries, layer 1 for artifacts, rules, and documents, and layer 2 for chat messages. All layers are written into one LanceDB generation and one manifest. Every record stores its source type, layer, source path, and authority. Only layer 0 is indexed and searched by default.

Reserved identifiers name the groups that are not threads: `@rules` for the workspace rules file and `@document/<sourcePath>` for each external document. Thread identifiers never start with `@`, so these identifiers cannot collide with them.

External documents are opt-in. They are listed in `memory.documentSources` in `.marc/marc.config.json`, resolve inside the workspace root, and are read only when configured.

## Context

Summary-only memory cannot surface evidence that sits in artifacts, rules, or chat. A separate index per source type would need its own ranking, status, and manifest contract. Record-level provenance lets search, status, and the evaluation harness tell sources apart inside one store. Reserved identifiers keep the thread-keyed rebuild and recall logic intact.

Documents are the only source a user points at by path, so they are restricted. Paths outside the workspace, paths inside `.marc/` or `node_modules/`, and links are not followed. Configuration therefore cannot expose machine state or dependencies to the index.

## Consequences

- One generation holds every indexed layer. A change to the record contract requires a full rebuild, and a manifest with schema 6 reports `incompatible`.
- Indexing another layer is a rebuild decision, not a storage change. The default stays at layer 0 until the ranking has been measured with the other layers.
- Passage identifiers are content-based, so a changed passage invalidates only its own judgments.
- Indexed text turns `#`, `>`, `*`, hyphens and underscores into spaces, as the E0 baseline does. In the E1 measurement, keeping these characters inside the text changed the order of the top threads in case A25 and dropped its top thread below the eligibility threshold.
- External documents are read at rebuild time and are not watched. A configuration change takes effect at the next rebuild.
- Existing workspaces keep their recall behavior until a rebuild requests more layers.

## Continuity note (activation)

The activation of layers 0, 1, and 2 for the production index is accepted on 2026-10-27 (see ADR 0012). The statements above about the default layer describe the decision as it was taken. The default search depth stays `0`, which searches layer 0 only.
