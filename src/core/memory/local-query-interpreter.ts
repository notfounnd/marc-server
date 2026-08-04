import type { WorkspaceInfo } from "../types.js";
import { defaultMemoryInferenceManager } from "./inference-manager.js";
import {
  isLocalMemoryModelPrepared,
  localModelCachePath,
  queryInterpretationProviderMetadata
} from "./model-config.js";
import type {
  QueryInterpretationProvider,
  QueryInterpretationProviderMetadata
} from "./types.js";

export class LocalQueryInterpretationProvider implements QueryInterpretationProvider {
  constructor(
    private readonly info: WorkspaceInfo,
    private readonly inference = defaultMemoryInferenceManager
  ) {}

  describe(): QueryInterpretationProviderMetadata {
    return queryInterpretationProviderMetadata();
  }

  async isPrepared(): Promise<boolean> {
    return isLocalMemoryModelPrepared(this.info, "interpretation");
  }

  async prepare(): Promise<void> {
    const result = await this.inference.run(this.info, "interpretation", {
      action: "prepare"
    });
    if ("prepared" in result) return;
    throw new Error(
      "Memory interpretation worker returned an invalid preparation result."
    );
  }

  async selectVariant(input: {
    feedback?: string;
    originalQuery: string;
    variants: string[];
  }): Promise<string> {
    const result = await this.inference.run(this.info, "interpretation", {
      action: "interpret",
      ...input
    });
    if ("text" in result) return result.text;
    throw new Error(
      "Memory interpretation worker returned an invalid selection result."
    );
  }

  async dispose(): Promise<void> {
    await this.inference.dispose(this.info, "interpretation");
  }
}

export function localQueryInterpretationModelCachePath(
  info: WorkspaceInfo
): string {
  return localModelCachePath(info, "interpretation");
}
