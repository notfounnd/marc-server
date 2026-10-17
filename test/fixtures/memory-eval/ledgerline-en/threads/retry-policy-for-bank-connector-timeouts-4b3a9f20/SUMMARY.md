# Retry policy for bank connector timeouts

Thread: marc://$retry-policy-for-bank-connector-timeouts-4b3a9f20

Closed: `2026-07-25T10:00:00.000Z`

---

## Scope

Bank connectors time out for reasons that usually clear up on their own, such as a slow response from the bank or a short network interruption. This thread defines a retry policy that recovers from those timeouts without hiding a connection that is really broken. The policy has to balance two risks: giving up too early on a healthy bank, and retrying forever against a bank that is down.

## Options

The thread compared several retry approaches, each with a different effect on how quickly a broken connection is shown to the user. That effect was the main criterion of the comparison. The discussion kept the operator in mind, because the operator reads the connection status in the interface.

## Outcome

The chosen policy was implemented with a test that simulates timeouts followed by a success. The connection state is cleared when the success arrives, so the interface stops showing the problem. The thread closed after that test passed and the state changes were reviewed.
