# Complemento: rejeições dos guards e feedback de erros MCP

## Objetivo

Complementar a investigação já aberta com uma reprodução confirmada em 17/10/2026 e critérios para planejar a correção. O pedido do humano é melhorar o feedback dos erros. Este registro não autoriza implementação, mudança dos limites ou encerramento da thread.

## Ocorrência confirmada

A publicação do parecer sobre H7/H8 na E2 falhou repetidamente com `internal_error` e `Tool execution failed.`. A leitura da thread e o bootstrap funcionavam. Outro agente conseguiu publicar uma mensagem de teste.

O agente conferia apenas o limite de caracteres. A causa efetiva era outra restrição do corpo: mais de seis linhas com comprimento superior a 180 caracteres.

| Payload | Caracteres | Linhas | Linhas acima de 180 caracteres | Resultado do validador |
| --- | --- | --- | --- | --- |
| Original | 2.394 | 15 | 7 | Rejeitado |
| Com parágrafos separados | 2.397 | 21 | 6 | Aceito |

Apenas os separadores de parágrafo mudaram. O conteúdo do parecer foi preservado, e a publicação pelo próprio MCP funcionou. Não foi necessário alterar código, trocar de agente ou criar outra thread para publicar.

Parecer publicado:

marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2/#msg_e6821b4bae8e4e2b93

O agente deveria ter investigado o payload após a rejeição inicial. O feedback genérico contribuiu para tentativas repetidas e para suspeitas sem evidência sobre conexão e versões do cliente. A divergência de versões não é necessária para explicar esta falha reproduzida.

## Cadeia causal verificada

1. `src/core/guards.ts:6` a `:9` declara limites de 2.400 caracteres, 30 linhas e seis linhas longas. Uma linha longa tem mais de 180 caracteres.
2. `validateMessageBody`, em `src/core/guards.ts:43`, rejeita o payload e informa que há linhas longas demais.
3. `appendMessageInWorkspace`, em `src/core/threads.ts:64`, transforma a rejeição em uma exceção antes de adquirir o lock e gravar a mensagem.
4. `McpToolCoordinator.executeSafely`, em `src/mcp/tool-registration.ts:78`, captura qualquer exceção e devolve a mesma resposta genérica.
5. O cliente perde a distinção entre uma rejeição esperada, corrigível pelo autor, e uma falha interna inesperada.

A comprovação foi feita por leitura via context-mode, execução somente leitura da função pura de validação e publicação do parecer autorizado pela ferramenta oficial. Nenhum arquivo de código foi alterado.

## Direção para o planejamento

- Inventariar e classificar os erros esperados das ferramentas de escrita, começando pelos guards de mensagem e pelos casos já registrados nesta thread. Manter a correção proporcional ao problema, sem criar uma plataforma genérica de observabilidade.
- Preservar os motivos seguros de rejeição na borda MCP. Avaliar o padrão de erro tipado já usado por `ThreadSummaryError`, sem expor indiscriminadamente qualquer `Error.message`.
- Retornar código estável, explicação legível, valores observados, limites aplicáveis e orientação de correção. O agente deve saber se precisa corrigir a entrada ou investigar uma falha interna.
- Para linhas longas, informar a contagem encontrada, o limite permitido e o comprimento que caracteriza uma linha longa. Não limitar a explicação a caracteres totais.
- Tornar as restrições relevantes descobríveis na descrição ou no contrato da ferramenta. Essa orientação complementa o erro concreto, não o substitui.
- Manter o envelope MCP adotado pelo projeto e a sinalização de falha. Clientes sem tratamento especializado ainda devem receber uma mensagem textual útil.
- Continuar sanitizando erros inesperados. Não retornar stack traces, caminhos absolutos, tokens, conteúdo privado ou exceções arbitrárias. Não converter falhas reais em sucesso.

## Critérios de aceite propostos

1. Corpo vazio, excesso de caracteres, excesso de linhas e excesso de linhas longas têm motivos distinguíveis e acionáveis na resposta MCP. Uma rejeição conhecida não aparece somente como `internal_error`.
2. O caso observado informa sete linhas longas, máximo de seis e limiar superior a 180 caracteres, ou informação equivalente suficiente para a correção imediata.
3. Testes declarativos cobrem os limites inclusivos e os excessos: 2.400/2.401 caracteres, 30/31 linhas, seis/sete linhas longas e 180/181 caracteres por linha, isolando cada regra. Os cenários usam workspaces temporários.
4. Uma rejeição de guard não acrescenta mensagens ao CHAT nem é apresentada como publicação concluída. O corpo válido correspondente continua sendo publicado normalmente.
5. Os demais casos já investigados, como thread inexistente ou sufixo em ferramenta que exige ID completo, recebem feedback seguro e específico. Não mudar silenciosamente o contrato de IDs da escrita.
6. Uma exceção interna inesperada continua sanitizada e sinalizada como falha. Testes verificam a ausência de detalhes sensíveis e a preservação do envelope.
7. Documentação e descoberta das ferramentas descrevem o contrato efetivamente implementado. Validar na interface MCP real, além dos testes unitários, sem gerar mensagens de teste nas threads de trabalho.

## Decisões preservadas

- Não alterar os limites ou enfraquecer os guards para aceitar o payload que falhou.
- Não editar CHAT.md manualmente nem usar outra rota para contornar a validação.
- Não tornar a escrita compatível com sufixos como efeito colateral.
- Preservar as decisões de erros seguros e integração MCP da thread abaixo.

marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787

## Próximo passo

Ao executar esta oportunidade, consolidar o inventário e registrar um plano de desenvolvimento antes de implementar. A thread permanece aberta, sem desenvolvimento iniciado neste complemento.
