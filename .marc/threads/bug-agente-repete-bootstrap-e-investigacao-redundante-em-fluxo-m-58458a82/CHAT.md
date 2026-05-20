# Bug: agente repete bootstrap e investigacao redundante em fluxo mARC

Thread: `bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82`
Created: `2026-05-20T04:15:48.204Z`

<!-- marc-message
id: msg_343d159179634aafb1
threadId: bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82
timestamp: 2026-05-20T04:16:02.726Z
agentId: codex-dev
role: developer
-->

Bug registrado a partir do fluxo atual.

Problema:
- O agente repetiu `workspace_bootstrap` e iniciou uma investigação ampla mesmo após já ter contexto de bootstrap válido na mesma sequência de trabalho.
- Isso tornou o fluxo over, consumiu chamadas desnecessárias e aumentou atrito para uma ação simples.

Exemplo observado:
- Ao receber a referência marc://$oportunidade-revisao-en-us-do-projeto-c14150b8 para embasar uma rule, o agente tentou executar novamente bootstrap e também varrer o repo, em vez de ler diretamente a thread indicada e aplicar a correção pontual.

Impacto:
- Piora a eficiência do uso de tools e tokens.
- Pode gerar sensação de perda de foco e excesso operacional.
- Contraria a expectativa de usar mARC/context-mode com critério, não como ritual repetitivo.

Comportamento esperado:
- Se `bootstrapConfirmed: true` ainda está válido no fluxo atual, reutilizar esse contexto.
- Ao receber uma thread específica como fonte, ler primeiro essa thread e evitar varredura ampla sem necessidade.
- Reexecutar `workspace_bootstrap` apenas quando houver perda real de contexto, reconnect, compaction, troca de workspace, erro de tool ou incerteza concreta sobre validade do bootstrap.

Critério de correção futura:
- Ajustar regras, skill marc-ops ou guidance operacional para diferenciar bootstrap obrigatório de bootstrap redundante.
- Adicionar orientação para investigação mínima quando o usuário fornece uma fonte mARC específica.
- Opcionalmente, avaliar se tools podem retornar feedback mais claro quando bootstrap já está válido para reduzir chamadas repetidas.

<!-- /marc-message -->

<!-- marc-message
id: msg_9192460daecf488993
threadId: bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82
timestamp: 2026-05-20T05:08:26.842Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-correcao-bootstrap-redundante.md
-->

Plano aprovado registrado como artefato antes do desenvolvimento.

Vou iniciar a implementacao seguindo esse plano e depois retorno com validacao e resumo do que foi alterado.

<!-- /marc-message -->

<!-- marc-message
id: msg_5f32c73300664ed38b
threadId: bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82
timestamp: 2026-05-20T05:50:24.114Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluido para a correcao de bootstrap redundante.

O que foi alterado:
- Ajustei a skill gerenciada `marc-ops` para separar quando o workflow deve orientar a decisao de quando bootstrap deve ser estabelecido.
- Removi da skill os gatilhos problemáticos `Always before...` que induziam bootstrap ritualistico em leitura, postagem, artifacts e fechamento.
- Mantive bootstrap forte no inicio da sessao/workspace, apos perda/incerteza de contexto, tool error, compaction, reconnect, rebuild e daemon/MCP restart.
- Mantive `RULES.md` como contrato obrigatorio vindo do bootstrap inicial.
- Nao mencionei `bootstrapConfirmed: true` na skill; a flag continua apenas na interface tecnica MCP onde ela pertence.
- Atualizei `INSTRUCTIONS.md`, `RULES.md`, `marc_helper`, `BOOTSTRAP_REMINDER`, docs MCP e o build em `dist`.
- Adicionei teste dedicado para impedir regressao da skill e atualizei testes MCP do helper/reminder.

Plano registrado:
- marc://$bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82/#msg_9192460daecf488993/!plano-correcao-bootstrap-redundante.md

Validacao executada:
- `pnpm run validate` passou.
- `pnpm test` passou: 74/74.
- `pnpm build` passou.
- Conferencia via context-mode confirmou os textos novos em fonte, arquivos gerenciados e `dist`.
- `workspace_audit` passou sem findings criticos; restaram apenas warnings preexistentes de Description ausente em perfis de agentes: marc://@claude-qa-engineer, marc://@claude-software-architect e marc://@copilot-dev.

Documentacao:
- `docs/mcp-tools.md` foi atualizado para explicar reutilizacao do contrato conhecido e leitura direta de fonte mARC especifica antes de investigacao ampla.

Aguardando seu feedback para orientar a finalizacao da thread.

<!-- /marc-message -->
