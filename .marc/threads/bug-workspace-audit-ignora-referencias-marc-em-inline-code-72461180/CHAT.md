# Bug: workspace_audit ignora referencias mARC em inline code

Thread: `bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180`
Created: `2026-05-20T03:51:52.197Z`

<!-- marc-message
id: msg_295c157eadee42529d
threadId: bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180
timestamp: 2026-05-20T03:52:04.763Z
agentId: codex-dev
role: developer
-->

Bug identificado a partir da thread marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2.

Problema:
- Mensagens podem citar referencias mARC em inline code, por exemplo `marc://@claude-qa-engineer`.
- Na UI, isso nao vira link clicavel.
- `workspace_audit` nao reporta o problema.

Evidencia observada:
- A regra existe em `.marc/RULES.md`: Project References exige uso do formato esperado pelas ferramentas mARC.
- A ultima mensagem de marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2 colocou referencias de agentes em inline code.
- A auditoria da thread reportou apenas `agent_metadata_missing`, sem warning sobre referencia nao linkavel.

Causa tecnica provavel:
- `src/core/audit/messages.ts` remove inline code em `removeMarkdownCode()` antes de `messageReferences()` procurar `marc://`.
- Com isso, referencias mARC colocadas entre crases ficam invisiveis para `auditReferences()`.

Impacto:
- A regra operacional de referencias existe, mas nao esta plenamente verificavel pela auditoria.
- Agentes podem continuar postando referencias que parecem texto/codigo e nao links, sem feedback automatico.

Criterio esperado de correcao futura:
- `workspace_audit` deve detectar `marc://` em inline code quando aparecer em mensagens normais e emitir warning pratico, por exemplo `reference_not_linkable`.
- Fenced code blocks devem continuar protegidos para evitar falso positivo em exemplos tecnicos.
- Teste deve cobrir uma mensagem com `marc://@agent` entre crases e validar que a auditoria acusa o problema.
- Teste deve cobrir fenced code com exemplo de `marc://` e validar que nao acusa falso positivo.

<!-- /marc-message -->

<!-- marc-message
id: msg_6b9482c05ea842dd9b
threadId: bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180
timestamp: 2026-05-20T15:50:41.471Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-correcao-inline-code-references.md
-->

Plano detalhado registrado como artefato da thread. Vou iniciar o desenvolvimento seguindo TDD e validar o fluxo completo antes de retornar para feedback.

<!-- /marc-message -->

<!-- marc-message
id: msg_22ac46f6503040e88c
threadId: bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180
timestamp: 2026-05-20T16:01:36.413Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluído e aguardando feedback.

O que foi realizado:
- `workspace_audit` agora detecta referências mARC em inline code e reporta `reference_not_linkable`.
- Referências dentro de fenced code blocks continuam ignoradas para evitar falso positivo em exemplos técnicos.
- A validação existente de referência inválida ou alvo ausente foi preservada também para referências encontradas em inline code.
- Documentação atualizada para orientar que referências mARC em mensagens devem ser texto normal, não inline code, e para listar referências não linkáveis como achado objetivo da auditoria.

Validação executada:
- `pnpm run validate`: passou.
- `pnpm test`: passou com 75 testes e 0 falhas.
- `pnpm build`: passou.
- Auditoria da thread via MCP ativo: sem críticos; apenas os três warnings já conhecidos de perfis de agente sem Description.
- Auditoria via build recém-gerado confirmou `reference_not_linkable` no caso da própria thread.

Observação:
- A revisão do texto do `marc-ops` sobre mensagens com artifacts ficou fora deste escopo, conforme combinado, e permanece no radar para tratamento posterior.

<!-- /marc-message -->

<!-- marc-message
id: msg_a7561c6f92254692a6
threadId: bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180
timestamp: 2026-05-20T16:39:53.013Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-correcao-artifacts-metadata.md
-->

Plano adicional registrado como artefato da thread. Vou ajustar a orientação de artifacts para usar metadata sem path redundante no corpo da mensagem.

<!-- /marc-message -->

<!-- marc-message
id: msg_68949e0d7a084dfead
threadId: bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180
timestamp: 2026-05-20T16:52:37.381Z
agentId: codex-dev
role: developer
-->

Ajuste adicional concluído localmente e aguardando restart para validação pela ferramenta.

O que foi realizado:
- `marc-ops` agora orienta anexar artifacts por metadata para a UI exibir, sem repetir `artifacts/...` no corpo apenas para mostrar o anexo.
- `RULES.md` gerado passou a falar em usar artifact metadata quando relevante.
- `docs/agent-workflows.md` separa artifact anexado por metadata de referência canônica de artifact.
- Testes de recomendações cobrem que a orientação antiga não volta no próximo update.

Validação local executada:
- Teste focado de recomendações: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou com 76 testes e 0 falhas.
- `pnpm build`: passou.
- Inspeção de `dist` confirmou ausência de `reference the attached path` e `link artifacts when relevant` nos módulos gerados.

Próximo passo:
- Depois do restart, validar via `workspace_bootstrap` que `.agents/skills/marc-ops/SKILL.md` e `.marc/RULES.md` continuam atuais com a nova orientação.

<!-- /marc-message -->
