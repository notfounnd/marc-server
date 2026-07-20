import { Database, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button, classNames } from "./common.js";
import type { MemoryIndexHealth } from "./types.js";

export function WorkspaceSettingsPanel({
  health,
  t,
  onAutoRebuildChange,
  onEmbeddingBatchSizeChange,
  onPrepareModel,
  onRebuild
}: {
  health?: MemoryIndexHealth;
  t: (key: string, options?: { count: number }) => string;
  onAutoRebuildChange: (autoRebuild: boolean) => void;
  onEmbeddingBatchSizeChange: (embeddingBatchSize: number) => void;
  onPrepareModel: () => void;
  onRebuild: (mode: "incremental" | "full") => void;
}) {
  const modelPrepared = health?.modelPrepared === true;
  const preparing = health?.preparing === true;
  const rebuilding = health?.rebuilding === true;
  const busy = preparing || rebuilding;
  const canPrepare = !modelPrepared && !busy;
  const canRebuild = modelPrepared && !busy;
  const autoRebuild = health?.autoRebuild ?? true;
  const configuredBatchSize = health?.embeddingBatchSize ?? 4;
  const [batchSize, setBatchSize] = useState(configuredBatchSize);

  useEffect(() => {
    setBatchSize(configuredBatchSize);
  }, [configuredBatchSize]);

  function updateBatchSize(value: number[]) {
    const next = value[0];
    if (next === undefined) return;
    setBatchSize(next);
  }

  function commitBatchSize(value: number[]) {
    const next = value[0];
    if (next === undefined) return;
    setBatchSize(next);
    if (next === configuredBatchSize) return;
    onEmbeddingBatchSizeChange(next);
  }

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
      <div className="workspace-settings-batch-row">
        <Label htmlFor="workspace-memory-embedding-batch-size">
          {t("Embedding batch size")}
          <span>{t("{{count}} records", { count: batchSize })}</span>
        </Label>
        <Slider
          id="workspace-memory-embedding-batch-size"
          aria-label={t("Embedding batch size")}
          disabled={busy}
          max={16}
          min={2}
          step={2}
          value={[batchSize]}
          onValueChange={updateBatchSize}
          onValueCommit={commitBatchSize}
        />
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
          onClick={() => onRebuild("incremental")}
        >
          <RefreshCw size={14} className={classNames(rebuilding && "spin")} />
          {t("Rebuild incremental")}
        </Button>
        <Button
          className="workspace-settings-action"
          disabled={!canRebuild}
          onClick={() => onRebuild("full")}
        >
          <RefreshCw size={14} className={classNames(rebuilding && "spin")} />
          {t("Rebuild full")}
        </Button>
      </div>
    </div>
  );
}
