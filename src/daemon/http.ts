import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ThreadListStatus, WorkspaceInfo } from "../core/types.js";

export function json(
  response: http.ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body, null, 2));
}

export function text(
  response: http.ServerResponse,
  status: number,
  body: string
): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function serveStatic(
  url: URL,
  response: http.ServerResponse
): Promise<boolean> {
  const requestPath = decodeURIComponent(url.pathname);
  const relativePath =
    requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");

  for (const publicDir of publicDirCandidates()) {
    const candidate = path.resolve(publicDir, relativePath);
    const relative = path.relative(publicDir, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;

    if (await pathExists(candidate)) {
      response.writeHead(200, { "content-type": contentType(candidate) });
      response.end(await fs.readFile(candidate));
      return true;
    }

    const indexPath = path.join(publicDir, "index.html");
    if (!requestPath.startsWith("/api/") && (await pathExists(indexPath))) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(await fs.readFile(indexPath));
      return true;
    }
  }

  return false;
}

export async function readBody(
  request: http.IncomingMessage
): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function authorized(
  request: http.IncomingMessage,
  url: URL,
  token: string
): boolean {
  const auth = request.headers.authorization;
  return (
    auth === `Bearer ${token}` ||
    request.headers["x-marc-token"] === token ||
    url.searchParams.get("token") === token
  );
}

export function isWorkspaceInfo(value: unknown): value is WorkspaceInfo {
  const candidate = value as Partial<WorkspaceInfo>;
  return Boolean(
    candidate?.id && candidate.name && candidate.rootPath && candidate.marcPath
  );
}

export function threadListStatus(value: string | null): ThreadListStatus {
  return value === "closed" || value === "all" ? value : "open";
}

export function isIgnorableWorkspaceChange(
  filename: string | Buffer | null
): boolean {
  if (!filename) return false;
  const normalized = filename.toString().replaceAll("\\", "/");
  return normalized === "cache" || normalized.startsWith("cache/");
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function publicDirCandidates(): string[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(moduleDir, "..", "public")
  ];
}
