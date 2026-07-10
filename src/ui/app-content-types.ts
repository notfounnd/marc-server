import type {
  Agent,
  ArtifactMenuItem,
  MarkdownLinkHandler,
  Message,
  StatusKind,
  Thread,
  ThreadIndexHealth,
  ThreadPayload,
  Workspace
} from "./types.js";

export type AppContentProps = {
  statusKind: StatusKind;
  lastSyncedAt?: Date;
  selectedThreadIndexHealth?: ThreadIndexHealth;
  selectedThread?: Thread;
  selectedAgent?: Agent;
  selectedWorkspace?: Workspace;
  selectedThreadArtifacts: ArtifactMenuItem[];
  showArtifactMenu: boolean;
  showWorkspaceSettings: boolean;
  threadPayload?: ThreadPayload;
  uiAgentId: string;
  composerBody: string;
  agents: Agent[];
  allWorkspaceThreads: Thread[];
  sending: boolean;
  rules: string;
  onShowArtifactMenuChange: (show: boolean) => void;
  onShowWorkspaceSettingsChange: (show: boolean) => void;
  onCopyReference: (reference: string) => void | Promise<void>;
  onOpenLink: MarkdownLinkHandler;
  onAttachArtifact: (message: Message) => void;
  onAgentIdChange: (agentId: string) => void;
  onBodyChange: (body: string) => void;
  onSendMessage: () => void;
  onLoadThreadMessages: (threadId: string) => Promise<Message[]>;
  onShowShortcuts: () => void;
};
