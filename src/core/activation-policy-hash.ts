import { createHash } from "node:crypto";
import type { ActivationPolicy } from "./activation-policy.js";

/**
 * The content pin of an authorization. The hash covers everything except the revision
 * and updatedAt, so a hand edit of participants or limits changes it even when the
 * revision stays the same. Keys are sorted at every level, so the hash does not depend
 * on the order in which a file lists its fields.
 */
export function policyContentHash(policy: ActivationPolicy): string {
  const { revision: _revision, updatedAt: _updatedAt, ...content } = policy;
  return createHash("sha256")
    .update(canonicalJson(content), "utf8")
    .digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortKeys(record[key])])
  );
}
