export type WorkspaceDocumentSource = {
  path: string;
  authority: "normative" | "reference";
};

/** activation.cyclesPerStage: the value in force, the file's value or the default when absent or invalid. */
/** listening.defaultOn: the workspace default for listening to a thread when a session starts on it. Off by default. */
export type WorkspaceSettings = {
  memory: {
    autoRebuild: boolean;
    embeddingBatchSize: number;
    documentSources: WorkspaceDocumentSource[];
  };
  activation: { cyclesPerStage: number };
  listening: { defaultOn: boolean };
};

export type WorkspaceSettingsInput = {
  memory?: { autoRebuild?: boolean; embeddingBatchSize?: number };
  activation?: { cyclesPerStage?: number };
  listening?: { defaultOn?: boolean };
};
