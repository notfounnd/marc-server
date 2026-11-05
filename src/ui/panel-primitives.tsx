import * as React from "react";

/** The small uppercase label that heads a group of rows in a thread menu or an activation panel. */
export function PanelEyebrow({ children }: { children: React.ReactNode }) {
  return <span className="panel-eyebrow">{children}</span>;
}
