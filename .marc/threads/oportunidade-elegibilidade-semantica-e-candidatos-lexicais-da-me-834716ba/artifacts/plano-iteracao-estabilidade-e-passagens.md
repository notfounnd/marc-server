# Plano da iteracao de estabilidade e passagens

## Objetivo

Transformar o recall da memory em um pipeline semanticamente estavel, orientado a passagens e consolidado por thread. A correcao preserva a busca semanticamente pura. Match literal nao passa a ser criterio de elegibilidade.

## Escopo

### 1. Reranker estavel

- Usar exclusivamente `model_O4.onnx` para o mMARCO.
- Remover fallback automatico para `model_quint8_avx2.onnx`.
- Considerar o modelo preparado apenas quando o arquivo O4 correto estiver presente.
- Manter Prepare model como caminho explicito para baixar o novo artefato.
- Separar `RERANK_BATCH_SIZE` do tamanho de lote configuravel de embeddings.
- Iniciar o reranker com lote 8 e reduzir para 4, 2 e 1 apenas em erro de memoria.
- Cobrir a invariancia dos scores diante de variacao de lote.

### 2. Corpus de passagens

- Elevar o schema da memory para v3 e exigir full rebuild para a migracao.
- Remover o chunk global que replica todo o SUMMARY.
- Extrair blocos Markdown e dividi-los em passagens de ate 320 tokens mMARCO, com sobreposicao de 48 tokens.
- Preferir quebra de sentenca antes de cortar por janela de tokens.
- Incluir titulo e secao em todas as passagens.
- Gerar IDs estaveis para que rebuilds incrementais possam reconciliar as passagens.
- Reaproveitar o tokenizer local do reranker sem manter pesos ONNX carregados fora das operacoes de inferencia.

### 3. Seleção e ranking por thread

- Manter profundidades internas de candidatos vetoriais em 100, 200, 300 e 400.
- Reter no maximo tres passagens por thread antes do reranking.
- Reranquear passagens, nao documentos longos.
- Consolidar cada thread pela melhor passagem relevante.
- Ordenar threads finais por Reciprocal Rank Fusion entre o rank denso da thread e o rank do reranker.
- Preservar no retorno a passagem que explica o resultado.

### 4. Elegibilidade e benchmark

- Executar varredura deterministica de limiar com O4.
- Escolher o menor limiar que preserve positivos esperados e elimine negativos conhecidos.
- Falhar a calibracao caso nao exista separacao suficiente, sem trocar limiar por conveniencia.
- Cobrir `brutalism`, `interface com brutalism` no Edge e Deep, `brutal` sem falso positivo, `toggle` e `toogle` sem falsos positivos.
- Verificar que uma consulta aquecida respeita 30 segundos no ambiente local como guardrail de qualidade, sem timeout de producao.
- Registrar score, ordem, workers e duracao no relatorio `memory:quality`.

### 5. Documentacao e validacao

- Atualizar `docs/memory.md` para documentar modelo O4, corpus de passagens, RRF, batches e migracao v3.
- Executar validate, testes, build, quality benchmark, Prepare model e full rebuild.
- Informar reinicio necessario depois que os contratos e workers forem alterados.

## Fora de escopo

- Reintroduzir fallback lexical.
- Criar configuracao de usuario para batch do reranker.
- Definir timeout de producao para recall.
- Alterar o corpus para indexar arquivos fora de threads fechadas.
