export type MarcReference =
  | { type: "agent"; agentId: string }
  | { type: "thread"; threadId: string }
  | { type: "message"; threadId?: string; messageId: string }
  | {
      type: "artifact";
      threadId?: string;
      messageId: string;
      artifactFile: string;
    };

const ID_PATTERN = "[A-Za-z0-9._-]+";
const FILE_PATTERN = "[A-Za-z0-9._-]+";

export function parseMarcReference(value: string): MarcReference | undefined {
  const agentMatch = new RegExp(`^marc://@(${ID_PATTERN})$`).exec(value);
  if (agentMatch) {
    return { type: "agent", agentId: decodeURIComponent(agentMatch[1]) };
  }

  const localArtifactMatch = new RegExp(
    `^marc://#(${ID_PATTERN})/!(${FILE_PATTERN})$`
  ).exec(value);
  if (localArtifactMatch) {
    return {
      type: "artifact",
      messageId: decodeURIComponent(localArtifactMatch[1]),
      artifactFile: decodeURIComponent(localArtifactMatch[2])
    };
  }

  const localMessageMatch = new RegExp(`^marc://#(${ID_PATTERN})$`).exec(value);
  if (localMessageMatch) {
    return {
      type: "message",
      messageId: decodeURIComponent(localMessageMatch[1])
    };
  }

  const remoteArtifactMatch = new RegExp(
    `^marc://\\$(${ID_PATTERN})/#(${ID_PATTERN})/!(${FILE_PATTERN})$`
  ).exec(value);
  if (remoteArtifactMatch) {
    return {
      type: "artifact",
      threadId: decodeURIComponent(remoteArtifactMatch[1]),
      messageId: decodeURIComponent(remoteArtifactMatch[2]),
      artifactFile: decodeURIComponent(remoteArtifactMatch[3])
    };
  }

  const remoteMessageMatch = new RegExp(
    `^marc://\\$(${ID_PATTERN})/#(${ID_PATTERN})$`
  ).exec(value);
  if (remoteMessageMatch) {
    return {
      type: "message",
      threadId: decodeURIComponent(remoteMessageMatch[1]),
      messageId: decodeURIComponent(remoteMessageMatch[2])
    };
  }

  const threadMatch = new RegExp(`^marc://\\$(${ID_PATTERN})$`).exec(value);
  if (threadMatch) {
    return { type: "thread", threadId: decodeURIComponent(threadMatch[1]) };
  }

  return undefined;
}

export function messageArtifactReference(
  messageId: string,
  artifact: string,
  threadId?: string
): string {
  const artifactFile = artifact.replace(/^artifacts\//, "");
  return threadId
    ? `marc://$${threadId}/#${messageId}/!${artifactFile}`
    : `marc://#${messageId}/!${artifactFile}`;
}
