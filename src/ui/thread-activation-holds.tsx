import { GoToButton } from "./go-to-button.js";
import { holdOriginOf } from "./thread-activation-people.js";
import { waitTextOf } from "./thread-activation-waiting-model.js";
import type { ActivationHoldView, Message, Translate } from "./types.js";

/**
 * A reservation the daemon holds, shown as a row of the waiting section. It has no action: it names the
 * waiting profile, why it waits, and the mention that holds it, when that message is loaded.
 */
export function HoldRow({
  hold,
  messages,
  goTo,
  t
}: {
  hold: ActivationHoldView;
  messages: Message[];
  goTo: (href: string) => void;
  t: Translate;
}) {
  const origin = holdOriginOf(hold, messages);
  const text = waitTextOf(hold.reason);
  const goButton = (
    <GoToButton
      reference={`marc://#${hold.messageId}`}
      label={t("Go to the message")}
      onOpenLink={goTo}
    />
  );
  return (
    <>
      <div className="activation-head">
        <strong>
          {t("{{recipient}} is waiting", { recipient: hold.recipient })}
        </strong>
        {origin ? null : goButton}
      </div>
      <span className="activation-detail">{t(text.detail)}</span>
      {origin ? (
        <div className="activation-head">
          <span className="activation-detail">
            {t("Mentioned by {{agent}} · {{time}}", {
              agent: origin.agentId,
              time: new Date(origin.timestamp).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit"
              })
            })}
          </span>
          {goButton}
        </div>
      ) : null}
    </>
  );
}
