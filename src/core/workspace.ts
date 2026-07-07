import fs from "node:fs/promises";
import path from "node:path";
import { workspaceId } from "./ids.js";
import {
  listAgentProfilesInWorkspace,
  readAgentProfileInWorkspace,
  registerAgentInWorkspace
} from "./agents.js";
import {
  attachArtifactInWorkspace,
  attachArtifactToMessageInWorkspace,
  readMessageArtifactInWorkspace
} from "./artifacts.js";
import { marcDir, resolveWorkspace, safeJoin } from "./paths.js";
import {
  applyWorkspaceRecommendations,
  BOOTSTRAP_INSTRUCTIONS,
  buildRulesContent
} from "./recommendations.js";
import {
  listThreadsCachedInWorkspace,
  readWorkspaceStatusInWorkspace,
  rebuildThreadIndexInWorkspace
} from "./workspace-status.js";
import {
  LocalEmbeddingProvider,
  prepareMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace
} from "./memory/index.js";
import {
  appendMessageInWorkspace,
  createThreadInWorkspace,
  listThreadsInWorkspace,
  readThreadInWorkspace,
  readThreadInfoInWorkspace,
  readThreadSinceInWorkspace,
  readThreadTailInWorkspace
} from "./threads.js";
import {
  withWorkspaceWriteLock,
  writeFileAtomically
} from "./write-coordination.js";
import type {
  AgentListOptions,
  AgentProfile,
  AgentProfileSummary,
  AgentRegistrationResult,
  ChatMessage,
  MessageInput,
  ThreadInfo,
  ThreadInfoResult,
  ThreadListOptions,
  ThreadReadOptions,
  ThreadReadResult,
  ThreadReadSinceResult,
  ThreadTailOptions,
  ThreadTailResult,
  WorkspaceInfo,
  WorkspaceRecommendationsUpdate,
  WorkspaceStatus
} from "./types.js";
import type { MemoryRecallResult, MemoryStatus } from "./memory/index.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getWorkspaceInfo(
  workspaceRootInput?: string
): Promise<WorkspaceInfo> {
  const rootPath = resolveWorkspace(workspaceRootInput);
  const name = path.basename(rootPath);
  return {
    id: workspaceId(rootPath, name),
    name,
    rootPath,
    marcPath: marcDir(rootPath)
  };
}

