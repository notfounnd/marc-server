import assert from "node:assert/strict";
import test from "node:test";
import { clientOf } from "../src/core/agent-launch.js";
import type { AgentProfileSummary } from "../src/core/types.js";

type Row = {
  name: string;
  profile: Pick<AgentProfileSummary, "model" | "client">;
  client: "claude-code" | undefined;
};

const rows: Row[] = [
  {
    name: "a Claude Opus model without a Client line runs in Claude Code",
    profile: { model: "claude-opus-5-5" },
    client: "claude-code"
  },
  {
    name: "a Claude Haiku model with an explicit claude-code runs in Claude Code",
    profile: { model: "claude-haiku-5-5", client: "claude-code" },
    client: "claude-code"
  },
  {
    name: "an explicit claude-code wins over a Codex model",
    profile: { model: "gpt-6.1-sol", client: "claude-code" },
    client: "claude-code"
  },
  {
    name: "a Codex model without a Client line has no client until F5",
    profile: { model: "gpt-6.1-sol" },
    client: undefined
  },
  {
    name: "an explicit codex has no client until F5, even with a Claude model",
    profile: { model: "claude-haiku-5-5", client: "codex" },
    client: undefined
  },
  {
    name: "an unknown explicit client never falls back to the model prefix",
    profile: { model: "claude-haiku-5-5", client: "gemini" },
    client: undefined
  },
  {
    name: "a human profile has no client",
    profile: { model: "human" },
    client: undefined
  },
  {
    name: "a missing model and no Client line have no client",
    profile: {},
    client: undefined
  },
  {
    name: "an empty model has no client",
    profile: { model: "" },
    client: undefined
  }
];

for (const row of rows) {
  test(`client of a profile: ${row.name}`, () => {
    assert.equal(clientOf(row.profile), row.client);
  });
}
