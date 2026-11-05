import { randomBytes, randomUUID } from "node:crypto";
import type { SupervisionRecord } from "../core/activation-supervision-types.js";
import type { DeadlineNotice } from "../core/activation-turn-timeout.js";
import type { SlotKey } from "../core/session-slots.js";
import type { WorkspaceInfo } from "../core/types.js";
import type { AdoptedRun } from "./supervision-adopted-run.js";
import {
  createPermissionStore,
  type PermissionStore
} from "./supervision-permission-store.js";
import {
  DEFAULT_TURN_PORTS,
  type TurnPorts
} from "./supervision-turn-process.js";

export type SupervisionScope = { workspace: WorkspaceInfo; threadId: string };

/**
 * What a permission request must match to be accepted: the live turn's process, the thread it belongs to,
 * and the slot binding the run holds. The start instant is absent when no source reported it. The binding
 * is read again when the request is created, so a slot taken by another owner refuses it.
 */
export type PermissionTarget = {
  workspaceId: string;
  threadId: string;
  pid: number;
  startedAt: number | undefined;
  slot: SlotKey;
  generation: number;
  ownerToken: string;
};

/**
 * The port the executor implements. The daemon calls start after a start is committed and outside the
 * thread's queue, so a launch never holds the queue. notice answers the deadline notice of a live run,
 * and is optional so that a runner without turns answers nothing.
 */
export type SupervisionRunner = {
  start(scope: SupervisionScope, record: SupervisionRecord): void;
  notice?(runId: string): DeadlineNotice | undefined;
  /** Takes over a running card found after a restart. Absent on a runner without turns. */
  adopt?(run: AdoptedRun): void;
  /** True while a run of this id is launching, running or watched. Absent on a runner without turns. */
  isLive?(runId: string): boolean;
  /** The process a permission request of this run must come from, or undefined when the run is not live. */
  permissionTarget?(runId: string): PermissionTarget | undefined;
};

/** The runner of a daemon without turns: nothing is launched, so a started card waits in starting. */
export const NOOP_RUNNER: SupervisionRunner = { start: () => undefined };

/** The ids, the instant, the daemon start and the turn ports a supervision judgment draws from. Injected for tests. */
export type SupervisionOptions = {
  runner: SupervisionRunner;
  now: () => string;
  newRunId: () => string;
  newSessionId: () => string;
  newOwnerToken: () => string;
  /** The daemon start in epoch milliseconds. The presence grace window counts from it. */
  startedAt: number;
  /** The clock, timers, spawn and heartbeat interval of a supervised turn. */
  turn: TurnPorts;
  /** The permission requests of the live turns, in memory. The daemon's runner and routes share it. */
  permissions: PermissionStore;
};

export const DEFAULT_SUPERVISION_OPTIONS: SupervisionOptions = {
  runner: NOOP_RUNNER,
  now: () => new Date().toISOString(),
  newRunId: () => randomUUID(),
  newSessionId: () => randomUUID(),
  newOwnerToken: () => randomBytes(32).toString("base64url"),
  startedAt: Date.now(),
  turn: DEFAULT_TURN_PORTS,
  permissions: createPermissionStore({ now: () => Date.now() })
};
