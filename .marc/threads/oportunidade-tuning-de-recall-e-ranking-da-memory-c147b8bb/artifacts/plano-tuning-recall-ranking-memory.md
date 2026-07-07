# Tuning de Recall e Ranking da Memory

## Resumo

- Thread alvo: marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb.
- Problema confirmado: `memory_recall("implementar rotacao de token da interface")` encontra a thread correta de token, mas hoje ela fica em 3º lugar, atrás de threads genéricas de UI.
- Solução: manter a busca vetorial como fonte de candidatos, mas adicionar reranking local híbrido com sinais lexicais e boost de seção decisória antes de deduplicar e limitar resultados.

## Mudanças Principais

- Antes do código, anexar na thread um artifact `artifacts/plano-tuning-recall-ranking-memory.md` com este plano e postar comentário curto referenciando o artifact.
- Em `src/core/memory/operations.ts`, trocar o fluxo direto `search -> convert -> dedupe` por `search expanded candidates -> rank -> dedupe best per thread -> limit`.
- Buscar mais candidatos que o `limit` final: `candidateLimit = min(max(limit * 6, 30), 100)` e `candidateMinScore = min(minScore, 0.05)`.
- Adicionar ranking determinístico:
  - `finalScore = clamp(0.70 * vectorScore + 0.25 * lexicalScore + 0.05 * sectionBoost)`.
  - `lexicalScore`: termos normalizados da query, sem acento, comparados contra título, seção e texto do chunk.
  - `sectionBoost`: dispatch table, com maior peso para `Decisão/Decisões/Decision/Decisions`, peso médio para arquitetura/risco/segurança/validação, peso baixo para resultado/contexto.
  - desempate: `finalScore`, depois `lexicalScore`, depois `vectorScore`, depois `threadId`.
- Manter contrato externo enxuto:
  - inputs MCP/CLI seguem iguais: `query`, `limit` e `minScore`.
  - output segue com os mesmos campos.
  - `score` passa a representar relevância final ranqueada.
  - `reason` passa a explicar sinais relevantes, em en-US, por exemplo termos exatos e seção decisória.
- Atualizar `docs/memory.md` para documentar que recall usa ranking híbrido local sobre candidatos vetoriais e que `.marc/memory` continua sendo snapshot derivada de `SUMMARY.md`.

## Testes e Validação

- Escrever teste vermelho antes da mudança: consulta `implementar rotacao de token da interface` deve ranquear a thread de token acima de uma thread genérica de UI, mesmo quando a UI tiver score vetorial bruto maior.
- Cobrir deduplicação após ranking: quando a mesma thread aparece em vários chunks, o melhor chunk ranqueado representa a thread.
- Cobrir `reason`: deve indicar seção decisória ou termos exatos quando esses sinais afetarem ranking.
- Manter testes existentes de scanner, rebuild, status, MCP e model_missing.
- Rodar validação final via context-mode/Bash:
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`
- Validar a query real após desenvolvimento. Se a tool MCP ativa não carregar o código novo sem restart, avisar explicitamente antes de pedir reinício.

## Assumptions

- Nenhum comando `git`.
- Nenhum browser/MCP Playwright; esta evolução não exige UI.
- Comunicação mARC e resposta ao usuário em pt-BR; código, docs e textos de produto em en-US.
- Não alterar corpus da v1: continua indexando apenas `.marc/threads/*/SUMMARY.md`.
- Não alterar provider de embedding, LanceDB schema persistido ou formato de `.marc/memory` além do comportamento de consulta.
- Preservar Markdown como fonte da verdade; ranking é projeção derivada e reconstruível.
- Código deve seguir regras locais: sem `else`, sem `if` aninhado, guards com early return e dispatch table para variação de seção.
