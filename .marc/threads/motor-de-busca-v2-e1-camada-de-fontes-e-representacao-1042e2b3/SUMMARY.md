# Motor de busca v2 - E1 Camada de fontes e representação

Thread: marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3

Closed: `2026-10-19T22:15:54.695Z`

---

A E1 é a segunda etapa do programa motor de busca v2. Ela criou a camada de fontes da memória:
- proveniência por registro;
- leitores de summary, artifact, rules, document e chat;
- o manifest v7 (`source-layers-v1`), com só a camada 0 indexada;
- `documentSources` como opt-in.

O ranking não mudou. Ficou não inferior ao baseline da E0 nos dois corpora, depois de três recuos de normalização que foram medidos.

marc://@claude-software-architect aprovou na revisão técnica, na revisão 3. marc://@codex-software-architect aprovou na terceira re-revisão independente, depois de dois pareceres pendentes cujos bloqueios foram corrigidos. O humano aceitou a E1, autorizou o encerramento e fez o rebuild completo da produção depois da aceitação. A memória está `ready`, no schema 7.

## Entrega

- **Proveniência:**
  - `passageId` calculado pelo conteúdo, `passageSha256` e `passageOrdinal`;
  - `lineStart` e `lineEnd` da seção de origem, mais `layer`, `authority` e `sourceType`;
  - desambiguação de títulos `##` duplicados.
- **Fontes:** `src/core/memory/sources/`.
  - Um leitor por fonte e `INDEXED_LAYERS = [0]`.
  - A contenção física por `realpath` fica no helper compartilhado `files.ts`: nenhum leitor segue um link, nem num ancestral do caminho.
  - Uma única definição de fence em `fences.ts`, lida pela segmentação e pela normalização.
- **Contrato:**
  - `MEMORY_SCHEMA_VERSION = 7` e `MEMORY_RETRIEVAL_CONTRACT = "source-layers-v1"` ficam em `sources/contract.ts`, e um manifest v6 é dado como `incompatible`;
  - o registro do manifest guarda `layer` e `authority`, e o rebuild incremental reindexa quando a autoridade muda;
  - `indexedLayers` em `MemoryOperationOptions`.
- **Harness:** `productionCheck` por schema, fingerprint com camadas, `capture --all-layers` e `report --without-latency`.
- **Documentação:** ADR 0010, `docs/memory.md` e `docs/mcp-tools.md`.

## Normalização e recuos

O texto indexado continua mantendo:
- o texto dos links junto com a URL;
- o corpo das fences de prosa e de shell (`text`, `txt`, `bash`, `sh`, `shell`, `console` ou sem linguagem). As outras fences são removidas;
- o tratamento de tabelas e de marcadores de linha.

A preservação de identificadores foi revertida por completo, caso a caso, porque mudava a ordem do topo no M0:

| Caracteres revertidos | Casos afetados |
|---|---|
| hífen | 9D, A34, O02 |
| underscore | A31, O02 |
| `#`, `>` e `*` | A25 |

Hoje esses caracteres viram espaço, como na E0.

## Validação

- **Capturas finais:**
  - marc `8af296ddeca8`, contra a E0 `7020a9de1965`;
  - ledgerline-en `4dad1e8eaea7`, contra a E0 `a3761dd19573`.
- **Critério 1 no marc:** top1Target com Δ −0,010 (limite inferior −0,034, δ 0,05) e MRR com Δ −0,005 (limite inferior −0,017, δ 0,03).
- **Critério 2:** Δ 0 nos dois corpora. No ledgerline-en, todas as métricas tiveram Δ 0.
- **Baseline:** a E0, reexecutada com o código da E1, ficou idêntica ao relatório aprovado.
- **Julgamento incremental:** os dois avaliadores julgaram 236 pares novos em quatro rodadas, com consenso registrado. Nenhum julgamento da E0 foi alterado.
- **Correções depois da medição:** contenção, fences e invalidação. A medição foi preservada porque o código final gera, na camada 0, registros idênticos aos das capturas: marc 351 de 351 e ledgerline-en 136 de 136. Os dois aprovadores conferiram isso de forma independente.
- **Checks finais:** `pnpm validate`, `pnpm build` e `pnpm test` com 566 de 566. O manifest de produção ficou intacto durante toda a medição (`89a98442…a491a`). Depois da aceitação, o rebuild autorizado gerou o `33104f73…cdabb`, no schema 7, com 59 summaries.
- **Revisão final:** o detalhe está no artifact revisao-final-e1.md, ligado às mensagens msg_aa70740b7eac448cb2 e msg_71063310d1434ca6a4.

## Limites e continuidade

- **E2:**
  - o M0 é sensível à margem de elegibilidade, com efeitos de segunda ordem (A31, A25 e O02 em 0,5019);
  - o equivalence do 9I já falhava na E0;
  - com n=100, o δ do MRR reprova um único caso que caia de 1 para 0;
  - os scripts `memory:quality` e `memory:benchmark` só rodam no schema v6.
- **E3:** o filtro FTS do LanceDB (pré ou pós) ainda não foi confirmado; o status compara só summaries; o leitor de documentos tem custo de varredura.
- **Normalização:** um bloco com indentação de 4 espaços continua sendo lido como texto, como na E0. A normalização não implementa todo o CommonMark.
- **Rebuild:** a decisão de um rebuild único depois da E2 foi revista pelo humano, e o rebuild aconteceu ao fim da E1. Na E2, a referência de "produção intacta" passa a ser o manifest `33104f73…cdabb`.
- **Medição das camadas na T4b, para a E3:**
  - marc: [0] tem 352 registros em 18,4 s; [0,1,2] tem 2.769 registros em 147,6 s;
  - ledgerline-en: [0] tem 136 registros em 4,6 s; [0,1,2] tem 265 registros em 8,5 s.
