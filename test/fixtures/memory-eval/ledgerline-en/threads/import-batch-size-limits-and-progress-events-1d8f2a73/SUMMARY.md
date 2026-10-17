# Import batch size limits and progress events

Thread: marc://$import-batch-size-limits-and-progress-events-1d8f2a73

Closed: `2026-09-30T10:00:00.000Z`

---

## Scope

Large CSV and OFX imports can exceed the memory available and block the user interface while they run. The thread adds a batch size limit and progress events that the interface can display, so that a long import is both safe and visible.

## Batches

Batches of five hundred rows are committed in one transaction. Each batch emits a progress event with the count of rows read and the count of rows accepted, so an interrupted import shows exactly where it stopped. The resume starts from the last committed batch and never repeats one.

## Decisions

The batch size is configurable in the settings file, with a minimum of fifty and a maximum of five thousand. Values outside the range are clamped and logged. Tests cover the clamping, the progress count after an interruption and the resume from the last committed batch.
