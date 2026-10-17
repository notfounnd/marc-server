# Plano da E1: camada de fontes e representação

## Resumo

A E1 prepara o índice para as próximas etapas sem mudar como a busca decide:

- **proveniência por registro:** tipo de fonte, camada, caminho, autoridade e linhas;
- **registro de leitores de fonte:** um leitor por tipo (summary, artifact, rules, document, chat), em tabela de dispatch;
- **correção da representação do texto:** substitui a normalização de `src/core/memory/summaries.ts:234-243`, que perde o texto dos links, quebra identificadores com `-` e `_` e descarta todo bloco de código;
- **documentos externos (D5):** configuração opt-in nas settings JSON, presa à raiz do workspace.

Na E1, **só a camada 0 (`SUMMARY.md`) é indexada e buscada.** Os leitores das camadas 1 e 2 ficam implementados e testados, e a E3 os liga no rebuild. O ranking, a elegibilidade e a interpretação continuam os mesmos.

Rota e decisões: marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md.

## Gate de entrada

1. A E0 (marc://$motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b) aprovada tecnicamente, com o baseline `M0` capturado nos dois corpora.
2. Antes do dispatch, os aprovadores conferem as referências de linha deste plano contra o código atual e registram as correções no handoff, sem mudar o desenho.

## Fontes obrigatórias

- `.marc/RULES.md` com `Custom Rules`, `AGENTS.md` e o registro da rota;
- relatório baseline da E0;
- ADRs `0001-markdown-source-of-truth.md` e `0009-cooperative-locks-and-atomic-markdown-writes.md`;
- `docs/memory.md`, seções `Source of truth`, `Rebuild flow` e `Recall flow`;
- `src/core/memory/summaries.ts`, `types.ts`, `rebuild-operations.ts`, `status.ts`, `lancedb-store.ts`, `lancedb-store-support.ts`, `store.ts`, `settings.ts` e `semantic-ranking.ts` (`semanticRecallHits`);
- `src/core/markdown.ts` (`parseMessages`) e `src/core/paths.ts` (`safeJoin`).

## Escopo de escrita autorizado

| Caminho | Uso |
|---|---|
| `src/core/memory/sources/**` (novo) | Leitores de fonte, registro e normalização |
| `src/core/memory/summaries.ts` | Passa a delegar ao leitor de summary; a normalização sai daqui |
| `src/core/memory/types.ts` | Tipos de proveniência, manifest v7 e campos novos do hit |
| `src/core/memory/rebuild-operations.ts`, `status.ts` | Versão do manifest e camadas indexadas |
| `src/core/memory/lancedb-store.ts`, `lancedb-store-support.ts`, `store.ts` | Colunas novas e filtro por camada |
| `src/core/memory/semantic-ranking.ts` | Apenas `semanticRecallHits`, para copiar os campos de proveniência |
| `src/core/memory/settings.ts`, `src/core/types.ts` | `memory.documentSources` |
| `src/mcp/memory-tools.ts`, `src/daemon/memory-routes.ts` | Apenas se o schema de saída precisar declarar os campos novos |
| `scripts/memory-eval/**` | Opção de corpus para medir o custo de indexar todas as camadas |
| `test/core-memory-*.test.ts`, `test/memory-eval-*.test.ts`, `test/fixtures/**` | Testes |
| `docs/memory.md`, `docs/mcp-tools.md`, `docs/adrs/0010-memory-source-layers.md`, `docs/adrs/README.md` | Documentação e ADR |

**Exclusões explícitas:**

- `hybrid-ranking.ts`, `semantic-eligibility.ts`, `query-*.ts` e `search-depth.ts`: o ranking e a interpretação não mudam;
- `src/ui/**`;
- `.marc/memory/**`: **sem rebuild produtivo até o fim da E2** (decisão do registro de um único rebuild para E1 e E2). As avaliações usam o workspace temporário do harness;
- `package.json` e `pnpm-lock.yaml`.

## Desenho

### 1. Proveniência

Tipos novos em `src/core/memory/types.ts`:

```ts
export type MemorySourceType = "summary" | "artifact" | "rules" | "document" | "chat";
export type MemoryLayer = 0 | 1 | 2;
export type MemoryAuthority = "decision" | "rule" | "artifact" | "document" | "conversation";
```

Campos adicionados a `MemoryVectorRecord`:

| Campo | Conteúdo |
|---|---|
| `sourceType` | Tipo da fonte |
| `layer` | 0 para summary; 1 para artifact, rules e document; 2 para chat |
| `sourcePath` | Caminho relativo à raiz do workspace (`info.rootPath`), com `/` |
| `authority` | summary → `decision`; rules → `rule`; artifact → `artifact`; document → conforme a configuração; chat → `conversation` |
| `lineStart`, `lineEnd` | Linhas da seção de origem no arquivo, contadas a partir de 1. Passagens herdam as linhas da seção. É um **localizador** para navegação, não identifica a passagem |
| `sourceSha256` | SHA-256 do arquivo de origem |
| `passageOrdinal` | Posição da passagem dentro da seção, a partir de 0, na ordem devolvida por `splitPassages` |
| `passageSha256` | SHA-256 do texto da passagem exatamente como foi indexado |
| `passageId` | **Identidade individual** da passagem: `<sourcePath>#<16 primeiros hex de passageSha256>`. Duas passagens diferentes da mesma seção têm ids diferentes. Duas passagens com texto idêntico no mesmo arquivo compartilham o id, o que é correto, porque têm a mesma relevância para qualquer consulta. Se o texto indexado mudar, o id muda, e o julgamento antigo deixa de valer |
| `messageId`, `agentId` | Só no chat |
| `artifactFileName` | Só no artifact |

**Agrupamento:** `threadId` continua obrigatório. Fontes que não pertencem a uma thread usam ids reservados que `slugify` nunca produz: `@rules` para `RULES.md` e `@document/<sourcePath>` para documentos. A E3 decide como esses grupos aparecem no resultado.

Os mapas de camada e de autoridade são tabelas `Record<MemorySourceType, …>`, não condicionais.

`MemoryRecallHit` ganha `sourceType`, `sourcePath` e `authority`. É uma mudança aditiva no MCP e na API HTTP.

### 2. Registro de leitores

`src/core/memory/sources/index.ts`:

```ts
export type MemorySourceReader = (
  info: WorkspaceInfo,
  settings: WorkspaceSettings
) => Promise<MemorySource[]>;

export const memorySourceReaders: Record<MemorySourceType, MemorySourceReader> = {
  summary: readSummarySources,
  artifact: readArtifactSources,
  rules: readRulesSources,
  document: readDocumentSources,
  chat: readChatSources
};

export const INDEXED_LAYERS: readonly MemoryLayer[] = [0];
```

O rebuild lê apenas os tipos cuja camada está em `INDEXED_LAYERS`. A E3 muda essa constante para `[0, 1, 2]`.

**Regras dos leitores:**

| Leitor | Arquivos | Segmentação |
|---|---|---|
| summary | `threads/<dir>/SUMMARY.md` | Comportamento atual de identity e seções `##`, movido de `summaries.ts` sem mudança de desenho |
| artifact | `threads/<dir>/artifacts/*.md` de threads fechadas. Ignora outras extensões e subpastas | Seções `##`. Sem `##`, o arquivo inteiro vira uma seção `Overview` |
| rules | `.marc/RULES.md` | Seções `##` e `###` |
| document | Caminhos de `memory.documentSources` (seção 4) | Seções `##` |
| chat | `threads/<dir>/CHAT.md` de threads fechadas, lido com `parseMessages` de `src/core/markdown.ts` | Uma seção por mensagem, com título `<agentId> <timestamp>` |

- **Thread fechada:** é a que tem `SUMMARY.md`, a mesma regra de `scanThreadSummarySources` e de `src/core/thread-index.ts`. Os leitores de artifact e chat não leem threads abertas (D4).
- **Passagens:** todos os leitores passam pelo mesmo `materializeThreadSummarySources` (`splitPassages` com 320 tokens e 48 de sobreposição). Só o leitor de summary gera o registro `identity`.

### 3. Normalização do texto

Novo `src/core/memory/sources/markdown-text.ts`, com `markdownToIndexText(markdown: string): string`. Ele substitui `normalizeMarkdownForEmbedding` em todos os leitores. As regras são uma lista ordenada de pares `[RegExp, replacement]`, aplicadas em sequência:

1. Remover comentários HTML.
2. Blocos cercados: manter o conteúdo quando a linguagem declarada é vazia, `text`, `txt`, `bash`, `sh`, `shell` ou `console`. Remover os demais blocos, incluindo `json` e `ts`.
3. Código inline: manter o texto.
4. Imagens `![alt](src)` → `alt`.
5. Links `[texto](url)` → `texto url`. Se o texto for igual à url, manter só um dos dois.
6. Marcadores de início de linha: títulos `#`, citação `>`, itens de lista (`-`, `*`, `+`, `1.`, `1)`) e caixas de tarefa `[ ]` e `[x]`.
7. Ênfase `**x**`, `__x__`, `*x*` e `_x_`, só quando o marcador não está colado a uma letra ou dígito. Assim, `memory_deep` e `snake_case_name` ficam intactos.
8. Tabelas: remover as linhas separadoras (`|---|`) e trocar `|` por espaço.
9. Linhas horizontais (`---`, `***`, `___` sozinhos na linha).
10. Colapsar espaços em branco.

**Exemplos que o teste exige,** como tabela declarativa de entrada e saída esperada:

| Entrada | Saída |
|---|---|
| `` `field-aware-hybrid-v2` `` | `field-aware-hybrid-v2` |
| `memory_deep e snake_case_name` | inalterada |
| `[ADR 0001](docs/adrs/0001-markdown-source-of-truth.md)` | `ADR 0001 docs/adrs/0001-markdown-source-of-truth.md` |
| `marc://$oportunidade-x-1234abcd` | inalterada |
| `- **Decisão:** usar --resume` | `Decisão: usar --resume` |
| bloco ` ```bash ` com `pnpm memory:eval capture` | `pnpm memory:eval capture` |
| bloco ` ```json ` | removido |
| `\| a \| b \|` seguido de `\|---\|---\|` | `a b` |

### 4. Documentos externos (D5)

Nova chave em `WorkspaceSettings.memory`:

```ts
documentSources: Array<{ path: string; authority: "normative" | "reference" }>;
```

- **Padrão:** `[]`.
- **Edição:** só pelo JSON `.marc/marc.config.json`. `WorkspaceSettingsInput` e a UI não mudam.
- **Autoridade:** `normative` → `authority: "rule"`; `reference` → `authority: "document"`. O mapeamento é uma tabela.

**Validação**, em `normalizeWorkspaceSettings`, seguindo o padrão atual de erro de `searchRetryDepth`:

- `path` relativo à raiz do workspace e resolvido com `safeJoin(info.rootPath, path)`;
- caminhos absolutos ou que escapam da raiz são rejeitados;
- caminhos dentro de `.marc/` ou de `node_modules/` são rejeitados;
- um arquivo precisa ter extensão `.md`;
- um diretório é lido de forma recursiva, só `*.md`, até 4 níveis e 200 arquivos por fonte, sem seguir links simbólicos;
- `authority` precisa ser um dos dois valores.

### 5. Manifest e armazenamento

- `MemoryManifest.schemaVersion: 7` e `retrievalContract: "source-layers-v1"`. Um índice v6 passa a ser `incompatible` em `status.ts`, o que exige rebuild completo, como no padrão atual.
- `MemoryManifestRecord` ganha `sourceType` e `sourcePath`. O rebuild incremental compara por fonte.
- As colunas novas entram em `lanceDbRow` e em `lanceDbArrowTable`. `lexicalSummary` continua com o texto do registro.
- `searchVector` e `searchLexical` ganham a opção `layers?: MemoryLayer[]` com padrão `[0]`. `LanceDbMemoryVectorStore` aplica o filtro com `where` e `InMemoryMemoryVectorStore` com `filter`.

### 6. Medição de custo para a E3

O harness ganha a opção `--all-layers` na captura. Ela troca `INDEXED_LAYERS` no workspace temporário por injeção de dependência no rebuild do harness, sem alterar a constante de produção, e registra o tempo de rebuild e o número de registros por camada. A E1 só mede; a decisão de custo fica para a E3.

## Tarefas do desenvolvedor

| Tarefa | Entrega | Testes |
|---|---|---|
| T1 | `markdown-text.ts`; `summaries.ts` passa a usá-lo | `test/core-memory-markdown-text.test.ts` com a tabela da seção 3 e casos de cada regra |
| T2 | Tipos e proveniência, manifest v7, colunas, filtro de camada e campos novos no hit | Testes existentes atualizados; manifest v6 resulta em `incompatible`; registros de summary com `layer: 0`, `sourcePath` e linhas corretos; filtro de camada nos dois stores; seção declarada com duas passagens de textos diferentes gera `passageId` distintos e `passageOrdinal` 0 e 1; o mesmo texto em seções diferentes do mesmo arquivo gera o mesmo `passageId`; `passageSha256` confere com o texto indexado |
| T3 | Registro de leitores, leitores de artifact, rules, document e chat, e `documentSources` | `test/core-memory-sources.test.ts` com um workspace temporário: thread aberta ignorada; só `.md` em artifacts; chat com `messageId` e `agentId`; ids `@rules` e `@document/...`; cada rejeição da seção 4 como cenário declarado; link simbólico não seguido |
| T4 | `--all-layers` no harness, ADR 0010, docs, capturas e comparação | Sem teste novo além dos do harness; evidência na entrega |

O ADR `docs/adrs/0010-memory-source-layers.md` registra três decisões:

- fontes por camada e índice único por geração;
- ids reservados para grupos que não são threads;
- documentos externos só por opt-in.

O índice `docs/adrs/README.md` recebe a entrada nova.

## Critérios de aceite

Os critérios comparam a captura nova com o baseline da E0 pelo `compare`, nos dois corpora. Antes da comparação, os aprovadores fazem o julgamento incremental da E0 (`worksheet --variants`) para os pares novos da captura da E1. O `compare` só emite veredito sem nenhuma variante em estado `incomplete`.

1. **Top1-alvo e MRR:** não inferiores ao baseline (δ da E0).
2. **Exposição incidental e abstenção correta nos negativos:** não inferiores ao baseline (δ da E0). Resultado inconclusivo reprova o critério, conforme a regra de decisão da E0, inclusive a rodada única de ampliação.
3. **Diagnóstico:** o relatório mostra a atribuição de 3P, 6I e 9I antes e depois.
4. **Proveniência:** todo registro tem os campos da seção 1. Um teste lê `lineStart` e `lineEnd` no arquivo e encontra o título da seção. Outro teste prova que passagens diferentes da mesma seção têm `passageId` distintos.
5. **Produção:** `.marc/memory/**` sem alteração. Hash do manifest igual antes e depois.
6. **Validação:** `pnpm validate`, `pnpm build` e `pnpm test` passam. As regras de estilo e de teste foram respeitadas.
7. **Documentação:** docs e ADR atualizados.

**Recuo:** se o critério 1 ou o 2 falhar, os aprovadores identificam a regra de normalização responsável pela diferença por caso. O desenvolvedor reverte só essa regra e repete a captura. O restante da E1 segue.

## Evidência esperada

- caminhos alterados com referências de linha;
- checks e resultados;
- `captureId` antigo e novo e o relatório do `compare` anexado;
- tempo de rebuild e registros por camada com `--all-layers`;
- hash do manifest de produção antes e depois;
- riscos.

## Riscos

- **Proveniência por seção:** `splitPassages` não devolve deslocamentos, então as linhas de uma passagem são as da seção. A E4 deixa isso explícito no resultado. A identificação individual não depende das linhas: vem de `passageId`, calculado sobre o conteúdo. É esse id que a E3 e a E4 usam para julgar trechos e verificar evidência.
- **Blocos de código:** manter `bash` e `text` pode trazer ruído. O recuo por regra cobre esse risco.
- **Volume das camadas 1 e 2:** artifacts grandes, como os da thread `57488bab`, podem aumentar muito o rebuild. A medição da seção 6 alimenta a E3.

## Pendências antes do dispatch

- Desenvolvedor definido pelo humano e configuração confirmada.
- Veredito conjunto dos aprovadores sobre este plano, depois da aprovação da E0.

## Histórico de revisões

- **Revisão 2 (2026-10-15):** incorpora a revisão de marc://@codex-software-architect. O critério 2 passa de "sem piora classificada" para não inferioridade, e a comparação passa a exigir o julgamento incremental dos pares novos. Arquitetura sem mudança.
- **Revisão 3 (2026-10-15):** responde ao parecer de marc://@codex-software-architect sobre a revisão 2. A proveniência ganha `passageOrdinal`, `passageSha256` e `passageId`, a identidade individual da passagem baseada no conteúdo. As linhas da seção continuam só como localizador. Contrato compartilhado com a verificação de evidência da E3 e com os julgamentos por trecho da E4.
