import fs from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  appendMessage,
  attachArtifact,
  createThread,
  getWorkspaceInfo,
  initWorkspace,
  listAgentProfiles,
  listThreads,
  readAgentProfile,
  readRules,
  readThread,
  readThreadInfo,
  readThreadSince,
  readThreadTail,
  registerAgent,
  updateWorkspaceRecommendations,
} from "../core/workspace.js";
import { safeJoin } from "../core/paths.js";
import type { WorkspaceInfo } from "../core/types.js";

type McpOptions = {
  workspace?: string;
  daemonUrl?: string;
  token?: string;
};

function text(content: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
      },
    ],
  };
}

const BOOTSTRAP_REMINDER =
  "If bootstrap context was lost, rerun workspace_bootstrap before relying on bootstrapConfirmed.";

function bootstrapRequired() {
  return text({
    error: {
      code: "bootstrap_required",
      message: "Call workspace_bootstrap first, then retry this tool with bootstrapConfirmed: true.",
      nextTool: "workspace_bootstrap",
      retryWith: { bootstrapConfirmed: true },
    },
  });
}

function gatedShape<T extends z.ZodRawShape>(shape: T): T & { bootstrapConfirmed: z.ZodOptional<z.ZodBoolean> } {
  return {
    ...shape,
    bootstrapConfirmed: z
      .boolean()
      .optional()
      .describe("Set to true only after workspace_bootstrap returned successfully in this session/workspace."),
  };
}

async function withBootstrap<T>(
  input: { bootstrapConfirmed?: boolean },
  handler: () => Promise<T>,
): Promise<ReturnType<typeof text>> {
  if (input.bootstrapConfirmed !== true) {
    return bootstrapRequired();
  }

  return text({
    bootstrap: {
      confirmed: true,
      reminder: BOOTSTRAP_REMINDER,
    },
    result: await handler(),
  });
}

const MARC_HELPER_TOPICS = [
  "overview",
  "workspace",
  "agents",
  "threads",
  "messages",
  "artifacts",
  "incremental_reading",
  "ui_daemon",
  "all",
] as const;

type MarcHelperTopic = (typeof MARC_HELPER_TOPICS)[number];
type MarcHelperGuide = {
  purpose: string;
  whenToUse: string[];
  relatedTools: string[];
  examples: string[];
  notes: string[];
};

