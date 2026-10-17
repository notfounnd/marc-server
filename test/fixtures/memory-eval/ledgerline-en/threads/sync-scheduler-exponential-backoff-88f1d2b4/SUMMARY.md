# Sync scheduler: exponential backoff (v2)

Thread: marc://$sync-scheduler-exponential-backoff-88f1d2b4

Closed: `2026-06-12T10:00:00.000Z`

---

## Scope

A failing bank should not be polled every hour, because repeated failures waste requests and can lead the bank to block the client. This thread replaces the fixed interval of version one with an exponential backoff. The refresh cycle keeps the per-account lock introduced in the first version, so two cycles still never write the same account at once.

## Backoff

Each failure doubles the wait before the next refresh cycle, up to a cap of twelve hours. A success resets the wait to the base interval at once. The refresh cycle records the time of the next attempt in the database, so a restart does not reset the backoff and turn a long wait into an immediate poll against a bank that is still failing.

## Decisions

The cap and the base interval are settings of the account, so that an account with an unusually reliable bank can use a shorter base interval. Storing the next attempt time in the database was chosen over keeping it in memory, for the restart reason above. The lock behavior is unchanged, and a skipped cycle is still logged.

## Outcome

A test simulates five failures followed by one success and checks the wait after each one. The thread closed after that test passed and the wait values matched the documented cap.
