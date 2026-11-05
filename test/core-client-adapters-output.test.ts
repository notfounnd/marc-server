import assert from "node:assert/strict";
import test from "node:test";
import {
  adapterFor,
  claudeCodeAdapter,
  type ParseResult,
  type RunOutcome
} from "../src/core/client-adapters.js";

const SESSION = "5f0c2a6e-8d1b-4c3a-9e7f-2b6d4a1c0e88";

const parsedResult = {
  sessionId: SESSION,
  isError: false,
  subtype: "success",
  permissionDenials: [],
  totalCostUsd: 0.0123,
  durationMs: 4200,
  resultText: "done"
};

function jsonOutput(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    session_id: SESSION,
    total_cost_usd: 0.0123,
    duration_ms: 4200,
    permission_denials: [],
    result: "done",
    ...overrides
  });
}

const parseRows: {
  name: string;
  stdout: string;
  expected: ParseResult;
}[] = [
  {
    name: "a valid result is read with its cost, duration and session",
    stdout: jsonOutput(),
    expected: { status: "parsed", result: parsedResult }
  },
  {
    name: "a result of another session is invalid output",
    stdout: jsonOutput({ session_id: "other-session" }),
    expected: { status: "invalid_output" }
  },
  {
    name: "a result without its duration is invalid output",
    stdout: jsonOutput({ duration_ms: undefined }),
    expected: { status: "invalid_output" }
  },
  {
    name: "a truncated JSON is invalid output",
    stdout: '{"type":"result","session_id":',
    expected: { status: "invalid_output" }
  },
  {
    name: "a JSON array is invalid output",
    stdout: "[]",
    expected: { status: "invalid_output" }
  },
  {
    name: "an empty output is invalid output",
    stdout: "",
    expected: { status: "invalid_output" }
  },
  {
    name: "an error result is still read, with its flag",
    stdout: jsonOutput({ is_error: true, subtype: "error_max_turns" }),
    expected: {
      status: "parsed",
      result: {
        ...parsedResult,
        isError: true,
        subtype: "error_max_turns"
      }
    }
  }
];

for (const row of parseRows) {
  test(`parse result: ${row.name}`, () => {
    assert.deepStrictEqual(
      claudeCodeAdapter.parseResult(row.stdout, SESSION),
      row.expected
    );
  });
}

const successOutcome: RunOutcome = {
  timedOut: false,
  crashed: false,
  missingClient: false,
  exitCode: 0,
  parsed: { status: "parsed", result: parsedResult },
  stderr: ""
};

const invalidParsed: ParseResult = { status: "invalid_output" };

function parsedWith(resultText: string, isError: boolean): ParseResult {
  return {
    status: "parsed",
    result: { ...parsedResult, resultText, isError }
  };
}

const failureRows: {
  name: string;
  outcome: RunOutcome;
  expected: string | undefined;
}[] = [
  {
    name: "a successful turn has no failure",
    outcome: successOutcome,
    expected: undefined
  },
  {
    name: "a timeout prevails over an incomplete JSON",
    outcome: {
      ...successOutcome,
      timedOut: true,
      exitCode: undefined,
      parsed: invalidParsed
    },
    expected: "timeout"
  },
  {
    name: "a timeout prevails over a session message in stderr",
    outcome: {
      ...successOutcome,
      timedOut: true,
      exitCode: undefined,
      parsed: invalidParsed,
      stderr: "No conversation found with session ID"
    },
    expected: "timeout"
  },
  {
    name: "a crash prevails over an incomplete JSON",
    outcome: {
      ...successOutcome,
      crashed: true,
      exitCode: undefined,
      parsed: invalidParsed
    },
    expected: "crashed"
  },
  {
    name: "a missing client executable is client_missing",
    outcome: {
      ...successOutcome,
      missingClient: true,
      exitCode: undefined,
      parsed: invalidParsed
    },
    expected: "client_missing"
  },
  {
    name: "a missing conversation is session_not_found",
    outcome: {
      ...successOutcome,
      exitCode: 1,
      parsed: invalidParsed,
      stderr: "No conversation found with session ID: x"
    },
    expected: "session_not_found"
  },
  {
    name: "a login hint in the result is auth",
    outcome: {
      ...successOutcome,
      exitCode: 1,
      parsed: parsedWith("Not logged in · Please run /login", true)
    },
    expected: "auth"
  },
  {
    name: "an unclassified error result is error, never a guess",
    outcome: {
      ...successOutcome,
      exitCode: 1,
      parsed: parsedWith("something unexpected", true)
    },
    expected: "error"
  },
  {
    name: "a non-zero exit with a clean JSON is error, because the cause is ambiguous",
    outcome: { ...successOutcome, exitCode: 1 },
    expected: "error"
  },
  {
    name: "a zero exit with an invalid JSON is invalid_output",
    outcome: { ...successOutcome, parsed: invalidParsed },
    expected: "invalid_output"
  }
];

for (const row of failureRows) {
  test(`failure reason: ${row.name}`, () => {
    assert.equal(claudeCodeAdapter.failureReason(row.outcome), row.expected);
  });
}

const adapterRows: {
  name: string;
  client: string | undefined;
  expected: typeof claudeCodeAdapter | undefined;
}[] = [
  {
    name: "claude-code has its adapter",
    client: "claude-code",
    expected: claudeCodeAdapter
  },
  {
    name: "codex has no adapter until F5",
    client: "codex",
    expected: undefined
  },
  {
    name: "an unknown client has no adapter",
    client: "gemini",
    expected: undefined
  },
  {
    name: "a missing client has no adapter",
    client: undefined,
    expected: undefined
  },
  {
    name: "an inherited object key is not an adapter",
    client: "constructor",
    expected: undefined
  }
];

for (const row of adapterRows) {
  test(`adapter table: ${row.name}`, () => {
    assert.equal(adapterFor(row.client), row.expected);
  });
}
