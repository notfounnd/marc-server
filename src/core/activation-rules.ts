/** Declarative validation rules. A rule is a row: a field, a predicate, and the code it reports. */
export type ValidationError = { field: string; code: string };

export type Rule = {
  field: string;
  test: (value: unknown) => boolean;
  code: string;
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

export function isString(value: unknown): boolean {
  return typeof value === "string";
}

export function isBoolean(value: unknown): boolean {
  return typeof value === "boolean";
}

export function isSlug(value: unknown): boolean {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

export function isIsoDate(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function integerBetween(
  min: number,
  max: number
): (value: unknown) => boolean {
  return (value) =>
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max;
}

/** One error per failed row. The prefix locates nested fields, such as a stage's maxPasses. */
export function applyRules(
  record: Record<string, unknown>,
  rules: readonly Rule[],
  prefix = ""
): ValidationError[] {
  return rules.flatMap((rule) =>
    rule.test(record[rule.field])
      ? []
      : [{ field: `${prefix}${rule.field}`, code: rule.code }]
  );
}
