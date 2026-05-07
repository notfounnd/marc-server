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
