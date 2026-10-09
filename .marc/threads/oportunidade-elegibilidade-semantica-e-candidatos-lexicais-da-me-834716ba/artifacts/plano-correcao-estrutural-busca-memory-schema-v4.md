# Plano - Correção estrutural da busca da memory

## Objetivo

Corrigir ranking, elegibilidade e manutenção da memory priorizando qualidade e previsibilidade. Latência será medida, mas não bloqueará esta entrega.

A solução preserva `SUMMARY.md` de threads fechadas como fonte de verdade, mantém E5 + mMARCO e não introduz listas linguísticas, regras por palavra, boosts literais ou ajustes específicos para os termos usados na validação.

## Arquitetura de busca

1. Migrar a memory para schema v4 com duas representações:
   - identidade da thread, composta por título e síntese executiva;
   - passagens de conteúdo, sem repetir o título em cada embedding.
2. Recuperar candidatos pela união dos rankings de identidade e passagens.
3. Consolidar candidatos por thread antes do reranking.
4. Reranquear documentos no nível da thread, compostos pela identidade e melhores evidências, sem limitar prematuramente a três passagens.
5. Ordenar por fusão dos ranks de identidade, passagens e mMARCO. Scores brutos não serão tratados como probabilidades comparáveis.
6. Separar elegibilidade do ranking:
   - extrair sinais relativos, incluindo concordância entre rankings, margens, concentração de evidências e posições;
   - calibrar regressão logística offline com julgamentos graduados;
   - versionar coeficientes e política no código;
   - exibir apenas relevância direta ou contextual;
   - rejeitar relevância incidental ou irrelevante.
7. Garantir que cada nova consulta comece em depth 0. Deep retry apenas amplia candidatos da mesma consulta e nunca reduz a exigência de elegibilidade.

## Gerações e sanitização

1. Tanto full quanto incremental produzirão uma nova geração:
   - full recalcula todos os embeddings;
   - incremental reaproveita vetores inalterados e calcula somente fontes novas ou modificadas.
2. Validar tabelas, dimensões, providers e contagens antes de promover atomicamente o novo manifesto.
3. Em falha, manter a geração anterior ativa e remover artefatos temporários incompletos.
4. Serializar search, prepare, rebuild e purge pelo coordenador global para impedir acesso concorrente a uma geração removida.
5. Adicionar `Purge unused` no settings e `marc memory purge` no CLI. Purge não será exposto pelo MCP.
6. Preservar modelos ativos, artefatos exigidos pelos contratos ativos, a geração apontada pelo manifesto e arquivos desconhecidos fora do inventário gerenciado.
7. Remover modelos substituídos, variantes ONNX não selecionadas, gerações inativas e versões antigas reconhecidas do LanceDB.
8. Usar `dropTable` e `optimize` do LanceDB sob coordenação exclusiva, sem remoção genérica sobre `.marc/cache`.
9. Exibir no settings os modelos ativos, variantes, estado e tamanho em disco. O toast do purge informará bytes e itens liberados.

## Contratos e interface

1. Evoluir `MemoryStatus` com inventário dos modelos ativos, espaço utilizado, espaço recuperável e estado de purge.
2. Criar `POST /api/workspaces/:workspaceId/memory/purge`, retornando bytes, modelos, gerações e versões removidas.
3. Manter a interface pública de `memory_recall`. Seu `score` passará a representar elegibilidade calibrada e `matchedText` continuará apontando a melhor evidência.
4. Atualizar textos pelo sistema de localização e manter produto, código e documentação técnica em en-US.
5. Atualizar a documentação da memory, schema v4, rebuild geracional, política de relevância e manutenção de cache.

## Qualidade e aceite

1. Substituir o benchmark de threshold por corpus versionado com julgamentos `direct`, `contextual`, `incidental` e `irrelevant`.
2. Incluir fixtures sintéticas multilíngues e integração com o corpus real fechado.
3. Cobrir em depth 0 a 3:
   - `brutal`;
   - `brutalismp`;
   - `brutalism`;
   - `interface com brutalism`;
   - `interace com brutalism`;
   - `toggle`;
   - `toogle`;
   - consultas positivas, ambíguas e sem resposta de outros domínios.
4. Para brutalism, a thread de estilo deve superar registros que apenas mencionam o termo durante testes da busca.
5. Para toggle e toogle, as threads de switch e persistência de settings devem superar ocorrências desconectadas.
6. Avaliar nDCG@10, MRR, Recall@10, precisão de elegibilidade, recall de elegibilidade e falsos positivos sem resposta.
7. Exigir zero falha nos casos críticos e zero falso positivo nas consultas negativas do conjunto de aceite. A calibração usará validação por famílias de consulta para impedir memorização dos termos.
8. Testar repetição, batch sizes diferentes, todos os depths, restart, full e incremental, promoção após falha e purge preservando a geração e modelos ativos.
9. Remover SLA de duração do gate. Registrar tempos apenas como observação para evolução posterior.
10. Executar `pnpm run memory:quality`, `pnpm run validate`, `pnpm test` e `pnpm build`. Validar a UI somente por `playwright-cli`.
11. Após o schema v4 estar pronto, solicitar restart e full rebuild. A thread somente será concluída depois da matriz real de buscas e do feedback do usuário.

## Disciplina de implementação

- Preservar Markdown como fonte de verdade.
- Usar guard clauses e early returns, sem `else` e sem `if` aninhado.
- Usar Strategy ou dispatch tables para variações de comportamento.
- Efetuar alterações somente com a ferramenta nativa `apply_patch`.
- Não executar comandos git.
