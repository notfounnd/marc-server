# Motor de busca v2 - E3 Profundidade em camadas e funil de latência

Thread: marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8

Closed: `2026-10-27T22:46:55.752Z`

---

A E3 é a quarta etapa do programa motor de busca v2. Ela testou duas coisas:
- se a busca em camadas (summaries, depois artifacts, regras e documentos, depois chat) podia rodar na UI com um funil de candidatos sob orçamento fixo;
- se uma expansão adaptativa entre profundidades podia fazer o mesmo.

Pelos critérios pré-declarados, o funil (H4) e a expansão adaptativa (H5) foram reprovados no marc. Pela decisão D10 do humano ("seguir a regra"), a produção ficou assim:
- a UI faz uma busca única em depth 0, que é o algoritmo M0;
- as camadas 1 e 2 ficam disponíveis aos agentes pela `depth` do MCP e da CLI, com rerank do pool consolidado completo;
- o funil e a expansão ficam só no harness, para reavaliação depois do estudo de modelos.

marc://@claude-software-architect aprovou na revisão técnica (revisao-final-e3.md, msg_54ac0a83a3a34ef4a5). marc://@codex-software-architect coaprovou (msg_d8f52d8113b1498989). O humano aceitou a E3 em 2026-10-27. A ativação das camadas na produção (T6) foi revisada (revisao-ativacao-e3.md, msg_df83e256d7464fc189) e coaprovada pelo Codex (msg_92ee4cb103c7468e93). O humano autorizou este encerramento.

## Decisão

A decisão está em decisao-e3.md, coaprovada em msg_045816d10190469682, com a D10 decidida pelo humano.

| Hipótese | Resultado (marc) | Desfecho |
|---|---|---|
| H4: recall do funil | −0,063 em K = 30, o máximo do grid; margem −0,02 | Reprovada |
| H4: sobrevivência da evidência | 0,727 com cosine e 0,773 com cosine-fts, contra o critério de 0,90 | Reprovada |
| H5: expansão adaptativa | Top-1 +0,122, mas exposição incidental pior (−0,163), abstenção inconclusiva e 2 de 8 armadilhas paradas antes da evidência | Reprovada |
| DEPTH0 contra o M0 congelado (1b68a7e3f4e6 e 5ae0f660527c) | Não inferior em 114 casos comuns do marc e 40 do ledgerline-en (regra da E0) | Aceito |

No ledgerline-en, o funil e a expansão passaram, o que não basta para adotá-los com um corpus só. Os julgamentos por camada foram fechados em consenso pelos dois avaliadores, em duas rodadas: consenso-julgamento-e3.md e consenso-julgamento-e3-rodada-2.md. A auditoria cega não disparou: 3 de 274 (1,09%) no marc e 0 de 158 no ledgerline-en.

## Entrega

- **Núcleo:**
  - camadas 0, 1 e 2, e depth de 0 a 2 no core, MCP, CLI e HTTP; depth 3 é rejeitado com a explicação das camadas;
  - interpretação só na camada 0;
  - status e reconcile com um comparador único;
  - contrato do hit com `groupId`, `groupKind`, `reference` por tipo de evidência, `layersSearched` e `rerankPairs`;
  - ordenação por tamanho no reranker.
- **UI:** retirada do Deep e da configuração de profundidade de busca; snapshot schema 7.
- **Ativação (T6):**
  - `INDEXED_LAYERS = [0, 1, 2]`;
  - rebuild de produção com 343 registros: 61 na camada 0, 221 na camada 1 e 61 na camada 2;
  - os testes declaram as camadas explicitamente.
- **Harness (`scripts/memory-eval/`):**
  - captura por depth;
  - variantes DEPTH0/1/2, ADAPTIVE, FUNNEL, ALL_PASSAGES e ALL_CANDIDATES;
  - métricas de sobrevivência e parada;
  - `merge-judgments`, `compare-common` e `latency e2e`;
  - os módulos de scoring da E2 foram movidos para o harness.
- **Documentação:** ADR 0012, nota no ADR 0010, `docs/memory.md`, `docs/mcp-tools.md` e `docs/ui-and-daemon.md`. O backlog Playwright foi atualizado (msg_4cfad711a1fe4726a5).

## Validação

- **Latência, T5** (índice com a camada 0; 30 casos e 90 amostras por caminho): UI com mediana de 11.814 ms contra 18.221 ms do M0, razão 0,648.
- **Latência, ativação** (UI sobre o índice com as três camadas): 12.090 ms contra 18.417 ms, razão 0,656. As duas passam o limite de 1,2. O MCP em depth 2 fica em cerca de 18,5 s e é só informativo.
- **Checks no estado final:** `pnpm validate` 0, `pnpm build` 0, `pnpm test` 1.020 de 1.020, rodados pelo principal. O Codex rodou checagens focadas por conta própria.
- **Produção:** o manifest da E2 ficou intacto até a aceitação. Depois do rebuild autorizado, o status ficou `ready`.

## Limites e continuidade

- **Meta de 5 s:** não foi atingida em nenhum caminho. É informativa e fica para o estudo de modelos, que deve trocar o reranker ou o embedding em vez de acrescentar etapas.
- **Reavaliação:** o funil e a expansão adaptativa só voltam com nova avaliação, nova decisão e nova baseline congelada.
- **Concordância entre avaliadores:** o kappa do marc ficou em 0,47 (sinalizado). As faixas de confiança continuam heurísticas (ADR 0011).
- **CLI:** `marc memory recall` mantém o processo vivo por cerca de 5 min depois de responder, por causa do timer de inatividade do interpretador. Isso não vem da E3 e fica para o backlog.
- **Testes E2E:** os testes E2E duráveis de browser continuam pendentes no backlog Playwright.
- **Depois do encerramento:** o principal refaz o rebuild pela CLI nova, para indexar esta thread nas três camadas, e coloca as mudanças no stage. O commit, o reinício do ecossistema e o full rebuild ficam com o humano.
