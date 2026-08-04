# Plano - Correcao estrutural da busca da memory

## Objetivo

Corrigir ranking, elegibilidade e manutencao da memory priorizando qualidade e previsibilidade. Latencia sera medida, mas nao bloqueara esta entrega.

A solucao preserva `SUMMARY.md` de threads fechadas como fonte de verdade, mantem E5 + mMARCO e nao introduz listas linguisticas, regras por palavra, boosts literais ou ajustes especificos para os termos usados na validacao.

## Arquitetura de busca

1. Migrar a memory para schema v4 com duas representacoes:
   - identidade da thread, composta por titulo e sintese executiva;
   - passagens de conteudo, sem repetir o titulo em cada embedding.
2. Recuperar candidatos pela uniao dos rankings de identidade e passagens.
3. Consolidar candidatos por thread antes do reranking.
4. Reranquear documentos no nivel da thread, compostos pela identidade e melhores evidencias, sem limitar prematuramente a tres passagens.
5. Ordenar por fusao dos ranks de identidade, passagens e mMARCO. Scores brutos nao serao tratados como probabilidades comparaveis.
6. Separar elegibilidade do ranking:
   - extrair sinais relativos, incluindo concordancia entre rankings, margens, concentracao de evidencias e posicoes;
   - calibrar regressao logistica offline com julgamentos graduados;
   - versionar coeficientes e politica no codigo;
   - exibir apenas relevancia direta ou contextual;
   - rejeitar relevancia incidental ou irrelevante.
7. Garantir que cada nova consulta comece em depth 0. Deep retry apenas amplia candidatos da mesma consulta e nunca reduz a exigencia de elegibilidade.

## Geracoes e sanitizacao

1. Tanto full quanto incremental produzirao uma nova geracao:
   - full recalcula todos os embeddings;
   - incremental reaproveita vetores inalterados e calcula somente fontes novas ou modificadas.
2. Validar tabelas, dimensoes, providers e contagens antes de promover atomicamente o novo manifesto.
3. Em falha, manter a geracao anterior ativa e remover artefatos temporarios incompletos.
4. Serializar search, prepare, rebuild e purge pelo coordenador global para impedir acesso concorrente a uma geracao removida.
5. Adicionar `Purge unused` no settings e `marc memory purge` no CLI. Purge nao sera exposto pelo MCP.
6. Preservar modelos ativos, artefatos exigidos pelos contratos ativos, a geracao apontada pelo manifesto e arquivos desconhecidos fora do inventario gerenciado.
7. Remover modelos substituidos, variantes ONNX nao selecionadas, geracoes inativas e versoes antigas reconhecidas do LanceDB.
8. Usar `dropTable` e `optimize` do LanceDB sob coordenacao exclusiva, sem remocao generica sobre `.marc/cache`.
9. Exibir no settings os modelos ativos, variantes, estado e tamanho em disco. O toast do purge informara bytes e itens liberados.

## Contratos e interface

1. Evoluir `MemoryStatus` com inventario dos modelos ativos, espaco utilizado, espaco recuperavel e estado de purge.
2. Criar `POST /api/workspaces/:workspaceId/memory/purge`, retornando bytes, modelos, geracoes e versoes removidas.
3. Manter a interface publica de `memory_recall`. Seu `score` passara a representar elegibilidade calibrada e `matchedText` continuara apontando a melhor evidencia.
4. Atualizar textos pelo sistema de localizacao e manter produto, codigo e documentacao tecnica em en-US.
5. Atualizar a documentacao da memory, schema v4, rebuild geracional, politica de relevancia e manutencao de cache.

## Qualidade e aceite

1. Substituir o benchmark de threshold por corpus versionado com julgamentos `direct`, `contextual`, `incidental` e `irrelevant`.
2. Incluir fixtures sinteticas multilingues e integracao com o corpus real fechado.
3. Cobrir em depth 0 a 3:
   - `brutal`;
   - `brutalismp`;
   - `brutalism`;
   - `interface com brutalism`;
   - `interace com brutalism`;
   - `toggle`;
   - `toogle`;
   - consultas positivas, ambiguas e sem resposta de outros dominios.
4. Para brutalism, a thread de estilo deve superar registros que apenas mencionam o termo durante testes da busca.
5. Para toggle e toogle, as threads de switch e persistencia de settings devem superar ocorrencias desconectadas.
6. Avaliar nDCG@10, MRR, Recall@10, precisao de elegibilidade, recall de elegibilidade e falsos positivos sem resposta.
7. Exigir zero falha nos casos criticos e zero falso positivo nas consultas negativas do conjunto de aceite. A calibracao usara validacao por familias de consulta para impedir memorizacao dos termos.
8. Testar repeticao, batch sizes diferentes, todos os depths, restart, full e incremental, promocao apos falha e purge preservando a geracao e modelos ativos.
9. Remover SLA de duracao do gate. Registrar tempos apenas como observacao para evolucao posterior.
10. Executar `pnpm run memory:quality`, `pnpm run validate`, `pnpm test` e `pnpm build`. Validar a UI somente por `playwright-cli`.
11. Apos o schema v4 estar pronto, solicitar restart e full rebuild. A thread somente sera concluida depois da matriz real de buscas e do feedback do usuario.

## Disciplina de implementacao

- Preservar Markdown como fonte de verdade.
- Usar guard clauses e early returns, sem `else` e sem `if` aninhado.
- Usar Strategy ou dispatch tables para variacoes de comportamento.
- Efetuar alteracoes somente com a ferramenta nativa `apply_patch`.
- Nao executar comandos git.