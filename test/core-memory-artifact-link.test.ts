import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readArtifactSources } from "../src/core/memory/sources/artifact.js";
import type { MemorySource } from "../src/core/memory/sources/contract.js";
import { tempWorkspace, writeSummary } from "./memory-test-helpers.js";
import {
  chatMessage,
  chatText,
  summary,
  writeArtifact,
  writeFileAt
} from "./memory-layers-fixtures.js";

test("the first message that attaches an artifact fixes its message id, even when a later one attaches it too", async () => {
  // Scenario: m1 does not attach the file; m2 and m3 both attach it. The id is m2.
  const source = await artifactSourceWith([
    chatMessage("m1", "artifacts/other.md"),
    chatMessage("m2", "artifacts/plano.md"),
    chatMessage("m3", "artifacts/plano.md")
  ]);
  assert.equal(source.chunks[0]?.messageId, "m2");
});

test("an artifact that no message attaches has no message id", async () => {
  const source = await artifactSourceWith([
    chatMessage("m1", "artifacts/other.md")
  ]);
  assert.equal(source.chunks[0]?.messageId, undefined);
});

test("an artifact of a thread without CHAT.md has no message id", async () => {
  const info = await tempWorkspace();
  await writeSummary(info, "t1", summary("t1", "Brutalism summary"));
  await writeArtifact(info, "t1", "plano.md", "Plan text.");
  const source = artifactOf(await readArtifactSources(info), "plano.md");
  assert.equal(source.chunks[0]?.messageId, undefined);
});

test("changing the attaching message changes the source hash, and the same attachment keeps it", async () => {
  // Scenario: m1 attaches the file, is read twice, then m2 attaches it instead.
  const info = await tempWorkspace();
  await writeSummary(info, "t1", summary("t1", "Brutalism summary"));
  await writeArtifact(info, "t1", "plano.md", "Plan text.");
  await writeChat(info, [chatMessage("m1", "artifacts/plano.md")]);
  const first = artifactOf(await readArtifactSources(info), "plano.md");
  const again = artifactOf(await readArtifactSources(info), "plano.md");
  assert.equal(again.sha256, first.sha256);

  await writeChat(info, [chatMessage("m2", "artifacts/plano.md")]);
  const relinked = artifactOf(await readArtifactSources(info), "plano.md");
  assert.notEqual(relinked.sha256, first.sha256);
  assert.equal(relinked.chunks[0]?.messageId, "m2");
});

async function artifactSourceWith(messages: string[]): Promise<MemorySource> {
  const info = await tempWorkspace();
  await writeSummary(info, "t1", summary("t1", "Brutalism summary"));
  await writeArtifact(info, "t1", "plano.md", "Plan text.");
  await writeChat(info, messages);
  return artifactOf(await readArtifactSources(info), "plano.md");
}

function artifactOf(sources: MemorySource[], fileName: string): MemorySource {
  // The fixture always writes this artifact, so the lookup must succeed; a miss fails the
  // test on the first property access.
  return sources.find(
    (source) => path.basename(source.sourcePath) === fileName
  ) as MemorySource;
}

async function writeChat(
  info: Parameters<typeof writeArtifact>[0],
  messages: string[]
): Promise<void> {
  await writeFileAt(
    path.join(info.marcPath, "threads", "t1", "CHAT.md"),
    chatText(messages)
  );
}
