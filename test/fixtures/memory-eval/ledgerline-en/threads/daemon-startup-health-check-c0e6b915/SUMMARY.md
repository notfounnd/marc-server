# Daemon startup health check

Thread: marc://$daemon-startup-health-check-c0e6b915

Closed: `2026-09-24T10:00:00.000Z`

---

## Scope

The daemon starts even when the database is locked or a disk is full, and users discover the problem only later, when a sync fails or a page does not load. The startup should check its prerequisites and report what it found before it accepts any request.

## Checks

The check verifies the settings file, the database lock, the free disk space and the port the API needs. Each failure has a code and a suggested action, so the message tells the user what to do next instead of only describing the error.

## Decisions

A failed check stops the daemon before it accepts any request. Warnings, such as low disk space, are logged and do not stop it. The health command shows the same checks on demand with the same codes, so an operator sees exactly what the daemon saw at startup.
