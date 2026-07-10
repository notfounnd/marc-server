import { Database, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button, classNames } from "./common.js";
import type { MemoryIndexHealth } from "./types.js";

export function WorkspaceSettingsPanel({
  health,
  t,
  onAutoRebuildChange,
  onPrepareModel,
  onRebuildMemory
}: {
  health?: MemoryIndexHealth;
  t: (key: string) => string;
  onAutoRebuildChange: (autoRebuild: boolean) => void;
  onPrepareModel: () => void;
  onRebuildMemory: () => void;
}) {
  const modelPrepared = health?.modelPrepared === true;
  const preparing = health?.preparing === true;
  const rebuilding = health?.rebuilding === true;
  const busy = preparing || rebuilding;
  const canPrepare = !modelPrepared && !busy;
  const canRebuild = modelPrepared && !busy;
  const autoRebuild = health?.autoRebuild ?? true;

  return (
    <div className="workspace-settings-panel">
      <div className="workspace-settings-head">
        <Database size={14} />
        <span>{t("Memory")}</span>
      </div>
      <div className="workspace-settings-status">
        <strong>{t("Memory status")}</strong>
        <span>{health?.message ?? t("Memory status unavailable.")}</span>
        {health?.lastError ? <small>{health.lastError}</small> : null}
      </div>
      <div className="workspace-settings-toggle-row">
        <Switch
          id="workspace-memory-auto-rebuild"
          checked={autoRebuild}
          onCheckedChange={onAutoRebuildChange}
        />
        <Label htmlFor="workspace-memory-auto-rebuild">
          {t("Automatic memory rebuild")}
        </Label>
      </div>
      <div className="workspace-settings-actions">
        <Button
          className="workspace-settings-action"
          disabled={!canPrepare}
          onClick={onPrepareModel}
        >
          <RefreshCw size={14} className={classNames(preparing && "spin")} />
          {t("Prepare model")}
        </Button>
        <Button
          className="workspace-settings-action"
          disabled={!canRebuild}
          onClick={onRebuildMemory}
        >
          <RefreshCw size={14} className={classNames(rebuilding && "spin")} />
          {t("Rebuild memory")}
        </Button>
      </div>
    </div>
  );
}
