# Oportunidade: reformatar Custom Rules com base na auditoria

Thread: `oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be`
Created: `2026-05-18T03:55:57.413Z`

<!-- marc-message
id: msg_b9f0101615424b7db4
threadId: oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be
timestamp: 2026-05-18T03:56:07.499Z
agentId: codex-dev
role: developer
-->

Contexto: a evolutiva de auditoria da thread marc://$oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb passou a reportar regras livres em `Custom Rules` com o finding `custom_rule_freeform`.

Feedback atual da auditoria em `.marc/RULES.md`: as seções `Agent Tooling`, `Project References`, `Session Onboarding`, `Flow Rules` e `Code Style` continuam compatíveis, mas não seguem o formato operacional recomendado pelo mARC com `Trigger`, `Do instead`, `Evidence` e `Severity`.

Oportunidade: reformatar essas regras para o novo padrão operacional, preservando intenção e escopo, para que agentes consigam aplicar o contrato local de forma mais determinística.

Critérios iniciais:
- converter apenas conteúdo sob `## Custom Rules`;
- manter o sentido das regras atuais;
- não alterar seções gerenciadas do mARC;
- rodar `workspace_audit` com `scope: rules` ao final;
- esperar que warnings `custom_rule_freeform` desapareçam ou sejam mantidos apenas quando uma regra for intencionalmente advisory/free-form.

<!-- /marc-message -->

<!-- marc-message
id: msg_49fb61bdac9c41428f
threadId: oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be
timestamp: 2026-05-18T22:42:21.702Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-reformatar-custom-rules-operacionais.md
-->

Plano registrado antes do desenvolvimento.

Artifact: `artifacts/plano-reformatar-custom-rules-operacionais.md`

Vou executar a conversão apenas em `.marc/RULES.md`, dentro de `## Custom Rules`, preservando as seções gerenciadas e validando ao final com `workspace_audit` usando `scope: rules`.

<!-- /marc-message -->

<!-- marc-message
id: msg_015edbcc67644648aa
threadId: oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be
timestamp: 2026-05-18T22:48:35.600Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-reformatar-custom-rules-operacionais.md
-->

Desenvolvimento realizado.

Escopo executado:
- Reformatado apenas `## Custom Rules` em `.marc/RULES.md`.
- Preservadas as seções gerenciadas do mARC.
- Convertidas as áreas `Agent Tooling`, `Project References`, `Session Onboarding`, `Flow Rules` e `Code Style` para regras operacionais com `Trigger`, `Do instead`, `Evidence` e `Severity`.
- Mantido o plano anexado em `artifacts/plano-reformatar-custom-rules-operacionais.md`.

Validação:
- `workspace_audit` com `scope: rules`, `severity: all` e `maxFindings: 50` retornou `ok: true`.
- Resultado da auditoria: 0 findings, 0 críticos, 0 warnings e 0 suggestions.

Arquivos alterados:
- `.marc/RULES.md`
- `marc://$oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be` com o plano e este comentário de conclusão.

Aguardo seu feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_3d34868759cd4a8885
threadId: oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be
timestamp: 2026-05-18T23:31:42.710Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-reformatar-custom-rules-operacionais.md
-->

Encerramento aprovado pelo usuário.

Resumo do resultado:
- `.marc/RULES.md` foi reformatado em `## Custom Rules` para o padrão operacional com `Trigger`, `Do instead`, `Evidence` e `Severity`.
- As seções gerenciadas do mARC foram preservadas.
- A regra `Preserve Markdown as source of truth` foi adicionada em `Architecture Rules`.
- A organização final das Custom Rules ficou validada pelo usuário.

Validação antes do encerramento:
- `workspace_audit` com `scope: rules`: 0 findings.
- `workspace_audit` com `scope: artifacts` nesta thread: 0 findings.
- `workspace_audit` com `scope: references` nesta thread: 0 findings.

Vou criar `SUMMARY.md` para marcar a thread como fechada.

<!-- /marc-message -->
