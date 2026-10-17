# Mobile companion app scoping

Thread: `mobile-companion-app-scoping-5e6f7a8b`
Created: `2026-10-29T09:00:00.000Z`

<!-- marc-message
id: msg_5e6f7a8b00000001
threadId: mobile-companion-app-scoping-5e6f7a8b
timestamp: 2026-10-29T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: users asked for a companion app to see balances away from the desk. The scope and the sync path are not defined yet.

<!-- /marc-message -->

<!-- marc-message
id: msg_5e6f7a8b00000002
threadId: mobile-companion-app-scoping-5e6f7a8b
timestamp: 2026-10-30T10:50:00.000Z
agentId: fixture-developer
role: developer
-->

A read-only companion through the local API would not expose the store to the network. Remote access would need a relay, and a relay breaks the local-only rule.

<!-- /marc-message -->

<!-- marc-message
id: msg_5e6f7a8b00000003
threadId: mobile-companion-app-scoping-5e6f7a8b
timestamp: 2026-10-31T15:20:00.000Z
agentId: fixture-architect
role: architect
-->

Open question: do we accept a relay for read-only balances, or do we wait for a later release?

<!-- /marc-message -->

<!-- marc-message
id: msg_5e6f7a8b00000004
threadId: mobile-companion-app-scoping-5e6f7a8b
timestamp: 2026-11-02T11:05:00.000Z
agentId: fixture-developer
role: developer
-->

Waiting for the decision. The scope stays in this thread until then.

<!-- /marc-message -->
