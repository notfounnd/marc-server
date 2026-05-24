import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
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

async function runCoreChild(script: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `Child process exited with code ${code}.`));
    });
  });
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

test("preserves concurrent message and artifact updates in one thread", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Concurrent transcript");
  const sourceMessage = await appendMessage(workspace, thread.id, {
    agentId: "ui-user",
    role: "user",
    body: "Attach concurrent decisions here."
  });
  const artifactCount = 20;
  const messageCount = 20;

  const artifacts = Array.from({ length: artifactCount }, (_, index) =>
    attachArtifactToMessage(
      workspace,
      thread.id,
      sourceMessage.id,
      `decision-${index}.md`,
      `# Decision ${index}`
    )
  );
  const messages = Array.from({ length: messageCount }, (_, index) =>
    appendMessage(workspace, thread.id, {
      agentId: "codex-dev",
      role: "developer",
      body: `Concurrent update ${index}.`
    })
  );

  const expectedArtifacts = await Promise.all(artifacts);
  await Promise.all(messages);

  const transcript = await readThread(workspace, thread.id);
  const linkedArtifacts = transcript.messages?.[0].artifacts ?? [];

  assert.equal(transcript.messageCount, messageCount + 1);
  assert.deepEqual(linkedArtifacts.sort(), expectedArtifacts.sort());
});

test("coordinates thread writers across Node processes", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Cross-process transcript");
  const sourceMessage = await appendMessage(workspace, thread.id, {
    agentId: "ui-user",
    role: "user",
    body: "Attach process-level decisions here."
  });
  const coreModule = pathToFileURL(
    path.resolve("src/core/workspace.ts")
  ).toString();
  const workspaceValue = JSON.stringify(workspace);
  const threadValue = JSON.stringify(thread.id);
  const messageValue = JSON.stringify(sourceMessage.id);
  const appendScript = [
    `import { appendMessage } from ${JSON.stringify(coreModule)};`,
    "await Promise.all(Array.from({ length: 10 }, (_, index) =>",
    `  appendMessage(${workspaceValue}, ${threadValue}, {`,
    '    agentId: "codex-dev", role: "developer",',
    "    body: `Process update ${index}.`",
    "  })",
    "));"
  ].join("\n");
  const artifactScript = [
    `import { attachArtifactToMessage } from ${JSON.stringify(coreModule)};`,
    "await Promise.all(Array.from({ length: 10 }, (_, index) =>",
    `  attachArtifactToMessage(${workspaceValue}, ${threadValue}, ${messageValue},`,
    "    `process-decision-${index}.md`, `# Process Decision ${index}`",
    "  )",
    "));"
  ].join("\n");

  await Promise.all([runCoreChild(appendScript), runCoreChild(artifactScript)]);

  const transcript = await readThread(workspace, thread.id);

  assert.equal(transcript.messageCount, 11);
  assert.equal(transcript.messages?.[0].artifacts.length, 10);
});
