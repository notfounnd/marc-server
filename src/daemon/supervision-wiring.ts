import { DENY } from "../core/supervision-permissions.js";
import type { RegistryDependencies } from "./session-registry.js";
import {
  DEFAULT_SUPERVISION_OPTIONS,
  type SupervisionOptions
} from "./supervision-runner.js";
import { createPermissionStore } from "./supervision-permission-store.js";
import {
  createSupervisionTurnRunner,
  type TurnRunner
} from "./supervision-turn-runner.js";
import type { TurnHost } from "./supervision-turn-steps.js";

/** What the runner reports to the permission requests: a deadline and the end of a turn. Tests fire them as the runner does. */
export type WiringHooks = {
  onDeadline(runId: string): void;
  onTurnEnd(runId: string): void;
};

export type SupervisionWiring = {
  options: SupervisionOptions;
  turnRunner: TurnRunner;
  hooks: WiringHooks;
};

/**
 * The supervisor's options, with the turn runner as its runner. The host is read when a turn starts, so
 * the runner can be built before the services it reads exist. Injected options win over the defaults.
 * The permission requests of a run are denied at its deadline and at its end, whatever the cause.
 */
export function wireSupervision(input: {
  now: () => string;
  registry?: Partial<RegistryDependencies>;
  supervision?: Partial<SupervisionOptions>;
  host: () => TurnHost;
  /** Told when a permission request changes, so the panel refreshes on the change. */
  changed?: (workspaceId: string, threadId: string) => void;
}): SupervisionWiring {
  const permissions =
    input.supervision?.permissions ??
    createPermissionStore({
      now: () => Date.parse(input.now()),
      changed: input.changed
    });
  const hooks: WiringHooks = {
    onDeadline: (runId) => permissions.denyOpen(runId, DENY.timeout),
    onTurnEnd: (runId) => permissions.denyOpen(runId, DENY.notSupervised)
  };
  const turnRunner = createSupervisionTurnRunner({
    host: input.host,
    ports: () => options.turn,
    ...hooks
  });
  const options: SupervisionOptions = {
    ...DEFAULT_SUPERVISION_OPTIONS,
    now: input.now,
    newSessionId:
      input.registry?.newSessionId ?? DEFAULT_SUPERVISION_OPTIONS.newSessionId,
    newOwnerToken:
      input.registry?.newOwnerToken ??
      DEFAULT_SUPERVISION_OPTIONS.newOwnerToken,
    startedAt: Date.now(),
    runner: turnRunner,
    permissions,
    ...input.supervision
  };
  return { options, turnRunner, hooks };
}
