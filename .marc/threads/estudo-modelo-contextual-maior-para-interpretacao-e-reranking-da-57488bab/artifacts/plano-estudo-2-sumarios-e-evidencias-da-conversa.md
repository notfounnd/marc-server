# Plano do estudo 2/4: sumários e evidências da conversa

## Síntese e autorização

O humano autorizou a execução do segundo estudo após a conclusão do estudo 1/4. A ordem mantida é pontuação/ordenação/descarte, conteúdo indexado, decisões estruturadas do interpretador e rerankers especializados.

Este estudo investiga se adicionar mensagens de threads fechadas melhora a recuperação contextual sem trocar modelos ou o ranking. Não autoriza implementar a oportunidade memory_deep, alterar a busca produtiva ou iniciar os estudos 3/4 e 4/4.

A recomendação do estudo 1 permanece: manter o ranking atual. A expansão de conteúdo é uma hipótese, não uma melhora presumida.

## Fontes e decisões preservadas

Foram recuperados a thread deste estudo, seu resultado 1/4, as fontes das consultas e julgamentos, a oportunidade memory_deep e seu anexo, a decisão de criação/revisão de SUMMARY e a migração dos cabeçalhos históricos. A análise utilizou context-mode, sequential-thinking e a documentação primária de LanceDB e Transformers.js por Context7.

A oportunidade abaixo propõe uma camada profunda separada da memória de sumários. Seus modelos e tamanhos citados são históricos, não a configuração atual.
marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae

Decisões preservadas:
- Markdown autoritativo, projeções e índices derivados.
- Somente as mesmas threads fechadas elegíveis no manifesto congelado.
- SUMMARY continua a decisão consolidada. CHAT é evidência de conversa, não decisão final por ter sido recuperado.
- Não reescrever sumários, perfis, regras, documentos de produto ou modelo/configuração.
- Não criar API, tool, recurso de UI ou nova memória produtiva.
- Não misturar este estudo com grafo, profundidade adaptativa, Jev ou novos modelos.

## Estado congelado e inventário

- Workspace: marc-dd422176e1, C:/Projetos/marc.
- Geração produtiva: `20261013051147276_6cfe9a14`.
- 53 registros de sumário e 338 registros vetoriais existentes.
- 53 CHAT.md correspondentes, 395 mensagens canônicas, sem IDs ausentes ou duplicados dentro das threads no inventário.
- 394.897 caracteres de CHAT e 161.798 caracteres de SUMMARY. Não são contagens de tokens.
- Maior mensagem: 3.205 caracteres.
- Hash agregado dos CHAT elegíveis: `9ab6870a435d283abf20f79656db8b8c1220393fecb0546fbc8e5fd80469e54e`.
- Manifesto SHA-256: `1a99b242539990b87afa7b016568c2eba9d0d248d5020bbcccaf708644f3dfcf`.
- Configuração: autoRebuild=false, embeddingBatchSize=4, searchRetryDepth=0.
- Configuração SHA-256: `ab8f2df35ee53770a55f560ae9d795907503016e1bc1b039e2818369fa8dc536`.
- E5 `Xenova/multilingual-e5-small`, int8, 384 dimensões. mMARCO `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`, O4.
- Transformers.js 4.3.1, LanceDB instalado, modelos/cache existentes.
- Tokenizers locais E5 e mMARCO: XLMRobertaTokenizer, capacidade declarada de 512 tokens.

Confirmar esses hashes antes e depois da rodada. A mudança de qualquer fonte congelada, modelo, configuração ou código invalida a execução, em vez de ser ocultada ou corrigida com checkout.

## Condições previamente definidas

### C0: sumários atuais

Usar a geração produtiva congelada exclusivamente por APIs de leitura do store. Identidades, textos, vetores e canais lexicais atuais ficam intactos. Nenhuma operação de rebuild, reconcile, purge, preparação ou escrita pode receber o WorkspaceInfo real.

