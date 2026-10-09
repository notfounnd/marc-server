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

<!-- marc-message
id: msg_88b1b9871afe461b82
threadId: ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983
timestamp: 2026-10-09T13:19:42.284Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-politica-registros-loop.md, artifacts/execucao-e-revisao-politica-loop.md
-->

Execução autorizada pelo usuário, com escopo nos três documentos de contrato e alinhamento das responsabilidades dos perfis existentes.

A entrega deve preservar autoria direta dos desenvolvedores, separar publicações relevantes do controle do loop e exigir revisão final integrada antes da aprovação técnica. Não há alteração de código do produto nem criação de perfis ou hooks.

O plano e os critérios de execução estão nos anexos. A thread permanece aberta até sua avaliação e autorização de encerramento.

<!-- /marc-message -->

<!-- marc-message
id: msg_97e56aececf648a5ab
threadId: ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983
timestamp: 2026-10-09T13:35:27.654Z
agentId: codex-dev
role: developer
artifacts: artifacts/relatorio-implementacao-politica-registros-loop.md
-->

## Alterações
- Atualizei somente `AGENTS.md`, `docs/agent-workflows.md` e `Custom Rules` de `.marc/RULES.md`.
- O relatório anexo registra o escopo e as evidências.

## Verificações
- API Prettier 3.8.3, `parser: "markdown"` e `proseWrap: "preserve"`: aprovada nos três arquivos após normalizar CRLF apenas na análise.
- A checagem CLI anterior não validou a formatação: os três arquivos foram ignorados por `.prettierignore`; o relatório corrige a afirmação anterior.
- AST de links locais: 22/22 resolvidos; auditoria `rules`: 0 achados; prefixo gerenciado de `RULES.md`: hash igual ao baseline.
- O principal informa que `pnpm validate` e `pnpm build` passaram; `pnpm test` está em andamento. Não executei esses comandos.

## Pendências
- Revisão final integrada e aprovação técnica do principal permanecem pendentes; `pnpm test` segue em andamento.
- A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_451c338490f842a4a5
threadId: ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983
timestamp: 2026-10-09T13:53:17.115Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-politica-registros-loop.md, artifacts/execucao-e-revisao-politica-loop.md
-->

## Entrega integrada
- Contrato alinhado em AGENTS.md, Agent Workflows, Custom Rules e nos dois perfis existentes.
- Controle do loop fica no canal de agentes e na evidência consolidada. A thread recebe decisões, descobertas, impedimentos e entregas relevantes.
- Desenvolvedores publicam suas próprias contribuições com o perfil compartilhado, sem criar ou atualizar cadastros.
- Revisão final independente do desenvolvimento inteiro é obrigatória antes da aprovação técnica. Revisões das tarefas, testes e auditorias não a substituem.

## Avaliação do principal
- Revisei o estado integrado, devolvi dois achados ao mesmo desenvolvedor e conferi as correções. Veredito técnico aprovado, com critérios, evidências e limites no artefato anexo.
- pnpm validate, pnpm build e pnpm test passaram. Foram 199 testes aprovados, além da checagem efetiva de Markdown e dos 22 links locais.
- Código, trecho gerenciado, configurações e metadados dos perfis foram preservados.

## Próximo passo
- Aguardo avaliação humana. A thread permanece aberta.
- A política não cria enforcement por ferramentas ou hooks. A aderência em uma sessão nova ainda precisa ser observada. O build mantém o aviso não bloqueante de bundle acima de 500 kB.

<!-- /marc-message -->

<!-- marc-message
id: msg_a84fb008e7204eb6a2
threadId: ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983
timestamp: 2026-10-09T14:23:51.051Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/execucao-e-revisao-politica-loop.md, artifacts/plano-politica-registros-loop.md
-->

## Encerramento autorizado
- O usuário aprovou o encerramento após confirmar que a alteração ficou restrita à documentação, regras do fluxo, responsabilidades dos perfis e registros da thread.
- A revisão final integrada foi aprovada. pnpm validate, pnpm build e pnpm test passaram, com 199 testes aprovados; Markdown e links também foram verificados.
- Não houve alteração de código, testes ou comportamento do produto. A política é instrucional, sem enforcement por hooks ou ferramentas.
- Permanece como limite a observação da aderência em sessões novas. Não há pendência de implementação no escopo desta thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_9e26c7c29bb3463395
threadId: ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983
timestamp: 2026-10-09T19:50:06.584Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/correcao-politica-registros-pontuais.md
-->

## Correção solicitada
- O usuário apontou que o contrato transferiu o diário da thread para atualizações contínuas do artefato. Esse não era o objetivo.
- Vou substituir essa obrigação por registros pontuais de handoff/handover, entrega e revisão final. A coordenação e as iterações ficam no canal entre agentes, sem edição do documento a cada ajuste.
- O plano corretivo está anexado. A atividade de Toast em andamento não será alterada.

<!-- /marc-message -->

<!-- marc-message
id: msg_4d1ccb5e125048438a
threadId: ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983
timestamp: 2026-10-09T19:58:38.335Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/correcao-politica-registros-pontuais.md
-->

## Correção direta concluída
- Corrigi pessoalmente AGENTS.md, Agent Workflows, Custom Rules e os dois perfis. O subagente foi encerrado sem editar arquivos.
- Handoff/handover pontual pode ser mensagem ou documento. Iterações, diagnósticos, autorizações e ajustes ficam no canal interno; não geram atualizações contínuas em mensagens ou artefatos.
- A evidência necessária é consolidada na entrega e na revisão final completa. Decisões materiais que realmente mudam o plano ou contrato continuam registráveis.
- Revisei os cinco arquivos integrados e aprovei tecnicamente a correção. Markdown, 22 links, pnpm validate, pnpm build e pnpm test passaram; 210 testes aprovados no workspace compartilhado.
- A atividade de Toast em andamento não foi alterada. Sessões que já carregaram o contrato anterior precisam receber ou reler a instrução atualizada.

<!-- /marc-message -->
