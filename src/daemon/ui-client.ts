export const UI_CLIENT = `
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
renderWorkspaces();
renderThreads();
renderAgents();

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
    return;
  }
  setStatus("warn", "Token required");
}

function setStatus(kind, text) {
  els.statusDot.className = "dot " + kind;
  els.statusText.textContent = text;
}

function markUpdated() {
  els.lastUpdated.textContent = "Synced " + new Date().toLocaleTimeString();
}

async function api(path) {
  if (!state.tokenLocked || !state.token) throw new Error("Token is not locked");
  const response = await fetch(path, { headers: { authorization: "Bearer " + state.token } });
  if (response.ok) return response.json();
  throw new Error(await response.text());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function makeButton(label, detail, active, onClick) {
  const element = document.createElement("button");
  element.className = "item" + (active ? " active" : "");
  element.innerHTML = "<h3>" + escapeHtml(label) + "</h3>" + (detail ? "<div class='muted path'>" + escapeHtml(detail) + "</div>" : "");
  element.addEventListener("click", onClick);
  return element;
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
    if (state.selectedWorkspace) await refreshWorkspaceDetails();
    if (state.selectedThread) await refreshThread();
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
  if (!state.selectedWorkspace) return;
  const current = workspaces.find(workspace => workspace.id === state.selectedWorkspace.id);
  if (current) {
    state.selectedWorkspace = current;
    return;
  }
  state.selectedWorkspace = null;
  state.selectedThread = null;
  state.selectedAgent = null;
  renderThreads();
  renderAgents();
  showEmpty("Workspace no longer registered", "Select another workspace.");
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
  if (state.selectedThread || state.selectedAgent) return;
  const rules = await api("/api/workspaces/" + id + "/rules");
  showWorkspaceRules(rules.markdown);
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
  const messages = data.messages.map(renderMessage).join("");
  els.viewTitle.textContent = state.selectedThread.title;
  els.viewSubtitle.textContent = state.selectedThread.id;
  els.content.className = "";
  els.content.innerHTML = messages || "<pre>" + escapeHtml(data.markdown) + "</pre>";
}

function renderMessage(message) {
  const artifacts = message.artifacts && message.artifacts.length
    ? "<div class='muted'>Artifacts: " + escapeHtml(message.artifacts.join(", ")) + "</div>"
    : "";
  const role = message.role ? "<span class='pill'>" + escapeHtml(message.role) + "</span>" : "";
  return "<article class='message'><div class='message-meta'><span class='pill'>" + escapeHtml(message.agentId) + "</span><span class='pill'>" + escapeHtml(message.timestamp) + "</span>" + role + "</div><pre>" + escapeHtml(message.body) + "</pre>" + artifacts + "</article>";
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
  els.viewSubtitle.textContent = "";
  els.content.className = "empty";
  els.content.textContent = detail;
}

if (state.tokenLocked) refreshAll();
setInterval(refreshAll, 2000);
`;
