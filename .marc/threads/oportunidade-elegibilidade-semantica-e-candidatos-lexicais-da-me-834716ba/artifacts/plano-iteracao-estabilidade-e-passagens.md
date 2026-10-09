# Plano da iteração de estabilidade e passagens

## Objetivo

Transformar o recall da memory em um pipeline semanticamente estável, orientado a passagens e consolidado por thread. A correção preserva a busca semanticamente pura. Match literal não passa a ser critério de elegibilidade.

## Escopo

### 1. Reranker estável

- Usar exclusivamente `model_O4.onnx` para o mMARCO.
- Remover fallback automático para `model_quint8_avx2.onnx`.
- Considerar o modelo preparado apenas quando o arquivo O4 correto estiver presente.
- Manter Prepare model como caminho explícito para baixar o novo artefato.
- Separar `RERANK_BATCH_SIZE` do tamanho de lote configurável de embeddings.
- Iniciar o reranker com lote 8 e reduzir para 4, 2 e 1 apenas em erro de memória.
- Cobrir a invariância dos scores diante de variação de lote.

### 2. Corpus de passagens

- Elevar o schema da memory para v3 e exigir full rebuild para a migração.
- Remover o chunk global que replica todo o SUMMARY.
- Extrair blocos Markdown e dividi-los em passagens de até 320 tokens mMARCO, com sobreposição de 48 tokens.
- Preferir quebra de sentença antes de cortar por janela de tokens.
- Incluir título e seção em todas as passagens.
- Gerar IDs estáveis para que rebuilds incrementais possam reconciliar as passagens.
- Reaproveitar o tokenizer local do reranker sem manter pesos ONNX carregados fora das operações de inferência.

### 3. Seleção e ranking por thread

- Manter profundidades internas de candidatos vetoriais em 100, 200, 300 e 400.
- Reter no máximo três passagens por thread antes do reranking.
- Reranquear passagens, não documentos longos.
- Consolidar cada thread pela melhor passagem relevante.
- Ordenar threads finais por Reciprocal Rank Fusion entre o rank denso da thread e o rank do reranker.
- Preservar no retorno a passagem que explica o resultado.

### 4. Elegibilidade e benchmark

- Executar varredura determinística de limiar com O4.
- Escolher o menor limiar que preserve positivos esperados e elimine negativos conhecidos.
- Falhar a calibração caso não exista separação suficiente, sem trocar limiar por conveniência.
- Cobrir `brutalism`, `interface com brutalism` no Edge e Deep, `brutal` sem falso positivo, `toggle` e `toogle` sem falsos positivos.
- Verificar que uma consulta aquecida respeita 30 segundos no ambiente local como guardrail de qualidade, sem timeout de produção.
- Registrar score, ordem, workers e duração no relatório `memory:quality`.

### 5. Documentação e validação

- Atualizar `docs/memory.md` para documentar modelo O4, corpus de passagens, RRF, batches e migração v3.
- Executar validate, testes, build, quality benchmark, Prepare model e full rebuild.
- Informar reinício necessário depois que os contratos e workers forem alterados.

## Fora de escopo

- Reintroduzir fallback lexical.
- Criar configuração de usuário para batch do reranker.
- Definir timeout de produção para recall.
- Alterar o corpus para indexar arquivos fora de threads fechadas.
