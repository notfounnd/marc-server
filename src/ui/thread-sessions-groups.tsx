import * as React from "react";
import { ThreadSessionRow } from "./thread-sessions-row.js";
import type {
  SessionStateName,
  ThreadSessionSlot,
  Translate
} from "./types.js";

type Group = "active" | "ended" | "other";

/** Dispatch table: session state to the group it is listed in. */
const STATE_GROUP: Record<SessionStateName, Group> = {
  unbound: "other",
  online: "active",
  reserved: "active",
  ended: "ended",
  unknown: "active",
  conflict: "active"
};

/** The Active and Ended groups, then the unbound profiles folded under a toggle that starts collapsed. */
export function SlotGroups({
  slots,
  t,
  onCopy,
  otherOpen,
  onToggleOther
}: {
  slots: ThreadSessionSlot[];
  t: Translate;
  onCopy: (text: string) => void;
  otherOpen: boolean;
  onToggleOther: () => void;
}) {
  if (slots.length === 0) {
    return <p className="sessions-status">{t("No agent profiles to show.")}</p>;
  }
  return (
    <>
      <SlotGroup
        title="Active"
        slots={inGroup(slots, "active")}
        t={t}
        onCopy={onCopy}
      />
      <SlotGroup
        title="Ended"
        slots={inGroup(slots, "ended")}
        t={t}
        onCopy={onCopy}
      />
      <OtherGroup
        slots={inGroup(slots, "other")}
        t={t}
        onCopy={onCopy}
        open={otherOpen}
        onToggle={onToggleOther}
      />
    </>
  );
}

function inGroup(
  slots: ThreadSessionSlot[],
  group: Group
): ThreadSessionSlot[] {
  return slots.filter((slot) => STATE_GROUP[slot.state] === group);
}

/** A labeled group of rows. An empty group is not rendered. */
function SlotGroup({
  title,
  slots,
  t,
  onCopy
}: {
  title: string;
  slots: ThreadSessionSlot[];
  t: Translate;
  onCopy: (text: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <section className="sessions-group">
      <span className="sessions-eyebrow">{t(title)}</span>
      <ul className="sessions-list">
        {slots.map((slot) => (
          <ThreadSessionRow
            key={slot.profile}
            slot={slot}
            t={t}
            onCopy={onCopy}
          />
        ))}
      </ul>
    </section>
  );
}

function OtherGroup({
  slots,
  t,
  onCopy,
  open,
  onToggle
}: {
  slots: ThreadSessionSlot[];
  t: Translate;
  onCopy: (text: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  if (slots.length === 0) return null;
  return (
    <section className="sessions-group">
      <button
        type="button"
        className="sessions-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{t("Other profiles · {{count}}", { count: slots.length })}</span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      <OtherRows slots={slots} t={t} onCopy={onCopy} open={open} />
    </section>
  );
}

function OtherRows({
  slots,
  t,
  onCopy,
  open
}: {
  slots: ThreadSessionSlot[];
  t: Translate;
  onCopy: (text: string) => void;
  open: boolean;
}) {
  if (!open) return null;
  return (
    <ul className="sessions-list">
      {slots.map((slot) => (
        <ThreadSessionRow
          key={slot.profile}
          slot={slot}
          t={t}
          onCopy={onCopy}
        />
      ))}
    </ul>
  );
}
