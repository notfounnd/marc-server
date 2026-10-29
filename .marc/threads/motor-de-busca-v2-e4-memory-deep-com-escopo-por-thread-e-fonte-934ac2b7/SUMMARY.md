# Motor de busca v2 - E4 memory_deep com escopo por thread e fonte

Thread: marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7

Closed: `2026-10-29T13:24:46.673Z`

---

A E4 é a quinta etapa do programa motor de busca v2. Ela entregou a ferramenta `memory_deep` (MCP e CLI), que devolve trechos com a origem completa depois do `memory_recall`. São dois modos:
- **com `threadId`:** busca dentro de uma thread fechada e indexada, com até B = 232 trechos avaliados pelo reranker;
- **sem `threadId`:** usa o pool exato da depth 2 e devolve só trechos dos grupos admitidos.

O `memory_recall` e a busca da UI não mudaram.

marc://@claude-software-architect aprovou na revisão técnica (revisao-final-e4.md, msg_247ca6ffe3fe47eaab). marc://@codex-software-architect coaprovou a revisão final e a adoção de B = 232 (msg_96d630e607b344ae98). O humano aceitou a E4 em 2026-10-29 e autorizou este encerramento.

## Decisão

- **Latência:** o humano decidiu "qualidade primeiro". A mediana de cada modo deve ficar em até 1,2 × a mediana do M0 medida na mesma execução. Os 5 s ficam como referência para o estudo de modelos.
- **Plano:** rev 4.1 (plano-e4-memory-deep.md), coaprovada pelo Codex antes do dispatch. A rev 4 corrigiu conflitos da rev 3 com o estado depois da E3:
  - sem pré-filtro de 60 trechos por cosseno;
  - `groupBand` pela heurística da ADR 0011;
  - só threads fechadas;
  - dataset separado, para preservar os captureIds da E0 à E3.
- **Adoção:** `DEEP` com B = 232, sem escolha D10 e sem reavaliação. O recuo B' = 212 foi calculado e não foi usado.
- **D03** ficou classificado como ordering e vai ao estudo de modelos. A evidência do CHAT ficou em 10º na saída do `DEEP`, e a do SUMMARY não entrou no pool.

## Entrega

Desenvolvedor: marc://@claude-dev (Haiku 5.5, xhigh), em modo sequencial com um desenvolvedor.

- **T1:**
  - `src/core/memory/deep*.ts`, com os dois modos;
  - filtro por thread em `readRows`;
  - `memoryReferenceOf` exportado;
  - resolução de thread movida para o core;
  - a ferramenta MCP `memory_deep` e o comando `marc memory deep` da CLI.
- **T2:** corpus e dataset `marc-deep` (62 threads e 14 casos D01–D14), mais `deep-run`, `deep-worksheet`, células de trecho no julgamento, classes de falha e o protocolo do gate. Entrega 1: msg_9c73a89ee3d947d89c, coaprovada pelo Codex em msg_9b58146283634fd9bc.
- **Avaliação:**
  - casos coaprovados em msg_87d26002ec5d49f890;
  - captura marc-deep/58686cbe9fc0;
  - julgamento cego dos avaliadores a e b, com consenso em consenso-julgamento-e4.md: 101 trechos, kappa ponderado de 0,896;
  - resultado em resultado-deep-e4.md.
- **T3:**
  - `deep-latency*.ts`;
  - descrição do MCP recalibrada;
  - orientação na skill (`marc-ops-skill.ts`);
  - `docs/memory.md` e `docs/mcp-tools.md`;
  - ADR 0013;
  - correção do `commitMerge` para graus de trecho.

  Entrega 2: msg_3dd0848cfb874710b8.

## Validação

- **Qualidade:** Success@5 de `DEEP` em 13/14 (o mínimo era 12), sem incompletos e com 100% dos resultados no escopo. `DEEP_ALL` teve as mesmas métricas; `DEEP_COSINE` também fez 13/14.
- **Latência:** uma execução intercalada, com 1 aquecimento e 3 rodadas rotacionadas. Os pares bateram com o replay.

  | Modo | Mediana | Limite (1,2 × M0) | p95 |
  |---|---|---|---|
  | com escopo | 11,5 s | 33,8 s | 35,0 s |
  | sem escopo | 26,5 s | 36,6 s | 37,7 s |

- **Checks:** `pnpm validate` exit 0, `pnpm build` exit 0 e `pnpm test` 1.170/1.170. Os arquivos excluídos pelo plano não foram alterados.
- **Fechamento, depois do reinício do mcp-marc:**
  - o bootstrap regenerou `.agents/skills/marc-ops/SKILL.md` e a cópia em `.claude`, com as três orientações do `memory_deep`;
  - a descrição publicada do MCP foi conferida;
  - uma chamada real com escopo na thread da E3 funcionou: 502 trechos, 232 avaliados pelo reranker, `scopeTruncated`, e o 1º resultado foi a mensagem que definiu o B = 232.
- `workspace_audit scope: messages`: 0 achados.

## Limites e continuidade

- **Amostra limitada:** uma execução de latência numa máquina cerca de 1,7× mais lenta que na E3 (6,74 pares/s), e 14 casos num corpus. A ADR 0013 exige repetir a medição antes de um release ou depois de mudar o reranker, a segmentação ou o corpus.
- **Estudo de modelos (próximo passo do programa):**
  - D03 (ordering);
  - casos em que `@rules` é a resposta;
  - o botão manual de "buscar mais fundo" na UI;
  - a meta de 5 s.
- **Oportunidades abertas:** custo fixo do rebuild incremental (404284ba) e ícone de barras para a faixa (214864b9).
- **Depois do encerramento:** o principal coloca as alterações no stage. O humano faz o commit, reinicia o ecossistema e faz o rebuild completo do marc e da memória.
