import {
  applyRules,
  integerBetween,
  isBoolean,
  isIsoDate,
  isNonEmptyString,
  isRecord,
  type Rule,
  type ValidationError
} from "./activation-rules.js";

/**
 * Policy version 2. It holds only the switch, the mode and the two limits. Participants
 * are not stored: they are every architect-role profile, computed live. Stages are the
 * fixed constant, so the file carries no stage list.
 */
export type ActivationPolicy = {
  version: 2;
  revision: string;
  enabled: boolean;
  mode: "confirm";
  attemptCap: number;
  pendingTtlMinutes: number;
  updatedAt: string;
};

/** A registered profile. Profiles without a role never match a participant rule. */
export type ProfileRef = { id: string; role?: string };

export type PolicyValidation =
  | { ok: true; policy: ActivationPolicy }
  | { ok: false; errors: ValidationError[] };

/** The only fields the UI form may send. The daemon owns version, mode, revision and updatedAt. */
export const POLICY_FORM_FIELDS = [
  "enabled",
  "attemptCap",
  "pendingTtlMinutes"
] as const;

const POLICY_DEFAULTS = { attemptCap: 2, pendingTtlMinutes: 1440 };

const POLICY_RULES: readonly Rule[] = [
  { field: "version", test: (value) => value === 2, code: "invalid_version" },
  { field: "revision", test: isNonEmptyString, code: "invalid_revision" },
  { field: "enabled", test: isBoolean, code: "invalid_type" },
  { field: "mode", test: (value) => value === "confirm", code: "invalid_mode" },
  { field: "attemptCap", test: integerBetween(1, 5), code: "out_of_range" },
  {
    field: "pendingTtlMinutes",
    test: integerBetween(5, 10080),
    code: "out_of_range"
  },
  { field: "updatedAt", test: isIsoDate, code: "invalid_date" }
];

/** The architect-role profiles, in registry order. Computed on every read, never stored. */
export function participantsOf(profiles: readonly ProfileRef[]): string[] {
  return profiles
    .filter((profile) => profile.role === "architect")
    .map((profile) => profile.id);
}

/**
 * Validates the stored or saved shape of a policy record. A missing policy is never valid
 * here: callers treat "no policy" as disabled before they reach this.
 */
export function validatePolicy(input: unknown): PolicyValidation {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ field: "policy", code: "invalid_type" }] };
  }
  const record: Record<string, unknown> = { ...POLICY_DEFAULTS, ...input };
  const errors = applyRules(record, POLICY_RULES);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, policy: toPolicy(record) };
}

/**
 * Save-time rule only. An enabled policy needs at least one architect to wake, so enabling
 * with none is refused. Reads never apply it: a stored policy must not turn invalid because
 * an architect was removed.
 */
export function saveErrorsOf(
  policy: ActivationPolicy,
  profiles: readonly ProfileRef[]
): ValidationError[] {
  if (!policy.enabled) return [];
  if (participantsOf(profiles).length > 0) return [];
  return [{ field: "participants", code: "no_participants" }];
}

/** Keeps only the form fields and adds the daemon-owned ones, before validation. */
export function policyCandidate(
  form: unknown,
  revision: string,
  updatedAt: string
): unknown {
  if (!isRecord(form)) return form;
  const picked = Object.fromEntries(
    POLICY_FORM_FIELDS.filter((field) => field in form).map((field) => [
      field,
      form[field]
    ])
  );
  return { ...picked, version: 2, mode: "confirm", revision, updatedAt };
}

function toPolicy(record: Record<string, unknown>): ActivationPolicy {
  return {
    version: 2,
    revision: String(record.revision),
    enabled: record.enabled === true,
    mode: "confirm",
    attemptCap: Number(record.attemptCap),
    pendingTtlMinutes: Number(record.pendingTtlMinutes),
    updatedAt: String(record.updatedAt)
  };
}
