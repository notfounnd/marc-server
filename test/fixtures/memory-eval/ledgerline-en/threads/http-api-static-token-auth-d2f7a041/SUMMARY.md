# Local HTTP API: static token auth (v1)

Thread: marc://$http-api-static-token-auth-d2f7a041

Closed: `2026-07-09T10:00:00.000Z`

---

## Scope

The local HTTP API serves the web UI and the command line interface, so every client that talks to the daemon goes through it. Every request needs a token. The first version uses one static token generated at install time and shared by every local client, which is the simplest way to protect the API while the client list is still small.

## Access

The token is sent in the Authorization header of each request. The server binds to 127.0.0.1, so no other machine on the network can reach it, even when the token leaks. A rotation command replaces the token and invalidates the old one at once, so a compromised token can be cut off without reinstalling the application.

## Decisions

One token for the whole machine is acceptable for this version, because every client runs as the same operating system user and the threat model is local. The design is expected to change when a client needs a different identity or a narrower permission, which is the subject of the next thread on this API.

## Outcome

A test checks that the rotation command invalidates the old token immediately, and the thread closed after that test passed. The rotation procedure was added to the operations notes for the release.
