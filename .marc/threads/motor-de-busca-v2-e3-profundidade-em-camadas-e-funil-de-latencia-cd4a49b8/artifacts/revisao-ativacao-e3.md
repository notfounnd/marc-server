# Revisão da ativação das camadas (T6)

## Escopo e fontes

Esta revisão cobre a ativação das camadas 0, 1 e 2 no índice de produção. Ela foi feita depois da aceitação humana da E3 (27/10) e da coaprovação do Codex sobre a revisão final integrada (marc://msg_d8f52d8113b1498989).

Fontes:
- a entrega da T6, publicada pelo claude-dev (marc://msg_f94f6123ac4f4dd9a7);
- o código, os testes e os documentos alterados, lidos diretamente;
- o JSON `latency-e2e-activation.json`;
- o manifest de produção depois do rebuild;
- as checagens que eu mesmo rodei.

A revisão responde ao limite que o Codex registrou: a latência da UI tinha sido medida só sobre o índice da camada 0.

## O que mudou

- **Código de produção:** uma linha. `INDEXED_LAYERS` passa a valer `[0, 1, 2]`, em `src/core/memory/sources/index.ts:28`.
- **Testes:**
  - `core-memory-sources-rebuild` agora compara o padrão com `[0, 1, 2]` explícito e `[0]` explícito com um workspace só de summaries;
  - `core-thread-summary-memory-projections` passa a contar só os registros de summary, e continua exigindo exatamente um, da mesma thread, com sha256 alterado;
  - `memory-eval-corpus-fixture` declara `[0]`;
  - o store de teste `ScoreOverrideStore` passa a respeitar `layers`, como o store de produção.

  Nenhuma asserção foi enfraquecida, e os testes não têm ramificação.
- **Harness:** em `t0-funnel-prestudy.ts`, modo `latency e2e`:
  - a referência M0 roda numa cópia só com a camada 0 e ordem `input`. Ela não passa pela checagem de produção, porque é a referência anterior à E3;
  - a UI e o MCP depth 2 rodam numa cópia com `INDEXED_LAYERS`, que é checada contra o manifest de produção;
  - a saída vai para um arquivo novo. O `latency-e2e-t5.json` foi preservado.
- **Documentação:**
  - ADR 0012: registro da ativação, do rebuild e da latência de ativação. O histórico da T5 foi preservado;
  - ADR 0010: nota de continuidade, sem reescrever a decisão;
  - `docs/memory.md` e `docs/mcp-tools.md`: refletem o índice de produção com três camadas.

## Rebuild de produção (principal)

- **Execução:** em 27/10, `memory rebuild --mode full` com o `dist` novo, em 3 min 40 s.
- **Status:** `ready`, sem stale, com 61 summaries indexados.
- **Manifest:** 343 registros, sendo 61 na camada 0, 221 na camada 1 e 61 na camada 2. O sha256 é `950427240b823bdebd387eea770db423f44a7886a82c146872ba0874c2d6cdb8`. O índice tem 45 MB.
- **Backup:** a cópia do índice anterior (`b96e41ce…`) foi guardada no scratchpad da sessão, para restaurar se for preciso.
- **Smoke test em depth 2:** `layersSearched` [0, 1, 2]. Veio um hit `@rules` com caminho e um hit de artifact com a referência da mensagem e do arquivo.

## Critérios

| Critério | Evidência | Resultado |
|---|---|---|
| UI ≤ 1,2 × M0 sobre o índice ativado | Mesmo protocolo da T5: 30 casos, 90 amostras por caminho, intercalado, numa só execução. UI 12.090 ms (p95 13.085); M0 18.417 ms (p95 20.223); razão **0,656** | Passa |
| M0 de referência estável | Pares do M0 iguais ao replay em 30 de 30 casos; mediana a +1,1% da T5 | Passa |
| Mudança da UI explicada | Os pares da UI diferem do M0 de −7 a +2 por caso (média 117,2 contra 118,0). A causa é o BM25 do índice misto, efeito já previsto na aceitação de DEPTH0 por não inferioridade. A latência da UI fica +2,3% acima da T5 | Esperado |
| MCP depth 2 (só informativo) | 18.531 ms (p95 22.681) | Reportado |
| Produção pronta | `memory status` pelo `dist` novo: `ready`, sem stale | Passa |
| Checagens | Do desenvolvedor: validate 0, build 0, test 1.020/1.020. Da revisão, depois do último ajuste de docs: ver a mensagem desta revisão | Ver mensagem |
| Regras | Sem `else` nem `if` aninhado nas mudanças; sem Git; pnpm-lock, datasets, julgamentos e `capture.ts` intocados | Passa |

## Limites e observações

- **Daemon e MCP:** até o reinício do ecossistema, eles continuam com o código antigo carregado (só a camada 0). Nesse intervalo podem marcar a memória como `stale`. O reinício resolve.
- **CLI:** `marc memory recall` imprime o resultado e mantém o processo vivo por cerca de 5 min, por causa do timer de inatividade do interpretador (`MEMORY_INTERPRETATION_IDLE_TIMEOUT_MS`). Isso não vem da ativação. Fica para o backlog depois da E3.
- **Medição:** foi feita numa cópia do corpus fixado, não no índice de produção, que tem mais conteúdo. A checagem de produção confirmou a mesma composição de registros.
- **Referência de 5 s:** continua não atingida, e é informativa. Fica para o estudo de modelos.

## Veredito

**Aprovado tecnicamente**, sujeito ao parecer do Codex sobre a ativação.

Depois dele:
- os arquivos da E3 vão para o stage;
- a thread só é encerrada com autorização humana;
- o commit e o reinício do ecossistema ficam com o humano.
