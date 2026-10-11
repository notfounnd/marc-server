# Avaliação integrada — Validação proporcional ao impacto

## Resultado

**Veredito técnico: approved.** A política proporcional foi implementada no harness sem exigir código novo ou um gate executável. O resultado satisfaz o plano aprovado e mantém a revisão final independente, a entrega autoral do desenvolvedor, a proibição de diário e a separação entre aprovação técnica, aceite humano e fechamento.

A aprovação se refere à coerência do contrato documental e às verificações realizadas. Não comprova adesão futura de agentes nem valida uma release do produto.

## Estado integrado e fontes revisadas

Foram revisados os quatro documentos autorizados em conjunto, o plano anexado, a thread e o relatório do desenvolvedor:

- AGENTS.md, especialmente a seção Validation e a preservação dos contratos de bootstrap, colaboração e revisão.
- .marc/RULES.md, especialmente a regra Select validation by delivery impact em Custom Rules.
- docs/agent-workflows.md, especialmente brief, relatório, publicação autoral e revisão independente.
- docs/development.md, especialmente Validation by impact e verificação de mudanças executáveis MCP.
- artifacts/plano-validacao-proporcional.md.
- artifacts/relatorio-validacao-proporcional-entrega.md.
- Entrega autoral msg_6716ae41c7df44a6a2, publicada como codex-dev, com metadados de anexo conferidos pelo principal.

O bootstrap independente e a autorização explícita foram verificados no canal interno antes da edição. O desenvolvedor usou o perfil compartilhado já existente, com gpt-6-luna e reasoning xhigh solicitados pelo principal conforme configuração humana vigente. Nenhuma introspecção de modelo foi alegada. Uma tarefa foi executada por um desenvolvedor desta atividade.

Os fingerprints dos quatro documentos não mudaram entre a leitura integrada do principal e a conferência posterior à entrega final.

## Critérios ligados à implementação e evidências

| Critério | Implementação integrada | Evidência verificada pelo principal |
| --- | --- | --- |
| Não disparar bateria por conteúdo editorial | RULES distingue editorial, changelog e registros mARC de mudança executável | Leitura da regra e comparação com AGENTS e guia de desenvolvimento |
| Tratar harness sem confundir com runtime | Checks locais mais revisão de coerência, autoridade, cenários e fluxo | Política nos documentos e revisão dos cenários de aceitação |
| Não dispensar testes só pela extensão Markdown | Mudanças em contratos de parsing/persistência continuam exigindo bateria | Regra explícita, com contraste para conteúdo comum de CHAT e SUMMARY |
| Verificar exemplos com segurança | Checks específicos, sem execução destrutiva ou fora do escopo | Leitura da regra canônica e do guia de desenvolvimento |
| Preservar bateria para mudanças executáveis e release | validate, build e test continuam exigidos para código, testes, tooling, dependências, configuração executável e release pronta | Comandos e condições conferidos nos documentos integrados |
| Tratar entrega mista e incerteza | Maior impacto determina checks, incerteza deve ser esclarecida, exceção humana declara escopo e limites | Leitura da regra e coerência com seleção no brief |
| Não confundir ausência de comando com aprovação ou pendência | Classificação, checks reais, resultados e limites entram no relatório | Campos do workflow, regra Evidence e entrega do dev |
| Preservar autoridade e manutenção | RULES permanece canônico e o prefixo gerenciado não mudou | Comparação de hash e links das instruções |
| Manter revisão completa e autoria | Principal verifica classificação e suficiência das evidências, sem substituir revisão integrada ou escrever a entrega do dev | Leitura do workflow e mensagem do desenvolvedor conferida no MCP |
| Não interferir em trabalho paralelo | Edições desta tarefa restritas aos quatro documentos autorizados | Escopo declarado pelo dev, inspeção dos alvos e identificação separada de mudanças concorrentes |

Os dez cenários do plano foram avaliados pela leitura da política e de seus pontos de aplicação. Isso é uma verificação do harness, não um teste comportamental automatizado de agentes.

