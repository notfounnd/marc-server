import fs from "node:fs/promises";
import path from "node:path";
import { safeJoin } from "../paths.js";
import type { WorkspaceInfo } from "../types.js";
import {
  E5_MODEL_FILE,
  E5_MODEL_ID,
  LFM_INTERPRETER_MODEL_DATA_FILE,
  LFM_INTERPRETER_MODEL_FILE,
  LFM_INTERPRETER_MODEL_ID,
  MMARCO_MODEL_ID,
  MMARCO_RERANKER_MODEL_FILE,
  isLocalMemoryModelPrepared,
  localModelCachePath
} from "./model-config.js";
import type { MemoryInferenceRole } from "./model-config.js";
import { LanceDbMemoryVectorStore } from "./store.js";
import type {
  MemoryInferenceModelRole,
  MemoryMaintenance,
  MemoryModelInventoryItem,
  MemoryPurgeResult,
  MemoryVectorStore
} from "./types.js";

type ManagedModelContract = {
  cachePath: string;
  inferenceRole: MemoryInferenceRole;
  model: string;
  role: MemoryInferenceModelRole;
  selectedOnnxFiles: string[];
  variant: string;
};

type ManagedFile = {
  bytes: number;
  path: string;
};

export async function readMemoryMaintenance(
  info: WorkspaceInfo
): Promise<MemoryMaintenance> {
  const contracts = modelContracts(info);
  const modelRoot = memoryModelRoot(info);
  const directories = await fs
    .readdir(modelRoot, { withFileTypes: true })
    .catch(() => []);
  const models = await Promise.all(
    directories
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        modelInventoryItem(info, contracts, modelRoot, entry.name)
      )
  );
  const recoverable = await recoverableModelFiles(info, contracts);
  return {
    models,
    recoverableBytes: sumBytes(recoverable),
    usedBytes: models.reduce((total, model) => total + model.bytes, 0)
  };
}

export async function purgeUnusedMemory(
  info: WorkspaceInfo,
  activeGeneration: string | undefined,
  store: MemoryVectorStore = new LanceDbMemoryVectorStore()
): Promise<MemoryPurgeResult> {
  const contracts = modelContracts(info);
  const recoverable = await recoverableModelFiles(info, contracts);
  const modelsRemoved = inactiveModelNames(recoverable, contracts);
  for (const file of recoverable) await fs.rm(file.path, { force: true });
  await removeEmptyModelDirectories(info);
  const storeResult = store.purgeUnused
    ? await store.purgeUnused(info, activeGeneration)
    : { bytesRemoved: 0, generationsRemoved: [], oldVersionsRemoved: 0 };
  return {
    bytesRemoved: sumBytes(recoverable) + storeResult.bytesRemoved,
    filesRemoved: recoverable.length,
    generationsRemoved: storeResult.generationsRemoved,
    modelsRemoved,
    oldVersionsRemoved: storeResult.oldVersionsRemoved
  };
}

function modelContracts(info: WorkspaceInfo): ManagedModelContract[] {
  return [
    {
      cachePath: localModelCachePath(info, "embedding"),
      inferenceRole: "embedding",
      model: E5_MODEL_ID,
      role: "retriever",
      selectedOnnxFiles: [E5_MODEL_FILE],
      variant: "int8"
    },
    {
      cachePath: localModelCachePath(info, "reranking"),
      inferenceRole: "reranking",
      model: MMARCO_MODEL_ID,
      role: "reranker",
      selectedOnnxFiles: [MMARCO_RERANKER_MODEL_FILE],
      variant: "O4"
    },
    {
      cachePath: localModelCachePath(info, "interpretation"),
      inferenceRole: "interpretation",
      model: LFM_INTERPRETER_MODEL_ID,
      role: "interpreter",
      selectedOnnxFiles: [
        LFM_INTERPRETER_MODEL_FILE,
        LFM_INTERPRETER_MODEL_DATA_FILE
      ],
      variant: "q4"
    }
  ];
}

