type MemoryCommandSteps = {
  run: () => Promise<unknown>;
  print: (result: unknown) => void;
  dispose: () => Promise<void>;
};

/** A one-shot command releases its workers, whose IPC channels would keep this process alive. */
export async function runMemoryCommand(
  steps: MemoryCommandSteps
): Promise<void> {
  try {
    steps.print(await steps.run());
  } finally {
    await steps.dispose();
  }
}
