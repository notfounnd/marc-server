# Revisao tecnica e validacao do fluxo em loop

## Resultado

O principal aprovou a entrega tecnica apos duas rodadas de ajustes de precisao. Esta e uma alteracao documental e de contrato local, nao uma implementacao de enforcement em runtime. A thread permanece aberta para revisao do humano e nao tem SUMMARY.md.

## Arquivos

- docs/agent-workflows.md documenta papeis, modelo/effort, confirmacao humana, teto de agentes, brief completo, bootstrap/autorizacao, templates de retorno, revisao iterativa e aceite humano.
- .marc/RULES.md recebeu seis regras criticas de Development Loop abaixo da fronteira de Custom Rules, apos Code Style. A unica mudanca em regras anteriores foi a ordem pnpm validate, pnpm build e pnpm test.
- AGENTS.md foi alinhado ao contrato e ao procedimento, sem versionar familias de modelos como whitelist nem mover a fonte normativa para a entrada.

## Bootstrap e autorizacao comprovados

Desenvolvedor delegado gpt-6-luna com reasoning xhigh. O principal usou a configuracao gpt-6.1-sol/high informada pelo usuario. O usuario tambem confirmou a configuracao atual dos desenvolvedores. Os parametros do spawn selecionam o perfil solicitado, mas o registro nao afirma uma introspeccao de efetividade inexistente.

O desenvolvedor fez workspace_bootstrap independente e conferiu workspace marc-dd422176e1 em C:/Projetos/marc, skill marc-ops, INSTRUCTIONS.md e RULES.md completos, AGENTS, README, docs/agent-workflows, docs/harness-engineering, ADR 0007, package.json, esta thread e seu plano. O principal verificou o OK_BOOTSTRAP e autorizou explicitamente os tres caminhos antes da primeira edicao. A autorizacao tambem esta registrada na mensagem msg_fa0b2b2a24d3411c80.

Execucao sequencial. O limite padrao documentado e dois desenvolvedores, mas o ensaio sequencial previamente definido pelo humano continua prioritario. Workers aguardando aprovacao ocupam a vaga. Nenhum agente foi encerrado por suposto travamento.

## Achados devolvidos e corrigidos

- Requisitos minimos estavam descritos com should em docs. Foram tornados obrigatorios e separados das recomendacoes.
- Fallback focava apenas effort. Agora tambem cobre modelo selecionado, adequacao ao papel e mapeamento equivalente nao estabelecidos, com confirmacao humana valida quando nao houver introspeccao.
- Teto padrao de dois poderia parecer imutavel. Overrides humanos podem definir outro teto dentro dos limites do cliente.
- Alterar a quantidade em uso poderia parecer proibido. O texto diferencia teto acordado de quantidade ativa e permite menos workers ou execucao sequencial.
- A palavra summary poderia bloquear resumos de progresso. A autorizacao de fechamento agora nomeia especificamente SUMMARY.md.
- As tres camadas receberam referencias cruzadas, mantendo RULES como contrato e docs como procedimento completo.

## Matriz de revisao

Os 16 casos abaixo sao revisao semantica manual do contrato, nao novos testes executaveis e nao uma garantia de obediencia automatica de qualquer cliente.