export async function initWorkspace(
  workspaceRootInput?: string
): Promise<WorkspaceInfo> {
  const info = await getWorkspaceInfo(workspaceRootInput);
  const dirs = [
    info.marcPath,
    safeJoin(info.marcPath, "agents"),
    safeJoin(info.marcPath, "threads"),
    safeJoin(info.marcPath, "cache")
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  const instructionsPath = safeJoin(info.marcPath, "INSTRUCTIONS.md");
  const rulesPath = safeJoin(info.marcPath, "RULES.md");
  const recommendationsExist =
    (await exists(instructionsPath)) && (await exists(rulesPath));
  if (recommendationsExist) return info;

  await withWorkspaceWriteLock(info.marcPath, "recommendations", async () => {
    if (!(await exists(instructionsPath))) {
      await writeFileAtomically(instructionsPath, BOOTSTRAP_INSTRUCTIONS);
    }

    if (!(await exists(rulesPath))) {
      await writeFileAtomically(rulesPath, buildRulesContent());
    }
  });

  return info;
}

export async function updateWorkspaceRecommendations(
  workspaceRoot: string
): Promise<WorkspaceRecommendationsUpdate> {
  const info = await initWorkspace(workspaceRoot);
  return applyWorkspaceRecommendations(info);
}

export async function registerAgent(
  workspaceRoot: string,
  profile: AgentProfile
): Promise<AgentRegistrationResult> {
  const info = await initWorkspace(workspaceRoot);
  return registerAgentInWorkspace(info, profile);
}

export async function createThread(
  workspaceRoot: string,
  title: string
): Promise<ThreadInfo> {
  const info = await initWorkspace(workspaceRoot);
  return createThreadInWorkspace(info, title);
}

export async function listThreads(
  workspaceRoot: string,
  options: ThreadListOptions = {}
): Promise<ThreadInfo[]> {
  const info = await initWorkspace(workspaceRoot);
  return listThreadsInWorkspace(info, options);
}

export async function listThreadsCached(
  workspaceRoot: string,
  options: ThreadListOptions = {}
): Promise<ThreadInfo[]> {
  const info = await initWorkspace(workspaceRoot);
  return listThreadsCachedInWorkspace(info, options);
}

export async function rebuildThreadIndexInBackground(
  workspaceRoot: string
): Promise<void> {
  const info = await initWorkspace(workspaceRoot);
  await rebuildThreadIndexInWorkspace(info);
}

export async function readWorkspaceStatus(
  workspaceRoot: string
): Promise<WorkspaceStatus> {
  const info = await initWorkspace(workspaceRoot);
  return readWorkspaceStatusInWorkspace(info);
}

export async function prepareMemory(workspaceRoot: string): Promise<{
  prepared: true;
  provider: ReturnType<LocalEmbeddingProvider["describe"]>;
}> {
  const info = await initWorkspace(workspaceRoot);
  return prepareMemoryInWorkspace(new LocalEmbeddingProvider(info));
}

export async function readMemoryStatus(
  workspaceRoot: string
): Promise<MemoryStatus> {
  const info = await initWorkspace(workspaceRoot);
  return readMemoryStatusInWorkspace(info, {
    provider: new LocalEmbeddingProvider(info)
  });
}

export async function rebuildMemory(
  workspaceRoot: string
): Promise<MemoryStatus> {
  const info = await initWorkspace(workspaceRoot);
  const provider = new LocalEmbeddingProvider(info);
  const status = await readMemoryStatusInWorkspace(info, { provider });
  if (status.status === "model_missing") return status;
  await rebuildMemoryInWorkspace(info, { provider });
  return readMemoryStatusInWorkspace(info, { provider });
}

export async function recallMemory(
  workspaceRoot: string,
  input: { query: string; limit?: number; minScore?: number }
): Promise<MemoryRecallResult> {
  const info = await initWorkspace(workspaceRoot);
  return recallMemoryInWorkspace(info, {
    provider: new LocalEmbeddingProvider(info),
    query: input.query,
    limit: input.limit,
    minScore: input.minScore
  });
}

export async function appendMessage(
  workspaceRoot: string,
  threadId: string,
  input: MessageInput
): Promise<ChatMessage> {
  const info = await initWorkspace(workspaceRoot);
  return appendMessageInWorkspace(info, threadId, input);
}

export async function readThread(
  workspaceRoot: string,
  threadId: string,
  options: ThreadReadOptions = {}
): Promise<ThreadReadResult> {
  const info = await initWorkspace(workspaceRoot);
  return readThreadInWorkspace(info, threadId, options);
}

export async function readThreadSince(
  workspaceRoot: string,
  threadId: string,
  afterMessageId: string
): Promise<ThreadReadSinceResult> {
  const info = await initWorkspace(workspaceRoot);
  return readThreadSinceInWorkspace(info, threadId, afterMessageId);
}

export async function readThreadInfo(
  workspaceRoot: string,
  threadId: string
): Promise<ThreadInfoResult> {
  const info = await initWorkspace(workspaceRoot);
  return readThreadInfoInWorkspace(info, threadId);
}

export async function readThreadTail(
  workspaceRoot: string,
  threadId: string,
  options: ThreadTailOptions = {}
): Promise<ThreadTailResult> {
  const info = await initWorkspace(workspaceRoot);
  return readThreadTailInWorkspace(info, threadId, options);
}

export async function readRules(workspaceRoot: string): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  return fs.readFile(safeJoin(info.marcPath, "RULES.md"), "utf8");
}

export async function listAgentProfiles(
  workspaceRoot: string,
  options: AgentListOptions = {}
): Promise<AgentProfileSummary[]> {
  const info = await initWorkspace(workspaceRoot);
  return listAgentProfilesInWorkspace(info, options);
}

export async function readAgentProfile(
  workspaceRoot: string,
  agentId: string
): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  return readAgentProfileInWorkspace(info, agentId);
}

export async function attachArtifact(
  workspaceRoot: string,
  threadId: string,
  fileName: string,
  content: string
): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  return attachArtifactInWorkspace(info, threadId, fileName, content);
}

export async function attachArtifactToMessage(
  workspaceRoot: string,
  threadId: string,
  messageId: string,
  fileName: string,
  content: string
): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  return attachArtifactToMessageInWorkspace(
    info,
    threadId,
    messageId,
    fileName,
    content
  );
}

export async function readMessageArtifact(
  workspaceRoot: string,
  threadId: string,
  messageId: string,
  artifactFile: string
): Promise<{ artifact: string; content: string }> {
  const info = await initWorkspace(workspaceRoot);
  const thread = await readThread(workspaceRoot, threadId);
  return readMessageArtifactInWorkspace(
    info,
    threadId,
    messageId,
    artifactFile,
    thread.messages ?? []
  );
}
