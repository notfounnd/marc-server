# Oportunidade - Calibragem de recall lexical e candidatos da memory

Thread: `oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac`
Created: `2026-07-09T04:47:32.194Z`

<!-- marc-message
id: msg_997ed75e07184ee89f
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-09T04:48:13.966Z
agentId: codex-dev
role: developer
artifacts: artifacts/diagnostico-calibragem-memory.md
-->

Oportunidade registrada: calibragem de recall lexical e candidatos da memory.

Motivacao:
- A UI e a tool MCP usam a mesma calibragem default (`recallMemory`, `limit 5`, `DEFAULT_MIN_SCORE = 0.15`).
- Mesmo assim, a query `brutalism` retornou vazio com default, apesar de existirem summaries fechados com `brutalism` / `neobrutalism`.
- Com `minScore: 0`, a mesma query retornou resultados relevantes, incluindo marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1.

Hipotese tecnica:
- O filtro vetorial de candidatos pode estar eliminando registros lexicalmente relevantes antes do reranking lexical/exact-term.

Pontos para investigar:
- Ajustar candidate threshold.
- Adicionar fallback lexical antes do reranking.
- Avaliar `show more`/busca ampliada na UI para reduzir risco do `limit 5`.
- Criar teste de regressao para termo exato presente em SUMMARY.md.

Detalhes registrados em artifacts/diagnostico-calibragem-memory.md.

<!-- /marc-message -->

<!-- marc-message
id: msg_7e6dd835976040ca8f
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-09T05:05:19.367Z
agentId: codex-dev
role: developer
-->

Comentário adicional sobre o `limit` da busca na UI.

A discussão atual deve ser tratada como tópico separado da calibragem de recall lexical: o ponto aqui é apenas o limite de resultados exibidos para o humano na interface.

Decisão proposta:

- Manter o default baixo da tool/MCP para agentes, pois o agente tende a aprofundar com novas consultas.
- Aumentar somente o limite usado pela UI, porque o humano interpreta a tela como uma visão mais completa do histórico.
- Usar um teto defensivo, não busca infinita. Valor inicial recomendado: `MEMORY_SEARCH_UI_LIMIT = 50`.
- Não adicionar `show more` nesta etapa. A UI pode renderizar todos os resultados retornados até o teto.

Racional:

- `limit: 5` é adequado para exploração incremental por agente, mas pode induzir o usuário a acreditar que há apenas cinco itens relevantes no histórico.
- `limit: 50` reduz esse risco sem transformar a busca em varredura/renderização ilimitada.
- O ajuste deve ficar isolado no contrato da UI, sem alterar o default global do recall.

<!-- /marc-message -->
