# Resumo executivo

Thread: `oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac`
Closed: `2026-07-21T04:41:33Z`

## Objetivo

Evoluir a busca humana da memory com aprofundamento progressivo por `minScore`, sem alterar o contrato público da tool MCP.

## Resultado

- Adicionada configuração persistida de profundidade de busca por workspace, de 0 a 3 retries.
- Toda nova query da UI começa em `0.15` e aplica apenas os retries automáticos configurados.
- Adicionado `Deep retry` abaixo do conteúdo da busca. Cada ação avança somente um nível adicional e desaparece apenas na profundidade final.
- Separado o estado de profundidade configurada dos retries manuais, impedindo que uma nova query herde o aprofundamento anterior.
- A UI usa `limit: 50` para a visão humana. A tool MCP preserva seu default de `limit: 5`.
- O painel de settings passou a expor Search depth em seção própria, acima das configurações de Memory, com extremos `Edge` e `Deep`.
- Corrigido o repasse de `deepRetryAvailable` e `onDeepRetry` entre `AppSidebar` e `AppSidebarMiddle`.

## Validação

- `pnpm run validate` passou.
- `pnpm test` passou com 135 testes.
- `pnpm build` passou.
- A validação no navegador confirmou que a busca `brutalism` renderiza resultados e o botão `Deep retry` quando há profundidade restante.
- O browser de automação foi fechado após a validação.

## Descoberta posterior

O aumento de `limit` da UI também ampliou indiretamente o conjunto de candidatos vetoriais antes do reranking. Portanto, `limit: 50` alterou a recuperação da UI, não apenas a quantidade de cards exibidos.

Essa descoberta não foi tratada como mudança de core nesta thread. Ela foi isolada para evitar que match lexical se torne resultado sem contexto semântico.

## Continuidade

A evolução estrutural de recall está registrada em marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba.

Direção definida para a continuidade:

- separar `resultLimit` de `candidateLimit`;
- usar match lexical apenas para ampliar candidatos avaliados;
- manter elegibilidade final dependente de contexto semântico e do `minScore` ativo;
- criar benchmarks para `brutalism`, `toggle` e `toogle`.

## Estado final

O fluxo de busca progressiva da UI está concluído. A correção de recall híbrido pertence à oportunidade derivada e não bloqueia este encerramento.
