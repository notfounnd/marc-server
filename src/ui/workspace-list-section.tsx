import { Server } from "lucide-react";
import { EmptyState, NavItem } from "./common.js";
import { workspaceMemoryIndicator } from "./workspace-memory-indicator.js";
import type { MemoryIndexHealth, Workspace } from "./types.js";

export function WorkspaceListSection({
  memoryHealthByWorkspace,
  onSelectWorkspace,
  selectedWorkspaceId,
  t,
  workspaces
}: {
  memoryHealthByWorkspace: Record<string, MemoryIndexHealth>;
  onSelectWorkspace: (workspace: Workspace) => void;
  selectedWorkspaceId?: string;
  t: (key: string) => string;
  workspaces: Workspace[];
}) {
  return (
    <section className="section">
      <div className="section-title">
        <Server size={16} />
        <h2>{t("Workspaces")}</h2>
      </div>
      <div className="stack">
        {workspaces.length ? (
          workspaces.map((workspace) => (
            <NavItem
              key={workspace.id}
              icon={<Server size={16} />}
              title={workspace.name}
              detail={workspace.rootPath}
              trailing={workspaceMemoryIndicator(
                memoryHealthByWorkspace[workspace.id],
                t
              )}
              active={workspace.id === selectedWorkspaceId}
              onClick={() => onSelectWorkspace(workspace)}
            />
          ))
        ) : (
          <EmptyState
            title={t("No workspaces")}
            detail={t("Ask an agent to register a project in mARC.")}
          />
        )}
      </div>
    </section>
  );
}
