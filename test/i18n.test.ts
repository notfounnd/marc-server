import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { activeLocale, loadTranslations, t } from "../src/i18n/index.js";

test("uses en_US as the default active locale", () => {
  assert.equal(activeLocale, "en_US");
});

test("resolves product text from the flat en_US catalog", () => {
  assert.equal(t("Cancel"), "Cancel");
});

test("interpolates i18next-style variables", () => {
  assert.equal(t("Synced {{time}}", { time: "10:30:00" }), "Synced 10:30:00");
});

test("falls back to the key for missing product text", () => {
  assert.equal(t("Missing product text"), "Missing product text");
});

test("keeps translation catalog flat and free of array values", () => {
  const translations = loadTranslations();
  for (const [key, value] of Object.entries(translations)) {
    assert.equal(typeof value, "string", `${key} must map to a string`);
    assert.equal(
      Array.isArray(value),
      false,
      `${key} must not map to an array`
    );
  }
});

test("keeps i18n usage scoped to the web UI", () => {
  const root = process.cwd();
  const allowed = [
    path.join("src", "i18n", "index.ts"),
    path.join("src", "ui", "app.tsx"),
    path.join("src", "ui", "app-content.tsx"),
    path.join("src", "ui", "app-sidebar.tsx"),
    path.join("src", "ui", "composer.tsx"),
    path.join("src", "ui", "content-header.tsx"),
    path.join("src", "ui", "content-header-actions.tsx"),
    path.join("src", "ui", "i18n.ts"),
    path.join("src", "ui", "main.tsx"),
    path.join("src", "ui", "modals.tsx"),
    path.join("src", "ui", "thread-view.tsx"),
    path.join("src", "ui", "workspace-settings-modal.tsx"),
    path.join("src", "ui", "workspace-overview.tsx"),
    path.join("test", "i18n.test.ts")
  ];
  const violations: string[] = [];

  for (const file of walk(path.join(root, "src")).concat(
    walk(path.join(root, "test"))
  )) {
    const relative = path.relative(root, file);
    if (allowed.includes(relative)) continue;
    const content = fs.readFileSync(file, "utf8");
    if (
      /\bi18next\b|react-i18next|from ["'][^"']*i18n|import ["'][^"']*i18n/.test(
        content
      )
    ) {
      violations.push(relative);
    }
  }

  assert.deepEqual(violations, []);
});

test("keeps backend, MCP, CLI, and workspace contract strings out of the UI catalog", () => {
  const translations = loadTranslations();
  const forbiddenPatterns = [
    /workspace_bootstrap/,
    /agent_register/,
    /thread_read/,
    /MCP/,
    /daemon registry/,
    /Markdown artifact file name must not include folders/,
    /Invalid workspace payload/,
    /Usage:\n {2}marc daemon/
  ];
  const violations = Object.keys(translations).filter((key) =>
    forbiddenPatterns.some((pattern) => pattern.test(key))
  );

  assert.deepEqual(violations, []);
});

function walk(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}
