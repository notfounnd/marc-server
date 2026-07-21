import { Archive, CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, EmptyState, NavItem } from "./common.js";
import {
  findMemorySearchThread,
  isMemorySearchAvailable,
  isMemorySearchClosedHit,
  memorySearchTooltip
} from "./memory-search.js";
import type {
  MemoryIndexHealth,
  MemoryRecallHit,
  MemoryRecallResult,
  MemorySearchStatus,
  Thread
} from "./types.js";

type Translation = (key: string) => string;

export function MemorySearchPanel({
  allThreads,
  deepRetryAvailable,
  error,
  health,
  query,
  result,
  selectedThreadId,
  status,
  t,
  onDeepRetry,
  onQueryChange,
  onSelectHit,
  onSubmit
}: {
  allThreads: Thread[];
  deepRetryAvailable: boolean;
  error?: string;
  health?: MemoryIndexHealth;
  query: string;
  result?: MemoryRecallResult;
  selectedThreadId?: string;
  status: MemorySearchStatus;
  t: Translation;
  onDeepRetry: () => void;
  onQueryChange: (query: string) => void;
  onSelectHit: (hit: MemoryRecallHit) => void;
  onSubmit: () => void;
}) {
  const available = isMemorySearchAvailable(health);
  const searching = status === "searching";
  const canSubmit = available && !searching && Boolean(query.trim());

  return (
    <div className="memory-search-panel">
      <form
        className="memory-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Input
          value={query}
          disabled={!available || searching}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("Search memory")}
        />
        <Button
          variant="primary"
          className="memory-search-submit"
          disabled={!canSubmit}
          title={t("Search memory")}
          type="submit"
        >
          {t("Search")}
        </Button>
      </form>
      {health?.status === "stale" ? (
        <p className="memory-search-note">
          {t("Memory index is stale. Results may miss recent summaries.")}
        </p>
      ) : null}
      {memorySearchBody({
        allThreads,
        available,
        error,
        health,
        result,
        searching,
        selectedThreadId,
        t,
        onSelectHit
      })}
      {deepRetryAvailable ? (
        <Button className="memory-search-deep-retry" onClick={onDeepRetry}>
          {t("Deep retry")}
        </Button>
      ) : null}
    </div>
  );
}

function memorySearchBody({
  allThreads,
  available,
  error,
  health,
  result,
  searching,
  selectedThreadId,
  t,
  onSelectHit
}: {
  allThreads: Thread[];
  available: boolean;
  error?: string;
  health?: MemoryIndexHealth;
  result?: MemoryRecallResult;
  searching: boolean;
  selectedThreadId?: string;
  t: Translation;
  onSelectHit: (hit: MemoryRecallHit) => void;
}) {
  if (!available) {
    return (
      <EmptyState
        title={t("Memory search unavailable")}
        detail={health?.message ?? t("Memory status unavailable.")}
      />
    );
  }
  if (searching) {
    return (
      <EmptyState
        title={t("Searching memory")}
        detail={t(
          "This can take a moment while the local model processes the query."
        )}
      />
    );
  }
  if (error) {
    return <EmptyState title={t("Search failed")} detail={error} />;
  }
  if (!result) {
    return (
      <EmptyState
        title={t("Nothing here yet")}
        detail={t("Run a memory search to find closed thread summaries.")}
      />
    );
  }
  if (!result.results.length) {
    return (
      <EmptyState
        title={t("No results")}
        detail={t(
          "Try different terms or rebuild memory if recent summaries are missing."
        )}
      />
    );
  }
  return (
    <div className="memory-search-results">
      {result.results.map((hit) => (
        <MemorySearchResultCard
          allThreads={allThreads}
          hit={hit}
          key={hit.threadId}
          selected={hit.threadId === selectedThreadId}
          onSelectHit={onSelectHit}
        />
      ))}
    </div>
  );
}

function MemorySearchResultCard({
  allThreads,
  hit,
  selected,
  onSelectHit
}: {
  allThreads: Thread[];
  hit: MemoryRecallHit;
  selected: boolean;
  onSelectHit: (hit: MemoryRecallHit) => void;
}) {
  const thread = findMemorySearchThread(hit, allThreads);
  const title = thread?.title ?? hit.title;
  const closed = isMemorySearchClosedHit(hit);
  return (
    <NavItem
      active={selected}
      closed={closed}
      detail={searchResultSlug(hit)}
      disabled={!thread}
      icon={thread ? <Archive size={16} /> : <CircleAlert size={16} />}
      onClick={() => onSelectHit(hit)}
      title={title}
      tooltip={memorySearchTooltip(hit, title)}
    >
      {hit.matchedText.trim() ? (
        <span className="memory-search-match">{hit.matchedText}</span>
      ) : null}
    </NavItem>
  );
}

function searchResultSlug(hit: MemoryRecallHit): string {
  return hit.reference.replace(/^marc:\/\/\$/, "");
}
