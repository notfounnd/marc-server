# Oportunidade: reformatar Custom Rules com base na auditoria

Thread: marc://$oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be

Closed: `2026-05-18T23:31:54.762Z`

---

## Resultado

- `.marc/RULES.md` foi reformatado em `## Custom Rules` para o padrão operacional do mARC.
- As regras custom passaram a usar `Trigger`, `Do instead`, `Evidence` e `Severity`.
- As seções gerenciadas do mARC foram preservadas.
- A regra crítica `Preserve Markdown as source of truth` foi adicionada em `Architecture Rules`.
- A ordem final das seções custom foi validada pelo usuário:
  - `Architecture Rules`
  - `Agent Tooling`
  - `Session Onboarding`
  - `Project References`
  - `Flow Rules`
  - `Code Style`

## Artifact

- `artifacts/plano-reformatar-custom-rules-operacionais.md`

## Validação

- `workspace_audit` com `scope: rules`: 0 findings.
- `workspace_audit` com `scope: artifacts` nesta thread: 0 findings.
- `workspace_audit` com `scope: references` nesta thread: 0 findings.

## Observações

- A mudança é exclusiva ao contrato local do workspace mARC.
- Não houve alteração de runtime do servidor.
