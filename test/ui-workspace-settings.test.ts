import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("renders workspace settings from the workspace detail header", () => {
  const content = fs.readFileSync("src/ui/app-content.tsx", "utf8");
  const headerActions = fs.readFileSync(
    "src/ui/content-header-actions.tsx",
    "utf8"
  );
  assert.equal(
    fs.existsSync("src/ui/workspace-settings-modal.tsx"),
    true,
    "workspace settings must render from a sheet modal component"
  );
  const modal = fs.readFileSync("src/ui/workspace-settings-modal.tsx", "utf8");

  assert.match(content, /showWorkspaceSettings/);
  assert.match(content, /ContentHeader/);
  assert.match(headerActions, /Settings/);
  assert.doesNotMatch(headerActions, /WorkspaceSettingsPanel/);
  assert.match(headerActions, /title=\{t\("Workspace settings"\)\}/);
  assert.match(modal, /WorkspaceSettingsPanel/);
  assert.match(modal, /SheetContent/);
});

test("uses the shared copyable header identity for workspace, thread, and agent", () => {
  const header = fs.readFileSync("src/ui/content-header.tsx", "utf8");

  assert.match(header, /content-title-block/);
  assert.match(header, /copy-reference-button/);
  assert.match(header, /marc:\/\/\$\$\{selectedThread\.id\}/);
  assert.match(header, /marc:\/\/@\$\{selectedAgent\.id\}/);
  assert.match(header, /selectedWorkspace\.rootPath/);
  assert.match(header, /Copy workspace path/);
  assert.match(header, /Copy agent reference/);
});

test("workspace settings panel exposes memory controls", () => {
  const panel = fs.readFileSync("src/ui/workspace-settings-panel.tsx", "utf8");
  const css = fs.readFileSync("src/ui/styles/thread-content.css", "utf8");
  const overlayCss = fs.readFileSync("src/ui/styles/overlays.css", "utf8");
  const switchComponent = fs.readFileSync(
    "src/components/ui/switch.tsx",
    "utf8"
  );
  const sliderComponent = fs.readFileSync(
    "src/components/ui/slider.tsx",
    "utf8"
  );

  assert.match(panel, /Automatic memory rebuild/);
  assert.match(panel, /<Label>\s*\{t\("Memory status"\)\}/);
  assert.match(panel, /Embedding batch size/);
  assert.match(panel, /\{t\("Search"\)\}/);
  assert.match(panel, /Search depth/);
  assert.match(panel, /\{t\("Edge"\)\}/);
  assert.match(panel, /\{t\("Deep"\)\}/);
  assert.match(panel, /Prepare model/);
  assert.match(panel, /Incremental rebuild/);
  assert.match(panel, /Full rebuild/);
  assert.match(panel, /modelPrepared/);
  assert.match(panel, /autoRebuild/);
  assert.match(panel, /embeddingBatchSize/);
  assert.match(panel, /<Switch/);
  assert.match(panel, /<Slider/);
  assert.match(panel, /onValueCommit/);
  assert.match(panel, /<Label/);
  assert.doesNotMatch(panel, /type="checkbox"/);
  assert.match(css, /\.workspace-settings-panel/);
  assert.match(css, /\.workspace-settings-toggle-row/);
  assert.match(css, /\.workspace-settings-slider-legend/);
  assert.match(overlayCss, /scrollbar-gutter: stable/);
  assert.doesNotMatch(css, /--shadow-offset/);
  assert.match(switchComponent, /@radix-ui\/react-switch/);
  assert.match(switchComponent, /SwitchPrimitive\.Root/);
  assert.match(switchComponent, /appearance-none/);
  assert.match(switchComponent, /p-0/);
  assert.match(sliderComponent, /@radix-ui\/react-slider/);
  assert.match(sliderComponent, /SliderPrimitive\.Root/);
  assert.ok(panel.indexOf('{t("Search")}') < panel.indexOf('{t("Memory")}'));
  assert.ok(
    panel.indexOf("Automatic memory rebuild") < panel.indexOf("<Switch")
  );
});

test("refreshes while memory prepare or rebuild is running", () => {
  const hook = fs.readFileSync(
    "src/ui/use-workspace-memory-actions.ts",
    "utf8"
  );

  assert.match(hook, /selectedMemoryHealth\?\.preparing/);
  assert.match(hook, /selectedMemoryHealth\?\.rebuilding/);
  assert.match(hook, /window\.setTimeout/);
  assert.match(hook, /rebuildMemoryIndex: \(mode: "incremental" \| "full"\)/);
  assert.match(hook, /embeddingBatchSize/);
});
