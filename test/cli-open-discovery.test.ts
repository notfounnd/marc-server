import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { DEFAULT_DAEMON_URL } from "../src/daemon/config.js";
import {
  discoverDaemon,
  type DaemonRuntime,
  type DiscoveryInput
} from "../src/cli-open-discovery.js";
import { runOpenCommand } from "../src/cli-open-command.js";
import {
  DAEMON_TOKEN,
  VALUES,
  assertNoSecret,
  harness,
  outputJson
} from "./cli-open-fixtures.js";

const DATA = "/discovery-data";
const DIR_TOKEN = path.join(DATA, "token");
const STATE_TOKEN_PATH = path.join("/elsewhere", "token");

type Row = {
  name: string;
  input: DiscoveryInput;
  runtime: DaemonRuntime | undefined;
  files: Record<string, string>;
  baseUrl: string;
  token: string | undefined;
};

/** The URL and token precedence of marc open, one row each. The file map stands in for the disk. */
const ROWS: Row[] = [
  {
    name: "a flag URL with no runtime state takes the token from the data directory",
    input: {
      explicitUrl: "http://127.0.0.1:5555",
      dataDir: DATA,
      fallbackToken: undefined
    },
    runtime: undefined,
    files: { [DIR_TOKEN]: "dir-token" },
    baseUrl: "http://127.0.0.1:5555",
    token: "dir-token"
  },
  {
    name: "no flag and no runtime state fall back to the default address",
    input: { explicitUrl: undefined, dataDir: DATA, fallbackToken: undefined },
    runtime: undefined,
    files: { [DIR_TOKEN]: "dir-token" },
    baseUrl: DEFAULT_DAEMON_URL,
    token: "dir-token"
  },
  {
    name: "the URL of daemon.json is used when no flag is given",
    input: { explicitUrl: undefined, dataDir: DATA, fallbackToken: undefined },
    runtime: { url: "http://127.0.0.1:6000", tokenPath: STATE_TOKEN_PATH },
    files: { [STATE_TOKEN_PATH]: "state-token" },
    baseUrl: "http://127.0.0.1:6000",
    token: "state-token"
  },
  {
    name: "the flag beats the URL of daemon.json",
    input: {
      explicitUrl: "http://127.0.0.1:5555",
      dataDir: DATA,
      fallbackToken: undefined
    },
    runtime: { url: "http://127.0.0.1:6000", tokenPath: STATE_TOKEN_PATH },
    files: { [STATE_TOKEN_PATH]: "state-token" },
    baseUrl: "http://127.0.0.1:5555",
    token: "state-token"
  },
  {
    name: "the token file that daemon.json names wins over the data directory token",
    input: { explicitUrl: undefined, dataDir: DATA, fallbackToken: undefined },
    runtime: { url: "http://127.0.0.1:6000", tokenPath: STATE_TOKEN_PATH },
    files: { [STATE_TOKEN_PATH]: "state-token", [DIR_TOKEN]: "dir-token" },
    baseUrl: "http://127.0.0.1:6000",
    token: "state-token"
  },
  {
    name: "an empty token file is skipped for the next candidate",
    input: { explicitUrl: undefined, dataDir: DATA, fallbackToken: undefined },
    runtime: { url: "http://127.0.0.1:6000", tokenPath: STATE_TOKEN_PATH },
    files: { [STATE_TOKEN_PATH]: "  \n", [DIR_TOKEN]: "dir-token" },
    baseUrl: "http://127.0.0.1:6000",
    token: "dir-token"
  },
  {
    name: "the token file beats MARC_TOKEN",
    input: {
      explicitUrl: undefined,
      dataDir: DATA,
      fallbackToken: "env-token"
    },
    runtime: undefined,
    files: { [DIR_TOKEN]: "dir-token" },
    baseUrl: DEFAULT_DAEMON_URL,
    token: "dir-token"
  },
  {
    name: "MARC_TOKEN is the last resort when no token file exists",
    input: {
      explicitUrl: undefined,
      dataDir: DATA,
      fallbackToken: "env-token"
    },
    runtime: undefined,
    files: {},
    baseUrl: DEFAULT_DAEMON_URL,
    token: "env-token"
  },
  {
    name: "no token anywhere gives an undefined token, so the command stops",
    input: { explicitUrl: undefined, dataDir: DATA, fallbackToken: undefined },
    runtime: undefined,
    files: {},
    baseUrl: DEFAULT_DAEMON_URL,
    token: undefined
  }
];

for (const row of ROWS) {
  test(`discovery: ${row.name}`, async () => {
    const found = await discoverDaemon(row.input, {
      readRuntime: async () => row.runtime,
      readText: async (filePath) => row.files[filePath],
      dirExists: () => false
    });
    assert.deepEqual(found, { baseUrl: row.baseUrl, token: row.token });
  });
}

test("marc open with --daemon-url and no daemon.json finds the daemon by its token file and never prints the token", async () => {
  const h = harness();
  const code = await runOpenCommand(
    { ...VALUES, "daemon-url": "http://127.0.0.1:5555", "dry-run": true },
    h.output,
    h.deps
  );
  assert.equal(code, 0);
  assert.equal(h.accesses[0].baseUrl, new URL("http://127.0.0.1:5555").href);
  assert.equal(h.accesses[0].token, DAEMON_TOKEN);
  assert.deepEqual(h.client.probes, ["status"]);
  assertNoSecret(h);
});

test("MARC_DAEMON_URL is used when no flag is given", async () => {
  const h = harness({
    env: { PATH: "/usr/bin", MARC_DAEMON_URL: "http://127.0.0.1:6001" }
  });
  await runOpenCommand({ ...VALUES, "dry-run": true }, h.output, h.deps);
  assert.equal(h.accesses[0].baseUrl, new URL("http://127.0.0.1:6001").href);
});

test("without a flag, MARC_DAEMON_URL or daemon.json, the default address is probed", async () => {
  const h = harness();
  await runOpenCommand({ ...VALUES, "dry-run": true }, h.output, h.deps);
  assert.equal(h.accesses[0].baseUrl, DEFAULT_DAEMON_URL);
  assert.equal(h.accessDirs.length, 1);
});

test("MARC_TOKEN is the last resort and its value reaches no output", async () => {
  const h = harness({
    files: {},
    env: { PATH: "/usr/bin", MARC_TOKEN: "caller-env-token" }
  });
  const code = await runOpenCommand(
    { ...VALUES, "dry-run": true },
    h.output,
    h.deps
  );
  assert.equal(code, 0);
  assert.equal(h.accesses[0].token, "caller-env-token");
  assert.equal(JSON.stringify(h.lines).includes("caller-env-token"), false);
  assert.equal(JSON.stringify(h.warnings).includes("caller-env-token"), false);
});

test("a --daemon-url that is not a URL is refused before any daemon call", async () => {
  const h = harness();
  const code = await runOpenCommand(
    { ...VALUES, "daemon-url": "not a url", "dry-run": true },
    h.output,
    h.deps
  );
  assert.equal(code, 5);
  const line = outputJson(h.lines);
  assert.equal(line.reason, "daemon_url_invalid");
  assert.deepEqual(h.client.calls, []);
  assert.deepEqual(h.client.probes, []);
});
