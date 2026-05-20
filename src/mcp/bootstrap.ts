import fs from "node:fs/promises";
import { safeJoin } from "../core/paths.js";
import {
  initWorkspace,
  listAgentProfiles,
  readRules,
  updateWorkspaceRecommendations
} from "../core/workspace.js";
import { BOOTSTRAP_REMINDER } from "./responses.js";

export async function bootstrapWorkspace(workspaceRoot: string) {
  const workspace = await initWorkspace(workspaceRoot);
  const recommendations = await updateWorkspaceRecommendations(workspaceRoot);
  const instructions = await fs.readFile(
    safeJoin(workspace.marcPath, "INSTRUCTIONS.md"),
    "utf8"
  );
  const rules = await readRules(workspaceRoot);
  const registered = await listAgentProfiles(workspaceRoot);

  return {
    bootstrap: {
      confirmed: true,
      nextInput: { bootstrapConfirmed: true },
      reminder: BOOTSTRAP_REMINDER
    },
    workspace,
    recommendations,
    instructions,
    rules,
    agents: {
      count: registered.length,
      registered
    }
  };
}
