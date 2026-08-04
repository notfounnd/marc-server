# Plano de Refinamento da Busca Semântica da Memory

## Objetivo

Substituir o ranking híbrido atual por recuperação e reranking semânticos. A busca deve recuperar contexto relevante por significado, sem depender de regras lexicais, termos exatos, fuzzy, prefixos, stopwords ou listas por idioma.

O corpus continua limitado aos `SUMMARY.md` de threads fechadas. Markdown continua como fonte de verdade. Índice vetorial, cache dos modelos e processos de inferência permanecem derivados e reconstruíveis.

## Decisões Confirmadas

- Usar somente um retriever, `Xenova/multilingual-e5-small` int8. Ele é o artefato ONNX para Transformers.js do modelo-base `intfloat/multilingual-e5-small`.
- Usar `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` como reranker.
- Executar retrieval e reranking em workers filhos isolados do Node.
- Manter TTL de 30 segundos por worker e workspace.
- Usar pools lineares de candidatos por profundidade: Edge 100, Retry 1 200, Retry 2 300 e Retry 3 400.
- Substituir `minScore` por `depth` em core, daemon, MCP, CLI e UI.
- Manter `limit` apenas como limite final de threads após reranking e deduplicação.
- Rejeitar `minScore` no novo contrato, sem ignorá-lo silenciosamente.
- Exigir full rebuild explícito após a migração do índice.

## Pipeline Semântico

1. Derivar o texto de embedding de cada resumo ou seção a partir de título, slug, identidade da seção e conteúdo.
2. Preservar separadamente o texto de apresentação para a UI.
3. Gerar embeddings de documentos com prefixo `passage:` e consultas com `query:`.
4. Recuperar o pool correspondente à profundidade solicitada, sem corte pelo score absoluto do E5.
5. Reranquear os pares consulta e contexto com mMARCO.
6. Converter logits do reranker em probabilidade de relevância.
7. Aplicar limiar inicial de 0.50, calibrado pela suíte de qualidade real.
8. Deduplicar por thread e ordenar por relevância do reranker, score do retriever e ID estável.

A implementação remove busca lexical, candidatos literais, boosts por termo exato, boosts por seção e fórmulas de ranking híbrido.

## Modelo, Workers e Uso de Memória

- Criar um worker de embedding E5 e um worker de reranking mMARCO para cada workspace.
- Serializar chamadas dentro de cada worker.
- Encerrar worker ocioso após 30 segundos. A terminação do processo devolve memória nativa ao sistema operacional, diferente de depender apenas de `.dispose()` do ONNX Runtime.
- Manter downloads em `.marc/cache/memory-models/`.
- Fazer `Prepare models` validar os dois caches. Os processos iniciados pela preparação também expiram pelo TTL.
- Reutilizar a configuração de batch como teto de inferência para embeddings e pares do reranker. Renomear o controle para `Inference batch size`.
- Escolher a variante ONNX int8 compatível com a CPU. Se ela falhar na inicialização, usar o artefato ONNX otimizado genérico.

As fronteiras internas devem separar provider de embedding, provider de reranking e coordenação de workers. Isso prepara um seletor futuro sem acoplar busca ou armazenamento ao modelo atual.

## Contratos e Experiência de Busca

- A API de recall recebe `depth` de 0 a 3.
- Uma nova busca sempre começa em Edge. A profundidade da busca anterior não pode contaminar a próxima.
- A UI só executa retry automático quando a profundidade anterior não produziu resultados elegíveis.
- Deep search avança exatamente uma profundidade por ação e fica disponível até a profundidade 3.
- MCP e UI usam a mesma política de candidatos. Eles podem apresentar quantidades diferentes porque `limit` atua somente na saída final.
- Atualizar o schema do snapshot persistido da busca para descartar respostas da política híbrida anterior.
- Substituir razões de match por explicações semânticas, sem referências a termos exatos ou section boost.

## Estados e Migração

- Rebuild requer retriever preparado.
- Busca requer índice utilizável, retriever e reranker preparados.
- Preservar os estados `ready`, `stale`, `incompatible` e erro.
- Rebuild automático continua incremental e não torna índices incompatíveis compatíveis.
- Atualizar a versão do schema da memory. A troca do espaço vetorial e do texto contextual de embedding torna full rebuild obrigatório.
- Atualizar textos de UI, contratos MCP e CLI, documentação de memory e a ação de preparação para cobrir os dois modelos.

## Validação e Critérios de Aceite

Adicionar testes determinísticos para:

- contexto gerado para E5
- batch e saída do mMARCO
- ciclo de vida, serialização e TTL dos workers
- fallback do modelo ONNX
- progressão de profundidade
- ordenação, deduplicação e isolamento de `limit`
- rejeição de `minScore`
- estados de prontidão
- full e incremental rebuild
- retry automático e manual da UI
- invalidação de snapshots persistidos

Adicionar uma suíte opt-in com os modelos reais e o corpus local. Ela deve reportar top resultados, scores, latência, PIDs, ciclo de vida dos workers e RSS.

A implementação só será considerada pronta quando a suíte real demonstrar:

- `brutalism` com `oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1` em primeiro.
- `interface com brutalism` com a mesma thread em primeiro.
- `toogle` sem resultados criados por aproximação com `toggle`.
- `toggle` avaliado por relevância semântica, nunca aceito apenas por ocorrência literal.

No encerramento, executar `pnpm run validate`, `pnpm test`, `pnpm build`, a suíte de qualidade e um full rebuild após o restart necessário.
