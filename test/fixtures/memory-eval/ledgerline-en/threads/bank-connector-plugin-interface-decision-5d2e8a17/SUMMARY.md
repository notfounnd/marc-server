# Bank connector plugin interface decision

Thread: marc://$bank-connector-plugin-interface-decision-5d2e8a17

Closed: `2026-10-23T10:00:00.000Z`

---

## Scope

The team considered a plugin interface so that new bank connectors could ship outside the core package. The open question was whether the interface should be public before the first external connector exists, because a public interface is hard to change later.

## Position

A public interface now would freeze names that the project has not used yet. The proposal is an internal interface with the two current connectors as its only implementations, so the names can still change as the second connector shows what is really needed.

## Decisions

The interface stays internal for this release. It is documented as unstable, and a public version waits until a second external connector asks for it. The internal interface carries a version field, so the loader can detect a later change and refuse a connector built for an older contract.
