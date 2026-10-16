import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { createServer } from "vite";
import type { AppContentProps } from "../src/ui/app-content-types.js";

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string };
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const viteConfigPath = fileURLToPath(
  new URL("../vite.config.ts", import.meta.url)
);

test("renders the package version after the developer credit and before shortcuts", async () => {
  const vite = await createServer({
    appType: "custom",
    configFile: viteConfigPath,
    logLevel: "silent",
    root: projectRoot,
    server: { middlewareMode: true }
  });

  try {
    const { AppContent } = (await vite.ssrLoadModule(
      "/src/ui/app-content.tsx"
    )) as {
      AppContent: React.ComponentType<AppContentProps>;
    };
    const props: AppContentProps = {
      statusKind: "idle",
      selectedThreadArtifacts: [],
      showArtifactMenu: false,
      showWorkspaceSettings: false,
      uiAgentId: "",
      composerBody: "",
      agents: [],
      allWorkspaceThreads: [],
      sending: false,
      rules: "",
      onShowArtifactMenuChange: () => undefined,
      onShowWorkspaceSettingsChange: () => undefined,
      onCopyReference: () => undefined,
      onOpenLink: () => undefined,
      onAttachArtifact: () => undefined,
      onAgentIdChange: () => undefined,
      onBodyChange: () => undefined,
      onSendMessage: () => undefined,
      onLoadThreadMessages: async () => [],
      onShowShortcuts: () => undefined
    };
    const i18n = createInstance();
    await i18n.init({
      fallbackLng: false,
      lng: "en_US",
      resources: {
        en_US: {
          translation: JSON.parse(
            readFileSync(
              new URL(
                "../public/locales/en_US/translation.json",
                import.meta.url
              ),
              "utf8"
            )
          ) as Record<string, string>
        }
      }
    });
    const html = renderToStaticMarkup(
      React.createElement(
        I18nextProvider,
        { i18n },
        React.createElement(AppContent, props)
      )
    );
    const footer = html.slice(
      html.indexOf('<footer class="content-footer">'),
      html.indexOf("</footer>") + "</footer>".length
    );
    const versionMarkup = `<span class="content-footer-version">v${packageMetadata.version}</span>`;
    const creditPosition = footer.indexOf("Developed by Júnior Sbrissa");
    const versionPosition = footer.indexOf(versionMarkup);
    const shortcutsPosition = footer.indexOf('class="content-footer-link"');

    assert.ok(footer.includes(versionMarkup));
    assert.ok(creditPosition >= 0);
    assert.ok(creditPosition < versionPosition);
    assert.ok(versionPosition < shortcutsPosition);
  } finally {
    await vite.close();
  }
});
