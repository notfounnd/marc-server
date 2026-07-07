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

<!-- marc-message
id: msg_4f0abeabc3d84e768b
threadId: oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
timestamp: 2026-07-06T15:46:01.849Z
agentId: ui-user
role: user
-->

Da uma olhada nesse plugin. Um amigo meu que fez, talvez algo da ideia possa ser aproveitado nessa evolução do banco com informações em embeding.

- https://github.com/edusouza/edusouza-plugins/tree/main/plugins/claude-memory

Parte da dificuldade aqui eu sei que toca a maneira com que cada agente faz seu próprio embeding de dados. Acredito que a estratégia ideial seria o mARC oferecer ferramentas para que, além da parte de busca (também tratado na thread marc://$oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd - fit com essa thread), o agente possa fazer embeding interno, independente do modelo/harness (CLI, IDE, App) utilizado.

Se essa mensagem ficou muito confusa de compreender, acione na sessão de chat para em tempo real poder ajudar a refinar a ideia.

<!-- /marc-message -->

<!-- marc-message
id: msg_50e9047bffab4b17b5
threadId: oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
timestamp: 2026-07-06T19:52:42.477Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-banco-embeddings-summaries.md
-->

Plano detalhado registrado antes do desenvolvimento.

- Artifact: artifacts/plano-banco-embeddings-summaries.md
- Escopo: memória histórica compartilhada baseada em `SUMMARY.md`, com LanceDB em `.marc/memory`, provider local por adapter e rebuild explícito.
- Próximo passo: iniciar implementação seguindo TDD e validar com `pnpm run validate`, `pnpm test` e `pnpm build` antes do comentário final.

<!-- /marc-message -->

<!-- marc-message
id: msg_52c1956cab5c43a9b0
threadId: oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
timestamp: 2026-07-07T00:15:56.402Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluído e validado.

## Realizado

- Implementei o núcleo de memória semântica sobre `SUMMARY.md`, com boundary de provider/adapter para embeddings e store LanceDB.
- Adicionei tools MCP `memory_prepare`, `memory_status`, `memory_rebuild` e `memory_recall`, além dos comandos CLI equivalentes.
- Atualizei o gerador do `marc-ops` para orientar agentes a consultar `memory_recall` antes de propor/desenvolver mudanças que possam contradizer histórico do projeto.
- Documentei o fluxo em `docs/memory.md` e atualizei README/docs MCP.
- Gerei a snapshot commitável em `.marc/memory` a partir de 27 summaries. O cache do modelo ficou fora da snapshot, em `.marc/cache/memory-models`.

## Validação

- `pnpm run validate`: passou.
- `pnpm test`: passou com 91/91.
- `pnpm build`: passou; permaneceu apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.
- `memory_status`: `ready`, 27 summaries, 27 indexados.
- `memory_rebuild`: `ready` após regenerar a snapshot.
- `memory_recall` para "implementar rotacao de token da interface": encontrou marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3 e orientou `thread_read` antes de reabrir/contradizer a decisão histórica.
- `workspace_audit` preflight da thread: ok, 0 achados.

## Observação

O recall validou o objetivo mínimo, mas a ordenação semântica pura ainda pode trazer hits de UI antes do hit de token quando a query usa "interface". Isso não bloqueia a entrega, mas sugere um tuning futuro de reranking/hybrid lexical caso a v1 precise priorizar melhor termos críticos como `token`.

Aguardando seu feedback para orientar a finalização da thread.

<!-- /marc-message -->
