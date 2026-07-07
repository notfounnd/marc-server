# Resumo executivo

Thread: `oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb`
Closed: `2026-07-07T22:15:00.000Z`

## Objetivo

Ajustar o recall e o ranking da memory para que consultas de desenvolvimento priorizem decisões históricas relevantes, especialmente quando uma thread decisória compete com resultados genéricos semanticamente próximos.

O caso guia foi a consulta `implementar rotacao de token da interface`, que antes encontrava a thread correta de token, mas abaixo de threads genéricas de UI.

## Resultado

A thread foi concluída com uma evolução funcional no ranking da memory.

- A busca vetorial continua sendo a fonte inicial de candidatos.
- O recall passou a buscar mais candidatos do que o limite final solicitado.
- Foi adicionado reranking local híbrido por score vetorial, termos exatos normalizados e boost de seção decisória.
- O contrato público de `memory_recall` foi preservado: mesmos inputs e mesmos campos de saída.
- O campo `score` passou a representar a relevância final ranqueada.
- O campo `reason` passou a explicar sinais relevantes quando disponíveis, como termos exatos e seção decisória.
- A política de ranking foi isolada em módulo próprio para manter `operations` como orquestração do fluxo.

## Decisões

- Não alterar o corpus da v1: a memory continua indexando apenas `.marc/threads/*/SUMMARY.md`.
- Não alterar provider de embeddings, schema persistido do LanceDB ou formato da snapshot `.marc/memory`.
- Manter Markdown como fonte da verdade; ranking é uma projeção de leitura.
- Usar uma estratégia determinística de ranking, com desempate por score final, score lexical, score vetorial e `threadId`.
- Preservar compatibilidade de MCP/CLI, sem novos parâmetros obrigatórios.

## Implementação

- Adicionado `src/core/memory/ranking.ts` com expansão de candidatos, ranking híbrido, normalização lexical, boosts por seção e explicação de ranking.
- Adicionado `src/core/memory/recall-actions.ts` para separar a montagem de próximas ações do fluxo principal.
- Atualizado `src/core/memory/operations.ts` para consultar candidatos expandidos, aplicar ranking, filtrar por score final, deduplicar por thread e limitar a resposta final.
- Adicionado teste de regressão em `test/core-memory.test.ts` para garantir que uma decisão de token supere uma thread genérica de UI mesmo quando o score vetorial bruto da UI é maior.
- Extraídos helpers de teste para `test/memory-test-helpers.ts`.
- Atualizado `docs/memory.md` para documentar o ranking híbrido e reforçar que o corpus e a snapshot continuam derivados dos summaries.

## Validação

- `pnpm run validate`: passou.
- `pnpm test`: passou com 93/93.
- `pnpm build`: passou; permaneceu apenas o aviso conhecido do Vite sobre chunk JavaScript maior que 500 kB.
- Validação via CLI pós-build: `memory recall` para `implementar rotacao de token da interface` retornou marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3 em primeiro lugar.
- Após restart dos recursos, a tool MCP `memory_recall` retornou a mesma thread em primeiro lugar, com `reason` indicando `Exact terms: implementar, rotacao, token` e `Section boost: Decisão`.
- `workspace_audit` preflight antes do encerramento: 0 achados.

## Experiência de uso

Após o desenvolvimento, a memory foi usada como ferramenta real de pesquisa de conhecimento sobre regras de UI e organização das informações.

Essa experiência foi registrada no artifact `artifacts/experiencia-uso-memory-pesquisa-ui.md`.

O uso prático mostrou que a memory consegue recuperar princípios históricos do projeto, não apenas decisões pontuais. A consulta sobre UI apontou threads de colunas, neobrutalism, organização de CSS, autocomplete, referências internas, artifacts e Markdown SoT.

A síntese consolidada mostrou que a UI organiza informação por dono semântico:

- Thread como eixo de navegação.
- Message como eixo da conversa.
- Artifact vinculado à Message.
- `SUMMARY.md` como síntese de encerramento.
- Índices e UI como projeções derivadas de Markdown.

## Continuidade

Não há pendência funcional nesta thread.

Possíveis evoluções futuras:

- ampliar métricas de avaliação com mais queries históricas;
- adicionar testes dedicados ao módulo de ranking se a política crescer;
- observar novas consultas reais para ajustar pesos ou boosts com evidência prática;
- manter summaries ricos em decisões, regras e continuidade, pois eles são a superfície principal da memory.

## Estado final

A oportunidade foi concluída e encerrada. O tuning melhorou a utilidade prática da memory para orientar agentes antes de propor mudanças, preservando a arquitetura v1 baseada em summaries e snapshot derivada.