| Cenario | Comportamento exigido e conferido | Resultado |
| --- | --- | --- |
| Perfil principal confirmado | Modelo de alta capacidade, effort efetivo medium ou superior e recomendado high. Origem registrada, sem pedir novamente confirmação conhecida. | Aprovado na revisao documental |
| Perfil desenvolvedor confirmado | Modelo econômico adequado à tarefa e effort high ou superior. Recomendação xhigh separada do mínimo. | Aprovado na revisao documental |
| Modelo ou esforço desconhecido | Pedir definição ao humano antes da implementação. Não adivinhar, não tratar default/inheritance como comprovação. | Aprovado na revisao documental |
| Esforço abaixo do mínimo | Não iniciar trabalho com configuração insuficiente. Solicitar correção ao humano, sem troca silenciosa. | Aprovado na revisao documental |
| xhigh não suportado, high comprovado | Reconhecer nível efetivo e diferença da recomendação. High satisfaz mínimo do developer, sem alegar xhigh ou inventar enum. | Aprovado na revisao documental |
| Níveis com outro vocabulário | Mapeamento equivalente deve ser explicitado e confirmado com evidência ou pelo humano. Não traduzir ordinal por conta própria. | Aprovado na revisao documental |
| Reconfiguração do principal | Principal não presume poder mudar seu modelo/effort. Orientar ação humana quando necessário. | Aprovado na revisao documental |
| Concorrência padrão | Teto dois desenvolvedores ativos, não obrigação de paralelizar. Respeitar limite efetivo do cliente. | Aprovado na revisao documental |
| Override sequencial ou outro teto | Confirmação humana prevalece, registrar limite e modo. Não substituir instrução mais restritiva pelo default. | Aprovado na revisao documental |
| Tarefas dependentes ou escrita sobreposta | Executar em sequência e impedir alterações concorrentes do mesmo contrato. | Aprovado na revisao documental |
| Comando pendente de aprovação | Manter vaga ocupada. Verificar estado antes de encerrar, não encerrar por silêncio. | Aprovado na revisao documental |
| Tarefa incompleta | Principal completa especificação antes de despachar. Worker pede esclarecimento/bloqueia expansão, não inventa critérios. | Aprovado na revisao documental |
| Bootstrap não comprovado | Sem autorização de edição. Principal verifica OK_BOOTSTRAP com identidade/fontes/regras/config/escopo. | Aprovado na revisao documental |
| Revisão encontra problema | Devolver findings específicos ao developer, revisar correção e integrado. Ausência de crítico não basta. | Aprovado na revisao documental |
| Fechamento sem usuário | Aceite técnico não fecha thread. Não criar SUMMARY antes de autorização humana. | Aprovado na revisao documental |
| Preservação e agnosticismo | Custom Rules apenas, managedprefix preservado, nenhum runtimehook ou configuração de fornecedor. Modelos/famílias são exemplos, não whitelist. | Aprovado na revisao documental |

## Validacao executada

- pnpm validate terminou com exit code 0.
- pnpm build terminou com exit code 0.
- pnpm test terminou com exit code 0. Foram 198 testes aprovados e zero falhas, cancelamentos ou skips.
- Checagem direta pela API do Prettier aprovou os tres Markdown. Isso e separado da checagem geral, pois a configuracao atual ignora Markdown.
- Os 20 links relativos nos tres documentos apontam a arquivos existentes. As referencias externas opcionais de Codex e Claude foram lidas durante a investigacao.
- A atualizacao gerenciada retornou tudo alreadyCurrent, sem sobrescrever as regras customizadas.
- Audit preflight do registro inicial, audit rules e audit messages do registro final retornaram zero findings. Cada escopo foi usado em seu checkpoint, sem substituir a revisao tecnica.

## Preservacao

224 arquivos protegidos fora dos tres caminhos de desenvolvimento permaneceram identicos. Codigo, testes, demais docs, configuracoes, INSTRUCTIONS.md e skill marc-ops nao receberam alteracoes.

O prefixo gerenciado de RULES permaneceu byte a byte identico. Todo o legado anterior foi preservado, descontando somente a linha de validacao expressamente aprovada.

Hashes SHA-256 conferidos:

- Arquivos protegidos antes e depois 003ebe300a28adff2e9d9247b4787d73a57e8e44afef8862ab8cfa0fdae0a0a8.
- Prefixo gerenciado antes e depois d8fece9a56dd8c460cb23df377151ea6a42db05871b58805bdc63cc3809b670d.
- Legado normalizado com a unica alteracao permitida 24b3b558b3722c4ea4433e8fbdacdddc392d3817dc54eb9411abf0447e60de7b.

## Limites e continuidade

Estas regras guiam a colaboracao deste repositorio. Nao mudam configuracoes de Codex, Claude ou outros clientes, nao instalam hooks e nao oferecem comparacao matematica entre reasoning de fornecedores. O humano define ou confirma o perfil quando o contexto nao permite estabelece-lo.

Nao houve alteracao do mecanismo de busca nem mudanca de arquitetura de runtime. Nenhum restart do daemon foi exigido por esta entrega. Clientes podem exigir nova sessao para descobrir automaticamente instrucoes atualizadas. A verificacao de bootstrap e a responsabilidade do principal permanecem obrigatorias.

O aceite tecnico nao encerra a thread. Aguardamos a revisao e a orientacao humana para eventuais ajustes ou encerramento.