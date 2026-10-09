# Resumo executivo

Thread: marc://$documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81
Closed: `2026-10-09T03:33:26Z`

## Objetivo e aceite

Documentar o fluxo de desenvolvimento em loop e sua politica de modelos, reasoning, delegacao, revisao e encerramento. Consolidar as identidades persistentes dos agentes e corrigir a apresentacao dos perfis na UI.

O humano autorizou explicitamente o encerramento nesta conversa. A aprovacao tecnica foi registrada antes do aceite. Nao ha pendencia de implementacao nesta thread.

## Fluxo consolidado

- AGENTS.md orienta a entrada local, docs/agent-workflows.md detalha o procedimento e Custom Rules em .marc/RULES.md estabelece as obrigacoes. A parte gerenciada das regras foi preservada.
- O principal planeja, orquestra, integra, revisa o desenvolvimento completo e concede aprovacao tecnica. Usa modelo de alta capacidade com reasoning minimo medium e recomendado high.
- Desenvolvedores recebem tarefas atomicas, autocontidas, claras e completas, com escopo autorizado, fontes, criterios de aceite, verificacoes, exclusoes e condicoes de bloqueio. Usam modelo adequado ao escopo com reasoning minimo high e recomendado xhigh.
- Modelo e reasoning sao tratados separadamente. Configuracao solicitada e efetiva, origem da confirmacao e limites do cliente devem ser registrados sem inventar introspeccao. Configuracao desconhecida, incompatibilidade ou capacidade abaixo do minimo exige consulta ao humano antes da implementacao.
- O teto padrao e dois desenvolvedores, salvo override humano confirmado e respeitados os limites do cliente. E um maximo, nao uma meta. O teste atual deste workspace permanece sequencial com um desenvolvedor ativo ate nova orientacao humana.
- Cada desenvolvedor faz bootstrap independente, le marc-ops e o contrato completo, confirma OK_BOOTSTRAP e aguarda autorizacao explicita antes de editar. Context-mode, Bash e apply_patch permanecem obrigatorios conforme as regras locais.
- A revisao independente cobre requisitos, comportamento, arquitetura, manutencao, regras, testes e documentacao. Achados voltam ao mesmo desenvolvedor ate atingir o criterio de qualidade. Auditoria estrutural nao substitui essa revisao.
- Apenas o humano aceita o resultado e autoriza SUMMARY.md e encerramento. A documentacao e local a este repositorio, sem hooks ou configuracao de terceiros no produto mARC.

## Perfis persistentes

- Cadastro ativo limitado a codex-software-architect, role architect, modelo gpt-6.1-sol, e codex-dev compartilhado, role developer, modelo gpt-6-luna, alem de ui-user preservado.
- Reasoning atual high para o principal e xhigh para os desenvolvedores consta no contexto manual com origem da confirmacao humana. Nao integra o campo Model nem implica observacao runtime.
- Description continua em uma linha conforme o contrato do MCP. Responsabilidades, limites e configuracao foram complementados em bullets abaixo dos metadados e preservados em novo registro.
- Somente o principal administra o cadastro e registra as entregas no mARC. Subagentes temporarios reutilizam codex-dev sem perfis por tarefa ou spawn. A identidade runtime e variacoes de configuracao ficam nas evidencias da tarefa.
- Cinco perfis redundantes foram removidos. Snapshot dos perfis anteriores foi anexado antes da remocao. Autoria e corpos das mensagens historicas nao foram reescritos.

## Apresentacao dos agentes

MarkdownPanel recebeu preserveLineBreaks desativado por padrao e ativado apenas na visualizacao dos agentes. CSS white-space pre-line preserva quebras simples dos paragrafos e mantem wrapping de texto longo. Threads, mensagens, artefatos e regras permanecem com a renderizacao padrao.

Arquivos dos perfis, parsers e metadados nao foram modificados por esse ajuste de UI. O principal realizou esta correcao diretamente, conforme excecao humana explicita para o ajuste simples, sem alterar a regra geral de desenvolvimento delegado.

## Validacao

- Planos e revisoes anexados pelo MCP antes das respectivas implementacoes e registros de entrega. Bootstrap e autorizacoes dos desenvolvedores registrados.
- pnpm validate, pnpm build e pnpm test passaram na ordem estabelecida. Rodada final com 199 testes, zero falhas e zero skips. O build apresentou somente o warning conhecido de bundle acima de 500 kB.
- Regressao de UI reproduziu a ausencia da opcao antes da correcao e passou depois. E verificacao de integracao por fonte, nao teste visual de navegador.
- Prettier API verificou os Markdown da consolidacao e os links locais foram conferidos.
- MCP confirmou exatamente tres perfis. Novo agent_register retornou unchanged para os dois perfis Codex, preservando o contexto manual em bullets.
- ui-user, prefixo gerenciado de RULES.md e 284 arquivos protegidos de codigo, testes, scripts e historico das outras threads permaneceram intactos durante a consolidacao.
- Auditorias agents e messages passaram sem findings. A auditoria de mensagens do encerramento foi executada apos o registro completo dos anexos.
- HTTP 200 da UI confirmou referencias aos assets do novo build. Nao foi registrada execucao visual automatizada desktop/mobile.

## Limites e continuidade

Os links para os cinco perfis removidos nao resolvem mais no cadastro ativo. Nove mensagens conservam esses autores historicos. O snapshot tambem documenta que codex-dev anteriormente representava o principal, antes de passar a representar desenvolvedores. Nao foram criados aliases nem reatribuidas mensagens de outros ferramentais ao Codex.

O backlog de marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a foi revisado e recebeu cenarios pendentes para quebras dos metadados, wrapping responsivo, conteudo Markdown dos perfis e isolamento do restante do renderizador. Cobertura E2E duravel continua nessa oportunidade, sem bloquear o encerramento autorizado desta thread.

Os planos, o snapshot e as revisoes detalhadas permanecem nos artefatos anexados ao historico desta thread. O mecanismo de busca e os contratos do produto nao foram alterados.
