import assert from "node:assert/strict";
import test from "node:test";
import {
  renderActivitySection,
  type ThreadActivitySnapshot
} from "../src/core/thread-activity-markdown.js";

const SNAPSHOT: ThreadActivitySnapshot = {
  threadId: "thread-1",
  profiles: [
    {
      profile: "claude-software-architect",
      role: "architect",
      origin: "adopted",
      activations: 1
    }
  ],
  stages: [
    { id: "planning", cyclesUsed: 1, max: 5, outcome: "advanced" },
    { id: "execution", cyclesUsed: 0, max: 5, outcome: "skipped" },
    { id: "review", cyclesUsed: 0, max: 5, outcome: "open" }
  ],
  stageMoves: [
    {
      at: "2026-11-10T10:00:00.000Z",
      from: "planning",
      to: "review",
      by: "agent",
      agentId: "claude-software-architect",
      droppedHolds: 0
    }
  ],
  leadChanges: [
    {
      at: "2026-11-10T11:00:00.000Z",
      from: "claude-software-architect",
      to: "codex-software-architect"
    },
    { at: "2026-11-10T12:00:00.000Z", to: "claude-software-architect" }
  ],
  policyRevision: "rev-1",
  pausedDuringThread: "never",
  conflicts: 0
};

const RENDERED = renderActivitySection({
  status: "recorded",
  snapshot: SNAPSHOT
}) as string;

test("a jumped stage is shown as skipped, and the stage a move left as advanced", () => {
  assert.match(RENDERED, /\| Execution \| 0 \| 5 \| skipped \|/);
  assert.match(RENDERED, /\| Planning \| 1 \| 5 \| advanced \|/);
});

test("the stage moves list the time, both stages, the mover and the holds dropped", () => {
  assert.match(RENDERED, /\| At \| From \| To \| By \| Dropped holds \|/);
  assert.match(
    RENDERED,
    /\| 2026-11-10T10:00:00\.000Z \| Planning \| Review \| agent claude-software-architect \| 0 \|/
  );
});

test("the lead changes list the time and the profile ids, and a first lead shows no previous one", () => {
  assert.match(
    RENDERED,
    /\| 2026-11-10T11:00:00\.000Z \| claude-software-architect \| codex-software-architect \|/
  );
  assert.match(
    RENDERED,
    /\| 2026-11-10T12:00:00\.000Z \| - \| claude-software-architect \|/
  );
});

test("a snapshot without moves or lead changes renders neither table", () => {
  const plain = renderActivitySection({
    status: "recorded",
    snapshot: { ...SNAPSHOT, stageMoves: undefined, leadChanges: undefined }
  }) as string;
  assert.doesNotMatch(plain, /Dropped holds/);
  assert.doesNotMatch(plain, /\| At \| From \| To \|/);
});
