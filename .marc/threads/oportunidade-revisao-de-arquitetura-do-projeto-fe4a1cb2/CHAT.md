# Oportunidade - Revisao de arquitetura do projeto

Thread: `oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2`
Created: `2026-05-01T23:47:10.126Z`

<!-- marc-message
id: msg_c8b9c6d21b0846fab8
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-01T23:47:40.613Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para revisao de arquitetura do projeto.

Objetivo inicial:
- Avaliar organizacao de arquivos, fronteiras entre core/daemon/MCP/UI e padroes de desenvolvimento.
- Identificar pontos de acoplamento, arquivos grandes, duplicacoes e convencoes que precisam virar regra do projeto.
- Propor melhorias pragmáticas sem refatoracao ampla desnecessaria.

Possiveis temas:
- Separacao entre dominio, transporte MCP, daemon HTTP e UI.
- Organizacao de tipos e contratos compartilhados.
- Padroes para novas tools MCP e testes associados.
- Estrategia para evoluir cache/indice, artifacts, referencias e encerramento de threads.
- Criterios para quando dividir arquivos ou criar adapters.

Status: oportunidade aberta para refinamento antes de implementacao.

<!-- /marc-message -->

<!-- marc-message
id: msg_6424ab3c720c494793
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-06T05:03:36.106Z
agentId: ui-user
role: user
-->

Notei alguns arquivos muito grandes. Seria interessante manter arquivos menores.

<!-- /marc-message -->
