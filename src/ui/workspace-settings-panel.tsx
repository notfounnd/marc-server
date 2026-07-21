import { Database, RefreshCw, Search } from "lucide-react";
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
  onSearchRetryDepthChange,
  onPrepareModel,
  onRebuild
}: {
  health?: MemoryIndexHealth;
  t: (key: string, options?: { count: number }) => string;
  onAutoRebuildChange: (autoRebuild: boolean) => void;
  onEmbeddingBatchSizeChange: (embeddingBatchSize: number) => void;
  onSearchRetryDepthChange: (searchRetryDepth: number) => void;
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
  const configuredSearchRetryDepth = health?.searchRetryDepth ?? 0;
  const [batchSize, setBatchSize] = useState(configuredBatchSize);
  const [searchRetryDepth, setSearchRetryDepth] = useState(
    configuredSearchRetryDepth
  );

  useEffect(() => {
    setBatchSize(configuredBatchSize);
  }, [configuredBatchSize]);

  useEffect(() => {
    setSearchRetryDepth(configuredSearchRetryDepth);
  }, [configuredSearchRetryDepth]);

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

  function updateSearchRetryDepth(value: number[]) {
    const next = value[0];
    if (next === undefined) return;
    setSearchRetryDepth(next);
  }

  function commitSearchRetryDepth(value: number[]) {
    const next = value[0];
    if (next === undefined) return;
    setSearchRetryDepth(next);
    if (next === configuredSearchRetryDepth) return;
    onSearchRetryDepthChange(next);
  }

  return (
    <div className="workspace-settings-panel">
      <div className="workspace-settings-head">
        <Search size={14} />
        <span>{t("Search")}</span>
      </div>
      <div className="workspace-settings-batch-row">
        <Label htmlFor="workspace-memory-search-retry-depth">
          {t("Search depth")}
          <span>{t("{{count}} retries", { count: searchRetryDepth })}</span>
        </Label>
        <Slider
          id="workspace-memory-search-retry-depth"
          aria-label={t("Search depth")}
          max={3}
          min={0}
          step={1}
          value={[searchRetryDepth]}
          onValueChange={updateSearchRetryDepth}
          onValueCommit={commitSearchRetryDepth}
        />
        <div className="workspace-settings-slider-legend" aria-hidden="true">
          <span>{t("Edge")}</span>
          <span>{t("Deep")}</span>
        </div>
      </div>
      <div className="workspace-settings-head">
        <Database size={14} />
        <span>{t("Memory")}</span>
      </div>
      <div className="workspace-settings-status">
        <Label>{t("Memory status")}</Label>
        <span>{health?.message ?? t("Memory status unavailable.")}</span>
        {health?.lastError ? <small>{health.lastError}</small> : null}
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
