import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";
import type {
  CaptureFile,
  CapturedVectors
} from "../scripts/memory-eval/capture-types.js";
import { readVectors } from "../scripts/memory-eval/capture-vectors.js";
import {
  createFakes,
  dataset,
  fixtureThreadsRoot,
  readCaptureFile,
  runCapture,
  tempDirectory,
  THREAD_SETTINGS
} from "./memory-eval-capture-fixtures.js";
import { chatMessage, chatText } from "./memory-layers-fixtures.js";

/** The corpus of the E3 fixture: the settings thread holds a chat message about the rotation key. */
async function threadsWithChat(t: TestContext): Promise<string> {
  const threadsRoot = await fixtureThreadsRoot(t);
  const message = chatMessage("msg_settings_chat", "").replace(
    "body",
    "Decidimos guardar a chave de rotacao no cofre local, fora do JSON das settings."
  );
  await fs.writeFile(
    path.join(threadsRoot, THREAD_SETTINGS, "CHAT.md"),
    chatText([message])
  );
  return threadsRoot;
}

/**
 * An E3 capture of the three-layer fixture, with the vectors of its records and the corpus root that
 * it was captured from. The worksheet must read the same root, or the corpus digest refuses it.
 */
export async function e3WorksheetCapture(t: TestContext): Promise<{
  capture: CaptureFile;
  vectors: Map<string, number[]>;
  threadsRoot: string;
  captureDir: string;
}> {
  const threadsRoot = await threadsWithChat(t);
  const { result } = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    dataset,
    syntheticQueries: false
  });
  const capture = await readCaptureFile(result.captureDir);
  const vectors = await readVectors(
    result.captureDir,
    capture.vectors as CapturedVectors
  );
  return { capture, vectors, threadsRoot, captureDir: result.captureDir };
}
