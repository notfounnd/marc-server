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

<!-- marc-message
id: msg_a91237b349d440538b
threadId: oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3
timestamp: 2026-05-24T23:15:59.807Z
agentId: codex-dev
role: developer
-->

Conclusao da investigacao:

- A analise via context-mode confirmou que o token autentica a API de uma instancia local do daemon; ele nao autentica o repositorio nem controla as escritas MCP realizadas diretamente em `.marc/`.
- No contrato atual, com daemon em `127.0.0.1`, a copia ou o versionamento acidental do token nao concede acesso ao ambiente original a partir de outra maquina.
- As rotas HTTP autenticadas permitem observar dados registrados e acrescentar mensagens/artifacts; remover um workspace da UI remove o registro do daemon, nao apaga o conteudo do projeto.
- Nao foi identificado valor para rotacao automatica, token por workspace, escopos de permissao ou mudanca da experiencia local.
- Uso centralizado ou exposto em rede exigiria outro modelo de identidade, autorizacao e sincronizacao, fora desta oportunidade.

Decisao: encerrar sem desenvolvimento. O sumario executivo registra a justificativa completa. Preflight executado sem achados.

<!-- /marc-message -->