async function modelInventoryItem(
  info: WorkspaceInfo,
  contracts: ManagedModelContract[],
  modelRoot: string,
  directoryName: string
): Promise<MemoryModelInventoryItem> {
  const cachePath = safeJoin(modelRoot, directoryName);
  const contract = contracts.find((item) => item.cachePath === cachePath);
  if (!contract) {
    return {
      active: false,
      bytes: sumBytes(await listFiles(cachePath)),
      model: directoryName.replaceAll("--", "/"),
      prepared: false,
      role: "unused",
      variant: "unused"
    };
  }
  return {
    active: true,
    bytes: sumBytes(await listFiles(cachePath)),
    model: contract.model,
    prepared: await isLocalMemoryModelPrepared(info, contract.inferenceRole),
    role: contract.role,
    variant: contract.variant
  };
}

async function recoverableModelFiles(
  info: WorkspaceInfo,
  contracts: ManagedModelContract[]
): Promise<ManagedFile[]> {
  const root = memoryModelRoot(info);
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  const activePaths = new Set(contracts.map((contract) => contract.cachePath));
  const selectedByPath = new Map(
    contracts.map((contract) => [
      contract.cachePath,
      new Set(contract.selectedOnnxFiles)
    ])
  );
  const recoverable: ManagedFile[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const cachePath = safeJoin(root, entry.name);
    const files = await listFiles(cachePath);
    if (!activePaths.has(cachePath)) {
      recoverable.push(...files);
      continue;
    }
    const selected = selectedByPath.get(cachePath) ?? new Set<string>();
    recoverable.push(
      ...files.filter(
        (file) =>
          isOnnxArtifact(file.path) &&
          !selected.has(normalizedPath(file.path).split("/onnx/")[1] ?? "")
      )
    );
  }
  return recoverable;
}

function inactiveModelNames(
  files: ManagedFile[],
  contracts: ManagedModelContract[]
): string[] {
  const activePaths = contracts.map((contract) =>
    normalizedPath(contract.cachePath)
  );
  return [
    ...new Set(
      files.flatMap((file) => {
        const normalized = normalizedPath(file.path);
        if (activePaths.some((active) => normalized.startsWith(`${active}/`)))
          return [];
        const relative = normalized.split("/memory-models/")[1]?.split("/")[0];
        return relative ? [relative.replaceAll("--", "/")] : [];
      })
    )
  ];
}

async function listFiles(root: string): Promise<ManagedFile[]> {
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  const files: ManagedFile[] = [];
  for (const entry of entries) {
    const entryPath = safeJoin(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(entryPath);
    files.push({ bytes: stat.size, path: entryPath });
  }
  return files;
}

async function removeEmptyModelDirectories(info: WorkspaceInfo): Promise<void> {
  const root = memoryModelRoot(info);
  const directories = await listDirectories(root);
  const deepestFirst = directories.sort(
    (left, right) => right.length - left.length
  );
  for (const directory of deepestFirst) {
    const entries = await fs.readdir(directory).catch(() => []);
    if (entries.length) continue;
    await fs.rmdir(directory).catch(() => undefined);
  }
}

async function listDirectories(root: string): Promise<string[]> {
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  const directories: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryPath = safeJoin(root, entry.name);
    directories.push(entryPath, ...(await listDirectories(entryPath)));
  }
  return directories;
}

function memoryModelRoot(info: WorkspaceInfo): string {
  return safeJoin(info.marcPath, "cache", "memory-models");
}

function isOnnxArtifact(filePath: string): boolean {
  const normalized = normalizedPath(filePath);
  return normalized.includes("/onnx/") && normalized.includes(".onnx");
}

function normalizedPath(filePath: string): string {
  return path.resolve(filePath).replaceAll("\\", "/");
}

function sumBytes(files: ManagedFile[]): number {
  return files.reduce((total, file) => total + file.bytes, 0);
}
