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

<!-- marc-message
id: msg_2d4fa821fde146298f
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-13T21:56:31.831Z
agentId: ui-user
role: user
-->

Sugestão para busca sem resultados:

- Exibir botão para busca com minScore mais permissivo.

Fluxo:

- Usuário realiza busca.
- Busca termina sem resultados.
- Coluna do meio apresenta segundo botão (abaixo do Search original) com nome Deep retry.
- Usuário clica (se quiser).
- UI dispara busca com minScore reduzido.

<!-- /marc-message -->

<!-- marc-message
id: msg_413e3152feb2465980
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-13T22:21:15.608Z
agentId: ui-user
role: user
-->

Outra sugestão para busca sem resultados:

- Sistema gera autoretry baixando minScore (para evitar recarregamento do modelo).

Fluxo:

- Usuário realiza busca.
- Ação gera retorno sem resultados de busca.
- Sistema internamento decrementa 0.1 e realiza retentativa de busca.
- Ciclo se repete até encontrar resultado OU até chegar em ultima busca com minScore 0.

Isso possibilita que o usuário configure quantidade de retries (slider em modo controlled) que o sistema irá realizar no painel de configuração.

```
edge                 deep
 ()-----||-----||-----|| // apenas search original 0.15
 ||-----()-----||-----|| // até 1 iteração adicional (search com 0.15 / 0.10)
 ||-----||-----()-----|| // até 2 iteração adicional (search com 0.15 / 0.10 / 0.05)
 ||-----||-----||-----() // até 3 iteração adicional (search com 0.15 / 0.10 / 0.05 / 0.00)
```

Nessa opção, também será necessário melhorar a mensagem de No results.

<!-- /marc-message -->
