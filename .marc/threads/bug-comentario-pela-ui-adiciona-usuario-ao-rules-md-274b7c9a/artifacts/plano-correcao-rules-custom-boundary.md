# Plano de correcao - RULES.md Custom Rules boundary

> Para agentes: implementar com cuidado em TDD. A correcao deve seguir a ADR 0007 e nao deve tratar nenhum nome de secao customizada como especial.

## Objetivo

Corrigir a manutencao de `RULES.md` para preservar corretamente o conteudo customizado abaixo de `## Custom Rules`, mantendo a fonte da verdade de agentes em `.marc/agents/*.md`.

## Contexto obrigatorio

- Thread origem: `bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a`.
- Thread relacionada: `oportunidade-organizar-agentes-registrados-no-rules-md-734062bc`.
- ADR relacionada: `docs/adrs/0007-rules-managed-baseline-and-custom-rules.md`.
- Evidencia anterior: a perda observada de uma secao customizada via `workspace_bootstrap` ocorreu provavelmente por MCP server stale em memoria.
- Bug confirmado no codigo atual: conteudo com heading `##` abaixo dos comentarios de `## Custom Rules` e perdido, contrariando a ADR 0007.

## Contrato funcional

- Acima de `## Custom Rules`: baseline gerenciado pelo mARC.
- Abaixo dos comentarios de `## Custom Rules`: conteudo do projeto, preservado por posicao.
- A preservacao abaixo de Custom Rules independe do nivel do heading (`#`, `##`, `###`, etc.).
- A recomendacao de usar `###` ou mais profundo e apenas convencao de organizacao, nao regra de preservacao.
- Qualquer bloco customizado legado com heading `###` a `######` encontrado antes de `## Custom Rules` pode ser migrado para baixo da fronteira.
- O nome da secao customizada e irrelevante. Nao usar `Flow Rules` como caso especial em codigo ou testes.
- Agentes registrados nao devem ser listados em `RULES.md`; a fonte da verdade e `.marc/agents/*.md`.

## Implementacao planejada

1. Criar testes de regressao antes da correcao:
   - secao customizada `### Project Workflow` antes de `## Custom Rules` e migrada para baixo da fronteira;
   - secao customizada `### Project Workflow` abaixo da fronteira e preservada;
   - conteudo com `## Project Notes` abaixo dos comentarios e preservado;
   - `##` desconhecido acima de `## Custom Rules` e descartado;
   - bloco legado `### Registered Agents (Marckers)` e removido;
   - `agent_register` nao altera `RULES.md`;
   - POST da UI pelo daemon nao altera `RULES.md`.
2. Refatorar a normalizacao de `RULES.md` em `src/core/workspace.ts`:
   - preservar `## Custom Rules` do heading ate o fim do arquivo;
   - garantir comentarios oficiais no topo do bloco custom;
   - migrar genericamente blocos `###` a `######` do baseline para a area custom;
   - evitar inventario de agentes em `RULES.md`;
   - estabilizar `recommendations.updated` para retornar `updated` quando corrige drift e `alreadyCurrent` na segunda chamada.
3. Validar com testes, typecheck e build.
4. Comentar resultado na thread com instrucoes de handoff para nova sessao/MCP fresh validar `workspace_bootstrap` real.

## Validacao esperada

- `pnpm test test/core.test.ts test/daemon.test.ts`
- `pnpm typecheck`
- `pnpm build`
- Probe local em workspace temporario validando o ciclo:
  - primeira chamada com baseline desatualizado retorna `updated` contendo `RULES.md`;
  - segunda chamada retorna `alreadyCurrent` contendo `RULES.md`;
  - custom rules permanecem preservadas.

## Handoff obrigatorio

Ao final, registrar na thread:

- causa raiz provavel do incidente observado: MCP stale para a perda da secao customizada;
- bug corrigido no codigo atual: preservacao posicional da area Custom Rules;
- testes e validacoes executadas;
- orientacao para reiniciar MCP client/server em nova sessao antes de validar `workspace_bootstrap` real.
