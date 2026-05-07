export type MessageGuardResult = {
  ok: boolean;
  reason?: string;
};

export const MAX_MESSAGE_CHARS = 2400;
export const MAX_MESSAGE_LINES = 30;
export const MAX_LONG_LINES = 6;
export const LONG_LINE_CHARS = 180;

export const MESSAGE_STYLE_GUIDE = [
  "Keep messages useful, readable, and complete.",
  "Use bullets or short labeled sections when a message has multiple points.",
  "Do not remove important context just to make a message shorter.",
  "Avoid dense paragraphs; split scope, decisions, validation, risks, and next steps when relevant.",
  "Link artifacts for long plans, logs, reviews, or detailed analysis.",
  "Mention what changed, what matters, validation performed, and any blocker.",
];

export function validateMessageBody(body: string): MessageGuardResult {
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, reason: "Message body is empty." };
  }

  const lines = trimmed.split(/\r?\n/);
  const longLines = lines.filter((line) => line.length > LONG_LINE_CHARS);

  if (trimmed.length > MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      reason: `Message is too long (${trimmed.length} chars). Keep it under ${MAX_MESSAGE_CHARS} chars or attach an artifact.`,
    };
  }

  if (lines.length > MAX_MESSAGE_LINES) {
    return {
      ok: false,
      reason: `Message has too many lines (${lines.length}). Keep it under ${MAX_MESSAGE_LINES} lines or attach an artifact.`,
    };
  }

  if (longLines.length > MAX_LONG_LINES) {
    return {
      ok: false,
      reason: "Message has too many very long lines. Split it into shorter sentences or attach an artifact.",
    };
  }

  return { ok: true };
}
