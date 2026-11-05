import { Button } from "./common.js";
import { PanelEyebrow } from "./panel-primitives.js";
import { participantRowsOf } from "./thread-activation-people.js";
import type { Translate } from "./types.js";

/**
 * The architect profiles that wake in this thread. The lead carries its mark; every other architect
 * offers Make lead, which is the only way the human changes the lead.
 */
export function ParticipantsSection({
  participants,
  lead,
  busy,
  onMakeLead,
  t
}: {
  participants: string[];
  lead: string | null | undefined;
  busy: boolean;
  onMakeLead: (agentId: string) => void;
  t: Translate;
}) {
  const rows = participantRowsOf(participants, lead);
  return (
    <section className="popover-section activation-section">
      <PanelEyebrow>{t("Participants")}</PanelEyebrow>
      {rows.length === 0 ? (
        <p className="activation-note">
          {t("No architect profile is registered yet.")}
        </p>
      ) : (
        <ul className="activation-participants">
          {rows.map((row) => (
            <li className="activation-participant" key={row.agentId}>
              <span className="activation-check-name">{row.agentId}</span>
              {row.leads ? (
                <span className="activation-leads">{t("Leads")}</span>
              ) : (
                <Button
                  variant="ghost"
                  className="activation-make-lead"
                  disabled={busy}
                  onClick={() => onMakeLead(row.agentId)}
                >
                  {t("Make lead")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
