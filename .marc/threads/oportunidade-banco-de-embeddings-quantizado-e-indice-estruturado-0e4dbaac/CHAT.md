# Oportunidade - Banco de embeddings quantizado e indice estruturado de sumarios

Thread: `oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac`
Created: `2026-05-24T19:36:42.984Z`

<!-- marc-message
id: msg_a3463002f1e7473d90
threadId: oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
timestamp: 2026-05-24T19:37:33.491Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada: banco de embeddings quantizado com índice estruturado de sumários.

Objetivo:
- Criar recuperação semântica e cronológica local sobre o histórico documentado, injetando no contexto do agente apenas evidências executivas relevantes à tarefa atual.

Resultados esperados:
- Reduzir tokens gastos com leitura repetida de threads, artifacts e documentos longos.
- Recuperar linha do tempo e motivação de decisões arquiteturais ou técnicas.
- Melhorar planos e correções com base em decisões consolidadas, prevenindo regressões históricas.
- Reduzir alucinações ao fundamentar análises em fontes reais e rastreáveis.
- Acelerar onboarding sem varredura integral do histórico; manter busca local rápida, com baixo uso de RAM.

Diretriz técnica inicial:
- Avaliar LanceDB para similaridade local com embeddings quantizados.
- Criar índice estruturado vinculado às fontes Markdown autoritativas; vetores e índices permanecem derivados reconstruíveis.

Pontos para investigar:
- Fontes indexáveis: `SUMMARY.md`, artifacts selecionados, ADRs, regras e metadata de threads.
- Estrutura de chunk, timeline, referência de origem, decisão, data, tags e evidência recuperável.
- Modelo, quantização, execução local, custo de rebuild e compatibilidade entre versões de embeddings.
- Atualização incremental diante de threads novas/alteradas/fechadas e edições externas de Markdown.
- Interface para agentes/UI e casos que ainda exigem leitura direta da fonte.

Critérios de sucesso:
- Resultados trazem evidência rastreável à fonte Markdown original.
- Rebuild completo ocorre a partir das fontes autoritativas.
- Recuperação reduz contexto sem omitir decisões relevantes em testes.
- Latência, memória, privacidade e compatibilidade são avaliadas e documentadas antes da implementação.

<!-- /marc-message -->
