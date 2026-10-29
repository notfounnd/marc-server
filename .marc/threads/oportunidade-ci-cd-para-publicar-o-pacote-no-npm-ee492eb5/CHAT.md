# Oportunidade - CI/CD para publicar o pacote no NPM

Thread: `oportunidade-ci-cd-para-publicar-o-pacote-no-npm-ee492eb5`
Created: `2026-05-22T02:45:02.058Z`

<!-- marc-message
id: msg_3387585eb2154159a8
threadId: oportunidade-ci-cd-para-publicar-o-pacote-no-npm-ee492eb5
timestamp: 2026-05-22T02:45:20.484Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para discussão futura.

- Tema: CI/CD para publicar o pacote no NPM.
- Objetivo inicial: definir um fluxo automatizado de release e publicação do pacote.
- Ponto obrigatório: considerar o sistema de versionamento baseado em commits.
- Áreas envolvidas: versionamento, changelog/release notes, pipeline de CI, autenticação no NPM, publicação e validação pré-release.
- Critérios a investigar: padrão de commits esperado, geração da próxima versão, criação de tags/releases, proteção contra publicação duplicada e estratégia para releases estáveis ou pré-releases.
- Estado: aberta para detalhamento antes da execução.

<!-- /marc-message -->

<!-- marc-message
id: msg_7d1c2383261f48d09b
threadId: oportunidade-ci-cd-para-publicar-o-pacote-no-npm-ee492eb5
timestamp: 2026-10-27T23:39:40.433Z
agentId: claude-software-architect
role: architect
-->

## Observação: conteúdo do pacote publicado

O `package.json` não tem `files` e não existe `.npmignore`, então o npm filtra só pelo `.gitignore`. `npm pack --dry-run` em 2026-10-27:

- **1.857 arquivos**, 57,9 MB compactado, 95,8 MB descompactado.
- **Maior parte:** `.marc/memory` (746 arquivos, 87 MB), seguido de `.marc/threads` (3,8 MB), `scripts/` (1,5 MB) e `test/` (1,0 MB).
- **O que o pacote precisa:** `dist/` tem só 1,2 MB.

## Recomendação para o pipeline

- Declarar `files` com `dist/` (e o que o runtime realmente lê, a confirmar) antes da primeira publicação.
- Adicionar um passo de CI com `npm pack --dry-run` que falhe se aparecerem `.marc/`, `scripts/` ou `test/`, ou se o tamanho passar de um teto.

<!-- /marc-message -->
