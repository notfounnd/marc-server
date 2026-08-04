import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  readMemoryManifest,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace,
  scanThreadSummarySources
} from "../src/core/memory/index.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  ScoreOverrideStore,
  createThreadFolder,
  tempWorkspace,
  writeThreadChat,
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

test("uses the canonical thread title as summary embedding context", async () => {
  const info = await tempWorkspace();
  const threadId = "thread-canonical-title";
  await writeSummary(
    info,
    threadId,
    [
      "# Resumo executivo",
      "",
      `Thread: marc://$${threadId}`,
      "",
      "## Resultado",
      "",
      "- Decisao visual consolidada."
    ].join("\n")
  );
  await writeThreadChat(
    info,
    threadId,
    "Oportunidade - Estilo neo-brutalism para a UI"
  );

  const [summary] = await scanThreadSummarySources(info);

  assert.equal(summary?.title, "Oportunidade - Estilo neo-brutalism para a UI");
  assert.match(
    summary?.chunks[0]?.embeddingText ?? "",
    /Thread: Oportunidade - Estilo neo-brutalism para a UI\./
  );
});

test("rebuild creates a current manifest and status detects stale summaries", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
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

  await rebuildMemoryInWorkspace(info, { provider, reranker, store });
  const manifest = await readMemoryManifest(info);
  const current = await readMemoryStatusInWorkspace(info, {
    provider,
    reranker,
    store
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
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token.",
      "- Mudanca nova que deixa o indice stale."
    ].join("\n")
  );
  const stale = await readMemoryStatusInWorkspace(info, {
    provider,
    reranker,
    store
  });

  assert.equal(current.status, "ready");
  assert.equal(manifest?.schemaVersion, 6);
  assert.equal(manifest?.retrievalContract, "field-aware-hybrid-v2");
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
  const reranker = new FakeRerankingProvider();
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
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });
  const disposeCallsBeforeRecall = provider.disposeCalls;

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
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
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map((document) => (document.includes("rotacao") ? 0.9 : 0.6))
  );
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
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "implementar rotacao de token da interface",
    limit: 2
  });

  assert.equal(recall.results[0]?.threadId, "thread-token");
  assert.match(recall.results[0]?.matchedText ?? "", /token/i);
  assert.match(recall.results[0]?.reason ?? "", /^Matched /);
});

test("recall uses title prefixes only for single-term queries", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new ScoreOverrideStore({ "thread-ui": 0.8 });
  await writeSummary(
    info,
    "thread-ui",
    [
      "# Resumo - Estilo neo-brutalism para a UI",
      "",
      "Thread: `thread-ui`",
      "Closed: `2026-05-22T02:20:47.643Z`",
      "",
      "## Resultado",
      "",
      "- Aplicar o estilo visual na interface."
    ].join("\n")
  );
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "brutalism"
  });
  assert.deepEqual(store.lexicalFields, ["title", "summary", "titlePrefix"]);

  store.lexicalFields.length = 0;
  await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "interface brutalism"
  });
  assert.deepEqual(store.lexicalFields, ["title", "summary"]);
});
