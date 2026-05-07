import { defaultUrlTransform } from "react-markdown";
import { parseMarcReference, type MarcReference } from "../core/marc-references.js";

const MARC_ID = "[A-Za-z0-9_-]+";
const MARC_ARTIFACT_FILE = "[A-Za-z0-9._-]+";
const MARC_REFERENCE_PATTERN = new RegExp(
  `marc://(?:@${MARC_ID}|#${MARC_ID}(?:/!${MARC_ARTIFACT_FILE})?|\\$${MARC_ID}(?:/#${MARC_ID}(?:/!${MARC_ARTIFACT_FILE})?)?)`,
  "g",
);

const marcReferenceLabelStrategies = {
  agent: (reference) => `@${reference.agentId}`,
  thread: (reference) => `$${reference.threadId}`,
  message: (reference) => `#${reference.messageId}`,
  artifact: (reference) => `!${reference.artifactFile}`,
} satisfies {
  [Type in MarcReference["type"]]: (reference: Extract<MarcReference, { type: Type }>) => string;
};

export function marcReferenceLabel(reference: string): string {
  const parsed = parseMarcReference(reference);
  if (!parsed) {
    return reference;
  }
  const strategy = marcReferenceLabelStrategies[parsed.type] as (value: typeof parsed) => string;
  return strategy(parsed);
}

export function linkifyMarcReferences(markdown: string): string {
  let inFence = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) {
        return line;
      }

      return line
        .split(/(`[^`]*`)/g)
        .map((segment) => {
          if (segment.startsWith("`") && segment.endsWith("`")) {
            return segment;
          }

          return segment.replace(MARC_REFERENCE_PATTERN, (reference, offset) => {
            const before = segment[offset - 1];
            if (before === "(" || before === "<") {
              return reference;
            }
            return `[${marcReferenceLabel(reference)}](${reference})`;
          });
        })
        .join("");
    })
    .join("\n");
}

export function transformMarkdownUrl(...args: Parameters<typeof defaultUrlTransform>): string {
  const [url] = args;
  return url.startsWith("marc://") ? url : defaultUrlTransform(...args);
}
