# Correção: Auditoria de Referências mARC em Inline Code

## Resumo

Corrigir `workspace_audit` para detectar referências `marc://` escritas em inline code e emitir `reference_not_linkable`, sem auditar referências dentro de fenced code blocks. O plano será registrado como artefato na thread antes do desenvolvimento, usando apenas metadata de anexo, sem repetir path no corpo da mensagem.

## Mudanças Principais

- Antes do desenvolvimento:
  - Executar `workspace_update_recommendations`, conforme regra do workspace.
  - Anexar o plano detalhado à thread `bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180` como artifact metadata.
  - Postar mensagem curta dizendo que o plano foi registrado, sem path ou referência textual ao artefato no corpo.
  - Rodar `workspace_audit` em escopo adequado antes da alteração.

- Auditoria:
  - Ajustar `src/core/audit/messages.ts` para remover fenced code blocks antes da extração de referências.
  - Preservar inline code no fluxo de detecção, para que `marc://...` entre crases não fique invisível.
  - Adicionar detecção explícita de referência mARC em inline code com finding `reference_not_linkable`.
  - Manter validações existentes para referências normais: inválidas, agentes ausentes, threads ausentes e mensagens ausentes.
  - Manter controle de fluxo plano, com guards, sem `else` e sem `if` aninhado.

- Documentação:
  - Revisar `docs/mcp-tools.md` e `docs/agent-workflows.md`.
  - Atualizar somente se necessário para registrar que `workspace_audit` detecta referências mARC não linkáveis em inline code.
  - Deixar a revisão de `marc-ops` sobre mensagens com artifacts no radar como trabalho posterior, fora desta correção.

## Testes e Validação

- Atualizar `test/core-audit.test.ts`:
  - Mensagem com `` `marc://$thread-id` `` deve gerar `reference_not_linkable`.
  - Fenced code block com `marc://...` não deve gerar finding.
  - Referência normal válida deve continuar sem finding.
  - Referência normal inválida ou para alvo ausente deve continuar gerando os findings existentes.

- Executar:
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`

- Ao final:
  - Rodar `workspace_audit` na thread.
  - Comentar na thread, em pt-BR, o que foi alterado, a validação executada, eventual decisão sobre documentação e que a finalização aguarda feedback.

## Assumptions

- `reference_not_linkable` será warning.
- Fenced code blocks continuam tratados como exemplos técnicos protegidos.
- Markdown permanece source of truth.
- Código, testes e docs do projeto ficam em en-US; comunicação com usuário e thread fica em pt-BR.
