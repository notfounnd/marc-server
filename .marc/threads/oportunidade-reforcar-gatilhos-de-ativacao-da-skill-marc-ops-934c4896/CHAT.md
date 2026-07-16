# Oportunidade - Reforçar gatilhos de ativação da skill marc-ops

Thread: `oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896`
Created: `2026-07-16T16:44:25.224Z`

<!-- marc-message
id: msg_323217b561b4400896
threadId: oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896
timestamp: 2026-07-16T16:45:56.695Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-reforco-ativacao-skill-marc-ops.md
-->

Oportunidade registrada para reforçar os gatilhos de ativação da skill `marc-ops`.

- O escopo está limitado ao frontmatter gerado da skill mARC.
- O artefato fixa os textos aprovados para `description` e `when_to_use`.
- O corpo existente, incluindo `## Always Active`, será preservado.
- O plano prevê testes de metadados, idempotência e documentação.

Plano detalhado: marc://$oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896/#msg_323217b561b4400896/!proposta-reforco-ativacao-skill-marc-ops.md

Inicio agora o desenvolvimento e a validação previstos.

<!-- /marc-message -->

<!-- marc-message
id: msg_c98514bd60f44b5395
threadId: oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896
timestamp: 2026-07-16T16:52:35.070Z
agentId: ui-user
role: user
-->

Reforçando os textos:

description:

```
Operate inside a mARC-enabled repository. Activates EVERY session in this workspace. Always active when a session starts, after every compaction, and whenever development is requested only if the skill has not already been loaded in the active session. Establish bootstrap context, read RULES.md, and apply Custom Rules, artifact metadata, marc:// references, and workspace_audit checkpoints. This process must not be ignored.
```

when_to_use:

```
Use this always-active skill at the start of every session in a mARC workspace, after every compaction, reconnecting, or context loss, and whenever development is requested only if it has not already been loaded in the active session. Use it before proposing, planning, editing, posting messages, attaching artifacts, validating, concluding, or closing mARC work.
```

<!-- /marc-message -->

<!-- marc-message
id: msg_c164a702fd41456bac
threadId: oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896
timestamp: 2026-07-16T18:51:49.433Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluído.

**O que foi realizado**

- Atualizei o frontmatter gerado de `marc-ops` com os textos aprovados para `description` e `when_to_use`.
- Substituí apenas os blocos YAML multilinha por valores YAML de linha única.
- Preservei o corpo da skill, incluindo `## Always Active`.
- Atualizei `docs/agent-workflows.md` com os gatilhos de início de sessão, compaction e desenvolvimento.
- Ampliei o teste de recomendações para proteger os valores literais, a ausência de blocos multilinha, a idempotência e os marcadores do corpo.
- Após o restart, `workspace_bootstrap` atualizou a projeção em `.agents/skills/marc-ops/SKILL.md`. Uma atualização adicional confirmou que ela está idempotente.

**Validação**

- `pnpm run validate` passou.
- `pnpm test` passou com 125 testes.
- `pnpm build` passou.
- O preflight não encontrou achados.
- A conferência via context-mode confirmou o frontmatter gerado e a preservação do corpo operacional.

Plano aplicado

marc://$oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896/#msg_323217b561b4400896/!proposta-reforco-ativacao-skill-marc-ops.md

Aguardando seu feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_afdcae6dbc7a4361a0
threadId: oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896
timestamp: 2026-07-16T18:58:02.143Z
agentId: codex-dev
role: developer
-->

Encerramento registrado por solicitação do usuário.

Nota operacional registrada no resumo

- A memory permanece stale porque o auto rebuild está desabilitado.
- O rebuild manual não concluiu porque o ONNX Runtime não conseguiu alocar memória suficiente.
- A oportunidade não tem pendência funcional ou documental. O índice poderá ser refeito quando houver memória disponível.

<!-- /marc-message -->
