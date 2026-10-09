# Revisão técnica e validação do fluxo em loop

## Resultado

O principal aprovou a entrega técnica após duas rodadas de ajustes de precisão. Esta é uma alteração documental e de contrato local, não uma implementação de enforcement em runtime. A thread permanece aberta para revisão do humano e não tem SUMMARY.md.

## Arquivos

- docs/agent-workflows.md documenta papéis, modelo/effort, confirmação humana, teto de agentes, brief completo, bootstrap/autorização, templates de retorno, revisão iterativa e aceite humano.
- .marc/RULES.md recebeu seis regras críticas de Development Loop abaixo da fronteira de Custom Rules, após Code Style. A única mudança em regras anteriores foi a ordem pnpm validate, pnpm build e pnpm test.
- AGENTS.md foi alinhado ao contrato e ao procedimento, sem versionar famílias de modelos como whitelist nem mover a fonte normativa para a entrada.

## Bootstrap e autorização comprovados

Desenvolvedor delegado gpt-6-luna com reasoning xhigh. O principal usou a configuração gpt-6.1-sol/high informada pelo usuário. O usuário também confirmou a configuração atual dos desenvolvedores. Os parâmetros do spawn selecionam o perfil solicitado, mas o registro não afirma uma introspecção de efetividade inexistente.

O desenvolvedor fez workspace_bootstrap independente e conferiu workspace marc-dd422176e1 em C:/Projetos/marc, skill marc-ops, INSTRUCTIONS.md e RULES.md completos, AGENTS, README, docs/agent-workflows, docs/harness-engineering, ADR 0007, package.json, esta thread e seu plano. O principal verificou o OK_BOOTSTRAP e autorizou explicitamente os três caminhos antes da primeira edição. A autorização também está registrada na mensagem msg_fa0b2b2a24d3411c80.

Execução sequencial. O limite padrão documentado é dois desenvolvedores, mas o ensaio sequencial previamente definido pelo humano continua prioritário. Workers aguardando aprovação ocupam a vaga. Nenhum agente foi encerrado por suposto travamento.

## Achados devolvidos e corrigidos

- Requisitos mínimos estavam descritos com should em docs. Foram tornados obrigatórios e separados das recomendações.
- Fallback focava apenas effort. Agora também cobre modelo selecionado, adequação ao papel e mapeamento equivalente não estabelecidos, com confirmação humana válida quando não houver introspecção.
- Teto padrão de dois poderia parecer imutável. Overrides humanos podem definir outro teto dentro dos limites do cliente.
- Alterar a quantidade em uso poderia parecer proibido. O texto diferencia teto acordado de quantidade ativa e permite menos workers ou execução sequencial.
- A palavra summary poderia bloquear resumos de progresso. A autorização de fechamento agora nomeia especificamente SUMMARY.md.
- As três camadas receberam referências cruzadas, mantendo RULES como contrato e docs como procedimento completo.

## Matriz de revisão

Os 16 casos abaixo são revisão semântica manual do contrato, não novos testes executáveis e não uma garantia de obediência automática de qualquer cliente.

