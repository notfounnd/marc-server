# Plano de desenvolvimento — Validação proporcional ao impacto da entrega

## Resumo

A thread 054fd58b trata da exigência indiscriminada de validate, build e testes em mudanças apenas documentais. O comentário msg_c660ed662ff74551b1 exemplifica o desperdício durante um ajuste Markdown. A investigação verificou que a exigência está no harness do projeto, não em um gate executável do mARC.

Objetivo: selecionar a validação pelo impacto real da entrega e pelo que será afirmado como concluído, sem reduzir a qualidade da revisão final integrada.

## Fontes e diagnóstico

- Thread marc://$oportunidade-gate-de-validacao-proporcional-ao-impacto-da-entreg-054fd58b e seus dois comentários.
- AGENTS.md, Custom Rules de .marc/RULES.md, docs/agent-workflows.md e docs/development.md.
- src/core/recommendations.ts preserva Custom Rules durante o refresh.
- src/core/audit/rules.ts verifica estrutura operacional das regras, sem executar a bateria do produto.
- src/core/audit/preflight.ts não implementa um gate de build ou testes.
- package.json define os comandos de validação, mas não determina quando o agente deve executá-los.
- .prettierignore exclui Markdown. O format:check geral não comprova a formatação destes documentos.
- memory_recall consultado para o propósito desta mudança não retornou decisões históricas relevantes.

## Política proposta

A classificação depende do impacto e da conclusão afirmada, não da extensão do arquivo.

1. Conteúdo editorial e registros mARC: conferir conteúdo, formatação, links, referências e metadados aplicáveis. Não executar a bateria do produto.
2. Harness: acrescentar revisão da coerência das instruções, autoridade das fontes, cenários de aplicação e preservação do fluxo. Alterar instruções não exige por si só build ou testes do produto.
3. Documentação com exemplos executáveis: verificar os exemplos afetados por checks específicos e seguros. Não executar automaticamente a bateria completa. Não executar exemplos destrutivos ou fora do escopo apenas para validar a documentação.
4. Código, testes, tooling, dependências, configuração executável ou mudanças nos contratos de parsing/persistência: executar pnpm validate, pnpm build e pnpm test, além dos checks específicos necessários.
5. Declaração de release pronta: exigir a bateria completa, mesmo quando a última alteração tenha sido documental.
6. Entrega mista: aplicar o conjunto de validações do impacto mais abrangente. Quando o impacto não estiver determinado, esclarecê-lo antes de dispensar checks.
7. Registrar classificação, checks realmente executados, resultados e limites na entrega consolidada. Um comando não aplicável não é um check aprovado nem uma pendência.

A exceção humana explícita permanece possível com escopo e limites declarados. Nenhum resultado pode ser afirmado sem evidência.

## Escopo e alterações

A tarefa de implementação é única, atômica e autocontida. Caminhos autorizados:

- AGENTS.md: resumir a política e remeter à regra canônica. Preservar o alerta de que pnpm validate executa correções mutáveis.
- .marc/RULES.md: substituir a regra indiscriminada somente em Custom Rules, usando Trigger, Do instead, Evidence e Severity. Preservar integralmente a parte gerenciada.
- docs/agent-workflows.md: fazer o handoff declarar impacto e checks proporcionais. O desenvolvedor reporta evidências e o principal verifica classificação e suficiência na revisão final.
- docs/development.md: substituir o checklist que exige a bateria para documentação, mantendo os comandos disponíveis e os checks específicos para mudanças MCP.

Não alterar código, testes, package.json, scripts, perfis, configurações de clientes, arquivos gerenciados ou históricos de outras threads. Não criar automação nem regras específicas de fornecedores. A thread 1d4c0daa e seus arquivos de implementação ficam fora deste escopo. docs/harness-engineering.md foi revisado e não duplica a exigência indevida, portanto não precisa de alteração.

## Execução e colaboração

- Principal: perfil compartilhado codex-software-architect. Modelo e reasoning conforme configuração já confirmada para a função de arquiteto, sem presumir introspecção.
- Desenvolvedor: perfil compartilhado codex-dev, solicitado com gpt-6-luna e reasoning xhigh, conforme acordo humano vigente.
- Uma tarefa, um desenvolvedor desta atividade. Não paralelizar subtarefas nem alterar o limite global do workspace.
- O desenvolvedor faz bootstrap independente, lê skill marc-ops, RULES completo, fontes da tarefa e plano, e retorna OK_BOOTSTRAP no canal interno.
- O principal confere workspace, fontes, regras críticas, configuração, situação dos alvos e escopo antes de autorizar edições.
- Usar context-mode para inspeção e resultados, Bash para comandos e apply_patch nativo para edições manuais. Não usar PowerShell nem Git.
- Coordenação, autorizações, checks e correções ficam no canal interno. Não manter diário em mensagens ou artefatos.
- O desenvolvedor publica sua própria entrega consolidada na thread sob o perfil compartilhado e devolve o ID da mensagem no relatório interno.
- O principal faz revisão final independente dos quatro documentos integrados. Achados retornam ao mesmo desenvolvedor. Após qualquer correção, revisar novamente o estado integrado e repetir os checks afetados.
- Não interromper nem encerrar um desenvolvedor apenas por silêncio. Verificar sua situação e eventuais aprovações pendentes.

## Validação desta entrega

Esta entrega altera apenas instruções e documentação. Aplicar checks localizados, sem pnpm validate, pnpm build ou pnpm test. A aprovação deste plano estabelece explicitamente esse escopo de validação, inclusive enquanto a regra anterior ainda estiver presente.

Checks:

- Parser Markdown e Prettier existentes, em modo somente leitura e com arquivos explicitamente selecionados.
- Links e âncoras locais dos quatro documentos.
- Comparação da parte gerenciada de RULES antes e depois.
- Revisão de escopo e preservação de alterações concorrentes. Não reverter mudanças de outro terminal.
- Auditoria estrutural com escopos aplicáveis. Preflight antes da implementação. Auditoria de regras e de mensagens/metadados nos checkpoints concluídos, sem substituir revisão técnica.
- Revisão de coerência: nenhum ponto alterado pode continuar exigindo a bateria completa indiscriminadamente para documentação.
- Não executar formatadores mutáveis globais nem build no checkout compartilhado.

## Cenários de aceitação

- Correção editorial no CHANGELOG não dispara bateria do produto.
- Alteração em AGENTS, RULES ou workflow exige revisão das instruções e cenários, não build automático.
- Exemplo executável alterado recebe verificação específica, sem execução cega ou destrutiva.
- Alteração em código, testes, dependências ou tooling continua exigindo validate, build e test.
- Mudança em contrato de parsing/persistência exige a bateria, mesmo quando o arquivo alterado é Markdown.
- Mudança comum de conteúdo em CHAT ou SUMMARY não se confunde com alteração do contrato de persistência.
- Entrega mista e declaração de release pronta exigem a bateria completa.
- Impacto incerto não permite omissão silenciosa dos checks.
- Auditoria limpa e ausência de build não substituem a revisão final independente.
- A entrega informa resultados reais e marca comandos não aplicáveis sem declarar que passaram.

## Entrega, revisão e aceite

Consolidar o relatório do desenvolvedor uma vez na entrega. O principal registra sua avaliação integrada com fontes, critérios, evidências, achados, limitações e veredito explícito.

A aprovação técnica comprova o contrato documental e sua coerência, não adesão futura de agentes ou validação comportamental em outra sessão. Não é necessário restart do produto para esta mudança.

Ao concluir, publicar o resultado na thread e aguardar feedback humano. Não encerrar a thread sem autorização explícita.

