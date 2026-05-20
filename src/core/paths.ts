import path from "node:path";

export function resolveWorkspace(input?: string): string {
  return path.resolve(input ?? process.cwd());
}

export function marcDir(workspaceRoot: string): string {
  return path.join(resolveWorkspace(workspaceRoot), ".marc");
}

export function assertInside(parent: string, candidate: string): string {
  const parentResolved = path.resolve(parent);
  const candidateResolved = path.resolve(candidate);
  const relative = path.relative(parentResolved, candidateResolved);

  if (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  ) {
    return candidateResolved;
  }

  throw new Error(`Path escapes allowed root: ${candidate}`);
}

export function safeJoin(parent: string, ...segments: string[]): string {
  return assertInside(parent, path.join(parent, ...segments));
}
