# Oportunidade - Mecanismo de busca sobre o conhecimento do projeto

Closed: 2026-07-09T04:44:18Z

## Executive Summary

Implementado mecanismo de busca na UI sobre a base de memory do projeto, reaproveitando o `memory_recall` existente em vez de criar uma busca textual paralela. A busca fica disponivel na coluna central, sem exigir agente conectado, e consulta o daemon por um endpoint dedicado.

## Decisions

- A UI usa a mesma infraestrutura de memory da tool MCP, via `recallMemory`.
- A busca fica disponivel apenas quando a memory estiver `ready` ou `stale`.
- O fluxo de busca e acionado por botao, nao em tempo real durante digitacao.
- O ultimo resultado e preservado em um unico slot de `localStorage`, sobrescrito a cada busca.
- A ordenacao visual preserva o ranking retornado por `memory_recall`.
- O resultado usa o card padrao de `NavItem`; o trecho encontrado aparece apenas como conteudo extra abaixo do titulo/detalhe.

## Implementation

- Adicionado endpoint daemon `POST /api/workspaces/:workspaceId/memory/recall`.
- Adicionado modo `search` na coluna central da UI.
- Adicionados estados de busca: vazio, processando, erro, indisponivel, sem resultados e resultados.
- Resultado encontrado navega para a thread correspondente.
- Resultado de thread encerrada usa semantica visual de arquivo: icone `Archive` e titulo tachado.
- Tooltip do resultado usa o texto completo de `matchedText`; quando nao houver trecho, usa o titulo.
- Formulario de busca usa input em largura total e botao textual `Search` em largura total abaixo.

## Validation

- `node --test --import tsx test/ui-memory-search.test.ts`
- `node --test --import tsx test/ui-memory-search-panel.test.ts`
- `pnpm run typecheck`
- `pnpm run validate`
- `pnpm test`
- `pnpm build`
- `workspace_audit` com escopo `preflight` sem findings.

## Follow-ups

- marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4 registra a investigacao sobre provider/modelo aquecido com TTL curto.
- A calibragem da busca pode ser revisitada se `limit: 5`, ausencia de resultados para termos especificos ou diferencas entre busca humana e busca de agente se mostrarem limitantes.
