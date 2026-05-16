import fs from "node:fs/promises";
import path from "node:path";
import type { WorkspaceInfo } from "../core/types.js";

type RegistryFile = {
  workspaces: WorkspaceInfo[];
};

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...values: unknown[]): unknown;
  };
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function tryOpenSqlite(dbPath: string): Promise<SqliteDb | undefined> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
    const sqlite = await dynamicImport("node:sqlite");
    const DatabaseSync = sqlite.DatabaseSync;
    if (!DatabaseSync) return undefined;
    return new DatabaseSync(dbPath) as SqliteDb;
  } catch {
    return undefined;
  }
}

function migrateSqlite(db: SqliteDb): void {
  const legacyName = ["ma", "irc"].join("");
  const legacyPathColumn = `${legacyName}_path`;

  try {
    db.exec(`ALTER TABLE workspaces RENAME COLUMN ${legacyPathColumn} TO marc_path`);
  } catch {
    // Fresh databases already use marc_path.
  }

  db.exec(`
    UPDATE workspaces
    SET
      id = replace(id, '${legacyName}', 'marc'),
      name = replace(name, '${legacyName}', 'marc'),
      root_path = replace(root_path, '${legacyName}', 'marc'),
      marc_path = replace(marc_path, '${legacyName}', 'marc')
  `);
}

function canonicalWorkspacePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

function sameWorkspacePath(left: WorkspaceInfo, right: WorkspaceInfo): boolean {
  return (
    canonicalWorkspacePath(left.rootPath) === canonicalWorkspacePath(right.rootPath) ||
    canonicalWorkspacePath(left.marcPath) === canonicalWorkspacePath(right.marcPath)
  );
}

export class DaemonStore {
  private readonly registryPath: string;
  private sqlite?: SqliteDb;

  private constructor(private readonly dataDir: string) {
    this.registryPath = path.join(dataDir, "registry.json");
  }

  static async open(dataDir: string): Promise<DaemonStore> {
    await fs.mkdir(dataDir, { recursive: true });
    const store = new DaemonStore(dataDir);
    store.sqlite = await tryOpenSqlite(path.join(dataDir, "marc.sqlite"));
    store.sqlite?.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        marc_path TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    if (store.sqlite) {
      migrateSqlite(store.sqlite);
    }
    return store;
  }

  sqliteAvailable(): boolean {
    return Boolean(this.sqlite);
  }

  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    return (await this.readRegistry()).workspaces.sort((a, b) => a.name.localeCompare(b.name));
  }

  async upsertWorkspace(workspace: WorkspaceInfo): Promise<WorkspaceInfo> {
    const registry = await this.readRegistry();
    const duplicateIds = registry.workspaces
      .filter((item) => item.id !== workspace.id && sameWorkspacePath(item, workspace))
      .map((item) => item.id);
    registry.workspaces = registry.workspaces.filter((item) => item.id === workspace.id || !sameWorkspacePath(item, workspace));
    const index = registry.workspaces.findIndex((item) => item.id === workspace.id);
    if (index >= 0) {
      registry.workspaces[index] = workspace;
    } else {
      registry.workspaces.push(workspace);
    }
    await this.writeRegistry(registry);
    for (const duplicateId of duplicateIds) {
      this.sqlite?.prepare("DELETE FROM workspaces WHERE id = ?").run(duplicateId);
    }

    this.sqlite
      ?.prepare(
        `INSERT INTO workspaces (id, name, root_path, marc_path, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           root_path = excluded.root_path,
           marc_path = excluded.marc_path,
           updated_at = excluded.updated_at`,
      )
      .run(workspace.id, workspace.name, workspace.rootPath, workspace.marcPath, new Date().toISOString());

    return workspace;
  }

  async getWorkspace(id: string): Promise<WorkspaceInfo | undefined> {
    return (await this.readRegistry()).workspaces.find((workspace) => workspace.id === id);
  }

  async removeWorkspace(id: string): Promise<WorkspaceInfo | undefined> {
    const registry = await this.readRegistry();
    const workspace = registry.workspaces.find((item) => item.id === id);
    if (!workspace) {
      return undefined;
    }

    registry.workspaces = registry.workspaces.filter((item) => item.id !== id);
    await this.writeRegistry(registry);
    this.sqlite?.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    return workspace;
  }

  private async readRegistry(): Promise<RegistryFile> {
    if (!(await exists(this.registryPath))) {
      return { workspaces: [] };
    }
    const raw = await fs.readFile(this.registryPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<RegistryFile>;
    return { workspaces: parsed.workspaces ?? [] };
  }

  private async writeRegistry(registry: RegistryFile): Promise<void> {
    await fs.writeFile(this.registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  }
}
