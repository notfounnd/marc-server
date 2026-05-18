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
