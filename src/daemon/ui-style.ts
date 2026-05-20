export const UI_STYLE = `
:root {
  color-scheme: light;
  --bg: #f3f0e8;
  --rail: #e8e1d4;
  --panel: #fffdf8;
  --panel-strong: #f8f4ea;
  --text: #1f2933;
  --muted: #657284;
  --line: #d6cdbd;
  --line-strong: #b9ad98;
  --accent: #0f766e;
  --accent-ink: #ffffff;
  --warn: #a16207;
  --danger: #b42318;
  --ok: #087443;
  --control: #ffffff;
  --control-border: #bdb3a3;
  --focus: #0f766e;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); }
button, input { font: inherit; }
button {
  border: 1px solid var(--control-border);
  background: var(--control);
  color: var(--text);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
}
button:hover { border-color: var(--focus); }
button.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
button.ghost { background: transparent; }
input {
  width: 100%;
  border: 1px solid var(--control-border);
  border-radius: 6px;
  padding: 9px 10px;
  background: var(--control);
  color: var(--text);
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #f7f4ee;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 12px;
}
.app { min-height: 100vh; display: grid; grid-template-columns: 280px 320px 1fr; }
aside, nav { padding: 18px; border-right: 1px solid var(--line); background: var(--rail); }
main { padding: 24px; min-width: 0; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: 24px; }
h2 { font-size: 16px; }
h3 { font-size: 14px; }
.muted { color: var(--muted); }
.section { margin-top: 20px; }
.row { display: flex; align-items: center; gap: 8px; }
.grow { flex: 1; }
.stack { display: grid; gap: 8px; margin-top: 10px; }
.token-box { display: grid; gap: 8px; margin-top: 18px; }
.token-actions { align-items: stretch; }
.status { display: flex; align-items: center; gap: 8px; }
.dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; background: var(--warn); }
.dot.ok { background: var(--ok); }
.dot.danger { background: var(--danger); }
.dot.warn { background: var(--warn); }
.item { text-align: left; width: 100%; display: block; }
.item.active { border-color: var(--accent); background: var(--panel); }
.path { margin-top: 4px; overflow-wrap: anywhere; }
.topbar { display: flex; align-items: start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--muted);
  background: var(--panel);
}
.empty {
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  padding: 16px;
  color: var(--muted);
  background: color-mix(in srgb, var(--panel), transparent 25%);
}
.message { border-bottom: 1px solid var(--line); padding: 14px 0; }
.message-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
@media (max-width: 1040px) {
  .app { grid-template-columns: 1fr; }
  aside, nav { border-right: 0; border-bottom: 1px solid var(--line); }
}
`;
