import { Archive, Bot, MessageSquareText, UserRound } from "lucide-react";
import {
  EmptyState,
  NavItem,
  isClosedThread,
  parseAgentProfile
} from "./common.js";
import type { Agent, MiddleMode, Thread } from "./types.js";

type Translation = (key: string, options?: Record<string, unknown>) => string;

export function threadList({
  mode,
  selectedThreadId,
  visibleThreads,
  t,
  onSelectThread
}: {
  mode: MiddleMode;
  selectedThreadId?: string;
  visibleThreads: Thread[];
  t: Translation;
  onSelectThread: (thread: Thread) => void;
}) {
  const empty = threadEmpty(mode, t);
  if (!visibleThreads.length) {
    return <EmptyState title={empty.title} detail={empty.detail} />;
  }
  return visibleThreads.map((thread) => (
    <NavItem
      key={thread.id}
      icon={
        isClosedThread(thread) ? (
          <Archive size={16} />
        ) : (
          <MessageSquareText size={16} />
        )
      }
      title={thread.title}
      detail={threadDetail(thread, t)}
      active={thread.id === selectedThreadId}
      closed={isClosedThread(thread)}
      onClick={() => onSelectThread(thread)}
    />
  ));
}

export function marckersList({
  agents,
  selectedAgentId,
  uiAgentId,
  t,
  onSelectAgent
}: {
  agents: Agent[];
  selectedAgentId?: string;
  uiAgentId: string;
  t: Translation;
  onSelectAgent: (agent: Agent) => void;
}) {
  if (!agents.length) {
    return (
      <EmptyState
        title={t("No marckers")}
        detail={t("Register a user or agent before posting.")}
      />
    );
  }
  return agents.map((agent) => {
    const profile = parseAgentProfile(agent.markdown);
    const isUiUser =
      agent.id === uiAgentId || profile.role?.toLowerCase() === "user";
    return (
      <NavItem
        key={agent.id}
        icon={isUiUser ? <UserRound size={16} /> : <Bot size={16} />}
        title={profile.title}
        detail={profile.role}
        tag={profile.model}
        active={agent.id === selectedAgentId}
        onClick={() => onSelectAgent(agent)}
      />
    );
  });
}

function threadEmpty(mode: MiddleMode, t: Translation) {
  if (mode === "archive") {
    return {
      detail: t("Threads with SUMMARY.md will appear here."),
      title: t("No closed threads")
    };
  }
  return {
    detail: t("Create a thread from an agent to start the room."),
    title: t("No threads")
  };
}

function threadDetail(thread: Thread, t: Translation): string {
  if (!isClosedThread(thread)) return thread.id;
  if (!thread.closedAt) return thread.id;
  return t("Closed {{date}}", {
    date: new Date(thread.closedAt).toLocaleString()
  });
}
