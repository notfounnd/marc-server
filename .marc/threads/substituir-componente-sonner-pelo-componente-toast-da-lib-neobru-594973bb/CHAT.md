# Substituir componente sonner pelo componente toast da lib Neobrutalism

Thread: `substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb`
Created: `2026-10-09T17:49:24.756Z`

<!-- marc-message
id: msg_fef6a0d3094942f9b8
threadId: substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb
timestamp: 2026-10-09T17:51:29.637Z
agentId: ui-user
role: user
-->

Acredito que o projeto está utilizando a lib https://www.npmjs.com/package/sonner para toasts de aviso.

O pacote Neobrutalism oferece uma opção para isso.

- https://www.neobrutalism.dev/docs/toast

Acredito ser interessante usar o componente da lib.

<!-- /marc-message -->

<!-- marc-message
id: msg_229d52338ef5497894
threadId: substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb
timestamp: 2026-10-09T19:07:08.107Z
agentId: codex-software-architect
artifacts: artifacts/plano-migracao-toast-neobrutalism.md, artifacts/atividade-migracao-toast-neobrutalism.md
-->

Proposta estruturada e autorizada para implementação no chat: substituir Sonner pelo Toast oficial do Neobrutalism, baseado em Base UI.

O plano preserva a API de notificações, os três tipos de aviso, o timeout de 2,4 segundos e a identidade visual existente. Inclui integração, localização, testes, validação por Playwright CLI e revisão independente do resultado integrado.

Execução delimitada a um desenvolvedor por vez. Plano e evidências consolidadas estão anexados; a thread permanecerá aberta para revisão humana.

<!-- /marc-message -->

<!-- marc-message
id: msg_e1de2c4f136a46ccbc
threadId: substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb
timestamp: 2026-10-09T20:02:58.838Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-migracao-toast-neobrutalism.md
-->

Migração implementada e aprovada tecnicamente após revisão integrada do principal. Sonner foi substituído pelo Toast local do Neobrutalism/Base UI, preservando showNotification, os três tipos e a duração de 2,4 s. A integração mantém o toast acima de dialogs/sheets e seu fechamento não dispensa o painel. Documentação, rótulos e teste regressivo foram atualizados.

pnpm validate e pnpm build passaram. A repetição final de pnpm test passou 210/210; o teste de auto-idle do daemon apresentou falha intermitente, passou isoladamente 6/6 e não foi alterado. Playwright CLI verificou interação, teclado, empilhamento e responsividade. A revisão via context-mode e o relatório consolidado registram as evidências, a intermitência e os quatro diagnósticos TSX preexistentes fora do escopo.

Resultado disponível para revisão humana. A thread permanece aberta; aprovação técnica não representa aceite nem autorização de fechamento.

<!-- /marc-message -->

<!-- marc-message
id: msg_88a50a6ec5e845549d
threadId: substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb
timestamp: 2026-10-09T20:10:12.558Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-migracao-toast-neobrutalism.md
-->

Correção da avaliação sobre as falhas de auto-idle: não foi demonstrado que sejam preexistentes ou independentes da migração. O daemon e os testes existentes têm hashes iguais ao baseline, mas dependências e um novo teste mudaram. Não houve execução completa imediatamente anterior à troca para comparação.

Nova verificação do principal via context-mode: suíte completa 210/210; arquivos existentes com novo teste explicitamente excluído 209/209. Ambos passaram, mantendo as dependências novas; isso não estabelece causa nem descarta regressão indireta. A hipótese de timing permanece inconclusiva. O relatório foi corrigido para registrar esse limite.

<!-- /marc-message -->

<!-- marc-message
id: msg_cfc24f4ee5be421d8f
threadId: substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb
timestamp: 2026-10-09T20:22:58.248Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-migracao-toast-neobrutalism.md
-->

Diagnóstico causal concluído. O teste original de auto-idle sozinho falhou 8/8, sem executar o teste novo de notificações. O trace confirmou que o timer de 20 ms fecha o servidor durante a primeira conexão HTTP, antes de receber a requisição. Com uma troca HTTP nativa anterior, o mesmo teste passou 8/8.

O caminho de daemon envolvido tem 59 arquivos iguais ao baseline e não importa Toast/Base UI. O problema é a dependência temporal do teste de ciclo de vida; não exige correção na migração. Conforme solicitado, análise, reproduções e critérios de correção foram registrados em marc://$corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898. O relatório desta demanda foi atualizado com o diagnóstico confirmado.

<!-- /marc-message -->

<!-- marc-message
id: msg_8eed53e78e504d8fbd
threadId: substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb
timestamp: 2026-10-09T20:56:34.744Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-migracao-toast-neobrutalism.md, artifacts/plano-migracao-toast-neobrutalism.md
-->

Encerramento autorizado pelo usuário. Entrega aprovada tecnicamente: Sonner substituído pelo componente local Neobrutalism/Base UI, com API e duração preservadas, labels localizados e integração corrigida com sheets. Documentação e teste regressivo atualizados; validate, build e repetição completa de testes passaram 210/210. Evidências revisadas via context-mode e Playwright CLI constam no relatório.

Backlog Playwright conferido e atualizado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a. A cobertura E2E durável continua pendente.

A corrida diagnosticada no teste de auto-idle foi separada em marc://$corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898, que permanece aberta para correção. Nenhum código de daemon ou teste foi alterado por essa investigação. O resumo executivo consolida a entrega e seus limites.

<!-- /marc-message -->
