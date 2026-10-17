# Local HTTP API: scoped tokens per client (v2)

Thread: marc://$http-api-scoped-tokens-per-client-9e1c6b38

Closed: `2026-07-15T10:00:00.000Z`

---

## Scope

A static token gives the browser UI and any third-party script the same powers. Each client should receive its own token with its own scope, so that a script cannot change what the interface can change. This version replaces the single token of the first version with a per-client model and keeps the local binding unchanged.

## Model

A token records its client name and a list of scopes, such as read accounts or write categories. A request outside the scope receives a forbidden response, which is distinct from an unauthenticated response. Tokens are issued by the command line interface, stored hashed so that a copy of the store does not reveal them, and listed together with their scopes.

## Decisions

Revoking one token does not affect the others, so a faulty script can be cut off without interrupting the web UI. Migration from the static token keeps the old token working until the user revokes it, so an upgrade does not break existing scripts. The scope names are documented and are part of the public contract of the local API.

## Outcome

The thread closed after the migration path was agreed and the scope names were reviewed. The per-client model is the reference for any future client that talks to the daemon.