const MARC_HELPER_GUIDES: Record<Exclude<MarcHelperTopic, "all">, MarcHelperGuide> = {
  overview: {
    purpose: "Understand the mARC workflow and choose the right tool for the next action.",
    whenToUse: [
      "At the start of a session using mARC.",
      "When deciding between reading, posting, attaching artifacts, or updating recommendations.",
    ],
    relatedTools: [
      "workspace_info",
      "workspace_register",
      "agent_register",
      "thread_list",
      "thread_read",
      "thread_read_since",
      "message_post",
      "message_attach_artifact",
      "workspace_bootstrap",
    ],
    examples: [
      "Call workspace_info to confirm which project this MCP server is bound to.",
      "Call workspace_bootstrap before using gated mARC tools in a session/workspace.",
      "Call thread_list before choosing a thread to continue.",
      "Call marc_helper with topic incremental_reading before reading a long active thread.",
    ],
    notes: [
      "Use mARC as shared project memory, not as a replacement for source files.",
      "Keep messages readable and complete. Put long logs, plans, and reports in artifacts.",
    ],
  },
  workspace: {
    purpose:
      "Initialize, inspect, and maintain the mARC workspace files: INSTRUCTIONS.md defines the stable bootstrap protocol, and RULES.md defines the workspace behavior contract.",
    whenToUse: [
      "Before the first mARC interaction in a project.",
      "When tool recommendations or workspace rules may be outdated.",
    ],
    relatedTools: [
      "workspace_register",
      "workspace_bootstrap",
      "workspace_info",
      "workspace_read_rules",
      "workspace_update_recommendations",
      "workspace_unregister",
    ],
    examples: [
      "workspace_register creates .marc files and registers the workspace with the daemon when configured.",
      "workspace_update_recommendations refreshes the recommended bootstrap protocol and workspace rules without overwriting Custom Rules.",
    ],
    notes: [
      "Call workspace_bootstrap before gated tools, then send bootstrapConfirmed: true after a successful bootstrap.",
      "workspace_update_recommendations remains free so recommended instructions and rules can be refreshed manually.",
      "Keep project-specific behavior in RULES.md under Custom Rules; INSTRUCTIONS.md should stay short and procedural.",
      "Markdown remains the source of truth for project-readable mARC content.",
      "After new MCP tools are added, rebuild and restart the MCP client because tool schemas may be cached.",
    ],
  },
  agents: {
    purpose: "Register and inspect participants that post to mARC threads.",
    whenToUse: [
      "Before an agent posts messages.",
      "When a coordinator needs to understand which participant wrote a message.",
    ],
    relatedTools: ["agent_register", "agent_list", "agent_read_profile"],
    examples: [
      "agent_register with id codex-dev, role developer, model gpt-5.5, and a short description.",
      "agent_list before writing a mention such as marc://@codex-dev.",
      "agent_read_profile for a referenced participant before assigning review work.",
    ],
    notes: [
      "Use stable, specific agent IDs such as codex-dev, qa-reviewer, or architect-reviewer.",
      "The orchestrating agent decides how to delegate to subagents; mARC stores the shared context.",
    ],
  },
  threads: {
    purpose: "Create, list, and read task conversations.",
    whenToUse: [
      "When starting a separate task or opportunity.",
      "When resuming work from existing mARC context.",
    ],
    relatedTools: ["thread_create", "thread_list", "thread_read", "thread_info", "thread_tail", "thread_read_since"],
    examples: [
      "thread_create with a clear task title for new work.",
      "thread_list defaults to open threads; pass status closed or all when needed.",
      "thread_info gives cheap metadata before deciding whether to read content.",
    ],
    notes: [
      "Closed threads are controlled by SUMMARY.md in the thread folder.",
      "Prefer a new thread when a conversation becomes too broad or needs a separate outcome.",
    ],
  },
  messages: {
    purpose: "Append structured updates to a thread.",
    whenToUse: [
      "After implementing, reviewing, planning, or finding a blocker.",
      "When the user asks to record a decision or status in mARC.",
    ],
    relatedTools: ["message_post", "agent_register", "thread_read"],
    examples: [
      "message_post with a readable implementation summary, validation commands, and any relevant risks.",
      "message_post after reading a thread to acknowledge the context and next action.",
    ],
    notes: [
      "Messages should preserve useful context instead of being brief but empty.",
      "Use bullets or short labeled sections when a message has multiple points.",
      "Use artifacts for large outputs, detailed reviews, logs, or long plans.",
    ],
  },
  artifacts: {
    purpose: "Store long Markdown content or supporting files under a thread.",
    whenToUse: [
      "When content would make a chat message too large.",
      "When attaching reports, detailed plans, benchmark outputs, or review notes.",
    ],
    relatedTools: ["message_attach_artifact", "message_post"],
    examples: [
      "message_attach_artifact with fileName review.md and Markdown content.",
      "message_post referencing the artifact path returned by message_attach_artifact.",
    ],
    notes: [
      "Keep artifacts attached to the relevant thread.",
      "Post a readable summary in the message so readers know why the artifact matters.",
    ],
  },
  incremental_reading: {
    purpose: "Read active threads efficiently without repeatedly loading the whole transcript.",
    whenToUse: [
      "When returning to a thread already read in the current session.",
      "When the user says a thread has a new message.",
      "When a thread may be long and only recent context is needed.",
    ],
    relatedTools: ["thread_read", "thread_read_since", "thread_info", "thread_tail"],
    examples: [
      "First read: call thread_read and store lastMessageId in your working context.",
      "Later read: call thread_read_since with threadId and afterMessageId set to the stored lastMessageId.",
      "If cursor_not_found returns shouldReadFullThread true, tell the user the incremental read failed and call thread_read.",
      "Use thread_tail with limit 5 or 10 for recent context when no cursor is available.",
    ],
    notes: [
      "thread_read omits markdown by default to avoid duplicating markdown plus parsed messages.",
      "Use includeMarkdown true only when raw CHAT.md content is specifically needed.",
    ],
  },
  ui_daemon: {
    purpose: "Understand how the local UI and daemon relate to MCP actions.",
    whenToUse: [
      "When the UI does not update as expected.",
      "When a workspace is missing from the panel.",
      "When validating local browser behavior.",
    ],
    relatedTools: ["workspace_register", "workspace_unregister", "thread_list", "message_post"],
    examples: [
      "Keep the daemon running so the UI can receive events.",
      "Run workspace_register if a project does not appear in the UI.",
    ],
    notes: [
      "The browser may keep an EventSource connection open for live updates.",
      "MCP clients may need restart after tool schema changes.",
    ],
  },
};

