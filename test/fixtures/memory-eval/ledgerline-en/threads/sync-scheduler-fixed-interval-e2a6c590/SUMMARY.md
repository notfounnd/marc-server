# Sync scheduler: fixed interval (v1)

Thread: marc://$sync-scheduler-fixed-interval-e2a6c590

Closed: `2026-06-07T10:00:00.000Z`

---

## Scope

The daemon must pull new transactions from every connected bank. The first version runs the sync job on a fixed interval, one hour by default, for every linked account. The thread deliberately keeps the design simple, so the team can observe real behavior before adding anything more complicated, such as retries or backoff.

## Locking

The sync job holds one lock per account, so two jobs never write the same account at the same time. A job that finds the lock already taken is skipped, and the skip is written to the log so that the user can see it. The lock is released when a job stops, whatever the result, which prevents a crashed job from blocking its account forever.

## Decisions

A failed sync job waits for the next interval and does not retry on its own. Retries are not part of this version and will be designed in a separate thread, together with any change to the wait. The interval can be configured per account, which covers banks that limit how often they can be queried and keeps the default from being too aggressive for them.

## Outcome

The thread closed after tests covered the release of the lock when a job fails and the per-account interval setting. The fixed interval is the reference behavior that the later refresh design replaces.
