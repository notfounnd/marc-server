# CLI command structure and exit codes

Thread: marc://$cli-command-structure-and-exit-codes-3c9e0a52

Closed: `2026-08-13T10:00:00.000Z`

---

## Scope

The command line interface grows with every feature, so the thread set one command grammar for the whole tool: a verb, then a noun, then flags. Exit codes must also tell scripts what happened without anyone parsing the output. Without a shared grammar, each new command would invent its own conventions, and scripts would break in small ways that are hard to find.

## Exit codes

The proposal used zero for success, one for a business failure such as a rejected import, two for a usage error, and three for an unreachable daemon. Each code has one meaning across all commands, so a script can branch on the result without knowing which command produced it.

## Decisions

The grammar and the exit codes are fixed for version one. Every command whose behavior changes must update the command line reference in the same change, so the documentation never describes an older contract. A test table checks the exit code of each command for success and for the usage error.
