# Indicador de versão no rodapé

Thread: `indicador-de-versao-no-rodape-7b4859bc`
Created: `2026-10-15T18:23:42.605Z`

<!-- marc-message
id: msg_8193ebbecbb14c05b9
threadId: indicador-de-versao-no-rodape-7b4859bc
timestamp: 2026-10-15T18:24:22.182Z
agentId: ui-user
role: user
-->

Adicionar indicador de versão depois do texto do desenvolvedor, no rodapé do mARC.

<!-- /marc-message -->

<!-- marc-message
id: msg_338e5bc2271741c69e
threadId: indicador-de-versao-no-rodape-7b4859bc
timestamp: 2026-10-15T23:01:47.076Z
agentId: ui-user
role: user
-->

Precisa avaliar qual a melhor maneira de capturar essa informação.

<!-- /marc-message -->

<!-- marc-message
id: msg_25d93cac8ba84b4183
threadId: indicador-de-versao-no-rodape-7b4859bc
timestamp: 2026-10-15T23:07:35.188Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-indicador-versao.md
-->

Proposta registrada: exibir v<versão> depois do crédito do desenvolvedor, usando package.json como fonte única e injeção de constante pelo Vite.

O indicador identifica a versão da UI carregada e funciona sem request ao daemon, token ou workspace selecionado. Não haverá versão duplicada no JSX nem novo endpoint.

O plano anexo delimita implementação, critérios de aceite e validação. Execução delegada sequencial sob codex-dev, preservando a bc45139b e todas as mudanças preexistentes. Após a entrega, farei revisão independente e validação de navegador; a thread permanecerá aberta para revisão humana.

<!-- /marc-message -->

<!-- marc-message
id: msg_ba2ecb02fe95423faf
threadId: indicador-de-versao-no-rodape-7b4859bc
timestamp: 2026-10-15T23:33:25.320Z
agentId: codex-dev
role: developer
artifacts: artifacts/entrega-indicador-versao.md
-->

Implementação do indicador de versão concluída no escopo autorizado. A UI mostra a versão do bundle, fornecida por `package.json` via Vite, após o crédito do desenvolvedor. Foco final versão+i18n passou 9/9; validate final passou. A suíte completa 395/395 e o build passaram antes da asserção final de existência do crédito no teste; o artifact registra essa limitação temporal, hashes, escopo e evidência do browser reportada pelo principal. Revisão integrada do principal permanece pendente; não declaro estado release-ready.

<!-- /marc-message -->

<!-- marc-message
id: msg_e5d15a20246b49fc97
threadId: indicador-de-versao-no-rodape-7b4859bc
timestamp: 2026-10-15T23:39:04.259Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-e-revisao-integrada-versao.md
-->

Indicador implementado e aprovado tecnicamente após revisão integrada independente. O rodapé mostra v0.3.0 após o crédito, usando package.json via Vite como fonte única; o valor identifica a UI carregada e funciona sem consulta ao daemon.

Conferi a entrega própria do developer, a configuração, o footer, CSS, testes e documentação. Foram resolvidas a integração com a allowlist de localização e a asserção de presença do crédito.

Validação independente final:
- Lint, formatação e TypeScript aprovados; validate final do developer aprovado.
- Build aprovado e suíte completa 395/395, sem falhas ou skips, incluindo a asserção final.
- Playwright CLI em desenvolvimento e produção: 1280/420/320 px, sem overflow, versão visível sem token/workspace, atalho funcional por mouse/teclado e Escape, sem erros de execução.

O relatório anexo registra critérios, evidências, autoria e limites. Permanece o aviso de bundle acima de 500 kB; a versão não compara UI e daemon nem identifica commits. O trabalho paralelo bc45139b foi preservado e nenhum comando Git foi executado nesta tarefa. A thread permanece aberta para revisão humana.

<!-- /marc-message -->

<!-- marc-message
id: msg_7c1f66d51ce844c09a
threadId: indicador-de-versao-no-rodape-7b4859bc
timestamp: 2026-10-16T00:03:57.198Z
agentId: codex-dev
role: developer
-->

Ajuste visual concluído em `src/ui/app-content.tsx:102`: reutilizei `content-footer-divider` entre o crédito e a versão; sem CSS, dependências ou alterações de teste. Hash final: `7DA9465E21CF5CD6939965D902FFB6B4F7EE884766F5C7E36BE4D5441B1ECB21`.

Checks: foco versão+i18n `9/9`; `pnpm validate` exit 0 (`All matched files use Prettier code style!`); `pnpm build` exit 0 (2392 módulos; aviso existente para chunk JS >500 kB); `pnpm test` exit 0 (`# pass 395`, `# fail 0`, `# skipped 0`). A revisão/browser independente do principal confirmou separadores entre crédito, versão e atalho, inclusive a 320 px sem overflow; revisão integrada aguardada para este delta. Nenhum comando Git foi executado.

<!-- /marc-message -->

<!-- marc-message
id: msg_fd4100711f164942b8
threadId: indicador-de-versao-no-rodape-7b4859bc
timestamp: 2026-10-16T00:05:01.598Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-e-revisao-integrada-versao.md
-->

Ajuste solicitado na revisão humana aplicado e aprovado tecnicamente: crédito | versão | atalhos, reutilizando o mesmo separador decorativo.

Conferi a entrega própria do developer e reavaliei a integração. Só um span foi acrescentado ao componente; os demais arquivos permaneceram iguais. Playwright CLI e capturas em 1280/320 px confirmaram separadores equivalentes, ausência de overflow e ação dos atalhos preservada.

Foco 9/9, validate, build e suíte completa 395/395 passaram após o ajuste. O parecer atualizado e os limites estão no relatório consolidado. A thread permanece aberta.

<!-- /marc-message -->
