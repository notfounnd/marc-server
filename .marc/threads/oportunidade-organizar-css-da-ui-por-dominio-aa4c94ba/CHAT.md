# Oportunidade - Organizar CSS da UI por domínio

Thread: `oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba`
Created: `2026-05-26T01:11:18.765Z`

<!-- marc-message
id: msg_ba477d4e5357491985
threadId: oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba
timestamp: 2026-05-26T01:11:31.874Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para reorganizar o CSS da UI por responsabilidade funcional, após a estabilização da evolução visual atual.

Contexto:

- A análise do CSS atual identificou `1272` linhas e `20.7 kB` no fonte; o asset compilado permanece pequeno (`37.35 kB`, aproximadamente `7.8 kB gzip`).
- A migração neo-brutalism não aumentou a quantidade de linhas do stylesheet; o problema é de manutenção e revisão, não de performance.
- Não foi encontrado lixo CSS relevante nem duplicação que justifique alteração imediata da cascade.

Objetivo:

- Transformar `styles.css` em um ponto de entrada agregador e distribuir regras por domínio: tokens/base, shell, conteúdo/Markdown/artifacts, composer, overlays e responsividade.
- Preservar seletores, declarações, ordem relativa e comportamento visual existente.

Critérios de sucesso:

- Nenhuma mudança intencional de layout, cor, tipografia, foco, animação ou responsividade.
- Build, validação e testes existentes executados com sucesso.
- Validação visual dos fluxos críticos da UI após a reorganização.

Fora de escopo:

- Redução artificial do payload CSS, troca de primitives/Tailwind, renomeação de classes ou redesign.

<!-- /marc-message -->

<!-- marc-message
id: msg_60b6c1734d284d8197
threadId: oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba
timestamp: 2026-05-27T00:25:51.712Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-ativacao-css-por-dominio.md, artifacts/matriz-faixas-css-por-dominio.md
-->

Desenvolvimento realizado.

Escopo executado:

- `styles.css` passou a atuar como entrypoint, mantendo os imports externos e importando seis fragmentos locais na ordem original da cascade.
- As copias integrais commitadas foram podadas por faixas continuas: fundacao, shell/navegacao, conteudo da thread, overlays, composer/footer e responsividade.
- `@theme inline` foi mantido no inicio do fragmento de fundacao, preservando a ordem expandida valida dos imports CSS.

Validacao:

- Comparacao estrutural via context-mode: a concatenacao dos seis fragmentos e exatamente igual ao corpo do stylesheet do commit-base; nenhum bloco foi perdido, duplicado ou reordenado.
- `git diff --check`: sem erros de whitespace.
- `pnpm run validate`: concluido com sucesso; Prettier reportou os CSS como unchanged e o typecheck concluiu sem erros.
- `pnpm test`: concluido com sucesso, 84 testes aprovados e 0 falhas.
- `pnpm build`: concluido com sucesso; permanece o aviso conhecido do chunk JavaScript acima de 500 kB, sem relacao com este refactor CSS.
- Validacao visual automatizada: tentei executar pela CLI permitida (`playwright-cli`), mas a sessao de browser nao abriu no executor; nao usei Playwright MCP. A verificacao visual fica pendente do feedback na UI em execucao.

Documentacao:

- Revisei a documentacao relacionada a UI. Nenhuma atualizacao e necessaria: o documento descreve a stack/experiencia visual, nao a distribuicao interna do CSS, e nao houve mudanca de comportamento ou contrato.

Aguardando seu feedback para orientar a finalizacao da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_6f7f98cc7e134da18c
threadId: oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba
timestamp: 2026-05-27T01:21:14.293Z
agentId: codex-dev
role: developer
-->

Validacao pos-rebuild/restart concluida no escopo correto, via `playwright-cli` executado a partir do projeto e usando a configuracao local com Chrome instalado.

Duas evidencias renderizadas por area CSS migrada:

- Fundacao: `body` com background `rgb(244, 241, 234)`; token `--teal` resolvido como `#0f766e`.
- Shell/navegacao: colunas desktop resolvidas como `320px 360px 760px`; sidebar com borda direita `2px`.
- Conteudo/thread: titulo da thread com `26px`; painel Markdown com peso `400`.
- Overlays: modal de atalhos com largura `860px`; padding `20px`.
- Composer/footer: composer com padding `15px`; footer com borda superior `2px`.
- Responsividade, viewport `900px`: `body` com overflow `auto`; coluna central com borda direita `0px`.

O asset CSS servido pelo daemon apos restart tambem contem os seis dominios esperados. A sessao Playwright foi encerrada ao final. Com esta checagem, a separacao CSS esta carregada na UI reconstruida; aguardo confirmacao para encerramento da thread.

<!-- /marc-message -->
