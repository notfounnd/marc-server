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
