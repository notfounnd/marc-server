import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { BackgroundThreadIndexReconciler, JsonThreadIndexStore, ThreadIndexReconciler } from "../src/core/thread-index.js";

const volumes = [100, 500, 1000, 5000, 10000];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function time(label, fn) {
  const start = performance.now();
  const result = await fn();
  return { label, ms: performance.now() - start, result };
}

function threadId(index) {
  return `thread-${String(index).padStart(5, "0")}`;
}

async function createFixture(count) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `marc-bench-${count}-`));
  const marc = path.join(root, ".marc");
  const threadsRoot = path.join(marc, "threads");
  await fs.mkdir(threadsRoot, { recursive: true });
  await fs.mkdir(path.join(marc, "cache"), { recursive: true });

  for (let index = 0; index < count; index += 1) {
    const id = threadId(index);
    const dir = path.join(threadsRoot, id);
    const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
    await fs.mkdir(path.join(dir, "artifacts"), { recursive: true });
    await fs.writeFile(path.join(dir, "CHAT.md"), `# Thread ${index}\n\nThread: \`${id}\`\nCreated: \`${createdAt}\`\n\n`);

    if (index % 4 === 0) {
      const closedAt = new Date(Date.UTC(2026, 1, 1, 0, 0, index)).toISOString();
      await fs.writeFile(path.join(dir, "SUMMARY.md"), `# Executive Summary\n\nThread: \`${id}\`\nClosed: \`${closedAt}\`\n\n- Done.\n`);
    }
  }

  return { root, marc, threadsRoot, indexPath: path.join(marc, "cache", "thread-index.json") };
}

async function scanThreads(threadsRoot) {
  const entries = await fs.readdir(threadsRoot, { withFileTypes: true });
  const threads = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(threadsRoot, entry.name);
    const chatPath = path.join(dir, "CHAT.md");
    const summaryPath = path.join(dir, "SUMMARY.md");
    const chat = await fs.readFile(chatPath, "utf8");
    const summaryExists = await exists(summaryPath);
    const summary = summaryExists ? await fs.readFile(summaryPath, "utf8") : "";

    threads.push({
      id: entry.name,
      title: /^#\s+(.+)$/m.exec(chat)?.[1] ?? entry.name,
      createdAt: /^Created:\s+`(.+)`$/m.exec(chat)?.[1] ?? "",
      status: summaryExists ? "closed" : "open",
      closedAt: summaryExists ? /^Closed:\s+`?([^`\n]+)`?$/m.exec(summary)?.[1] ?? "" : undefined,
    });
  }

  return threads;
}

async function rebuildIndex(threadsRoot, indexPath) {
  return (await new ThreadIndexReconciler(threadsRoot, new JsonThreadIndexStore(indexPath)).reconcile()).threads.length;
}

async function readWarmIndex(indexPath) {
  return JSON.parse(await fs.readFile(indexPath, "utf8")).threads.length;
}

async function backgroundRebuildWithStaleRead(threadsRoot, indexPath) {
  const reconciler = new BackgroundThreadIndexReconciler(threadsRoot, new JsonThreadIndexStore(indexPath));
  await reconciler.rebuild();
  const rebuild = rebuildIndex(threadsRoot, indexPath);
  const staleRead = await time("background rebuild stale read", () => reconciler.list({ status: "all" }));
  await rebuild;
  return staleRead.ms;
}

function printRows(rows) {
  const groups = Map.groupBy(rows, (row) => row.volume);
  const pivotVolume = Math.min(...rows.map((row) => row.volume));
  const pivotRows = rows.filter((row) => row.volume === pivotVolume);
  const pivotByScenario = new Map(pivotRows.map((row) => [row.scenario, row.ms]));

  for (const [volume, group] of groups) {
    const directBase = group.find((row) => row.scenario === "scan direct")?.ms;
    const displayRows = group.map((row) => ({
      ...row,
      directDelta: directBase && directBase > 0 ? ((row.ms - directBase) / directBase) * 100 : 0,
      scenarioPivot: pivotByScenario.get(row.scenario),
    }));
    const widths = {
      scenario: Math.max("scenario".length, ...displayRows.map((row) => row.scenario.length)),
      ms: Math.max("ms".length, ...displayRows.map((row) => row.ms.toFixed(2).length)),
      directDelta: Math.max(
        "vs direct".length,
        ...displayRows.map((row) => (row.scenario === "scan direct" ? "base" : formatDelta(row.directDelta)).length),
      ),
      pivotDelta: Math.max(
        `vs volume ${pivotVolume}`.length,
        ...displayRows.map((row) => (row.volume === pivotVolume ? "base" : formatPivotDelta(row.ms, row.scenarioPivot)).length),
      ),
    };

    console.log(`\nvolume: ${volume}`);
    console.log(
      `${"scenario".padEnd(widths.scenario)}  ${"ms".padStart(widths.ms)}  ${"vs direct".padStart(widths.directDelta)}  ${`vs volume ${pivotVolume}`.padStart(widths.pivotDelta)}`,
    );
    console.log(`${"-".repeat(widths.scenario)}  ${"-".repeat(widths.ms)}  ${"-".repeat(widths.directDelta)}  ${"-".repeat(widths.pivotDelta)}`);

    for (const row of displayRows) {
      const directDelta = row.scenario === "scan direct" ? "base" : formatDelta(row.directDelta);
      const pivotDelta = row.volume === pivotVolume ? "base" : formatPivotDelta(row.ms, row.scenarioPivot);
      console.log(
        `${row.scenario.padEnd(widths.scenario)}  ${row.ms.toFixed(2).padStart(widths.ms)}  ${directDelta.padStart(widths.directDelta)}  ${pivotDelta.padStart(widths.pivotDelta)}`,
      );
    }
  }
}

function formatDelta(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatPivotDelta(value, pivot) {
  if (!pivot || pivot <= 0) return "n/a";
  return formatDelta(((value - pivot) / pivot) * 100);
}

const rows = [];

for (const volume of volumes) {
  const fixture = await createFixture(volume);
  try {
    const direct = await time("scan direct", () => scanThreads(fixture.threadsRoot));
    rows.push({ volume, scenario: direct.label, ms: direct.ms });

    const cold = await time("json cold rebuild", () => rebuildIndex(fixture.threadsRoot, fixture.indexPath));
    rows.push({ volume, scenario: cold.label, ms: cold.ms });

    const warm = await time("json warm list", () => readWarmIndex(fixture.indexPath));
    rows.push({ volume, scenario: warm.label, ms: warm.ms });

    const staleRead = await backgroundRebuildWithStaleRead(fixture.threadsRoot, fixture.indexPath);
    rows.push({ volume, scenario: "background rebuild stale read", ms: staleRead });

    const rebuild10 = await time("json rebuild 10x", async () => {
      for (let index = 0; index < 10; index += 1) {
        await fs.rm(fixture.indexPath, { force: true });
        await rebuildIndex(fixture.threadsRoot, fixture.indexPath);
      }
    });
    rows.push({ volume, scenario: rebuild10.label, ms: rebuild10.ms });
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
}

printRows(rows);
