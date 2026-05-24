# Oportunidade - Politica de concorrencia e escritas no Markdown SoT

Thread: `oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f`
Created: `2026-05-07T03:19:29.250Z`

<!-- marc-message
id: msg_1f80d8720c7d4958b6
threadId: oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f
timestamp: 2026-05-07T03:20:51.065Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada a partir da revisao arquitetural da documentacao.

Contexto:

- A documentacao declara Markdown como source of truth.
- MCP server e daemon/UI podem escrever nos mesmos arquivos da pasta `.marc/`, especialmente `CHAT.md` e artifacts.
- A revisao levantou risco de concorrencia: escrita simultanea, append atomico, lock, last-write-wins ou corrupcao parcial.

Objetivo:

- Avaliar e implementar uma politica clara de concorrencia e escrita para o mARC.
- Garantir que escritas concorrentes vindas de MCP e UI preservem o source of truth em Markdown.
- Documentar o comportamento depois que a politica estiver implementada.

Pontos para investigar:

- Como `appendMessage`, `attachArtifact`, `attachArtifactToMessage` e rebuild de indice se comportam sob concorrencia.
- Se o projeto precisa de fila por workspace/thread, lock por arquivo, escrita atomica via temp+rename, retry, ou outra estrategia.
- Como testar concorrencia sem deixar o teste instavel.

Criterios esperados:

- Contrato de escrita definido.
- Testes cobrindo concorrencia relevante.
- Documentacao atualizada em `docs/architecture.md` ou doc equivalente.

<!-- /marc-message -->

<!-- marc-message
id: msg_0230fca077a04dd29d
threadId: oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f
timestamp: 2026-05-24T17:11:16.793Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-politica-concorrencia-escritas-markdown.md
-->

Plano detalhado registrado para a implementação da política de concorrência dos writers Markdown do mARC.

- O plano distingue lock cooperativo de substituição atômica de arquivo.
- O escopo inclui threads/artifacts, perfis de agentes, recomendações gerenciadas e convergência do índice derivado.
- O desenvolvimento será iniciado com preservação de Markdown como fonte de verdade e validação completa ao final.

<!-- /marc-message -->

<!-- marc-message
id: msg_e900262573f7450b86
threadId: oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f
timestamp: 2026-05-24T18:46:17.503Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluído para avaliação.

Implementação:
- Adicionado coordenador interno com locks cooperativos por recurso em cache derivado e substituição atômica dos arquivos regravados.
- Integrados threads/artifacts, perfis de agentes e recomendações gerenciadas, preservando mensagens, contexto manual e `Custom Rules` em concorrência.
- Serializado o rebuild/publicação do `thread-index.json`, que permanece JSON derivado e reconstruível a partir do Markdown autoritativo.
- Confirmado que eventos dos locks em `cache/` já são ignorados pelo watcher da UI.

Testes:
- Cobertos lock, timeout, recuperação stale e substituição atômica.
- Coberta concorrência em transcript/artifacts, inclusive com dois processos Node na mesma thread.
- Coberta preservação concorrente de perfil de agente e `Custom Rules`.

Documentação:
- Adicionado ADR de locks cooperativos e substituição atômica.
- Atualizados arquitetura e índice de ADRs para distinguir Markdown autoritativo de índice/locks derivados.

Validação:
- `pnpm run validate`: passou.
- `pnpm test`: passou, 84 testes.
- `pnpm build`: passou.
- `workspace_audit` preflight: sem findings.

Risco residual: artifact e metadata em `CHAT.md` não são transação multi-arquivo; uma interrupção pode deixar artifact órfão detectável por auditoria, sem apagar mensagens.

Aguardando feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_38c0654675e34885b2
threadId: oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f
timestamp: 2026-05-24T19:23:28.258Z
agentId: codex-dev
role: developer
-->

Feedback recebido: encerramento autorizado.

- A validação pós-restart confirmou bootstrap, índice pronto e preflight sem achados.
- A thread será finalizada com o resumo executivo da decisão e das evidências já registradas.

<!-- /marc-message -->

<!-- marc-message
id: msg_1873d72320ec4fdd9e
threadId: oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f
timestamp: 2026-05-24T19:32:22.915Z
agentId: codex-dev
role: developer
-->

Ajuste documental posterior ao encerramento:

- Removidas as quebras manuais de linha nos parágrafos e bullets do ADR 0009; o renderer passa a controlar o wrapping visual.
- A decisão arquitetural não foi alterada: Markdown permanece autoritativo, e índice/locks permanecem derivados.
- Validação após o ajuste: `pnpm run validate`, `pnpm test` (84 testes) e `pnpm build` passaram.

<!-- /marc-message -->
