# Web UI: paged transactions list (v1)

Thread: marc://$web-ui-transactions-paged-list-6a0b7f15

Closed: `2026-06-28T10:00:00.000Z`

---

## Scope

The web UI needs a transactions list, and this first version uses numbered pages of fifty rows with previous and next controls. The paged list is the baseline for later work on the list, so its behavior is documented carefully before any change to how rows are rendered.

## Behavior

Each page is a request to the local API with an offset and a limit, so the list never holds more than one page of data in the browser. The list shows the date, the description, the category and the amount in the account currency. Filters apply per account, and the filter choice is kept while the user moves between pages.

## Decisions

The sort order is fixed to the booking date, newest first. Users can filter by account but cannot sort by column in this version, because column sorting would need a server side change that was out of scope for this thread. Keeping the order fixed also makes the offset of each page stable for the user.

## Outcome

A keyboard test moves between pages and keeps the focus on the list after each move, so screen reader users do not lose their place. The thread closed after that test passed and the page controls were reviewed for their labels.
