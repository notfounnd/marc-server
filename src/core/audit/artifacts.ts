import type { WorkspaceAuditFinding } from "../types.js";
import {
  finding,
  messageLocation,
  messageMatchesOptions,
  threadArtifactLocation,
  type AuditContext
} from "./support.js";

export async function auditArtifacts(
  context: AuditContext
): Promise<WorkspaceAuditFinding[]> {
  const findings: WorkspaceAuditFinding[] = [];

  for (const thread of context.threads) {
    const linkedArtifacts = new Set(
      thread.messages.flatMap((message) => message.artifacts)
    );

    for (const message of thread.messages.filter((item) =>
      messageMatchesOptions(item, context)
    )) {
      for (const artifact of message.artifacts) {
        if (thread.artifactFiles.has(artifact)) continue;
        findings.push(
          finding({
            severity: "critical",
            scope: "artifacts",
            code: "artifact_link_missing_file",
            location: messageLocation(thread.id, message.id),
            message: `Message links missing artifact \`${artifact}\`.`,
            suggestion:
              "Create the artifact before posting or remove the stale artifact metadata."
          })
        );
      }

      const bodyArtifacts = [
        ...message.body.matchAll(/\bartifacts\/[A-Za-z0-9._-]+\.md\b/g)
      ].map((match) => match[0]);
      for (const artifact of bodyArtifacts) {
        if (message.artifacts.includes(artifact)) continue;
        findings.push(
          finding({
            severity: "warning",
            scope: "artifacts",
            code: "artifact_reference_not_attached",
            location: messageLocation(thread.id, message.id),
            message: `Message body references \`${artifact}\` without artifact metadata.`,
            suggestion:
              "Attach the artifact through `message_post.artifacts` or remove the textual reference."
          })
        );
      }
    }

    for (const artifact of thread.artifactFiles) {
      if (linkedArtifacts.has(artifact)) continue;
      findings.push(
        finding({
          severity: "warning",
          scope: "artifacts",
          code: "artifact_file_orphaned",
          location: threadArtifactLocation(thread.id, artifact),
          message: `Artifact \`${artifact}\` is stored on disk but no message links it.`,
          suggestion:
            "Attach it to the relevant message or remove the orphan file after review."
        })
      );
    }
  }

  return findings;
}
