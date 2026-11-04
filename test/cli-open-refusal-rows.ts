import type { OpenValues } from "../src/cli-open-input.js";
import {
  DATA_DIR,
  PROFILE,
  ROOT,
  VALUES,
  acquired,
  fakeClient,
  fakeWorkspace,
  harness,
  postedBy,
  sessionsReply,
  unbound,
  type Harness
} from "./cli-open-fixtures.js";
import { refused, unreachableClient } from "./cli-open-doubles.js";

/**
 * The refusal, input, and daemon failure rows of marc open. The test file runs each row and checks
 * the status, the reason, the exit code, and how many acquire calls the row makes.
 */

const ONLINE = sessionsReply({
  profile: PROFILE,
  state: "online",
  binding: { generation: 1 }
});
const NO_THREAD: OpenValues = {
  profile: PROFILE,
  workspace: ROOT,
  "data-dir": DATA_DIR
};
const NOBODY: OpenValues = { ...VALUES, profile: "nobody" };
const USER: OpenValues = { ...VALUES, profile: "ui-user" };
const BAD_SHELL: OpenValues = { ...VALUES, "tool-shell": "zsh" };
const NEW_WITH_VALUE: OpenValues = { ...VALUES, new: "yes" };

export type Row = {
  name: string;
  harness: () => Harness;
  values: OpenValues;
  status: string;
  exitCode: number;
  reason: string;
  /** How many acquire calls the row must make: a refusal is one, a failure before acquire is none. */
  acquires: number;
};

