import {
  Archive,
  AtSign,
  MessageSquareText,
  RefreshCw,
  Search,
  X
} from "lucide-react";
import { Button } from "./common.js";
import { marckersList, threadList } from "./app-sidebar-lists.js";
import { isMemorySearchAvailable } from "./memory-search.js";
import { MemorySearchPanel } from "./memory-search-panel.js";
import type {
  Agent,
  MemoryIndexHealth,
  MemoryRecallHit,
  MemoryRecallResult,
  MemorySearchStatus,
  MiddleMode,
  Thread
} from "./types.js";

export function AppSidebarMiddle({
  agents,
  allWorkspaceThreads,
  memorySearchError,
  memorySearchDeepRetryAvailable,
  memorySearchQuery,
  memorySearchResult,
  memorySearchStatus,
  middleMode,
  selectedAgentId,
  selectedMemoryHealth,
  selectedThreadId,
  t,
  uiAgentId,
  visibleThreads,
  onMemorySearchQueryChange,
  onMemorySearchDeepRetry,
  onMemorySearchSubmit,
  onMiddleModeChange,
  onSelectAgent,
  onSelectMemorySearchHit,
  onSelectThread
}: {
  agents: Agent[];
  allWorkspaceThreads: Thread[];
  memorySearchError?: string;
  memorySearchDeepRetryAvailable: boolean;
  memorySearchQuery: string;
  memorySearchResult?: MemoryRecallResult;
  memorySearchStatus: MemorySearchStatus;
  middleMode: MiddleMode;
  selectedAgentId?: string;
  selectedMemoryHealth?: MemoryIndexHealth;
  selectedThreadId?: string;
  t: Translation;
  uiAgentId: string;
  visibleThreads: Thread[];
  onMemorySearchQueryChange: (query: string) => void;
  onMemorySearchDeepRetry: () => void;
  onMemorySearchSubmit: () => void;
  onMiddleModeChange: (mode: MiddleMode) => void;
  onSelectAgent: (agent: Agent) => void;
  onSelectMemorySearchHit: (hit: MemoryRecallHit) => void;
  onSelectThread: (thread: Thread) => void;
}) {
  const memorySearchAvailable = isMemorySearchAvailable(selectedMemoryHealth);
  const memorySearchTitle = memorySearchAvailable
    ? t("Search memory")
    : (selectedMemoryHealth?.message ?? t("Memory search unavailable"));
  const middleHeader = middleHeaders({
    memorySearchStatus,
    mode: middleMode,
    t
  });
  const middleActions = middleModeActions({
    memorySearchAvailable,
    memorySearchTitle,
    t,
    onMiddleModeChange
  });
  const content = middleContent({
    agents,
    allWorkspaceThreads,
    memorySearchError,
    memorySearchDeepRetryAvailable,
    memorySearchQuery,
    memorySearchResult,
    memorySearchStatus,
    mode: middleMode,
    selectedAgentId,
    selectedMemoryHealth,
    selectedThreadId,
    uiAgentId,
    visibleThreads,
    t,
    onMemorySearchQueryChange,
    onMemorySearchDeepRetry,
    onMemorySearchSubmit,
    onSelectAgent,
    onSelectMemorySearchHit,
    onSelectThread
  });

  return (
    <nav className="middle">
      <section>
        <div className="section-title section-title-split">
          <span className="section-title-main">
            {middleHeader.icon}
            <h2>{middleHeader.title}</h2>
          </span>
          <div className="middle-mode-actions">{middleActions[middleMode]}</div>
        </div>
        <div className="stack">{content}</div>
      </section>
    </nav>
  );
}

type Translation = (key: string, options?: Record<string, unknown>) => string;

function middleHeaders({
  memorySearchStatus,
  mode,
  t
}: {
  memorySearchStatus: MemorySearchStatus;
  mode: MiddleMode;
  t: Translation;
}) {
  const headers = {
    archive: { icon: <Archive size={16} />, title: t("Closed") },
    marckers: { icon: <AtSign size={16} />, title: t("Marckers") },
    search: {
      icon:
        memorySearchStatus === "searching" ? (
          <RefreshCw size={16} className="spin" />
        ) : (
          <Search size={16} />
        ),
      title: t("Search")
    },
    threads: { icon: <MessageSquareText size={16} />, title: t("Threads") }
  };
  return headers[mode];
}

function middleModeActions({
  memorySearchAvailable,
  memorySearchTitle,
  t,
  onMiddleModeChange
}: {
  memorySearchAvailable: boolean;
  memorySearchTitle: string;
  t: Translation;
  onMiddleModeChange: (mode: MiddleMode) => void;
}) {
  const modeCloseButton = (
    <Button
      variant="primary"
      className="button-icon"
      onClick={() => onMiddleModeChange("threads")}
      title={t("Close")}
    >
      <X size={15} />
    </Button>
  );
  return {
    archive: modeCloseButton,
    marckers: modeCloseButton,
    search: modeCloseButton,
    threads: (
      <>
        <Button
          variant="primary"
          className="button-icon"
          disabled={!memorySearchAvailable}
          onClick={() => onMiddleModeChange("search")}
          title={memorySearchTitle}
        >
          <Search size={15} />
        </Button>
        <Button
          variant="primary"
          className="button-icon"
          onClick={() => onMiddleModeChange("marckers")}
          title={t("Show Marckers")}
        >
          <AtSign size={15} />
        </Button>
        <Button
          variant="primary"
          className="button-icon"
          onClick={() => onMiddleModeChange("archive")}
          title={t("Show closed threads")}
        >
          <Archive size={15} />
        </Button>
      </>
    )
  };
}

function middleContent(props: {
  agents: Agent[];
  allWorkspaceThreads: Thread[];
  memorySearchError?: string;
  memorySearchDeepRetryAvailable: boolean;
  memorySearchQuery: string;
  memorySearchResult?: MemoryRecallResult;
  memorySearchStatus: MemorySearchStatus;
  mode: MiddleMode;
  selectedAgentId?: string;
  selectedMemoryHealth?: MemoryIndexHealth;
  selectedThreadId?: string;
  uiAgentId: string;
  visibleThreads: Thread[];
  t: Translation;
  onMemorySearchQueryChange: (query: string) => void;
  onMemorySearchDeepRetry: () => void;
  onMemorySearchSubmit: () => void;
  onSelectAgent: (agent: Agent) => void;
  onSelectMemorySearchHit: (hit: MemoryRecallHit) => void;
  onSelectThread: (thread: Thread) => void;
}) {
  const content = {
    archive: threadList(props),
    marckers: marckersList(props),
    search: (
      <MemorySearchPanel
        allThreads={props.allWorkspaceThreads}
        deepRetryAvailable={props.memorySearchDeepRetryAvailable}
        error={props.memorySearchError}
        health={props.selectedMemoryHealth}
        query={props.memorySearchQuery}
        result={props.memorySearchResult}
        selectedThreadId={props.selectedThreadId}
        status={props.memorySearchStatus}
        t={props.t}
        onDeepRetry={props.onMemorySearchDeepRetry}
        onQueryChange={props.onMemorySearchQueryChange}
        onSelectHit={props.onSelectMemorySearchHit}
        onSubmit={props.onMemorySearchSubmit}
      />
    ),
    threads: threadList(props)
  };
  return content[props.mode];
}
