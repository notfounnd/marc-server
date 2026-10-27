import { Database, RefreshCw, Trash2 } from "lucide-react";
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
  onPurge,
  onRebuild
}: {
  health?: MemoryIndexHealth;
  t: (key: string, options?: Record<string, string | number>) => string;
  onAutoRebuildChange: (autoRebuild: boolean) => void;
  onEmbeddingBatchSizeChange: (embeddingBatchSize: number) => void;
  onPrepareModel: () => void;
  onPurge: () => void;
  onRebuild: (mode: "incremental" | "full") => void;
}) {
  const modelsPrepared = health?.modelPrepared === true;
  const preparing = health?.preparing === true;
  const rebuilding = health?.rebuilding === true;
  const busy = preparing || rebuilding;
  const canPrepare = !modelsPrepared && !busy;
  const canRebuild = health?.rebuildReady === true && !busy;
  const canPurge = (health?.maintenance?.recoverableBytes ?? 0) > 0 && !busy;
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
        <Label>{t("Memory status")}</Label>
        <span>{health?.message ?? t("Memory status unavailable.")}</span>
        {health?.lastError ? <small>{health.lastError}</small> : null}
      </div>
      <div className="workspace-settings-models">
        <Label>{t("Active models")}</Label>
        {(health?.maintenance?.models ?? [])
          .filter((model) => model.active)
          .map((model) => (
            <div className="workspace-settings-model" key={model.role}>
              <span>{model.model}</span>
              <small>
                {model.role} · {model.variant} · {formatBytes(model.bytes)}
              </small>
            </div>
          ))}
        <small>
          {t("{{size}} can be released.", {
            size: formatBytes(health?.maintenance?.recoverableBytes ?? 0)
          })}
        </small>
        <Button
          className="workspace-settings-action workspace-settings-purge-action"
          disabled={!canPurge}
          onClick={onPurge}
        >
          <Trash2 size={14} />
          {t("Purge unused")}
        </Button>
      </div>
      <div className="workspace-settings-toggle-row">
        <Label htmlFor="workspace-memory-auto-rebuild">
          {t("Automatic memory rebuild")}
        </Label>
        <Switch
          id="workspace-memory-auto-rebuild"
          checked={autoRebuild}
          onCheckedChange={onAutoRebuildChange}
        />
      </div>
      <div className="workspace-settings-batch-row">
        <Label htmlFor="workspace-memory-embedding-batch-size">
          {t("Inference batch size")}
          <span>{t("{{count}} items", { count: batchSize })}</span>
        </Label>
        <Slider
          id="workspace-memory-embedding-batch-size"
          aria-label={t("Inference batch size")}
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
          {t("Prepare models")}
        </Button>
        <Button
          className="workspace-settings-action"
          disabled={!canRebuild}
          onClick={() => onRebuild("incremental")}
        >
          <RefreshCw size={14} className={classNames(rebuilding && "spin")} />
          {t("Incremental rebuild")}
        </Button>
        <Button
          className="workspace-settings-action"
          disabled={!canRebuild}
          onClick={() => onRebuild("full")}
        >
          <RefreshCw size={14} className={classNames(rebuilding && "spin")} />
          {t("Full rebuild")}
        </Button>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = "B";
  for (const nextUnit of units) {
    value /= 1024;
    unit = nextUnit;
    if (value < 1024) break;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}