export const ROWS: Row[] = [
  {
    name: "a closed thread is exit 4 and no client is opened",
    harness: () =>
      harness({
        workspace: fakeWorkspace({ closed: true }),
        client: fakeClient({ sessions: unbound() })
      }),
    values: VALUES,
    status: "thread_closed",
    exitCode: 4,
    reason: "thread_closed",
    acquires: 0
  },
  {
    name: "an online owner is exit 6 and the slot is not opened",
    harness: () =>
      harness({
        client: fakeClient({
          sessions: ONLINE,
          acquire: refused("owner_active")
        })
      }),
    values: VALUES,
    status: "owner_active",
    exitCode: 6,
    reason: "owner_active",
    acquires: 1
  },
  {
    name: "a reserved slot is exit 6 as well",
    harness: () =>
      harness({
        client: fakeClient({ sessions: ONLINE, acquire: refused("reserved") })
      }),
    values: VALUES,
    status: "owner_active",
    exitCode: 6,
    reason: "reserved",
    acquires: 1
  },
  {
    name: "a recorded conflict is exit 8",
    harness: () =>
      harness({
        client: fakeClient({ sessions: ONLINE, acquire: refused("conflict") })
      }),
    values: VALUES,
    status: "refused",
    exitCode: 8,
    reason: "conflict",
    acquires: 1
  },
  {
    name: "an unknown owner is exit 8",
    harness: () =>
      harness({
        client: fakeClient({
          sessions: ONLINE,
          acquire: refused("owner_unknown")
        })
      }),
    values: VALUES,
    status: "refused",
    exitCode: 8,
    reason: "owner_unknown",
    acquires: 1
  },
  {
    name: "an invalid registry is exit 8",
    harness: () =>
      harness({
        client: fakeClient({
          sessions: unbound(),
          acquire: refused("registry_invalid")
        })
      }),
    values: VALUES,
    status: "refused",
    exitCode: 8,
    reason: "registry_invalid",
    acquires: 1
  },
  {
    name: "an unbound slot whose profile already posted is exit 8 continuity_unknown, before any acquire",
    harness: () =>
      harness({
        workspace: fakeWorkspace({ messages: [postedBy(PROFILE)] }),
        client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
      }),
    values: VALUES,
    status: "continuity_unknown",
    exitCode: 8,
    reason: "profile_posted_without_binding",
    acquires: 0
  },
  {
    name: "a generation that moved during the read is exit 8 with a retry",
    harness: () =>
      harness({
        client: fakeClient({
          sessions: unbound(),
          acquire: refused("generation_mismatch")
        })
      }),
    values: VALUES,
    status: "retry",
    exitCode: 8,
    reason: "generation_mismatch",
    acquires: 1
  },
  {
    name: "an unknown profile is exit 5 before any acquire",
    harness: () => harness({ client: fakeClient({ sessions: unbound() }) }),
    values: NOBODY,
    status: "input_error",
    exitCode: 5,
    reason: "profile_unknown",
    acquires: 0
  },
  {
    name: "a user profile cannot own a client and is exit 5",
    harness: () => harness({ client: fakeClient({ sessions: unbound() }) }),
    values: USER,
    status: "input_error",
    exitCode: 5,
    reason: "user_profile",
    acquires: 0
  },
  {
    name: "a missing --thread is exit 5",
    harness: () => harness({ client: fakeClient({ sessions: unbound() }) }),
    values: NO_THREAD,
    status: "input_error",
    exitCode: 5,
    reason: "thread_required",
    acquires: 0
  },
  {
    name: "an unknown --tool-shell is exit 5",
    harness: () => harness({ client: fakeClient({ sessions: unbound() }) }),
    values: BAD_SHELL,
    status: "input_error",
    exitCode: 5,
    reason: "tool_shell_invalid",
    acquires: 0
  },
  {
    name: "--new given a value is exit 5",
    harness: () => harness({ client: fakeClient({ sessions: unbound() }) }),
    values: NEW_WITH_VALUE,
    status: "input_error",
    exitCode: 5,
    reason: "new_takes_no_value",
    acquires: 0
  },
  {
    name: "an ambiguous thread ID is exit 5 with the resolver's code",
    harness: () =>
      harness({
        workspace: fakeWorkspace({
          resolution: {
            ok: false,
            error: { code: "ambiguous_thread_id", message: "two threads" }
          }
        }),
        client: fakeClient({ sessions: unbound() })
      }),
    values: VALUES,
    status: "input_error",
    exitCode: 5,
    reason: "ambiguous_thread_id",
    acquires: 0
  },
  {
    name: "a workspace the daemon does not know is exit 5",
    harness: () =>
      harness({
        client: fakeClient({ sessions: { status: 404, body: undefined } })
      }),
    values: VALUES,
    status: "input_error",
    exitCode: 5,
    reason: "workspace_not_registered",
    acquires: 0
  },
  {
    name: "no token in the data directory, in daemon.json, or in MARC_TOKEN is exit 9 token_missing",
    harness: () => harness({ files: {} }),
    values: VALUES,
    status: "daemon_unavailable",
    exitCode: 9,
    reason: "token_missing",
    acquires: 0
  },
  {
    name: "a token the daemon refuses is exit 9 token_rejected, before any slot is read",
    harness: () =>
      harness({
        client: fakeClient({
          sessions: unbound(),
          status: { status: 401, body: undefined }
        })
      }),
    values: VALUES,
    status: "daemon_unavailable",
    exitCode: 9,
    reason: "token_rejected",
    acquires: 0
  },
  {
    name: "an unreadable runtime state is exit 9",
    harness: () =>
      harness({
        readRuntime: async () => {
          throw new Error("EACCES: permission denied, open daemon.json");
        }
      }),
    values: VALUES,
    status: "daemon_unavailable",
    exitCode: 9,
    reason: "daemon_state_unreadable",
    acquires: 0
  },
  {
    name: "a daemon that does not answer is exit 9",
    harness: () => harness({ client: unreachableClient() }),
    values: VALUES,
    status: "daemon_unavailable",
    exitCode: 9,
    reason: "daemon_unreachable",
    acquires: 0
  },
  {
    name: "a daemon error on the slot read is exit 9",
    harness: () =>
      harness({
        client: fakeClient({ sessions: { status: 500, body: undefined } })
      }),
    values: VALUES,
    status: "daemon_unavailable",
    exitCode: 9,
    reason: "daemon_error",
    acquires: 0
  }
];
