import { useTranslation } from "react-i18next";
import {
  Archive,
  CircleAlert,
  Clock3,
  Copy,
  FileText,
  RefreshCw
} from "lucide-react";
import {
  Badge,
  classNames,
  isClosedThread,
  parseAgentProfile
} from "./common.js";
import { ContentHeaderActions } from "./content-header-actions.js";
import type {
  Agent,
  ArtifactMenuItem,
  MarkdownLinkHandler,
  StatusKind,
  Thread,
  ThreadIndexHealth,
  Workspace
} from "./types.js";

type HeaderIdentity = {
  closed?: boolean;
  kind: string;
  secondaryCopyTitle?: string;
  secondaryCopyValue?: string;
  secondaryLabel: string;
  title: string;
};

export function ContentHeader({
  statusKind,
  lastSyncedAt,
  selectedAgent,
  selectedThread,
  selectedThreadArtifacts,
  selectedThreadIndexHealth,
  selectedWorkspace,
  showArtifactMenu,
  showWorkspaceSettings,
  onCopyReference,
  onOpenLink,
  onShowArtifactMenuChange,
  onShowWorkspaceSettingsChange
}: {
  statusKind: StatusKind;
  lastSyncedAt?: Date;
  selectedAgent?: Agent;
  selectedThread?: Thread;
  selectedThreadArtifacts: ArtifactMenuItem[];
  selectedThreadIndexHealth?: ThreadIndexHealth;
  selectedWorkspace?: Workspace;
  showArtifactMenu: boolean;
  showWorkspaceSettings: boolean;
  onCopyReference: (reference: string) => void | Promise<void>;
  onOpenLink: MarkdownLinkHandler;
  onShowArtifactMenuChange: (show: boolean) => void;
  onShowWorkspaceSettingsChange: (show: boolean) => void;
}) {
  const { t } = useTranslation();
  const agentTitle = selectedAgent
    ? parseAgentProfile(selectedAgent.markdown).title
    : undefined;
  const identities = [
    selectedThread
      ? {
          closed: isClosedThread(selectedThread),
          kind: t("Thread"),
          secondaryCopyTitle: t("Copy thread reference"),
          secondaryCopyValue: `marc://$${selectedThread.id}`,
          secondaryLabel: selectedThread.id,
          title: selectedThread.title
        }
      : undefined,
    selectedAgent
      ? {
          kind: t("Agent"),
          secondaryCopyTitle: t("Copy agent reference"),
          secondaryCopyValue: `marc://@${selectedAgent.id}`,
          secondaryLabel: selectedAgent.id,
          title: agentTitle ?? selectedAgent.id
        }
      : undefined,
    selectedWorkspace
      ? {
          kind: t("Workspace"),
          secondaryCopyTitle: t("Copy workspace path"),
          secondaryCopyValue: selectedWorkspace.rootPath,
          secondaryLabel: selectedWorkspace.rootPath,
          title: selectedWorkspace.name
        }
      : undefined
  ].filter((identity): identity is HeaderIdentity => Boolean(identity));
  const identity = identities[0] ?? {
    kind: t("Workspace"),
    secondaryLabel: t("Lock the token to start syncing."),
    title: "mARC"
  };

  return (
    <header className="content-header">
      <div className="content-title-block">
        <div className="eyebrow">
          <FileText size={14} />
          {identity.kind}
        </div>
        <h2 className={classNames(identity.closed && "content-title-closed")}>
          {identity.title}
        </h2>
        <p className="thread-reference-row">
          <HeaderSecondaryReference
            identity={identity}
            onCopyReference={onCopyReference}
          />
        </p>
      </div>
      <div className="content-side">
        <ContentBadges
          lastSyncedAt={lastSyncedAt}
          selectedThread={selectedThread}
          selectedThreadIndexHealth={selectedThreadIndexHealth}
          statusKind={statusKind}
        />
        <ContentHeaderActions
          selectedAgent={selectedAgent}
          selectedThread={selectedThread}
          selectedThreadArtifacts={selectedThreadArtifacts}
          selectedWorkspace={selectedWorkspace}
          showArtifactMenu={showArtifactMenu}
          showWorkspaceSettings={showWorkspaceSettings}
          onOpenLink={onOpenLink}
          onShowArtifactMenuChange={onShowArtifactMenuChange}
          onShowWorkspaceSettingsChange={onShowWorkspaceSettingsChange}
        />
      </div>
    </header>
  );
}

function HeaderSecondaryReference({
  identity,
  onCopyReference
}: {
  identity: HeaderIdentity;
  onCopyReference: (reference: string) => void | Promise<void>;
}) {
  if (!identity.secondaryCopyValue)
    return <span>{identity.secondaryLabel}</span>;

  return (
    <button
      className="copy-reference-button"
      onClick={() => void onCopyReference(identity.secondaryCopyValue)}
      title={identity.secondaryCopyTitle}
    >
      <span>{identity.secondaryLabel}</span>
      <Copy size={13} />
    </button>
  );
}

function ContentBadges({
  lastSyncedAt,
  selectedThread,
  selectedThreadIndexHealth,
  statusKind
}: {
  lastSyncedAt?: Date;
  selectedThread?: Thread;
  selectedThreadIndexHealth?: ThreadIndexHealth;
  statusKind: StatusKind;
}) {
  const { t } = useTranslation();

  return (
    <div className="content-badges">
      <Badge
        tone={
          statusKind === "ok"
            ? "green"
            : statusKind === "error" || statusKind === "warn"
              ? "amber"
              : "neutral"
        }
      >
        <Clock3 size={13} />
        {lastSyncedAt
          ? t("Synced {{time}}", {
              time: lastSyncedAt.toLocaleTimeString()
            })
          : t("Not synced")}
      </Badge>
      {selectedThread && isClosedThread(selectedThread) ? (
        <Badge tone="amber">
          <Archive size={13} />
          {t("Closed")}
        </Badge>
      ) : null}
      {selectedThreadIndexHealth?.rebuilding ? (
        <Badge tone="amber">
          <RefreshCw size={13} className="spin" />
          {t("Index rebuilding")}
        </Badge>
      ) : selectedThreadIndexHealth?.status === "degraded" ||
        selectedThreadIndexHealth?.status === "unavailable" ? (
        <Badge tone="amber">
          <CircleAlert size={13} />
          {t("Index degraded")}
        </Badge>
      ) : null}
    </div>
  );
}
