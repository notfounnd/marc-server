# Correção - Ocultar comentários HTML no Markdown renderizado

Thread: marc://$correcao-ocultar-comentarios-html-no-markdown-renderizado-b84827bb

Closed: `2026-10-15T22:57:21.056Z`

---

A correção do renderizador Markdown foi implementada e aprovada tecnicamente: comentários e tags HTML continuam visíveis como texto escapado, preservando quebras de linha e linhas vazias da origem. A thread é encerrada por autorização explícita do usuário em 15/10/2026. Interpretar HTML permanece como evolução separada, sem implementação neste escopo.

## Decisão e entrega

O pedido inicial de ocultar comentários foi substituído pela orientação humana de mantê-los visíveis com as quebras corretas. O caso dos dois comentários de Custom Rules agora conserva a separação mesmo quando o primeiro sofre wrapping.

O plugin local de apresentação agrupa nós HTML brutos e seus separadores, recupera quebras pelas posições da origem e produz texto escapado. O estilo localizado usa pre-wrap. Não houve alteração de persistência, API ou dependências; o Markdown original permanece autoritativo. Foram acrescentados testes do helper e do MarkdownPanel real, além da documentação de UI.

Plano: marc://#msg_e9ed4a471edd490abb

Entrega própria do developer: marc://#msg_e941c353dfd04eae9a

Revisão integrada do principal e evidências detalhadas: marc://#msg_ef8f5bc1286e4969be

## Validação e aprovação

- Testes independentes do renderizador e regressões de links/perfis: 16/16 aprovados. Foco final do developer: 11/11.
- pnpm validate e pnpm build passaram; o build manteve o aviso de chunk acima de 500 kB.
- A execução paralela final de pnpm test registrou 325/327, com dois timeouts de subprocessos MCP. A suíte completa serial passou 328/328, sem skips. Esses resultados pertencem ao estado validado durante a entrega; não representam nova execução no encerramento nem declaração de release-ready.
- Playwright CLI verificou os componentes reais de regras, mensagens, resumos e artifacts em fixture isolada, incluindo larguras de 1280 e 420 px, quebras, linhas vazias, tags inertes e preservação de código, tabelas, links e referências. Não houve overflow horizontal nem erros de página; APIs do daemon não foram exercitadas.
- A revisão independente do principal aprovou tecnicamente todo o escopo integrado. A autorização humana de encerramento é posterior e distinta desse parecer.

## Continuidade e limites

A evolução para HTML renderizado continua aberta em marc://$evolucao-avaliar-convivencia-de-markdown-com-html-renderizado-ce4a7cbe.

Antes do encerramento, o backlog Playwright foi revisado e complementado com regressões de comentários literais, espaçamento, wrapping, segurança e recursos Markdown. Os cenários E2E duráveis continuam pendentes; a validação ad hoc não os substitui. Registro: marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a/#msg_fe4097f033fc4149aa

A auditoria estrutural de mensagens desta thread e a de referências do registro de backlog retornaram zero achados. Este encerramento altera somente registros mARC; não requer repetição das verificações executáveis já documentadas.
