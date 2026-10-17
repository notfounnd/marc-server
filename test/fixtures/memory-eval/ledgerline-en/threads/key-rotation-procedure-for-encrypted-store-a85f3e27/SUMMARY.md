# Key rotation procedure for the encrypted store

Thread: marc://$key-rotation-procedure-for-encrypted-store-a85f3e27

Closed: `2026-08-07T10:00:00.000Z`

---

## Scope

The encrypted store needs a rotation procedure, because keys should change over time and a key may be exposed by accident. Users should not lose data when the key changes, and the procedure should be cheap enough to run on a schedule without disrupting the daemon. This thread defines that procedure and the command that runs it.

## Options

Two designs were compared, and the comparison weighed the operational cost of each against the complexity of the code path. It also considered what a failed rotation would leave behind, because a half finished change is the main risk of any rotation.

## Outcome

The chosen design was implemented as a command with a dry run, so an operator can see what would happen before anything changes. The command refuses to run while a sync job holds a lock. The thread closed after the command and its tests passed.
