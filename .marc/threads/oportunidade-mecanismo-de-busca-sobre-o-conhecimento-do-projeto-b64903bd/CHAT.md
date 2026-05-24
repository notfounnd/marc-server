# Oportunidade - Mecanismo de busca sobre o conhecimento do projeto

Thread: `oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd`
Created: `2026-05-24T19:39:17.892Z`

<!-- marc-message
id: msg_d30cfddada7b4140b5
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-05-24T19:39:32.718Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada: mecanismo de busca sobre o conhecimento do projeto.

Relacionamento:
- Esta oportunidade tem fit com marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac.
- O mecanismo de busca é a experiência/contrato de recuperação; embeddings e índice estruturado são uma possível infraestrutura para elevar relevância e escala.

Objetivo:
- Permitir consultar threads, summaries, artifacts, ADRs, regras e agentes por termos, filtros e relevância, retornando fontes rastreáveis sem exigir leitura manual ampla.

Resultados esperados:
- Encontrar rapidamente decisões, bugs anteriores, mudanças e evidências do histórico.
- Apoiar navegação humana na UI e consumo direcionado por agentes/MCP.
- Reduzir reabertura de contexto irrelevante e tornar descobertas reproduzíveis por referências mARC.

Pontos para investigar:
- Escopo v1: busca textual/estruturada, sem depender da camada vetorial para ser útil.
- Evolução híbrida: combinar filtros, full-text e similaridade semântica quando o índice de embeddings existir.
- Fontes, permissões, filtros por tipo/thread/status/data/agente e ordenação de resultados.
- Forma de destacar trechos, retornar referência canônica e abrir o documento original na UI.
- API/MCP necessária, impacto no daemon/UI, cache derivado e atualização incremental após mudanças Markdown.

Critérios de sucesso:
- Resultados vinculam claramente trecho, fonte e referência navegável.
- A busca textual funciona independentemente de embeddings; a busca semântica pode ampliá-la depois.
- Índices continuam derivados e reconstruíveis; Markdown permanece fonte de verdade.
- Testes cobrem relevância mínima, filtros, referências e atualização após alteração das fontes.

<!-- /marc-message -->
