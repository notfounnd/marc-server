import { fork, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { WorkspaceInfo } from "../types.js";
import type { MemoryInferenceRole } from "./model-config.js";
import type {
  MemoryInferenceEnvelope,
  MemoryInferenceRequest,
  MemoryInferenceResponse,
  MemoryInferenceResult
} from "./inference-protocol.js";

export const MEMORY_INFERENCE_IDLE_TIMEOUT_MS = 30_000;
export const MEMORY_INTERPRETATION_IDLE_TIMEOUT_MS = 300_000;

const defaultIdleTimeouts: Record<MemoryInferenceRole, number> = {
  embedding: MEMORY_INFERENCE_IDLE_TIMEOUT_MS,
  interpretation: MEMORY_INTERPRETATION_IDLE_TIMEOUT_MS,
  reranking: MEMORY_INFERENCE_IDLE_TIMEOUT_MS
};

export type MemoryInferenceClient = {
  request(request: MemoryInferenceRequest): Promise<MemoryInferenceResult>;
  dispose(): Promise<void>;
  processId?(): number | undefined;
};

export type MemoryInferenceWorkerDiagnostic = {
  processId?: number;
  role: MemoryInferenceRole;
};

type MemoryInferenceClientFactory = (
  info: WorkspaceInfo,
  role: MemoryInferenceRole
) => MemoryInferenceClient;

type MemoryInferenceIdleTimeoutPolicy =
  | number
  | ((role: MemoryInferenceRole) => number);

type MemoryInferenceSlot = {
  activeOperations: number;
  client: MemoryInferenceClient;
  closed: boolean;
  disposeTimer?: NodeJS.Timeout;
  queue: Promise<void>;
  role: MemoryInferenceRole;
};

export class MemoryInferenceManager {
  private readonly slots = new Map<string, MemoryInferenceSlot>();
  private readonly idleTimeoutMsForRole: (role: MemoryInferenceRole) => number;

  constructor(
    private readonly createClient: MemoryInferenceClientFactory = createChildMemoryInferenceClient,
    idleTimeoutPolicy: MemoryInferenceIdleTimeoutPolicy = defaultIdleTimeoutMs
  ) {
    this.idleTimeoutMsForRole =
      typeof idleTimeoutPolicy === "number"
        ? () => idleTimeoutPolicy
        : idleTimeoutPolicy;
  }

  async run(
    info: WorkspaceInfo,
    role: MemoryInferenceRole,
    request: MemoryInferenceRequest
  ): Promise<MemoryInferenceResult> {
    const key = workspaceRoleKey(info, role);
    const slot = this.slotFor(info, role, key);
    slot.activeOperations += 1;
    const releaseQueue = await this.waitForTurn(slot);

    try {
      return await slot.client.request(request);
    } finally {
      releaseQueue();
      slot.activeOperations -= 1;
      this.scheduleDisposal(key, slot);
    }
  }

  async dispose(info: WorkspaceInfo, role: MemoryInferenceRole): Promise<void> {
    const key = workspaceRoleKey(info, role);
    const slot = this.slots.get(key);
    if (!slot) return;
    slot.closed = true;
    this.cancelDisposal(slot);
    this.slots.delete(key);
    await this.disposeSlot(slot);
  }

  async disposeAll(): Promise<void> {
    const slots = [...this.slots.values()];
    this.slots.clear();
    slots.forEach((slot) => {
      slot.closed = true;
      this.cancelDisposal(slot);
    });
    await Promise.all(slots.map((slot) => this.disposeSlot(slot)));
  }

  activeWorkers(info: WorkspaceInfo): MemoryInferenceWorkerDiagnostic[] {
    return (["embedding", "interpretation", "reranking"] as const).flatMap(
      (role) => {
        const slot = this.slots.get(workspaceRoleKey(info, role));
        if (!slot || slot.closed) return [];
        return [{ processId: slot.client.processId?.(), role }];
      }
    );
  }

  private slotFor(
    info: WorkspaceInfo,
    role: MemoryInferenceRole,
    key: string
  ): MemoryInferenceSlot {
    const existing = this.slots.get(key);
    if (existing) {
      this.cancelDisposal(existing);
      return existing;
    }

    const slot: MemoryInferenceSlot = {
      activeOperations: 0,
      client: this.createClient(info, role),
      closed: false,
      queue: Promise.resolve(),
      role
    };
    this.slots.set(key, slot);
    return slot;
  }

  private async waitForTurn(slot: MemoryInferenceSlot): Promise<() => void> {
    const previous = slot.queue;
    let release: () => void = () => undefined;
    slot.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }

  private scheduleDisposal(key: string, slot: MemoryInferenceSlot): void {
    if (slot.closed) return;
    if (slot.activeOperations > 0) return;
    this.cancelDisposal(slot);
    const timer = setTimeout(() => {
      void this.disposeIdleSlot(key, slot).catch(() => undefined);
    }, this.idleTimeoutMsForRole(slot.role));
    timer.unref();
    slot.disposeTimer = timer;
  }

  private cancelDisposal(slot: MemoryInferenceSlot): void {
    if (!slot.disposeTimer) return;
    clearTimeout(slot.disposeTimer);
    slot.disposeTimer = undefined;
  }

  private async disposeSlot(slot: MemoryInferenceSlot): Promise<void> {
    await slot.queue;
    await slot.client.dispose();
  }

  private async disposeIdleSlot(
    key: string,
    slot: MemoryInferenceSlot
  ): Promise<void> {
    if (slot.closed) return;
    if (slot.activeOperations > 0) return;
    if (this.slots.get(key) !== slot) return;
    slot.closed = true;
    slot.disposeTimer = undefined;
    this.slots.delete(key);
    await this.disposeSlot(slot);
  }
}

class ChildMemoryInferenceClient implements MemoryInferenceClient {
  private child?: ChildProcess;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      reject(error: Error): void;
      resolve(result: MemoryInferenceResult): void;
    }
  >();

  constructor(
    private readonly info: WorkspaceInfo,
    private readonly role: MemoryInferenceRole
  ) {}

  async request(
    request: MemoryInferenceRequest
  ): Promise<MemoryInferenceResult> {
    const child = this.childProcess();
    const id = this.nextId;
    this.nextId += 1;
    const envelope: MemoryInferenceEnvelope = { id, role: this.role, request };

    return new Promise<MemoryInferenceResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      child.send(envelope, (error) => {
        if (!error) return;
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  async dispose(): Promise<void> {
    const child = this.child;
    this.child = undefined;
    this.rejectPending(new Error("Memory inference worker stopped."));
    if (!child) return;
    if (child.connected) child.disconnect();
    child.kill();
  }

  processId(): number | undefined {
    return this.child?.pid;
  }

  private childProcess(): ChildProcess {
    const existing = this.child;
    if (existing?.connected) return existing;

    const child = fork(memoryInferenceWorkerPath(), [], {
      cwd: this.info.rootPath,
      env: { ...process.env, MARC_WORKSPACE_PATH: this.info.marcPath },
      execArgv: process.execArgv,
      serialization: "advanced",
      stdio: ["ignore", "ignore", "ignore", "ipc"]
    });
    child.on("message", (message) => this.handleMessage(message));
    child.on("error", (error) => this.handleExit(error));
    child.on("exit", () =>
      this.handleExit(new Error("Memory inference worker exited."))
    );
    this.child = child;
    return child;
  }

  private handleMessage(message: unknown): void {
    if (!isMemoryInferenceResponse(message)) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (!message.ok) {
      pending.reject(new Error(message.error));
      return;
    }
    pending.resolve(message.result);
  }

  private handleExit(error: Error): void {
    this.child = undefined;
    this.rejectPending(error);
  }

  private rejectPending(error: Error): void {
    this.pending.forEach((pending) => pending.reject(error));
    this.pending.clear();
  }
}

function createChildMemoryInferenceClient(
  info: WorkspaceInfo,
  role: MemoryInferenceRole
): MemoryInferenceClient {
  return new ChildMemoryInferenceClient(info, role);
}

function memoryInferenceWorkerPath(): string {
  const compiled = fileURLToPath(
    new URL("./inference-worker.js", import.meta.url)
  );
  if (fs.existsSync(compiled)) return compiled;
  return fileURLToPath(new URL("./inference-worker.ts", import.meta.url));
}

function workspaceRoleKey(
  info: WorkspaceInfo,
  role: MemoryInferenceRole
): string {
  const rootPath = path.resolve(info.rootPath);
  const normalized =
    process.platform === "win32" ? rootPath.toLowerCase() : rootPath;
  return `${normalized}:${role}`;
}

function defaultIdleTimeoutMs(role: MemoryInferenceRole): number {
  return defaultIdleTimeouts[role];
}

function isMemoryInferenceResponse(
  value: unknown
): value is MemoryInferenceResponse {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "number") return false;
  if (value.ok === true && isRecord(value.result)) return true;
  if (value.ok === false && typeof value.error === "string") return true;
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const defaultMemoryInferenceManager = new MemoryInferenceManager();
