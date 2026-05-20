import { useTranslation } from "react-i18next";
import { MarkdownPanel } from "./markdown-panel.js";
import type { MarkdownLinkHandler } from "./types.js";

export function WorkspaceOverview({
  rules,
  onLink
}: {
  rules: string;
  onLink: MarkdownLinkHandler;
}) {
  const { t } = useTranslation();

  return (
    <div className="overview">
      <h3>{t("RULES.md")}</h3>
      <MarkdownPanel
        markdown={rules || t("No rules loaded yet.")}
        onLink={onLink}
      />
    </div>
  );
}
