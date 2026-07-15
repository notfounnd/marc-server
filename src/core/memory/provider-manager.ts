import path from "node:path";
import type { WorkspaceInfo } from "../types.js";
import type { EmbeddingProvider } from "./types.js";

export const MEMORY_PROVIDER_IDLE_TIMEOUT_MS = 30_000;

type ProviderFactory = (info: WorkspaceInfo) => EmbeddingProvider;

type ProviderSlot = {
  provider: EmbeddingProvider;
  activeOperations: number;
  queue: Promise<void>;
  closed: boolean;
  disposeTimer?: NodeJS.Timeout;
};

export class MemoryProviderManager {
  private readonly slots = new Map<string, ProviderSlot>();

  constructor(
    private readonly createProvider: ProviderFactory,
    private readonly idleTimeoutMs = MEMORY_PROVIDER_IDLE_TIMEOUT_MS
  ) {}

  async run<Result>(
    info: WorkspaceInfo,
    operation: (provider: EmbeddingProvider) => Promise<Result>
  ): Promise<Result> {
    const key = workspaceKey(info);
    const slot = this.slotFor(info, key);
    slot.activeOperations += 1;
    const releaseQueue = await this.waitForTurn(slot);
    try {
      return await operation(slot.provider);
    } finally {
      releaseQueue();
      slot.activeOperations -= 1;
      this.scheduleDisposal(key, slot);
    }
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

  private slotFor(info: WorkspaceInfo, key: string): ProviderSlot {
    const existing = this.slots.get(key);
    if (existing) {
      this.cancelDisposal(existing);
      return existing;
    }

    const slot: ProviderSlot = {
      provider: this.createProvider(info),
      activeOperations: 0,
      queue: Promise.resolve(),
      closed: false
    };
    this.slots.set(key, slot);
    return slot;
  }

  private async waitForTurn(slot: ProviderSlot): Promise<() => void> {
    const previous = slot.queue;
    let release: () => void = () => undefined;
    slot.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }

  private scheduleDisposal(key: string, slot: ProviderSlot): void {
    if (slot.closed) return;
    if (slot.activeOperations > 0) return;
    this.cancelDisposal(slot);
    const timer = setTimeout(() => {
      void this.disposeIdleSlot(key, slot).catch(() => undefined);
    }, this.idleTimeoutMs);
    timer.unref();
    slot.disposeTimer = timer;
  }

  private cancelDisposal(slot: ProviderSlot): void {
    if (!slot.disposeTimer) return;
    clearTimeout(slot.disposeTimer);
    slot.disposeTimer = undefined;
  }

  private async disposeSlot(slot: ProviderSlot): Promise<void> {
    await slot.queue;
    await slot.provider.dispose();
  }

  private async disposeIdleSlot(
    key: string,
    slot: ProviderSlot
  ): Promise<void> {
    if (slot.closed) return;
    if (slot.activeOperations > 0) return;
    if (this.slots.get(key) !== slot) return;
    slot.closed = true;
    slot.disposeTimer = undefined;
    this.slots.delete(key);
    await slot.provider.dispose();
  }
}

function workspaceKey(info: WorkspaceInfo): string {
  const rootPath = path.resolve(info.rootPath);
  if (process.platform !== "win32") return rootPath;
  return rootPath.toLowerCase();
}
