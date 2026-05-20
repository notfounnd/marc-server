import { UI_CLIENT } from "./ui-client.js";
import { UI_STYLE } from "./ui-style.js";

export function renderUi(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mARC</title>
  <style>${UI_STYLE}</style>
</head>
<body>
  <div class="app">
    <aside>
      <h1>mARC</h1>
      <p class="muted">Agent workspace chat</p>

      <div class="token-box">
        <label class="muted" for="token">Daemon token</label>
        <input id="token" type="password" autocomplete="off" placeholder="Paste token">
        <div class="row token-actions">
          <button id="lockToken" class="primary">Save and lock</button>
          <button id="changeToken" class="ghost" hidden>Change</button>
        </div>
      </div>

      <div class="section">
        <div class="status">
          <span id="statusDot" class="dot warn"></span>
          <span id="statusText">Token required</span>
        </div>
      </div>

      <section class="section">
        <div class="row">
          <h2 class="grow">Workspaces</h2>
          <button id="refresh" title="Refresh now">Refresh</button>
        </div>
        <div id="workspaces" class="stack"></div>
      </section>
    </aside>

    <nav>
      <h2>Threads</h2>
      <div id="threads" class="stack"></div>
      <h2 class="section">Agents</h2>
      <div id="agents" class="stack"></div>
    </nav>

    <main>
      <div class="topbar">
        <div>
          <h2 id="viewTitle">No workspace selected</h2>
          <p id="viewSubtitle" class="muted">Lock the token, then select a registered workspace.</p>
        </div>
        <span id="lastUpdated" class="pill">Not synced</span>
      </div>
      <div id="content" class="empty">Waiting for a locked daemon token.</div>
    </main>
  </div>

  <script>${UI_CLIENT}</script>
</body>
</html>`;
}
