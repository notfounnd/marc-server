# Proposta de Desenvolvimento

## Contexto

A skill gerenciada `marc-ops` já declara ativação em toda sessão. Os metadados atuais, porém, usam YAML multilinha e não tornam explícitos os gatilhos de compactação e de solicitação de desenvolvimento.

O escopo é exclusivo da skill mARC. Não inclui napkin, hooks, integrações de IDE/CLI ou código para ferramentas externas.

## Objetivo

Reforçar os gatilhos no frontmatter da skill, preservando o corpo existente, inclusive `## Always Active`, e mantendo `src/core/marc-ops-skill.ts` como fonte de verdade da projeção em `.agents/skills/marc-ops/SKILL.md`.

## Textos Aprovados

### description

```text
Operate inside a mARC-enabled repository. Activates EVERY session in this workspace. Always active when a session starts, after every compaction, and whenever development is requested only if the skill has not already been loaded in the active session. Establish bootstrap context, read RULES.md, and apply Custom Rules, artifact metadata, marc:// references, and workspace_audit checkpoints. This process must not be ignored.
```

### when_to_use

```text
Use this always-active skill at the start of every session in a mARC workspace, after every compaction, reconnecting, or context loss, and whenever development is requested only if it has not already been loaded in the active session. Use it before proposing, planning, editing, posting messages, attaching artifacts, validating, concluding, or closing mARC work.
```

## Implementação

1. Alterar apenas os valores de `description` e `when_to_use` no gerador `WORKSPACE_SKILL`, convertendo-os para linhas únicas.
2. Não alterar, reordenar ou reescrever o corpo da skill, incluindo a seção `## Always Active`.
3. Atualizar os testes de recomendações para fixar os dois metadados, a ausência dos blocos YAML multilinha e a preservação do corpo.
4. Atualizar a documentação de workflow para incluir compactação e solicitação de desenvolvimento entre os gatilhos.
5. Regenerar a projeção local exclusivamente por `workspace_update_recommendations`.

## Validação

- Executar o fluxo de recomendações duas vezes e confirmar atualização seguida de idempotência.
- Executar `pnpm run validate`, `pnpm test` e `pnpm build`.
- Conferir por context-mode o gerador, a projeção gerada e a documentação.

## Limites

A adequação melhora a descoberta e a instrução da skill. Ela não detecta compactação dentro de um harness externo e não substitui os gates MCP existentes.