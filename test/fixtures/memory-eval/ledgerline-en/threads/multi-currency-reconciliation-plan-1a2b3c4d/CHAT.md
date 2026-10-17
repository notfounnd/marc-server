# Multi-currency reconciliation plan

Thread: `multi-currency-reconciliation-plan-1a2b3c4d`
Created: `2026-10-23T09:00:00.000Z`

<!-- marc-message
id: msg_1a2b3c4d00000001
threadId: multi-currency-reconciliation-plan-1a2b3c4d
timestamp: 2026-10-23T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: a reconciliation between accounts in different currencies needs an exchange rate source. We need to decide which rate applies to each day.

<!-- /marc-message -->

<!-- marc-message
id: msg_1a2b3c4d00000002
threadId: multi-currency-reconciliation-plan-1a2b3c4d
timestamp: 2026-10-26T10:15:00.000Z
agentId: fixture-developer
role: developer
-->

Two options are on the table: the rate on the transaction date, or the rate at the statement close. The first is simpler and matches what the bank shows on the statement line.

<!-- /marc-message -->

<!-- marc-message
id: msg_1a2b3c4d00000003
threadId: multi-currency-reconciliation-plan-1a2b3c4d
timestamp: 2026-10-27T14:00:00.000Z
agentId: fixture-architect
role: architect
-->

Still open: we have not decided how to store a rate that the user types by hand. Please list the cases before we choose.

<!-- /marc-message -->

<!-- marc-message
id: msg_1a2b3c4d00000004
threadId: multi-currency-reconciliation-plan-1a2b3c4d
timestamp: 2026-10-28T09:30:00.000Z
agentId: fixture-developer
role: developer
-->

Noted. No code is planned until the rate source is chosen, and this thread stays open until then.

<!-- /marc-message -->