## Avaliação de qualidade

A causa da exigência indiscriminada foi removida na fonte canônica e nos pontos que a reforçavam. O entrypoint resume a seleção e remete às fontes, o workflow exige a classificação no handoff e no relatório, e o guia de desenvolvimento deixa de tratar toda documentação como impacto executável.

A abordagem permanece agnóstica a fornecedores e clientes. Não foram criados scripts, hooks, seletores automáticos, schemas ou configurações. A seleção depende da natureza da entrega e da afirmação de conclusão, não de uma lista de extensões.

Os contratos anteriores de bootstrap independente, autorização antes da edição, perfil compartilhado, publicação autoral, formato de mensagens, ausência de diário, revisão integrada e aceite humano continuam presentes. A nota sobre efeitos mutáveis de pnpm validate permanece uma única vez em AGENTS.

Mudanças executáveis MCP mantêm a instrução de bateria completa, inspeção do servidor construído e restart do cliente para validação live quando aplicável. Essa condição não se aplica a esta entrega de harness.

## Checks e limites

Executados diretamente pelo principal, após a entrega final:

- Parser Markdown e API read-only do Prettier nos quatro documentos: aprovados.
- Links e âncoras locais pelo AST real, sem confundir headings dentro de exemplos fenced: 32 referências, zero problemas.
- Prefixo gerenciado de RULES: hash idêntico ao baseline.
- Busca das formulações antigas que obrigavam a bateria indiscriminadamente para documentação: removidas nos quatro documentos.
- Conferência de contratos preservados do loop, única nota de validate mutável e estabilidade dos fingerprints: aprovada.
- workspace_audit, scope rules: zero achados.
- workspace_audit, scope messages, na entrega do dev após os metadados do anexo: zero achados.

O desenvolvedor também reportou parsing, formatação, links, prefixo, cenários e auditoria de regras. O principal repetiu os checks estruturais relevantes e conferiu sua entrega, sem tomar o relatório do executor como substituto da avaliação integrada.

pnpm validate, pnpm build e pnpm test não foram executados nesta atividade. São não aplicáveis ao escopo documental aprovado, não checks aprovados nem pendências.

O dev registrou falha na importação opcional de remark-gfm devido a uma dependência transitiva ausente no cache. Os checks desta tarefa usaram remark-parse e Prettier Markdown sem alterar dependências. Não foi introduzida funcionalidade GFM nova. Renderização de UI e comportamento futuro de agentes não foram exercitados nem alegados.

## Achados, correções e escopo concorrente

A conferência preliminar identificou duplicação do alerta de validate em AGENTS e links para um heading que só existia dentro de um exemplo fenced. Os pontos foram devolvidos ao desenvolvedor internamente e resolvidos antes da avaliação final. Os checks foram repetidos no estado corrigido. Não há achados técnicos pendentes no escopo desta entrega.

O snapshot geral também identificou alterações concorrentes em arquivos de resolução de threads MCP e sua documentação, compatíveis com a atividade 1d4c0daa. Elas não foram revertidas, classificadas como parte desta entrega nem aprovadas nesta revisão. A declaração de ausência de alterações de produto refere-se ao escopo executado pelo dev desta thread, não ao checkout compartilhado como um todo.

## Veredito e próxima etapa

**approved**, porque a implementação remove a exigência documental excessiva, preserva a bateria para impactos executáveis e release, exige evidências proporcionais, mantém os contratos do loop e passou pelas verificações independentes descritas.

O próximo passo é o feedback humano. A thread permanece aberta. Não foi criado SUMMARY nem efetuado fechamento. Não é necessário rebuild ou restart do produto por esta mudança. Agentes em sessões já ativas precisam ler o contrato atualizado antes de confiar nas instruções anteriores.

Qualquer alteração posterior nos documentos invalida este veredito para o novo estado e exige reavaliação integrada e repetição dos checks afetados.

