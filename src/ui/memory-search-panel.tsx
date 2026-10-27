import { Archive, CircleAlert, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, EmptyState, NavItem } from "./common.js";
import {
  findMemorySearchThread,
  isMemorySearchAvailable,
  isMemorySearchClosedHit,
  isMemorySearchHitSelected,
  memorySearchTooltip,
  splitMemorySearchBands
} from "./memory-search.js";
import type {
  MemoryBand,
  MemoryIndexHealth,
  MemoryRecallHit,
  MemoryRecallResult,
  MemorySearchStatus,
  Thread
} from "./types.js";

type Translation = (key: string, options?: Record<string, unknown>) => string;

export function MemorySearchPanel({
  allThreads,
  error,
  health,
  query,
  result,
  selectedThreadId,
  status,
  t,
  onAlternateSearch,
  onQueryChange,
  onSelectHit,
  onSubmit
}: {
  allThreads: Thread[];
  error?: string;
  health?: MemoryIndexHealth;
  query: string;
  result?: MemoryRecallResult;
  selectedThreadId?: string;
  status: MemorySearchStatus;
  t: Translation;
  onAlternateSearch: () => void;
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
      {result?.interpretation.correctionApplied ? (
        <div className="memory-search-interpretation">
          <span>
            {t("Searching for {{query}}", {
              query: result.interpretation.effectiveQuery
            })}
          </span>
          <span>
            {t("Search instead for")}{" "}
            <a
              className="memory-search-alternate-link"
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onAlternateSearch();
              }}
            >
              {result.interpretation.originalQuery}
            </a>
          </span>
        </div>
      ) : null}
      {!result?.interpretation.correctionApplied &&
      result?.interpretation.suggestedQuery ? (
        <div className="memory-search-interpretation">
          <span>
            {t("Did you mean {{query}}?", {
              query: result.interpretation.suggestedQuery
            })}
          </span>
          <span>
            {t("Search for")}{" "}
            <a
              className="memory-search-alternate-link"
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onAlternateSearch();
              }}
            >
              {result.interpretation.suggestedQuery}
            </a>
          </span>
        </div>
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
  const { primary, lessLikely } = splitMemorySearchBands(result.results);
  return (
    <div className="memory-search-results">
      {primary.map((hit) => (
        <MemorySearchResultCard
          allThreads={allThreads}
          hit={hit}
          key={hitKey(hit)}
          selected={isMemorySearchHitSelected(hit, selectedThreadId)}
          t={t}
          onSelectHit={onSelectHit}
        />
      ))}
      {lessLikely.length ? (
        <details className="memory-search-less-likely">
          <summary>{t("Show less likely results")}</summary>
          {lessLikely.map((hit) => (
            <MemorySearchResultCard
              allThreads={allThreads}
              hit={hit}
              key={hitKey(hit)}
              selected={isMemorySearchHitSelected(hit, selectedThreadId)}
              t={t}
              onSelectHit={onSelectHit}
            />
          ))}
        </details>
      ) : null}
    </div>
  );
}

function MemorySearchResultCard({
  allThreads,
  hit,
  selected,
  t,
  onSelectHit
}: {
  allThreads: Thread[];
  hit: MemoryRecallHit;
  selected: boolean;
  t: Translation;
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
      icon={memorySearchIcon(hit, thread)}
      onClick={() => onSelectHit(hit)}
      title={title}
      tooltip={memorySearchTooltip(hit, title)}
    >
      <span className="memory-search-band">{t(BAND_LABEL_KEYS[hit.band])}</span>
      {hit.matchedText.trim() ? (
        <span className="memory-search-match">{hit.matchedText}</span>
      ) : null}
    </NavItem>
  );
}

/** Translation keys of the band labels. Labels state relative confidence, never a percentage. */
const BAND_LABEL_KEYS: Readonly<Record<MemoryBand, string>> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence"
};

function searchResultSlug(hit: MemoryRecallHit): string {
  return hit.reference.replace(/^marc:\/\/\$/, "");
}

/** The list key: the group id when the hit has one, otherwise its reference (rules and document hits). */
function hitKey(hit: MemoryRecallHit): string {
  return hit.groupId ?? hit.reference;
}

/** A thread that is loaded gets the archive mark; a group without a thread is a document, not an error. */
function memorySearchIcon(hit: MemoryRecallHit, thread?: Thread) {
  if (thread) return <Archive size={16} />;
  if (!hit.threadId) return <FileText size={16} />;
  return <CircleAlert size={16} />;
}
