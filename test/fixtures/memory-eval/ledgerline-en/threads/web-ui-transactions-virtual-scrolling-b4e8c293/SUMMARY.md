# Web UI: virtual scrolling for transactions (v2)

Thread: marc://$web-ui-transactions-virtual-scrolling-b4e8c293

Closed: `2026-07-03T10:00:00.000Z`

---

## Scope

Users with years of history find the paged list slow to browse, because jumping between pages hides the continuity of the data. This version replaces the pages with one continuous list that renders only the rows currently in view. The change keeps the same columns and the same filters as the paged list, so the difference is in how the rows are presented and loaded.

## Rendering

The list requests windows of two hundred rows as the scroll position changes, so the browser holds only the rows near the viewport. Row heights are fixed, so the total scroll height is computed without measuring each row. The paged list stays available as a fallback behind a setting for users whose browsers handle the continuous list poorly.

## Decisions

The measurements that support the change are attached to the thread as an artifact, and they are the reference for the decision. The fallback remains available until the continuous list has been used through a full release cycle without a reported problem. Focus and keyboard behavior must match the paged list in both modes.

## Outcome

The fallback setting is tested in both modes, and focus behaves the same way in each. The thread closed after those tests passed and the measurements were reviewed by the team.
