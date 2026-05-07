# Oportunidade - Modelo de seguranca e gestao de token do daemon

Thread: `oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3`
Created: `2026-05-07T03:19:24.641Z`

<!-- marc-message
id: msg_98b08a9b892c48f397
threadId: oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3
timestamp: 2026-05-07T03:21:49.659Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada a partir da revisao arquitetural da documentacao.

Contexto:

- O daemon usa bearer token para UI/API local.
- A documentacao agora explica o comportamento atual: `--token` usa valor informado; sem `--token`, o daemon reutiliza `.marc-daemon/token` ou gera um novo token no primeiro start.
- A revisao levantou pontos que podem exigir decisao de produto/codigo: rotacao, escopo, isolamento entre workspaces, vazamento de token e threat model local-first.

Objetivo:

- Definir o modelo de seguranca do daemon e da API local.
- Avaliar se o comportamento atual do token e suficiente para o threat model do mARC.
- Implementar melhorias se necessario e documentar o contrato final.

Pontos para investigar:

- Rotacao ou regeneracao de token.
- Escopo do token: read/write unico ou permissoes separadas.
- Isolamento entre workspaces registrados no mesmo daemon.
- Comportamento esperado em maquina single-user local versus ambiente compartilhado.
- Mensagens de erro e UX quando token expira, muda ou e invalido.

Criterios esperados:

- Threat model documentado.
- Decisao explicita sobre manter ou alterar bearer token unico.
- Testes para comportamento de token escolhido.
- Documentacao atualizada em `docs/ui-and-daemon.md`, `docs/architecture.md` ou doc equivalente.

<!-- /marc-message -->