function marcHelper(topic: MarcHelperTopic = "overview") {
  if (topic === "all") {
    return {
      tool: "marc_helper",
      purpose: "Provide operational guidance for using mARC MCP tools efficiently.",
      availableTopics: MARC_HELPER_TOPICS,
      topics: MARC_HELPER_GUIDES,
    };
  }

  return {
    tool: "marc_helper",
    topic,
    availableTopics: MARC_HELPER_TOPICS,
    ...MARC_HELPER_GUIDES[topic],
  };
}

async function notifyDaemon(workspace: WorkspaceInfo, options: McpOptions): Promise<void> {
  const daemonUrl = options.daemonUrl ?? process.env.MARC_DAEMON_URL;
  const token = options.token ?? process.env.MARC_TOKEN;
  if (!daemonUrl || !token) return;

  const response = await fetch(new URL("/api/workspaces", daemonUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(workspace),
  });

  if (!response.ok) {
    throw new Error(`Daemon registration failed: ${response.status} ${await response.text()}`);
  }
}

async function unregisterFromDaemon(workspace: WorkspaceInfo, options: McpOptions): Promise<void> {
  const daemonUrl = options.daemonUrl ?? process.env.MARC_DAEMON_URL;
  const token = options.token ?? process.env.MARC_TOKEN;
  if (!daemonUrl || !token) {
    throw new Error("Cannot unregister workspace without daemonUrl and token.");
  }

  const response = await fetch(new URL(`/api/workspaces/${encodeURIComponent(workspace.id)}`, daemonUrl), {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Daemon unregister failed: ${response.status} ${await response.text()}`);
  }
}

export function buildMcpServer(options: McpOptions = {}): McpServer {
  const workspaceRoot = options.workspace ?? process.cwd();
  const server = new McpServer({
    name: "marc",
    version: "0.1.0",
  });

  server.tool(
    "marc_helper",
    "Explain how to use mARC MCP tools efficiently, with topic-specific guidance and examples.",
    {
      topic: z.enum(MARC_HELPER_TOPICS).optional(),
    },
    async ({ topic }) => text(marcHelper(topic)),
  );

  server.tool(
    "workspace_bootstrap",
    "Bootstrap this mARC workspace for the current session. Call this before any gated mARC tool.",
    {},
    async () => {
      const workspace = await initWorkspace(workspaceRoot);
      const recommendations = await updateWorkspaceRecommendations(workspaceRoot);
      const instructions = await fs.readFile(safeJoin(workspace.marcPath, "INSTRUCTIONS.md"), "utf8");
      const rules = await readRules(workspaceRoot);
      const registered = await listAgentProfiles(workspaceRoot);

      return text({
        bootstrap: {
          confirmed: true,
          nextInput: { bootstrapConfirmed: true },
          reminder: BOOTSTRAP_REMINDER,
        },
        workspace,
        recommendations,
        instructions,
        rules,
        agents: {
          count: registered.length,
          registered,
        },
      });
    },
  );

  server.tool(
    "workspace_register",
    "Initialize .marc in the current project and optionally register it with the daemon.",
    gatedShape({}),
    async (input) => withBootstrap(input, async () => {
      const workspace = await initWorkspace(workspaceRoot);
      await updateWorkspaceRecommendations(workspaceRoot);
      await notifyDaemon(workspace, options);
      return workspace;
    }),
  );

  server.tool(
    "workspace_update_recommendations",
    "Update this workspace's recommended mARC instructions and rules without overwriting project content.",
    {},
    async () => text(await updateWorkspaceRecommendations(workspaceRoot)),
  );

  server.tool(
    "workspace_unregister",
    "Remove this workspace from the daemon registry and UI without deleting the local .marc folder or chat history.",
    gatedShape({}),
    async (input) => withBootstrap(input, async () => {
      const workspace = await getWorkspaceInfo(workspaceRoot);
      await unregisterFromDaemon(workspace, options);
      return {
        unregistered: workspace,
        deletedLocalFiles: false,
      };
    }),
  );

  server.tool(
    "agent_register",
    "Register an agent profile in this workspace before posting messages.",
    gatedShape({
      id: z.string().min(1),
      role: z.string().min(1),
      model: z.string().min(1),
      description: z.string().min(1),
      displayName: z.string().optional(),
    }),
    async (input) => withBootstrap(input, async () => registerAgent(workspaceRoot, input)),
  );

  server.tool(
    "agent_list",
    "List registered agent profiles in this workspace.",
    gatedShape({
      includeMarkdown: z.boolean().optional(),
    }),
    async (input) => withBootstrap(input, async () => listAgentProfiles(workspaceRoot, {
      includeMarkdown: input.includeMarkdown,
    })),
  );

  server.tool(
    "thread_create",
    "Create a new mARC thread in this workspace.",
    gatedShape({
      title: z.string().min(1),
    }),
    async (input) => withBootstrap(input, async () => createThread(workspaceRoot, input.title)),
  );

  server.tool(
    "message_post",
    "Append a structured Markdown message to a thread. Keep messages simple, direct, and short or medium length; attach long detail as artifacts.",
    gatedShape({
      threadId: z.string().min(1),
      agentId: z.string().min(1),
      body: z.string().min(1),
      role: z.string().optional(),
      artifacts: z.array(z.string()).optional(),
    }),
    async (input) =>
      withBootstrap(input, async () =>
        appendMessage(workspaceRoot, input.threadId, {
          agentId: input.agentId,
          body: input.body,
          role: input.role,
          artifacts: input.artifacts,
        }),
      ),
  );

  server.tool(
    "message_attach_artifact",
    "Write an artifact under a thread artifacts folder and return its relative link.",
    gatedShape({
      threadId: z.string().min(1),
      fileName: z.string().min(1),
      content: z.string(),
    }),
    async (input) =>
      withBootstrap(input, async () => ({
        path: await attachArtifact(workspaceRoot, input.threadId, input.fileName, input.content),
      })),
  );

  server.tool(
    "thread_list",
    "List threads in this workspace. Defaults to open threads; pass status 'closed' or 'all' when needed.",
    gatedShape({
      status: z.enum(["open", "closed", "all"]).optional(),
    }),
    async (input) => withBootstrap(input, async () => listThreads(workspaceRoot, { status: input.status })),
  );

  server.tool(
    "thread_read",
    "Read a thread transcript. Returns lastMessageId; agents should store it and prefer thread_read_since on later reads. Markdown is omitted by default to avoid duplicating messages.",
    gatedShape({
      threadId: z.string().min(1),
      includeMarkdown: z.boolean().optional(),
      includeMessages: z.boolean().optional(),
      includeSummary: z.boolean().optional(),
    }),
    async (input) =>
      withBootstrap(input, async () =>
        readThread(workspaceRoot, input.threadId, {
          includeMarkdown: input.includeMarkdown,
          includeMessages: input.includeMessages,
          includeSummary: input.includeSummary,
        }),
      ),
  );

  server.tool(
    "thread_read_since",
    "Read only messages added after afterMessageId. If the cursor is missing, returns cursor_not_found and shouldReadFullThread=true so the agent can announce fallback and call thread_read explicitly.",
    gatedShape({
      threadId: z.string().min(1),
      afterMessageId: z.string().min(1),
    }),
    async (input) => withBootstrap(input, async () => readThreadSince(workspaceRoot, input.threadId, input.afterMessageId)),
  );

  server.tool(
    "thread_info",
    "Read cheap thread metadata including messageCount, lastMessageId, updatedAt, status, and summary availability.",
    gatedShape({
      threadId: z.string().min(1),
    }),
    async (input) => withBootstrap(input, async () => readThreadInfo(workspaceRoot, input.threadId)),
  );

  server.tool(
    "thread_tail",
    "Read the last N messages from a thread. Use this for quick recent context when a full read is unnecessary.",
    gatedShape({
      threadId: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    async (input) => withBootstrap(input, async () => readThreadTail(workspaceRoot, input.threadId, { limit: input.limit })),
  );

  server.tool("workspace_read_rules", "Read this workspace RULES.md.", gatedShape({}), async (input) =>
    withBootstrap(input, async () => readRules(workspaceRoot)),
  );

  server.tool(
    "agent_read_profile",
    "Read one registered agent profile from this workspace.",
    gatedShape({
      agentId: z.string().min(1),
    }),
    async (input) => withBootstrap(input, async () => readAgentProfile(workspaceRoot, input.agentId)),
  );

  server.tool("workspace_info", "Return the workspace bound to this MCP process.", gatedShape({}), async (input) =>
    withBootstrap(input, async () => getWorkspaceInfo(workspaceRoot)),
  );

  return server;
}

export async function runMcpServer(options: McpOptions = {}): Promise<void> {
  const server = buildMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
