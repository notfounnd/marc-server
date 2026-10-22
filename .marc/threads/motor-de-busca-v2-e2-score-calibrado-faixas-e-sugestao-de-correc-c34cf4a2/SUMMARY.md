# Motor de busca v2 - E2 Score calibrado, faixas e sugestão de correção

Thread: marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2

Closed: `2026-10-22T02:56:29.818Z`

---

A E2 é a terceira etapa do programa motor de busca v2. Ela testou trocar a elegibilidade relativa do M0 por um score absoluto e calibrado, com faixas, juiz de admissão e sugestão de correção. Pelos critérios pré-declarados, o score calibrado, a calibração por projeto, o juiz e as alternativas de sugestão foram reprovados. A produção recebeu o recuo previsto:
- ordem e admissão do M0 inalteradas;
- uma faixa heurística de confiança (alta, média ou baixa) por resultado, calculada a partir da eligibility;
- o campo `abstained`;
- o mesmo contrato no core, MCP, HTTP, CLI e UI.

marc://@claude-software-architect aprovou na revisão técnica, depois da correção do B1. marc://@codex-software-architect coaprovou na re-revisão independente (msg_7d5d75d317e0413cb7). O humano aceitou a E2 e autorizou o encerramento e o rebuild produtivo, que é executado logo depois deste encerramento para indexar este summary.

## Decisão

A decisão foi coaprovada (decisao-e2.md) e aplicou os critérios do plano revisão 3 e do adendo de H7 e H8, sem ajuste depois da medição.

| Hipótese | Resultado | Desfecho |
|---|---|---|
| H1 (score calibrado) | Top1-alvo −0,010, inconclusivo; alvo de 3P não admitido | Recuo: ordem e admissão do M0, faixa pela eligibility |
| H2 (calibração por projeto) | N1 e N2 fora da tolerância (46,6% e 14,0% na mesma faixa) | Calibração padrão |
| H6 (faixas no ledgerline-en) | Reprovada nos dois ramos | Consulta D10: o humano aprovou as faixas como indicador heurístico, sem promessa de precisão |
| H7 (juiz de admissão) | Qwen e Kev sem ganho | Sem juiz |
| H3 e H8 (sugestão de correção) | Nenhuma alternativa supera A | Fica a A (LFM) |

Os julgamentos foram fechados em consenso pelos dois avaliadores, em três rodadas de cobertura, até zero pares pendentes nos dois corpora (consenso-julgamentos-e2.md).

## Entrega

- **Core:**
  - `src/core/memory/scoring/bands.ts` tem `MEMORY_BAND_CUTS` (0.9998832326558279, 0.8958386806238463 e 0.029530510370742287, do fit 1b68a7e3f4e6) e `memoryBandOf`;
  - `MemoryRecallHit.band` e `MemoryRecallResult.abstained`;
  - `abstained` é calculado sobre a lista admitida, antes do corte por `limit` (`operations.ts:237-257`). É verdadeiro só quando a busca rodou e nada foi admitido;
  - o score continua sendo a eligibility.
- **Transportes:**
  - a descrição do MCP diz que a faixa não é probabilidade;
  - a CLI imprime JSON com os campos novos;
  - o HTTP ganhou a costura de teste `createDaemonServer(config, dependencies)`, com o `recallMemory` real como padrão.
- **UI:**
  - alta e média na lista principal e baixa no bloco recolhido "Show less likely results";
  - sem score;
  - snapshot schema 6;
  - `abstained` continua para a próxima profundidade.
- **Limpeza:** removidos os scripts `memory-quality-*` e `memory-model-benchmark*`, seus testes e os comandos `memory:quality` e `memory:benchmark`. `test:benchmark` foi mantido.
- **Harness (`scripts/memory-eval/`):** `fit`, variantes H1, H2, H3, H7 e H8, juízes, consultas sintéticas e `latency --judge`. Os módulos `scoring/features.ts`, `judge-document.ts` e `synthetic-queries.ts` só são usados pelo harness.
- **Documentação:** ADR 0011 (`0011-memory-confidence-bands.md`), `docs/memory.md`, `docs/mcp-tools.md` e `docs/development.md`.

## Validação

- **Latência medida** na captura b72e80e00309 (marc, 114 casos e 342 amostras de `recallMemoryInWorkspace`): mediana de 18.193,4 ms contra 18.167,3 ms do M0, razão 1,0014 sobre o limite de 1,2; p95 de 19.997,4 ms.
- **Sem recaptura depois do B1.** O captureId atual é 5bd43e2180bb. A mudança vem depois do ranking, e o Codex confirmou que desfazer só o B1 devolve o hash do núcleo ao de b72e80e00309. 5bd43e2180bb não é uma captura medida.
- **Checks:** `pnpm validate` com exit 0, sem alterar arquivos; `pnpm build` com exit 0; `pnpm test` com 744 de 744, reexecutado pelo principal e pelo Codex. A primeira rodada ampla do Codex marcou 743 de 744, sem diagnóstico preservado, e a falha não se repetiu. Fica registrada como possível teste intermitente, sem causa atribuída.
- **Playwright CLI:** as três faixas, o bloco recolhido, a ausência do score e a continuação com `abstained`. O backlog E2E foi atualizado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a.
- **Produção:** o manifest ficou intacto até a aceitação (`1540264d…2045d`, 60 registros).
- **Revisões:** revisao-final-e2.md (msg_6407a3302fc6468192), parecer do Codex com o B1 (msg_7cffb5f48beb448ba4) e re-revisão do Codex (msg_7d5d75d317e0413cb7).

## Limites e continuidade

- **Precisão das faixas**, por bloco exclusivo: no marc, alta 0,88, média 0,41 e baixa 0,20; no ledgerline-en, não há separação. A faixa baixa é limitada pela admissão do M0 (0,5), porque o corte baixo fica abaixo dela.
- **Limites aceitos:** uma faixa inválida numa resposta ao vivo aparece com rótulo vazio; os testes HTTP injetados não enviam `depth`.
- **Para a E3:**
  - decidir se `scoring/features.ts`, `judge-document.ts` e `synthetic-queries.ts` entram em produção ou vão para `scripts/memory-eval/`;
  - a calibração real das faixas é tema futuro;
  - a escolha de modelo por hardware fica para uma versão posterior.
- **Processo:** durante a T5, o desenvolvedor encerrou processos pelo texto da linha de comando, sem dano conhecido. A regra passou a ser encerrar só os PIDs iniciados pelo próprio agente.
