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

<!-- marc-message
id: msg_d287b80fc349495384
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-21T01:24:42.112Z
agentId: ui-user
role: user
-->

Nessa segunda opção, caso ainda tenha espaço até chegar a zero, a terceira coluna pode exibir um botão para fazer mais um nível complementar de busca.

Exemplo:

- Busca configurada em slider 2 `||-----()-----||-----||`.
- Busca traz resultado e ao final um botão de Deep retry.
- Usuário clica.
- Faz mais uma rodada, como se slider tivesse na posição 3 `||-----||-----()-----||`.
- Busca traz resultado e ao final um botão de Deep retry.
- Usuário clica.
- Faz mais uma rodada, como se slider tivesse na posição 4 `||-----||-----||-----()`.
- Busca traz resultado e por ser o último nível o botão de Deep retry não é exibido.

<!-- /marc-message -->

<!-- marc-message
id: msg_fba65c3bb53048dcb4
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-21T01:26:53.689Z
agentId: ui-user
role: user
-->

Essa thread tem um nível de afinidade muito grande com a thread marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae .

Eu ainda vou querer fazer um deep search que olha para todo conteúdo da thread, mas ainda não tenho uma ideia de como isso ficará implementado e nem como vou adicionar isso na interface.

<!-- /marc-message -->

<!-- marc-message
id: msg_5f84ca7201e24b958a
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-21T02:20:45.899Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-busca-gradual-memory-ui.md
-->

Plano detalhado registrado antes do desenvolvimento.

Decisoes confirmadas:

- A recuperacao da memory nao sera alterada.
- A UI passa a aprofundar a mesma consulta apenas por minScore.
- Toda nova query inicia em 0.15 e nao herda Deep retry anterior.
- O slider fica apenas no painel de configuracao da workspace.
- Deep retry aparece na coluna 2 abaixo do conteudo da busca.
- A UI usa limite 50 e a MCP preserva limite 5.

Preflight e auditoria do artifact nao retornaram achados. Inicio agora a implementacao e os testes previstos.

<!-- /marc-message -->

<!-- marc-message
id: msg_12b6655709084f30ba
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-21T03:03:26.870Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluido e validado.

Realizado:
- Adicionado memory.searchRetryDepth por workspace, com slider de 0 a 3 no painel de configuracao.
- A UI inicia toda nova query em minScore 0.15 e aplica apenas os retries automaticos configurados.
- Adicionado Deep retry abaixo do conteudo da busca. Cada acao usa somente o proximo nivel disponivel.
- Separado profundidade configurada de retries manuais no estado ativo e no snapshot por workspace. Uma nova query nunca herda a profundidade anterior.
- Elevado apenas o limite da UI para 50 resultados. A tool MCP preserva o default de 5.
- Mantidos corpus, candidatos, ranking e contrato de recall inalterados.
- Atualizada a documentacao da memory e ampliada a cobertura do painel, da politica de profundidade e do snapshot.

Validacao:
- pnpm run validate passou.
- pnpm test passou com 134 testes.
- pnpm build passou.
- workspace_audit preflight retornou 0 achados.

Reinicio para validacao manual:
- Agora e o momento de reiniciar o daemon e a sessao do agente para carregar as alteracoes de backend e MCP. Depois, a UI podera ser validada com o slider e os fluxos de busca.

Aguardando seu feedback para orientar a finalizacao da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_81c7036eb17b4e648b
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-21T03:13:11.464Z
agentId: codex-dev
role: developer
-->

Ajuste de composicao concluido.

- Search depth foi movido para uma area Search propria, acima da area Memory.
- Memory voltou a agrupar apenas status, automatic memory rebuild, embedding batch size e acoes de modelo e rebuild.
- O slider de Search depth agora mostra Edge na extremidade esquerda e Deep na direita, conforme a escala definida na thread.
- O teste de configuracao verifica o novo cabecalho, os extremos e a ordem entre Search e Memory.

Validacao repetida:
- pnpm run validate passou.
- pnpm test passou com 134 testes.
- pnpm build passou.

O reinicio do daemon e da sessao do agente ja pode ser feito para validacao manual.

<!-- /marc-message -->

<!-- marc-message
id: msg_828af5c6cfc7421bb0
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-21T03:26:30.081Z
agentId: codex-dev
role: developer
-->

Ajuste complementar concluido.

- Consultei a documentacao do Switch pelo Context7 antes da alteracao.
- O padrao da biblioteca foi preservado: Label htmlFor e Switch id usam workspace-memory-auto-rebuild.
- Automatic memory rebuild agora exibe o texto a esquerda e o switch a direita.
- Memory status passou de strong para Label, alinhando o painel ao padrao dos demais rotulos.
- O teste de configuracao cobre o Label de status e a ordem visual do texto antes do Switch.

Validacao repetida:
- pnpm run validate passou.
- pnpm test passou com 134 testes.
- pnpm build passou.

O reinicio do daemon e da sessao do agente ja pode ser feito para validacao manual.

<!-- /marc-message -->

<!-- marc-message
id: msg_4e3897f5e11746ae98
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-21T03:57:33.957Z
agentId: codex-dev
role: developer
-->

Correção de regressão concluída.

Causa:
- `AppSidebar` recebia `memorySearchDeepRetryAvailable` e `onMemorySearchDeepRetry`, mas não os encaminhava para `AppSidebarMiddle`.

Realizado:
- Restabelecido o repasse dos dois props para a coluna de busca.
- Adicionado teste de regressão para esse limite de componentes.
- Mantida a política definida: uma busca em `Edge` com resultados ainda oferece `Deep retry`; o botão só desaparece quando a profundidade final é atingida.

Validação:
- Teste focado passou com 5 testes.
- `pnpm run validate` passou.
- `pnpm test` passou com 135 testes.
- `pnpm build` passou.
- No navegador, a busca `brutalism` exibiu 3 resultados e 1 botão `Deep retry`, sem erros de console.

Documentação:
- Nenhuma atualização necessária. O comportamento documentado já era o pretendido; a correção restaura sua renderização.

<!-- /marc-message -->

<!-- marc-message
id: msg_b1e85efcd5f440b9a6
threadId: oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
timestamp: 2026-07-21T04:43:56.865Z
agentId: codex-dev
role: developer
-->

Thread encerrada.

Entrega concluída:
- Busca progressiva por minScore na UI, com configuração por workspace e Deep retry manual.
- Correção do repasse de estado que impedia a renderização de Deep retry.
- Backlog Playwright atualizado para a cobertura E2E do fluxo.

Continuidade:
- A descoberta de que `limit` também altera os candidatos de recall foi isolada em marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba.
- A oportunidade derivada tratará candidatos lexicais e elegibilidade semântica sem fazer match literal virar resultado automático.

<!-- /marc-message -->
