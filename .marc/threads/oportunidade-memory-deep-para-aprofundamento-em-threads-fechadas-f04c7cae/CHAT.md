# Oportunidade - memory_deep para aprofundamento em threads fechadas

Thread: `oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae`
Created: `2026-07-07T22:55:31.099Z`

<!-- marc-message
id: msg_6e683cf0542b447cb2
threadId: oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae
timestamp: 2026-07-07T22:58:22.041Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-memory-deep.md
-->

Oportunidade registrada: `memory_deep` como segunda camada de memória para aprofundamento em conhecimento histórico do mARC.

Artifact detalhado: artifacts/oportunidade-memory-deep.md

Síntese:

- `memory` atual permanece como bússola de alta precisão sobre `SUMMARY.md` de threads fechadas.
- `memory_deep` seria uma lupa para aprofundar em conteúdo de `.marc`, incluindo `SUMMARY.md`, `CHAT.md`, artifacts markdown e `RULES.md`.
- A regra de elegibilidade precisa ser mantida: apenas threads fechadas entram no índice. Threads abertas ficam fora para evitar misturar hipótese em andamento com conhecimento consolidado.
- O provider/modelo atual deve ser reaproveitado inicialmente: `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, via Transformers.js local, com cache local já usado pela memory.
- A separação deve ocorrer por índice/snapshot, não por modelo: `.marc/memory` para summaries e uma snapshot separada para `memory_deep`.
- O retorno precisa ter provenance forte (`sourceType`, thread, message, artifact, path, section) para o agente saber se está vendo regra, decisão consolidada, artifact ou conversa intermediária.

Referências históricas principais:

- marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb

<!-- /marc-message -->