A captura do estudo 1 e o relatório corrigido v2 permanecem somente leitura e servem de referência. Não executar sua CLI de validação/captura ou suas suítes antigas, que podem alcançar arquivos de evidência.

### C1: sumários atuais mais mensagens

Criar uma única base LanceDB temporária com os mesmos 338 registros/vetores de C0, acrescidos de passagens das 395 mensagens elegíveis. Manter identidade e passagens dos sumários originais, sem regenerar ou substituir seus vetores.

A base temporária terá WorkspaceInfo de storage separado, com raiz física dentro do diretório autorizado. Providers de inferência recebem o WorkspaceInfo real somente para ler configuração/cache. Guardar essa separação antes de cada operação de escrita.

As passagens novas têm kind=passage e usam o schema e a criação de índices lexicais existentes. Texto adicional participa da recuperação densa e do campo lexical existente de conteúdo, sem criar outro canal, listas de palavras ou bônus de match literal. Identidades/títulos não são duplicados.

Somente C0 e C1 são condições de qualidade. Preservar as listas sem filtro como diagnóstico local para distinguir candidato ausente, exclusão e posição, não como terceira proposta produtiva.

## Corpus e materialização

- Ler somente CHAT e SUMMARY das 53 threads identificadas pelo manifesto. Não varrer indiscriminadamente todas as threads.
- Reusar `parseMessages` canônico. Confirmar correspondência de threadId, unicidade de IDs, arquivos regulares e caminhos físicos dentro da raiz de origem.
- Segmentar cada corpo de mensagem separadamente, sem fundir falas de autores/mensagens diferentes.
- Reusar o segmentador produtivo por sentenças/tokens, com máximo de 320 tokens e overlap de 48, iguais ao materializador atual.
- Preservar o corpo da mensagem como texto de conversa, sem filtro por palavra, idioma, modelo, alvo do gabarito ou relevância esperada.
- IDs, roles, timestamps e caminhos são proveniência, não texto para melhorar o score. Usar contexto neutro fixo na passagem, no formato já usado para seções, sem repetições artificiais do título.
- Manter sidecar por recordId com sourceType=chat, threadId, messageId, agentId, role quando presente, timestamp, caminho relativo, hash da fonte e ordinal da passagem. Não alegar offsets ou linhas exatas que o segmentador não fornece.
- Os registros de C0 têm proveniência summary. Nas evidências, distinguir sumário e conversa e nunca apresentar a fala recuperada como decisão final automaticamente.
- Apenas SUMMARY e CHAT nesta ablação. Artifacts, RULES, código e docs externos não entram. O estudo não abrange todo o escopo futuro de f04c7cae.
- Não excluir mensagens específicas que contenham termos do benchmark. Registrar o risco de contaminação histórica e inspecionar a proveniência dos ganhos, sem ajustar o corpus depois de ver resultados.

### Limites de tokens e lotes

Carregar tokenizers existentes localmente, sem download ou pipeline ONNX apenas para inspeção. Verificar o payload final do E5, incluindo prefixo/contexto, e o par consulta/documento do mMARCO nos limites de 512.

Não aceitar truncamento silencioso. A inspeção ocorre antes da captura real. Se o formato/materialização não couber, corrigir a implementação de segmentação para respeitar os limites, sem mudar o critério de qualidade ou selecionar parâmetros pelo gabarito. Uma expansão material deste protocolo deve ser comunicada e registrada antes de inferências.

O provider de embedding não divide uma chamada arbitrariamente grande em lotes. O executor deve chamar embedDocuments em grupos de no máximo quatro, conforme configuração congelada. Nunca enviar todos os corpos ou passagens em uma única chamada ao modelo.

Reranking conserva batch 8 e a política de backoff produtiva, sem paralelismo de inferência ou alteração de device/TTL. Qualquer backoff observado é diagnóstico, não mudança escondida de parâmetros.

## Consultas e comparabilidade