| Cenário | Comportamento exigido e conferido | Resultado |
| --- | --- | --- |
| Perfil principal confirmado | Modelo de alta capacidade, effort efetivo medium ou superior e recomendado high. Origem registrada, sem pedir novamente confirmação conhecida. | Aprovado na revisão documental |
| Perfil desenvolvedor confirmado | Modelo econômico adequado à tarefa e effort high ou superior. Recomendação xhigh separada do mínimo. | Aprovado na revisão documental |
| Modelo ou esforço desconhecido | Pedir definição ao humano antes da implementação. Não adivinhar, não tratar default/inheritance como comprovação. | Aprovado na revisão documental |
| Esforço abaixo do mínimo | Não iniciar trabalho com configuração insuficiente. Solicitar correção ao humano, sem troca silenciosa. | Aprovado na revisão documental |
| xhigh não suportado, high comprovado | Reconhecer nível efetivo e diferença da recomendação. High satisfaz mínimo do developer, sem alegar xhigh ou inventar enum. | Aprovado na revisão documental |
| Níveis com outro vocabulário | Mapeamento equivalente deve ser explicitado e confirmado com evidência ou pelo humano. Não traduzir ordinal por conta própria. | Aprovado na revisão documental |
| Reconfiguração do principal | Principal não presume poder mudar seu modelo/effort. Orientar ação humana quando necessário. | Aprovado na revisão documental |
| Concorrência padrão | Teto dois desenvolvedores ativos, não obrigação de paralelizar. Respeitar limite efetivo do cliente. | Aprovado na revisão documental |
| Override sequencial ou outro teto | Confirmação humana prevalece, registrar limite e modo. Não substituir instrução mais restritiva pelo default. | Aprovado na revisão documental |
| Tarefas dependentes ou escrita sobreposta | Executar em sequência e impedir alterações concorrentes do mesmo contrato. | Aprovado na revisão documental |
| Comando pendente de aprovação | Manter vaga ocupada. Verificar estado antes de encerrar, não encerrar por silêncio. | Aprovado na revisão documental |
| Tarefa incompleta | Principal completa especificação antes de despachar. Worker pede esclarecimento/bloqueia expansão, não inventa critérios. | Aprovado na revisão documental |
| Bootstrap não comprovado | Sem autorização de edição. Principal verifica OK_BOOTSTRAP com identidade/fontes/regras/config/escopo. | Aprovado na revisão documental |
| Revisão encontra problema | Devolver findings específicos ao developer, revisar correção e integrado. Ausência de crítico não basta. | Aprovado na revisão documental |
| Fechamento sem usuário | Aceite técnico não fecha thread. Não criar SUMMARY antes de autorização humana. | Aprovado na revisão documental |
| Preservação e agnosticismo | Custom Rules apenas, managedprefix preservado, nenhum runtimehook ou configuração de fornecedor. Modelos/famílias são exemplos, não whitelist. | Aprovado na revisão documental |

## Validação executada

- pnpm validate terminou com exit code 0.
- pnpm build terminou com exit code 0.
- pnpm test terminou com exit code 0. Foram 198 testes aprovados e zero falhas, cancelamentos ou skips.
- Checagem direta pela API do Prettier aprovou os três Markdown. Isso é separado da checagem geral, pois a configuração atual ignora Markdown.
- Os 20 links relativos nos três documentos apontam a arquivos existentes. As referências externas opcionais de Codex e Claude foram lidas durante a investigação.
- A atualização gerenciada retornou tudo alreadyCurrent, sem sobrescrever as regras customizadas.
- Audit preflight do registro inicial, audit rules e audit messages do registro final retornaram zero findings. Cada escopo foi usado em seu checkpoint, sem substituir a revisão técnica.

## Preservação

224 arquivos protegidos fora dos três caminhos de desenvolvimento permaneceram idênticos. Código, testes, demais docs, configurações, INSTRUCTIONS.md e skill marc-ops não receberam alterações.

O prefixo gerenciado de RULES permaneceu byte a byte idêntico. Todo o legado anterior foi preservado, descontando somente a linha de validação expressamente aprovada.

Hashes SHA-256 conferidos:

- Arquivos protegidos antes e depois 003ebe300a28adff2e9d9247b4787d73a57e8e44afef8862ab8cfa0fdae0a0a8.
- Prefixo gerenciado antes e depois d8fece9a56dd8c460cb23df377151ea6a42db05871b58805bdc63cc3809b670d.
- Legado normalizado com a única alteração permitida 24b3b558b3722c4ea4433e8fbdacdddc392d3817dc54eb9411abf0447e60de7b.

## Limites e continuidade

Estas regras guiam a colaboração deste repositório. Não mudam configurações de Codex, Claude ou outros clientes, não instalam hooks e não oferecem comparação matemática entre reasoning de fornecedores. O humano define ou confirma o perfil quando o contexto não permite estabelece-lo.

Não houve alteração do mecanismo de busca nem mudança de arquitetura de runtime. Nenhum restart do daemon foi exigido por esta entrega. Clientes podem exigir nova sessão para descobrir automaticamente instruções atualizadas. A verificação de bootstrap e a responsabilidade do principal permanecem obrigatórias.

O aceite técnico não encerra a thread. Aguardamos a revisão e a orientação humana para eventuais ajustes ou encerramento.
