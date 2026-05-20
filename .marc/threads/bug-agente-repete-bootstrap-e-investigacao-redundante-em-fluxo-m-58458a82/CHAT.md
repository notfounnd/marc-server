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
