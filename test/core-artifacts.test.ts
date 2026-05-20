import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendMessage,
  attachArtifact,
  attachArtifactToMessage,
  createThread,
  readMessageArtifact,
  readThread
} from "../src/core/workspace.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-core-"));
}

test("writes artifacts inside the thread folder only", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Review");
  const artifact = await attachArtifact(
    workspace,
    thread.id,
    "notes.md",
    "# Notes"
  );

  assert.equal(artifact, "artifacts/notes.md");
  assert.equal(
    await fs.readFile(
      path.join(
        workspace,
        ".marc",
        "threads",
        thread.id,
        "artifacts",
        "notes.md"
      ),
      "utf8"
    ),
    "# Notes"
  );
});

test("attaches markdown artifacts to an existing thread message", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Message artifact");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "ui-user",
    role: "user",
    body: "Initial UI note."
  });

  const relative = await attachArtifactToMessage(
    workspace,
    thread.id,
    message.id,
    "Detailed Decision",
    "# Detailed Decision"
  );
  const transcript = await readThread(workspace, thread.id, {
    includeMarkdown: true
  });

  assert.equal(relative, "artifacts/detailed-decision.md");
  assert.equal(
    transcript.messages?.[0].artifacts[0],
    "artifacts/detailed-decision.md"
  );
  assert.match(
    transcript.markdown ?? "",
    /artifacts: artifacts\/detailed-decision\.md/
  );
  assert.equal(
    await fs.readFile(
      path.join(
        workspace,
        ".marc",
        "threads",
        thread.id,
        "artifacts",
        "detailed-decision.md"
      ),
      "utf8"
    ),
    "# Detailed Decision"
  );
  const arbitraryRelative = await attachArtifactToMessage(
    workspace,
    thread.id,
    message.id,
    "notes.qualquercoisa",
    "Arbitrary suffix saved as markdown"
  );
  const multiDotRelative = await attachArtifactToMessage(
    workspace,
    thread.id,
    message.id,
    "diagram.export.jpg",
    "Multi-dot suffix saved as markdown"
  );
  const updatedTranscript = await readThread(workspace, thread.id);

  assert.equal(arbitraryRelative, "artifacts/notes.qualquercoisa.md");
  assert.equal(multiDotRelative, "artifacts/diagram.export.jpg.md");
  assert.deepEqual(updatedTranscript.messages?.[0].artifacts, [
    "artifacts/detailed-decision.md",
    "artifacts/notes.qualquercoisa.md",
    "artifacts/diagram.export.jpg.md"
  ]);

  const artifact = await readMessageArtifact(
    workspace,
    thread.id,
    message.id,
    "detailed-decision.md"
  );
  assert.deepEqual(artifact, {
    artifact: "artifacts/detailed-decision.md",
    content: "# Detailed Decision"
  });
  await assert.rejects(
    () => readMessageArtifact(workspace, thread.id, message.id, "missing.md"),
    /Artifact not linked to message/
  );
});
