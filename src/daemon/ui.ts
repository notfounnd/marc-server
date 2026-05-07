export function renderUi(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mARC</title>
  <style>
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
    button { border: 1px solid var(--control-border); background: var(--control); color: var(--text); border-radius: 6px; padding: 8px 10px; cursor: pointer; }
    button:hover { border-color: var(--line-strong); background: #faf7f0; }
    button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
    button.ghost { background: transparent; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    input { width: 100%; border: 1px solid var(--control-border); border-radius: 6px; padding: 9px 10px; background: var(--control); color: var(--text); }
    input:focus, button:focus { outline: 2px solid color-mix(in srgb, var(--focus), transparent 65%); outline-offset: 1px; }
    input:disabled { background: #eee8dc; color: var(--muted); }
    .app { min-height: 100vh; display: grid; grid-template-columns: 300px 360px minmax(0, 1fr); }
    aside, nav, main { min-width: 0; }
    aside { border-right: 1px solid var(--line); background: var(--rail); padding: 16px; }
    nav { border-right: 1px solid var(--line); background: #f8f5ee; padding: 16px; overflow: auto; }
    main { padding: 20px 24px; overflow: auto; }
    h1, h2, h3 { margin: 0; letter-spacing: 0; }
    h1 { font-size: 24px; line-height: 1.1; }
    h2 { font-size: 17px; margin-bottom: 10px; }
    h3 { font-size: 14px; margin-bottom: 5px; }
    .muted { color: var(--muted); font-size: 13px; }
    .section { margin-top: 18px; }
    .stack { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; gap: 8px; align-items: center; }
    .row > * { min-width: 0; }
    .grow { flex: 1; }
    .status { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 13px; min-height: 22px; }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--muted); flex: 0 0 auto; }
    .dot.ok { background: var(--ok); }
    .dot.warn { background: var(--warn); }
    .dot.danger { background: var(--danger); }
    .item { width: 100%; border: 1px solid var(--line); background: var(--panel); border-radius: 6px; padding: 10px; text-align: left; cursor: pointer; }
    .item.active { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
    .item .path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .token-box { margin-top: 16px; padding: 12px; border: 1px solid var(--line); background: var(--panel-strong); border-radius: 6px; }
    .token-actions { margin-top: 8px; }
    .pill { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; color: var(--muted); font-size: 12px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 14px; line-height: 1.5; }
    .message { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 14px; margin-bottom: 12px; }
    .message-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .empty { border: 1px dashed var(--line-strong); border-radius: 6px; padding: 16px; color: var(--muted); background: color-mix(in srgb, var(--panel), transparent 25%); }
    @media (max-width: 1040px) {
      .app { grid-template-columns: 1fr; }
      aside, nav { border-right: 0; border-bottom: 1px solid var(--line); }
    }
  </style>
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

  <script>
    const state = {
      token: localStorage.getItem("marcToken") || "",
      tokenLocked: localStorage.getItem("marcTokenLocked") === "true",
      workspaces: [],
      threads: [],
      agents: [],
      selectedWorkspace: null,
      selectedThread: null,
      selectedAgent: null,
      lastRenderedThreadKey: "",
      busy: false
    };

    const els = {
      token: document.querySelector("#token"),
      lockToken: document.querySelector("#lockToken"),
      changeToken: document.querySelector("#changeToken"),
      statusDot: document.querySelector("#statusDot"),
      statusText: document.querySelector("#statusText"),
      workspaces: document.querySelector("#workspaces"),
      threads: document.querySelector("#threads"),
      agents: document.querySelector("#agents"),
      content: document.querySelector("#content"),
      viewTitle: document.querySelector("#viewTitle"),
      viewSubtitle: document.querySelector("#viewSubtitle"),
      lastUpdated: document.querySelector("#lastUpdated"),
      refresh: document.querySelector("#refresh")
    };

    els.token.value = state.token;
    applyTokenState();

    els.lockToken.addEventListener("click", async () => {
      state.token = els.token.value.trim();
      if (!state.token) {
        setStatus("danger", "Paste the daemon token first");
        return;
      }
      state.tokenLocked = true;
      localStorage.setItem("marcToken", state.token);
      localStorage.setItem("marcTokenLocked", "true");
      applyTokenState();
      await refreshAll();
    });

    els.changeToken.addEventListener("click", () => {
      state.tokenLocked = false;
      localStorage.setItem("marcTokenLocked", "false");
      applyTokenState();
      setStatus("warn", "Token unlocked");
    });

    els.refresh.addEventListener("click", () => refreshAll());
    window.addEventListener("focus", () => refreshAll());

    function applyTokenState() {
      els.token.disabled = state.tokenLocked;
      els.lockToken.hidden = state.tokenLocked;
      els.changeToken.hidden = !state.tokenLocked;
      if (state.tokenLocked) {
        setStatus("warn", "Checking daemon");
      } else {
        setStatus("warn", "Token required");
      }
    }

    function setStatus(kind, text) {
      els.statusDot.className = "dot " + kind;
      els.statusText.textContent = text;
    }

    function markUpdated() {
      els.lastUpdated.textContent = "Synced " + new Date().toLocaleTimeString();
    }

    async function api(path) {
      if (!state.tokenLocked || !state.token) {
        throw new Error("Token is not locked");
      }
      const response = await fetch(path, { headers: { authorization: "Bearer " + state.token } });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function makeButton(label, detail, active, onClick) {
      const el = document.createElement("button");
      el.className = "item" + (active ? " active" : "");
      el.innerHTML = "<h3>" + escapeHtml(label) + "</h3>" + (detail ? "<div class='muted path'>" + escapeHtml(detail) + "</div>" : "");
      el.addEventListener("click", onClick);
      return el;
    }

    function sameJson(a, b) {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    async function refreshAll() {
      if (state.busy || !state.tokenLocked) return;
      state.busy = true;
      try {
        await api("/api/status");
        setStatus("ok", "Connected");
        await refreshWorkspaces();
        if (state.selectedWorkspace) {
          await refreshWorkspaceDetails();
        }
        if (state.selectedThread) {
          await refreshThread();
        }
        markUpdated();
      } catch (error) {
        setStatus("danger", error.message || String(error));
      } finally {
        state.busy = false;
      }
    }

    async function refreshWorkspaces() {
      const workspaces = await api("/api/workspaces");
      if (!sameJson(workspaces, state.workspaces)) {
        state.workspaces = workspaces;
        renderWorkspaces();
      }
      if (state.selectedWorkspace) {
        const current = workspaces.find(workspace => workspace.id === state.selectedWorkspace.id);
        if (current) {
          state.selectedWorkspace = current;
        } else {
          state.selectedWorkspace = null;
          state.selectedThread = null;
          state.selectedAgent = null;
          renderThreads();
          renderAgents();
          showEmpty("Workspace no longer registered", "Select another workspace.");
        }
      }
    }

    async function refreshWorkspaceDetails() {
      const id = encodeURIComponent(state.selectedWorkspace.id);
      const threads = await api("/api/workspaces/" + id + "/threads");
      const agents = await api("/api/workspaces/" + id + "/agents");
      if (!sameJson(threads, state.threads)) {
        state.threads = threads;
        renderThreads();
      }
      if (!sameJson(agents, state.agents)) {
        state.agents = agents;
        renderAgents();
      }
      if (!state.selectedThread && !state.selectedAgent) {
        const rules = await api("/api/workspaces/" + id + "/rules");
        showWorkspaceRules(rules.markdown);
      }
    }

    function renderWorkspaces() {
      els.workspaces.innerHTML = "";
      if (!state.workspaces.length) {
        els.workspaces.innerHTML = "<div class='empty'>No registered workspaces yet.</div>";
        return;
      }
      for (const workspace of state.workspaces) {
        els.workspaces.appendChild(makeButton(workspace.name, workspace.rootPath, state.selectedWorkspace?.id === workspace.id, () => selectWorkspace(workspace)));
      }
    }

    function renderThreads() {
      els.threads.innerHTML = "";
      if (!state.selectedWorkspace) {
        els.threads.innerHTML = "<div class='empty'>Select a workspace.</div>";
        return;
      }
      if (!state.threads.length) {
        els.threads.innerHTML = "<div class='empty'>No threads yet.</div>";
        return;
      }
      for (const thread of state.threads) {
        els.threads.appendChild(makeButton(thread.title, thread.id, state.selectedThread?.id === thread.id, () => selectThread(thread)));
      }
    }

    function renderAgents() {
      els.agents.innerHTML = "";
      if (!state.selectedWorkspace) {
        els.agents.innerHTML = "<div class='empty'>Select a workspace.</div>";
        return;
      }
      if (!state.agents.length) {
        els.agents.innerHTML = "<div class='empty'>No agents registered.</div>";
        return;
      }
      for (const agent of state.agents) {
        els.agents.appendChild(makeButton(agent.id, "", state.selectedAgent?.id === agent.id, () => showAgent(agent)));
      }
    }

    async function selectWorkspace(workspace) {
      state.selectedWorkspace = workspace;
      state.selectedThread = null;
      state.selectedAgent = null;
      state.lastRenderedThreadKey = "";
      renderWorkspaces();
      await refreshWorkspaceDetails();
    }

    async function selectThread(thread) {
      state.selectedThread = thread;
      state.selectedAgent = null;
      state.lastRenderedThreadKey = "";
      renderThreads();
      renderAgents();
      await refreshThread();
    }

    async function refreshThread() {
      if (!state.selectedWorkspace || !state.selectedThread) return;
      const workspaceId = encodeURIComponent(state.selectedWorkspace.id);
      const threadId = encodeURIComponent(state.selectedThread.id);
      const data = await api("/api/workspaces/" + workspaceId + "/threads/" + threadId);
      const key = JSON.stringify(data.messages) + data.markdown.length;
      if (key === state.lastRenderedThreadKey) return;
      state.lastRenderedThreadKey = key;
      const messages = data.messages.map(message => {
        const artifacts = message.artifacts && message.artifacts.length
          ? "<div class='muted'>Artifacts: " + escapeHtml(message.artifacts.join(", ")) + "</div>"
          : "";
        return "<article class='message'><div class='message-meta'><span class='pill'>" + escapeHtml(message.agentId) + "</span><span class='pill'>" + escapeHtml(message.timestamp) + "</span>" + (message.role ? "<span class='pill'>" + escapeHtml(message.role) + "</span>" : "") + "</div><pre>" + escapeHtml(message.body) + "</pre>" + artifacts + "</article>";
      }).join("");
      els.viewTitle.textContent = state.selectedThread.title;
      els.viewSubtitle.textContent = state.selectedThread.id;
      els.content.className = "";
      els.content.innerHTML = messages || "<pre>" + escapeHtml(data.markdown) + "</pre>";
    }

    function showAgent(agent) {
      state.selectedAgent = agent;
      state.selectedThread = null;
      state.lastRenderedThreadKey = "";
      renderThreads();
      renderAgents();
      els.viewTitle.textContent = agent.id;
      els.viewSubtitle.textContent = "Registered agent";
      els.content.className = "";
      els.content.innerHTML = "<pre>" + escapeHtml(agent.markdown) + "</pre>";
    }

    function showWorkspaceRules(markdown) {
      els.viewTitle.textContent = state.selectedWorkspace.name;
      els.viewSubtitle.textContent = state.selectedWorkspace.rootPath;
      els.content.className = "";
      els.content.innerHTML = "<h3>RULES.md</h3><pre>" + escapeHtml(markdown) + "</pre>";
    }

    function showEmpty(title, detail) {
      els.viewTitle.textContent = title;
      els.viewSubtitle.textContent = detail;
      els.content.className = "empty";
      els.content.textContent = detail;
    }

    renderWorkspaces();
    renderThreads();
    renderAgents();
    if (state.tokenLocked) {
      refreshAll();
    }
    setInterval(refreshAll, 2000);
  </script>
</body>
</html>`;
}
