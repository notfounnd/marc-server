# Motor de busca v2 - E0 Base de avaliação e diagnóstico causal

Thread: marc://$motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b

Closed: `2026-10-17T20:35:07.050Z`

---

Primeira etapa do programa motor de busca v2. Entregou o harness offline `memory:eval`, dois corpora julgados (`marc` e o fictício `ledgerline-en`) e o baseline M0, que serve de referência para medir as etapas E1 a E4. O marc://@claude-software-architect aprovou o resultado na revisão técnica, e o marc://@codex-software-architect concordou com ressalvas, que foram corrigidas. O humano aceitou a E0 e autorizou o encerramento. Nada foi alterado em `src/`, e o índice de produção ficou intacto: o manifest continua com o hash `123a7720…ba0d7`.

## Entrega

- **Harness:** `scripts/memory-eval/` tem os comandos `validate`, `capture`, `worksheet`, `merge-judgments`, `latency`, `replay`, `report` e `compare`. Também traz as métricas com alcance declarado (`metricReach`), um bootstrap pareado por família, o McNemar, a atribuição da perda e as variantes M0, D0, ORACLE_ADMISSION e PRODUCTION_RECALL. O script fica no `package.json` como `memory:eval`.
- **Datasets:** `marc.json` tem 114 casos sobre um corpus fixado de 56 threads, e `ledgerline-en.json` tem 40 casos. Os julgamentos foram feitos por dois avaliadores independentes e fechados por consenso. O artifact consenso-julgamentos-e0.md registra esse consenso.
- **Documentação:** a subsecção "Evaluation harness (memory:eval)" de `docs/memory.md`.
- **Testes:** 109 testes do harness, e a suíte completa ficou com 410 de 410.
- **Relatórios:** os artifacts report-e0-marc.md e report-e0-ledgerline-en.md.

## Decisões durante a execução

O histórico do plano registra cada uma delas.

- **Revisão 4:** a identidade da captura passou a usar o `queryFingerprint`. Com isso, gravar julgamentos não invalida mais a captura.
- **Revisão 5:** o corpus `marc` foi fixado, com um `corpusDigest`.
- **Revisão 6:** a latência saiu da captura e virou um comando próprio.
- **Revisão 7:** o CA1 foi dividido em duas partes, porque o reranker fp16 faz o score depender do padding do lote. O CA1a (caminho exato) passou em 154 de 154. O CA1b (sequência de threads) passou em 153 de 154. O caso 9I foi aceito porque cumpriu a condição de impacto: as métricas da lista admitida são idênticas entre M0 e PRODUCTION_RECALL.
- **Revisão 8:** por decisão do humano, a latência foi medida com a carga típica de desktop, com dois agentes abertos. As próximas etapas repetem essa condição, e ela não vale como prova para máquinas de 8 GB.
- **Julgamentos:** o kappa da primeira rodada ficou em 0,683 no ledgerline-en e 0,395 no marc. As divergências foram adjudicadas com uma escala revisada, e o relatório mantém o kappa da primeira rodada.

## Baseline M0, de 17/10/2026

- **marc:** Top1-alvo de 0,67; ORACLE_ADMISSION chega a 0,94; fullRecall10 de 0,917. A perda vem da admissão em 32 casos e da ordenação em 14, com nenhuma no recall de candidatos. Latência mediana de 18,2 s e p95 de 20,3 s.
- **ledgerline-en:** Top1-alvo de 0,882. Latência mediana de 5,7 s e p95 de 6,2 s.

## Continuidade

- **Prioridade definida pelo humano:** primeiro a qualidade da busca, depois a otimização da latência.
- **E2:** a perda está na admissão e na ordenação, e a interpretação sugere correções sem necessidade em 15 de 26 casos. Candidatos para um adendo, que precisa da coaprovação:
  - Qwen3-Reranker-0.6B ou Kev-0.6B como juiz de admissão sobre o top-N;
  - Laya multilingual, Kev-0.6B ou o LFM lendo logits para escolher entre as correções candidatas.
  - Os julgamentos da E0 não podem servir de treino.
- **E3:** a busca leva de 12 a 20 s com os modelos carregados, e o custo está na recuperação e no reranking.
- **Fora do escopo:** a CLI `marc memory recall` fica aberta cerca de 300 s depois de responder, por causa do TTL do interpretador.
- **Referências:** o plano, a revisão final (revisao-final-e0.md, msg_e86ae78b52ee4a308d e msg_7ea277c5fe0e419e87), o parecer do coaprovador (msg_de136b744e7c432389) e as entregas do desenvolvedor (msg_50f79445e0164eb8a2 e msg_f044e6610f5b4da788).
