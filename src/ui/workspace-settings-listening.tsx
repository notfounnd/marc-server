import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Translate } from "./types.js";

/** The listening default as the workspace memory actions hand it over: the value in force, and the save. */
export type WorkspaceListening = {
  value: boolean | undefined;
  save: (defaultOn: boolean) => Promise<void>;
};

/**
 * The workspace default for listening to a thread, a row beside the activation settings. Off has the agent
 * ask whether to listen when a session starts on a thread; on has it listen and offer to stop. It saves on
 * each switch. It is a preference only, so it never needs the activation authorization.
 */
export function ListeningDefaultField({
  defaultOn,
  onSave,
  t
}: {
  defaultOn: boolean;
  onSave: (defaultOn: boolean) => Promise<void>;
  t: Translate;
}) {
  return (
    <div className="workspace-settings-cycles-row">
      <div className="workspace-settings-cycles-text">
        <Label htmlFor="workspace-listening-default">
          {t("Listen to threads by default")}
        </Label>
        <small>
          {t(
            "Off: the agent asks whether to listen when it starts on a thread. On: it listens and offers to stop."
          )}
        </small>
      </div>
      <Switch
        id="workspace-listening-default"
        checked={defaultOn}
        onCheckedChange={(next: boolean) => void onSave(next)}
      />
    </div>
  );
}
