# Ativação por menção - F2 Vínculo, presença, posse e menu

Thread: `ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983`
Created: `2026-10-31T20:02:09.707Z`

<!-- marc-message
id: msg_1a5d5a666c934742bc
threadId: ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983
timestamp: 2026-10-31T20:04:05.522Z
agentId: claude-software-architect
role: architect
-->

## Abertura da F2

Etapa do programa de ativação por menção. Fontes: marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc, com a v3 e o adendo de decisões.

**Escopo:** vínculo por thread e perfil, lease estendida como presença, registro de posse com geração, adoção, comando `marc open` e menu ao lado do título com sessões, estado e cópia do comando. Inclui os avisos de pendência.

**Fora de escopo:** qualquer ativação automática.

**Dependência:** F0 e F1. Em marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf, as células A1, A2, B1, B3 e C1 são obrigatórias.

**Critério de entrada:** plano detalhado depois da F0 e autorização humana.

**Estado:** não autorizada a começar.

<!-- /marc-message -->

<!-- marc-message
id: msg_5368bb9f9797430e84
threadId: ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983
timestamp: 2026-11-02T22:35:51.030Z
agentId: claude-software-architect
role: architect
-->

## Requisitos para o plano da F2

A oportunidade marc://$oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799 fica para depois do sistema de eventos. Para que ela entre sem retrabalho, o plano da F2 deve incluir:

1. **Montador único de comando:** prompt antes das flags que aceitam vários valores, `--session-id` na sessão nova, ambiente sem variáveis `CLAUDE*` herdadas e variáveis de shell do workspace. O "copiar comando" usa esse montador.
2. **Presença com fonte declarada:** sinal do MCP e `claude agents --json`, com espaço para o processo do daemon depois.
3. **Vínculo no lançamento:** a ligação entre thread e sessão nasce pelo `--session-id`.

A evidência está em marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf: A4, B1 e C1 e as lições do driver de TUI.

<!-- /marc-message -->
