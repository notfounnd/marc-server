import { createHash } from "node:crypto";
import { realpath } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { WorkspaceInfo } from "../../types.js";

export type RegularFile = {
  path: string;
  bytes: Buffer;
  mtimeMs: number;
};

// Reads a regular file only when it is physically inside rootPath. The entry
// itself must not be a link, and no linked ancestor may move it out of the
// root. Missing, linked, escaping, and non-file entries yield undefined.
export async function readRegularFile(
  rootPath: string,
  filePath: string
): Promise<RegularFile | undefined> {
  const stats = await fs.lstat(filePath).catch(() => undefined);
  if (!stats?.isFile() || stats.isSymbolicLink()) return undefined;
  if (!(await isPhysicallyContained(rootPath, filePath))) return undefined;
  const bytes = await fs.readFile(filePath).catch(() => undefined);
  if (!bytes) return undefined;
  return { path: filePath, bytes, mtimeMs: stats.mtimeMs };
}

// realpath resolves every linked ancestor. The real path of the file must be
// inside the real root, and its relative path must equal the lexical one, so
// any link on the way is rejected. Windows reports each segment in canonical
// casing, so relative paths are compared case-insensitively on win32 only.
export async function isPhysicallyContained(
  rootPath: string,
  filePath: string
): Promise<boolean> {
  const realRoot = await realPath(rootPath);
  const realFile = await realPath(filePath);
  if (realRoot === undefined || realFile === undefined) return false;
  const physical = path.relative(realRoot, realFile);
  if (!isInsideRelative(physical)) return false;
  const lexical = path.relative(rootPath, filePath);
  return comparableRelative(physical) === comparableRelative(lexical);
}

function realPath(filePath: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    realpath.native(filePath, (error, resolved) =>
      resolve(error ? undefined : resolved)
    );
  });
}

function isInsideRelative(relativePath: string): boolean {
  if (path.isAbsolute(relativePath)) return false;
  return relativePath.split(path.sep)[0] !== "..";
}

function comparableRelative(relativePath: string): string {
  const slashed = relativePath.replaceAll("\\", "/");
  if (process.platform !== "win32") return slashed;
  return slashed.toLowerCase();
}

export function definedFiles(
  files: Array<RegularFile | undefined>
): RegularFile[] {
  return files.filter((file): file is RegularFile => file !== undefined);
}

export function rootRelativePath(
  info: WorkspaceInfo,
  filePath: string
): string {
  return path.relative(info.rootPath, filePath).replaceAll("\\", "/");
}

export function marcRelativePath(
  info: WorkspaceInfo,
  filePath: string
): string {
  return path.relative(info.marcPath, filePath).replaceAll("\\", "/");
}

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function sourceHash(markdown: string, title: string): string {
  return createHash("sha256")
    .update(markdown)
    .update("\0")
    .update(title)
    .digest("hex");
}