Usar os mesmos 30 casos históricos e 14 controles do estudo 1, com o parser já corrigido. São 44 casos lógicos e 40 consultas efetivas distintas. Preservar consultas originais, efetivas e alvos. Separar 12 controles positivos e 2 de abstinência.

Reusar apenas funções de leitura, parsing e avaliação seguras do estudo 1. Seus helpers de escrita e CLI apontam para outra raiz e não podem ser utilizados para escrever neste estudo.

Não carregar o LFM, reinterpretar queries, inventar novos casos ou testar somente a família brutalism.

Para cada consulta efetiva:
1. Gerar um vetor E5 uma única vez e reutilizá-lo em C0 e C1.
2. Usar os mesmos canais, parâmetros e limite de 100 por canal, profundidade inicial, mesma seleção de até três passagens por thread e o ranking híbrido produtivo.
3. Filtrar no mesmo limiar 0,5 e aplicar limite final de 50 depois da consolidação.
4. Capturar candidatos, documentos do reranker, batch, scores, sinais, listas e proveniência.

Reuso de scores do estudo 1 é permitido somente por chave exata contendo consulta, array ordenado de documentos, batch, hashes de modelos e runtime. Um miss deve produzir inferência real e ser contado. Nunca aproximar documento, reutilizar scores por ID de thread ou confundir cache com ausência de trabalho.

Cada condição é reproduzida com seus documentos/scores capturados. Comparar C0 atual com o baseline anterior para identificar eventual deriva, sem substituir resultados atuais por números antigos. Se o reuso introduzir incerteza de runtime ou equivalência, preferir baseline fresco e registrar o custo. Não afrouxar verificações para economizar execução.

## Implementação e escopo de escrita

Raiz exclusiva para executor, testes, checkpoints, base temporária e dados:
`C:/Users/junior/AppData/Local/Temp/marc-content-study-57488bab-20261013/`

Criar módulos pequenos e autocontidos, dentro de 300 linhas não brancas cada. Proposta de módulos: fontes/proveniência, materialização/tokenização, armazenamento temporário, captura/avaliação e CLI/IO, além de testes. A divisão pode acompanhar responsabilidades reais, sem frameworks desnecessários.

Todos os caminhos do repositório e do estudo 1 permanecem somente leitura. Registros de entrega na thread são a única escrita autorizada no workspace, feita por tools oficiais do mARC. Não criar scripts persistentes no projeto, hooks, dependências, configurações ou perfis.

Usar apply_patch nativo para edição manual. context-mode para investigação, execução e análise. Nenhum Git ou PowerShell.

## Testes e revisão antes da execução

Um desenvolvedor compartilhado, sequencial, configuração humana já confirmada gpt-6-luna/xhigh. Principal mantém arquitetura/revisão e configuração high confirmada. Reusar perfis existentes, sem administração do catálogo.

Antes de editar, o desenvolvedor confirma bootstrap independente, fontes, escopo, configuração e estado da raiz em OK_BOOTSTRAP. O principal verifica e autoriza explicitamente pelo canal interno.

Testes determinísticos sem branches/skips e sem modelos reais:
- Corpus fechado: excluir thread aberta, detectar ID errado/duplicado e rejeitar symlink ou escape de origem/destino, com fixtures declarativas adequadas ao contrato do harness.
- Mensagens canônicas, roles opcionais, Unicode e corpus sem corpo, com proveniência preservada.
- Segmentação por mensagem, limite/overlap, payload final validado, ausência de truncamento silencioso e IDs estáveis.
- 338 registros originais e vetores preservados, sem regeneração dos embeddings existentes.
- Escrita do store só com info temporário, nenhum mutator com info real.
- Embedding em batches de quatro, última sobra correta, vetor finito/dimensão 384 e nenhuma inferência duplicada de query entre C0/C1.
- Cache por chave exata e misses por alteração de documento/ordem/batch/modelo/runtime, sem reutilização parcial.
- Pipeline atual, filtros/limites, replay exato e métricas de alvo/julgamentos desconhecidos/abstinência.
- Checkpoint com fingerprint, retomada sem duplicação, lock/PID exclusivo, erro, stop do sampler e cleanup antes de status completo.
- Módulos dentro do limite e regras de controle de fluxo, incluindo fixtures e scripts embutidos.

