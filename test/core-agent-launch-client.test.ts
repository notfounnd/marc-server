import assert from "node:assert/strict";
import test from "node:test";
import { clientForModel } from "../src/core/agent-launch.js";

type Row = {
  name: string;
  model: string | undefined;
  client: "claude-code" | undefined;
};

const rows: Row[] = [
  {
    name: "a Claude Opus model runs in Claude Code",
    model: "claude-opus-5-5",
    client: "claude-code"
  },
  {
    name: "a Claude Haiku model runs in Claude Code",
    model: "claude-haiku-5-5",
    client: "claude-code"
  },
  {
    name: "a Codex model has no client until F5",
    model: "gpt-6.1-sol",
    client: undefined
  },
  {
    name: "a human profile has no client",
    model: "human",
    client: undefined
  },
  {
    name: "a missing model has no client",
    model: undefined,
    client: undefined
  },
  {
    name: "an empty model has no client",
    model: "",
    client: undefined
  }
];

for (const row of rows) {
  test(`client of a profile model: ${row.name}`, () => {
    assert.equal(clientForModel(row.model), row.client);
  });
}
