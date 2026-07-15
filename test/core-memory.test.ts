import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace,
  scanThreadSummarySources
} from "../src/core/memory/index.js";
import {
  FakeEmbeddingProvider,
  ScoreOverrideStore,
  createThreadFolder,
  providerMetadata,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

test("scans only thread summaries and extracts structured metadata", async () => {
  const info = await tempWorkspace();
  const threadId =
    "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3";
  await writeSummary(
    info,
    threadId,
    [
      "# Resumo - Modelo de seguranca e gestao de token do daemon",
      "",
      `Thread: marc://$${threadId}`,
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Resultado executivo",
      "",
      "- Manter token unico local.",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token."
    ].join("\n")
  );
  await createThreadFolder(info, "thread-sem-summary");

  const summaries = await scanThreadSummarySources(info);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.threadId, threadId);
  assert.equal(
    summaries[0]?.title,
    "Modelo de seguranca e gestao de token do daemon"
  );
  assert.equal(summaries[0]?.closedAt, "2026-05-24T23:15:59.807Z");
  assert.equal(summaries[0]?.reference, `marc://$${threadId}`);
  assert.ok(summaries[0]?.sha256);
  assert.ok(
    summaries[0]?.chunks.some((chunk) => chunk.sectionTitle === "Decisao")
  );
});

test("rebuild creates a current manifest and status detects stale summaries", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(
    info,
    "thread-token",
    [
      "# Resumo - Modelo de seguranca e gestao de token",
      "",
      "Thread: `thread-token`",
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token."
    ].join("\n")
  );

  await rebuildMemoryInWorkspace(info, { provider, store });
  const current = await readMemoryStatusInWorkspace(info, { provider, store });
  await writeSummary(
    info,
    "thread-token",
    [
      "# Resumo - Modelo de seguranca e gestao de token",
      "",
      "Thread: `thread-token`",
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token.",
      "- Mudanca nova que deixa o indice stale."
    ].join("\n")
  );
  const stale = await readMemoryStatusInWorkspace(info, { provider, store });

  assert.equal(current.status, "ready");
  assert.equal(current.stale, false);
  assert.equal(current.summaryCount, 1);
  assert.equal(stale.status, "stale");
  assert.equal(stale.stale, true);
  assert.equal(provider.documentCalls, 1);
  assert.equal(provider.queryCalls, 0);
});

test("recall returns the summary thread that matches the development intent", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(
    info,
    "thread-token",
    [
      "# Resumo - Modelo de seguranca e gestao de token",
      "",
      "Thread: `thread-token`",
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Resultado executivo",
      "",
      "- Token unico local e suficiente para o daemon em 127.0.0.1.",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token."
    ].join("\n")
  );
  await writeSummary(
    info,
    "thread-composer",
    [
      "# Resumo - Autocomplete de referencias no composer",
      "",
      "Thread: `thread-composer`",
      "Closed: `2026-05-11T00:43:20.102Z`",
      "",
      "## Decisao",
      "",
      "- Implementar autocomplete de referencias na UI."
    ].join("\n")
  );
  await rebuildMemoryInWorkspace(info, { provider, store });
  const disposeCallsBeforeRecall = provider.disposeCalls;

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    store,
    query: "criar rotacao para o token da interface",
    limit: 2
  });

  assert.equal(recall.results[0]?.threadId, "thread-token");
  assert.match(recall.results[0]?.matchedText ?? "", /token/i);
  assert.match(recall.results[0]?.reference ?? "", /^marc:\/\/\$thread-token/);
  assert.ok(
    recall.nextActions.some((action) => action.includes("thread_read"))
  );
  assert.equal(provider.queryCalls, 1);
  assert.equal(provider.disposeCalls, disposeCallsBeforeRecall);
});

test("recall reranks decision matches above generic vector neighbors", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new ScoreOverrideStore({
    "thread-token": 0.6,
    "thread-ui": 0.72
  });
  await writeSummary(
    info,
    "thread-token",
    [
      "# Resumo - Modelo de seguranca e gestao de token",
      "",
      "Thread: `thread-token`",
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Resultado executivo",
      "",
      "- O daemon usa token unico local.",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token.",
      "- Nao alterar a persistencia do token na UI."
    ].join("\n")
  );
  await writeSummary(
    info,
    "thread-ui",
    [
      "# Resumo - Esquemas de visualizacao das colunas da UI",
      "",
      "Thread: `thread-ui`",
      "Closed: `2026-05-22T02:20:47.643Z`",
      "",
      "## Resultado",
      "",
      "- Implementar melhoria visual de interface para as colunas da UI."
    ].join("\n")
  );
  await rebuildMemoryInWorkspace(info, { provider, store });

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    store,
    query: "implementar rotacao de token da interface",
    limit: 2
  });

  assert.equal(recall.results[0]?.threadId, "thread-token");
  assert.match(recall.results[0]?.matchedText ?? "", /rotacao/i);
  assert.match(recall.results[0]?.reason ?? "", /exact terms/i);
  assert.match(recall.results[0]?.reason ?? "", /Decisao/i);
});

test("recall does not load embeddings when the local provider is not prepared", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider(providerMetadata, false);
  const store = new InMemoryMemoryVectorStore();

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    store,
    query: "verificar historico de token"
  });

  assert.equal(recall.indexStatus.status, "model_missing");
  assert.deepEqual(recall.results, []);
  assert.equal(provider.queryCalls, 0);
  assert.ok(
    recall.nextActions.some((action) => action.includes("memory_prepare"))
  );
});
