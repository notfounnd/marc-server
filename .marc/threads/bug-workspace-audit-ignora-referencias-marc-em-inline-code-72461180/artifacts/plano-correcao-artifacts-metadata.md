# Correção: Artifacts por Metadata, Sem Path Redundante

## Summary

Ajustar a orientação de artifacts para deixar claro que o anexo deve ser feito via metadata da mensagem, sem repetir `artifacts/...` no corpo quando o objetivo é apenas exibir o anexo. A correção será feita na mesma thread `bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180`, com novo plano anexado por metadata antes do desenvolvimento.

## Key Changes

- Atualizar a fonte da skill em `src/core/marc-ops-skill.ts`:
  - substituir a instrução “Attach the artifact first, then reference the attached path in the message.”
  - orientar: anexar o artifact via message metadata; mencionar no corpo apenas o que foi registrado, não o path, salvo quando o path for assunto técnico da mensagem.
  - manter a checagem de que artifact mencionado no corpo precisa existir em metadata.

- Atualizar recomendações geradas:
  - ajustar `src/core/guards.ts` para trocar “link artifacts when relevant” por linguagem menos ambígua: usar artifacts via metadata para planos, logs, reviews e análises longas.
  - regenerar `.marc/RULES.md` e `.agents/skills/marc-ops/SKILL.md` via `workspace_update_recommendations`, sem editar derivados manualmente.

- Atualizar docs:
  - ajustar `docs/agent-workflows.md` para separar dois casos:
    - artifact anexado para leitura normal: use metadata, sem path no corpo.
    - referência canônica a artifact como objeto mARC: use `marc://.../!artifact.md` quando a mensagem precisa apontar para aquele asset.
  - manter `docs/mcp-tools.md` sem alteração adicional, salvo se a revisão final mostrar inconsistência.

- Não alterar auditoria nesta rodada:
  - `artifact_reference_not_attached` continua válido para path no corpo sem metadata.
  - Não criar warning para path redundante com metadata agora; esta correção é de orientação gerada e documentação, não de nova política de audit.

## Test Plan

- Atualizar testes de recomendações/skill:
  - `workspace_update_recommendations` deve gerar skill sem “reference the attached path in the message”.
  - skill gerada deve orientar artifact metadata e evitar path redundante no corpo.
  - `RULES.md` gerado deve usar linguagem de metadata, não “link artifacts” ambíguo.

- Rodar validação:
  - teste focado de recomendações.
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`
  - `workspace_audit` na thread antes do comentário final.

## Assumptions

- O comportamento correto padrão é: artifact aparece pela metadata da mensagem.
- O corpo da mensagem pode mencionar um path somente quando o path é informação relevante em si, não para “mostrar o anexo”.
- A thread atual será usada para registrar o plano, desenvolvimento e comentário final.
- Código, testes e docs ficam em en-US; mensagens mARC e respostas ao usuário ficam em pt-BR.