Rodar contratos existentes relevantes de ranking e segmentação. Não executar antigas suítes que escrevem na raiz de evidências concluídas. A entrega é estudo temporário offline, não mudança executável do repositório nem release-ready. Usar checks focados, sem comandos write-mode amplos do projeto ou passes presumidos de validate/build/test completos.

O principal revisa o conjunto integrado inteiro, incluindo arquitetura, limites, fontes, captura, metadados, erro/retomada, integridade e evidências, antes de autorizar a rodada real. Corrigir pelo mesmo loop. O bootstrap/autorizações e ajustes ficam internos, não em diário da thread.

## Execução e resultado

Após autorização técnica, um único executor prepara a base temporária e captura as 40 consultas sequencialmente. Sem janelas visíveis ou inferência em paralelo. Validar fingerprint na retomada e não repetir a captura se o processo estiver vivo.

Persistir run/PID/fase/progresso e checkpoints. A conclusão requer cleanup, release de lock, fontes congeladas preservadas, status completo e saída zero. Falha parcial não é resultado final.

Registrar:
- Quantidade de novas passagens por thread e total, cobertura das mensagens e fontes vazias/inelegíveis.
- Embeddings realmente novos, chamadas reais dos providers, cache hits/misses, documentos pontuados e batches estimados claramente identificados.
- Tempo de materialização/build separado do tempo de busca/replay e bytes da base temporária.
- RSS observado com escopo declarado. Não garantir RAM total/compatibilidade 8 GB por medir apenas coordenador.
- Top 1/3/5/10/50, MRR, posições por caso e ganhos/perdas pareados C1 versus C0.
- nDCG somente para julgamentos conhecidos, cobertura, incidentais explícitos e desconhecidos separados.
- Dois controles de abstinência separados dos 12 positivos.
- Presença do alvo nos canais, nota própria/final, motivo de exclusão e proveniência da melhor evidência.
- 3P, 6I, 9I como diagnósticos, sem lhes dar tratamento especial no algoritmo.
- Revisão manual das fontes de ganhos/regressões e mudança de melhores resultados para identificar repetição de query, hipótese superada ou evidência realmente explicativa.
- Comparação de C0 com o estudo 1 e integridade de produto, sumários/chats, modelos, configuração, manifesto e stage.

O corpus tem 53 threads e os julgamentos são parciais. A rodada não é holdout novo, não prova relevância global nem substitui avaliação humana. Mais passagens podem deslocar evidência útil do limite 100 e repetir termos de experiências antigas. Essas limitações entram na conclusão, não desaparecem por um Top 10 maior.

## Entrega e decisão

O desenvolvedor publica sua própria entrega consolidada via MCP, com arquivo/linhas, checks reais, limites e revisão do principal pendente. O principal confere essa autoria e registra relatório final legível com método, resultados, regressões, custos e revisão integrada substancial.

Não exportar código/corpus ou arquivo bruto integral da área local. Publicar apenas resultados agregados e evidência selecionada legível. A restrição anterior de exportação continua em vigor.

A decisão pode ser favorável, desfavorável ou inconclusiva à expansão. Não anunciar melhora produtiva nem implementar memory_deep com base apenas no estudo.

Ao final, comentar na thread e no chat, aguardar feedback e manter a thread aberta. Não iniciar o estudo 3/4.

## Questões pendentes

Nenhuma decisão humana impede a execução deste protocolo. Mudança de modelos, corpus além de CHAT, critérios, exportação integral ou implementação produtiva requer nova autorização.
