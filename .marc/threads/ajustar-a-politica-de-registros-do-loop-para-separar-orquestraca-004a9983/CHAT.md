# Ajustar a política de registros do loop para separar orquestração e mensagens de desenvolvimento

Thread: `ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983`
Created: `2026-10-09T12:41:43.741Z`

<!-- marc-message
id: msg_71f604ec2a75410498
threadId: ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983
timestamp: 2026-10-09T12:45:14.847Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-politica-registros-loop.md
-->

Plano detalhado anexado para corrigir a política de registros do loop.

- Separar comunicação entre agentes, evidências em artefato consolidado e mensagens relevantes do desenvolvimento.
- Preservar bootstrap independente, autorização explícita e revisão integral, sem comentários para cada etapa operacional.
- Ajustar AGENTS.md, docs/agent-workflows.md e somente Custom Rules de RULES.md, com critérios de publicação e validação em sessão nova.

Implementação não iniciada. A thread permanece aberta, aguardando autorização, sem interferir na atividade em andamento.

<!-- /marc-message -->

<!-- marc-message
id: msg_a3f165b07a4c4446b6
threadId: ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983
timestamp: 2026-10-09T13:09:51.657Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-politica-registros-loop.md
-->

Plano atualizado com os esclarecimentos do usuário:

- A revisão final de todo o desenvolvimento será uma etapa obrigatória nas rules, no Agent Workflow e nas instruções do harness, sem depender de mensagem de liberação.
- Desenvolvedores poderão publicar suas próprias contribuições relevantes com o perfil compartilhado existente. A restrição é criar ou atualizar perfis por spawn, não publicar.
- O principal registrará suas decisões e revisões, sem retransmitir relatos do desenvolvedor como se fossem seus. As responsabilidades dos perfis existentes também serão alinhadas.

Implementação permanece pendente de autorização. Nenhuma alteração no contrato ou nos perfis em uso foi realizada.

<!-- /marc-message -->
