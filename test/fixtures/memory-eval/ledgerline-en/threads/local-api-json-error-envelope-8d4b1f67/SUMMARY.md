# Local API JSON error envelope

Thread: marc://$local-api-json-error-envelope-8d4b1f67

Closed: `2026-08-19T10:00:00.000Z`

---

## Scope

API errors are inconsistent today. Some return plain text, and others return HTML from the web framework. The web UI needs one shape that it can read on every failure, so that it can show a useful message and not a raw page. This thread defines that shape for the whole local API.

## Shape

Every error returns a JSON object with a stable code, a human readable message and the request identifier. The message never includes account numbers, so the envelope can be shown in the interface and copied into a support report without leaking data. The request identifier lets support find the matching line in the log.

## Decisions

Codes are documented and never reused. A new failure receives a new code even when its HTTP status matches an existing one, so the web UI can tell the two apart. The web UI reads the code, looks up the message and shows it to the user, and the redaction rule for messages is covered by a test.

## Outcome

The thread closed after the web UI change that reads the code was merged and the redaction test passed. The envelope is now the only error format the local API returns.
