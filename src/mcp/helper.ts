export const MARC_HELPER_TOPICS = [
  "overview",
  "workspace",
  "agents",
  "threads",
  "messages",
  "artifacts",
  "incremental_reading",
  "ui_daemon",
  "all"
] as const;

export type MarcHelperTopic = (typeof MARC_HELPER_TOPICS)[number];

type MarcHelperGuide = {
  purpose: string;
  whenToUse: string[];
  relatedTools: string[];
  examples: string[];
  notes: string[];
};

const MARC_HELPER_GUIDES: Record<
  Exclude<MarcHelperTopic, "all">,
  MarcHelperGuide
> = {
  overview: {
    purpose:
      "Understand the mARC workflow and choose the right tool for the next action.",
    whenToUse: [
      "At the start of a session using mARC.",
      "When deciding between reading, posting, attaching artifacts, or updating recommendations."
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
      "workspace_bootstrap"
    ],
    examples: [
      "Call workspace_info to confirm which project this MCP server is bound to.",
      "Call workspace_bootstrap at the start of a session/workspace or when bootstrap context is missing, stale, or uncertain.",
      "Call thread_list before choosing a thread to continue.",
      "Call marc_helper with topic incremental_reading before reading a long active thread."
    ],
    notes: [
      "Use mARC as shared project memory, not as a replacement for source files.",
      "Keep messages readable and complete. Put long logs, plans, and reports in artifacts."
    ]
  },
  workspace: {
    purpose:
      "Initialize, inspect, and maintain the mARC workspace files: INSTRUCTIONS.md defines the stable bootstrap protocol, and RULES.md defines the workspace behavior contract.",
    whenToUse: [
      "Before the first mARC interaction in a project.",
      "When tool recommendations or workspace rules may be outdated."
    ],
    relatedTools: [
      "workspace_register",
      "workspace_bootstrap",
      "workspace_info",
      "workspace_read_rules",
      "workspace_update_recommendations",
      "workspace_unregister"
    ],
    examples: [
      "workspace_register creates .marc files and registers the workspace with the daemon when configured.",
      "workspace_update_recommendations refreshes managed instructions, rules, and skill while preserving Custom Rules; it does not establish or restore bootstrap context."
    ],
    notes: [
      "Call workspace_bootstrap at session start or when context is missing, stale, or uncertain; reuse a known current contract.",
      "Refreshing recommendations does not replace bootstrap.",
      "Keep project-specific behavior in RULES.md under Custom Rules; INSTRUCTIONS.md should stay short and procedural.",
      "Use Markdown for human-readable knowledge and coordination records; preserve structured formats such as JSON.",
      "After new MCP tools are added, rebuild and restart the MCP client because tool schemas may be cached."
    ]
  },
  agents: {
    purpose:
      "Discover and reuse participant profiles, and register or update one when necessary and permitted by the workspace contract.",
    whenToUse: [
      "When identifying a profile for a mARC message.",
      "When profile details are needed to understand a participant."
    ],
    relatedTools: ["agent_register", "agent_list", "agent_read_profile"],
    examples: [
      "Call agent_list or inspect the bootstrap agent inventory before choosing a profile.",
      "Call agent_read_profile when additional profile context is relevant.",
      "Call agent_register only when a profile must be created or updated and the workspace contract permits it."
    ],
    notes: [
      "Reuse an existing profile when it fits; do not assume a fixed ID or role catalog.",
      "Follow the current workspace contract for profile selection and administration."
    ]
  },
  threads: {
    purpose: "Create, list, and read task conversations.",
    whenToUse: [
      "When starting a separate task or opportunity.",
      "When resuming work from existing mARC context."
    ],
    relatedTools: [
      "thread_create",
      "thread_list",
      "thread_read",
      "thread_info",
      "thread_tail",
      "thread_read_since",
      "thread_write_summary"
    ],
    examples: [
      "thread_create with a clear task title for new work.",
      "thread_list defaults to open threads; pass status closed or all when needed.",
      "thread_info gives cheap metadata before deciding whether to read content.",
      "Thread read tools accept a unique 8-character hexadecimal suffix; use full IDs for writes.",
      "Use thread_write_summary with a full thread ID; create closes only when authorized, and update requires expectedSummaryRevision from thread_info or thread_read with includeSummary true.",
      "Provide only the caller-authored summary body; the core owns its title and metadata header.",
      "When the user gives a specific mARC source, read that source before broad workspace investigation."
    ],
    notes: [
      "Closed threads are controlled by SUMMARY.md in the thread folder.",
      "Follow the current workspace contract for thread composition and closure guidance.",
      "Prefer a new thread when a conversation becomes too broad or needs a separate outcome."
    ]
  },
  messages: {
    purpose: "Append structured updates to a thread.",
    whenToUse: [
      "After implementing, reviewing, planning, or finding a blocker.",
      "When the user asks to record a decision or status in mARC."
    ],
    relatedTools: ["message_post", "agent_register", "thread_read"],
    examples: [
      "message_post with a readable implementation summary, validation commands, and any relevant risks.",
      "message_post for a material decision, finding, risk, blocker, result, consolidated delivery, or genuine handoff."
    ],
    notes: [
      "Messages should preserve useful context instead of being brief but empty.",
      "Use bullets or short labeled sections when a message has multiple points.",
      "Use artifacts for large outputs, detailed reviews, logs, or long plans.",
      "Share material decisions, findings, risks, blockers, and results; avoid routine read acknowledgments and iteration-by-iteration status updates."
    ]
  },
  artifacts: {
    purpose: "Store long Markdown content or supporting files under a thread.",
    whenToUse: [
      "When content would make a chat message too large.",
      "When attaching reports, detailed plans, benchmark outputs, or review notes."
    ],
    relatedTools: ["message_attach_artifact", "message_post"],
    examples: [
      "message_attach_artifact with fileName review.md and Markdown content.",
      "message_post referencing the artifact path returned by message_attach_artifact."
    ],
    notes: [
      "Keep artifacts attached to the relevant thread.",
      "Post a readable summary in the message so readers know why the artifact matters."
    ]
  },
  incremental_reading: {
    purpose:
      "Read active threads efficiently without repeatedly loading the whole transcript.",
    whenToUse: [
      "When returning to a thread already read in the current session.",
      "When the user says a thread has a new message.",
      "When a thread may be long and only recent context is needed."
    ],
    relatedTools: [
      "thread_read",
      "thread_read_since",
      "thread_info",
      "thread_tail"
    ],
    examples: [
      "First read: call thread_read, read and process the returned message content, then store its lastMessageId as the consumed cursor.",
      "Later read: call thread_read_since with threadId and afterMessageId set to the stored lastMessageId.",
      "If cursor_not_found returns shouldReadFullThread true, tell the user the incremental read failed and call thread_read.",
      "Use thread_tail with limit 5 or 10 for recent context when no cursor is available."
    ],
    notes: [
      "Store or advance a cursor only after you have read and processed the message content.",
      "thread_info metadata does not advance a consumed-content cursor.",
      "thread_tail proves only its returned window was read; it does not establish that earlier backlog was consumed.",
      "thread_read omits markdown by default to avoid duplicating markdown plus parsed messages.",
      "Use includeMarkdown true only when raw CHAT.md content is specifically needed.",
      "Prefer the smallest read that answers the current question."
    ]
  },
  ui_daemon: {
    purpose: "Understand how the local UI and daemon relate to MCP actions.",
    whenToUse: [
      "When the UI does not update as expected.",
      "When a workspace is missing from the panel.",
      "When validating local browser behavior."
    ],
    relatedTools: [
      "workspace_register",
      "workspace_unregister",
      "thread_list",
      "message_post"
    ],
    examples: [
      "Keep the daemon running so the UI can receive events.",
      "Run workspace_register if a project does not appear in the UI."
    ],
    notes: [
      "The browser may keep an EventSource connection open for live updates.",
      "MCP clients may need restart after tool schema changes."
    ]
  }
};

export function marcHelper(topic: MarcHelperTopic = "overview") {
  if (topic === "all") {
    return {
      tool: "marc_helper",
      purpose:
        "Provide operational guidance for using mARC MCP tools efficiently.",
      availableTopics: MARC_HELPER_TOPICS,
      topics: MARC_HELPER_GUIDES
    };
  }

  return {
    tool: "marc_helper",
    topic,
    availableTopics: MARC_HELPER_TOPICS,
    ...MARC_HELPER_GUIDES[topic]
  };
}
