# Oportunidade - Organizar agentes registrados no RULES.md

Thread: `oportunidade-organizar-agentes-registrados-no-rules-md-734062bc`
Created: `2026-05-11T01:23:20.839Z`

<!-- marc-message
id: msg_2cb758b72681445682
threadId: oportunidade-organizar-agentes-registrados-no-rules-md-734062bc
timestamp: 2026-05-11T01:23:35.310Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para corrigir a organização de agentes no `RULES.md`.

- Problema: `agent_register` atualmente adiciona links de agentes no fim do arquivo, o que pode cair dentro de `## Custom Rules` e misturar inventário de agentes com regras operacionais do projeto.
- Estado atual aceitável: o projeto organizou manualmente os agentes em `## Custom Rules` > `### Registered Agents (Marckers)` e as regras em `### Flow Rules`.
- Melhor arquitetura desejada: agentes registrados devem ser gerenciados dentro da seção `## Agents`, provavelmente em uma subseção própria, sem poluir `## Custom Rules`.
- Requisito: `workspace_update_recommendations` deve preservar regras customizadas e manter uma organização previsível para agentes registrados.
- Critério de aceite: setup de projeto novo continua sem criar agentes padrão; agentes só aparecem após `agent_register`; novos registros são inseridos/atualizados no bloco correto.
- Validação esperada: testes cobrindo workspace novo sem agentes padrão, registro de agente em bloco correto e preservação de `Custom Rules`.

<!-- /marc-message -->
