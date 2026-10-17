# Bank connector plugin interface decision

Thread: `bank-connector-plugin-interface-decision-5d2e8a17`
Created: `2026-10-19T09:00:00.000Z`

<!-- marc-message
id: msg_5d2e8a1700000001
threadId: bank-connector-plugin-interface-decision-5d2e8a17
timestamp: 2026-10-19T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: we are considering a plugin interface so that new bank connectors can ship outside the core package. The question is whether the interface is public before the first external connector exists.

<!-- /marc-message -->

<!-- marc-message
id: msg_5d2e8a1700000002
threadId: bank-connector-plugin-interface-decision-5d2e8a17
timestamp: 2026-10-20T10:40:00.000Z
agentId: fixture-developer
role: developer
-->

A public interface now would freeze names we have not used yet. We propose an internal interface with the two current connectors as the only implementations.

<!-- /marc-message -->

<!-- marc-message
id: msg_5d2e8a1700000003
threadId: bank-connector-plugin-interface-decision-5d2e8a17
timestamp: 2026-10-21T15:10:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the interface stays internal for this release. It is documented as unstable, and a public version waits until a second external connector asks for it.

<!-- /marc-message -->

<!-- marc-message
id: msg_5d2e8a1700000004
threadId: bank-connector-plugin-interface-decision-5d2e8a17
timestamp: 2026-10-22T11:20:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The internal interface has a version field, so the loader can detect a later change.

<!-- /marc-message -->
