# Proposta de Rebuild Incremental e Batches Limitados

## Contexto

A memory indexa apenas summaries de threads fechadas. O Markdown continua sendo a fonte de verdade e o indice vetorial, o manifesto e os caches sao derivados e reconstruiveis.

No encerramento de marc://$oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896, a memory passou de 35 para 36 summaries. Como o auto rebuild estava desabilitado, foi solicitado um rebuild manual. O ONNX Runtime falhou durante a inferencia:

```text
Failed to allocate memory for requested buffer of size 2868903936
```

A alocacao solicitada equivale a cerca de 2,67 GiB em um unico buffer nativo. Havia aproximadamente 30% de 16 GiB livres no computador. Isso nao garante a disponibilidade de um bloco contiguo com esse tamanho, nem cobre pesos do modelo, tensores intermediarios e memoria ja comprometida pelo processo.

## Diagnostico Confirmado

- O provider local usa `Xenova/paraphrase-multilingual-MiniLM-L12-v2` com embeddings de 384 dimensoes.
- `modelPrepared` informa que o modelo esta disponivel no cache local. Nao significa que ele permanece carregado na RAM.
- Rebuilds criam um provider proprio e o descartam ao terminar ou falhar. O TTL de 30 segundos pertence ao provider reutilizado em consultas e nao explica o pico do rebuild.
- O fluxo atual envia todos os records de todos os summaries para uma unica chamada de `embedDocuments`.
- O provider encaminha o array inteiro ao pipeline do Transformers.js. Textos do lote sao processados juntos e preenchidos ate o maior comprimento.
- O tensor de atencao cresce aproximadamente em funcao de `tamanhoDoLote x tokensAoQuadrado`. Um lote unico de summaries longos explica o pico de memoria observado.

Conclusao tecnica

O problema central e o tamanho sem limite do lote de inferencia. Desalocar o modelo continua correto e necessario, mas nao resolve o tensor temporario criado dentro da chamada unica.

## Objetivo

Evoluir a memory em uma unica entrega para:

1. Processar embeddings com batches limitados e apenas um batch de inferencia em voo por workspace.
2. Reconciliar incrementalmente summaries novas, alteradas e removidas no fluxo normal.
3. Manter um rebuild completo explicito que use o mesmo executor por batches.
4. Preservar Markdown como fonte de verdade, locks por workspace, estados de UI e a capacidade de recuperar um indice inconsistente.

## Arquitetura Proposta

### Executor unico de embeddings

Criar um executor interno que receba records e produza vetores em batches limitados.

- O executor processa os batches de forma sequencial.
- Node pode manter o daemon e a UI responsivos entre operacoes assincronas.
- Nao iniciar batches de embedding em paralelo por padrao. A inferencia e computacao nativa e concorrencia paralela elevaria o pico de RAM.
- O tamanho do batch precisa ser conservador e determinado por teste. A primeira implementacao deve priorizar previsibilidade de memoria sobre throughput.
- O resultado preserva a ordem e a identidade dos records para associar cada vetor ao record correto.
- O executor deve ser usado tanto pela reconciliacao incremental quanto pelo rebuild completo. Nao duplicar a logica de embedding.

### Reconciliacao incremental

O fluxo automatico deixa de reconstruir toda a base quando apenas uma pequena parte do corpus mudou.

1. Ler os summaries fechados e seus fingerprints do Markdown.
2. Comparar a fonte atual com o manifesto comprometido.
3. Classificar records em novos, alterados, removidos e inalterados.
4. Gerar embeddings apenas para novos e alterados, por meio do executor limitado.
5. Aplicar upserts e remocoes no indice derivado.
6. Escrever o novo manifesto somente depois de o indice refletir a reconciliacao completa.

Se nao houver diferencas, nao carregar o modelo nem executar inferencia.

A implementacao deve definir identificadores estaveis para cada record derivado de summary. Um record alterado substitui seu vetor anterior. Um record removido elimina seu vetor e sua entrada de manifesto.

### Rebuild completo

O rebuild completo continua disponivel como operacao manual e intencional.

- Reprocessa todos os summaries fechados.
- Usa o mesmo executor com batches limitados.
- Substitui a projeção vetorial e o manifesto como uma nova derivacao coerente.
- Continua sendo o caminho para recuperacao, troca de provider ou dimensao, schema incompatível, manifesto invalido ou suspeita de divergencia.
- A acao atual de UI e MCP chamada `Rebuild memory` conserva semantica de rebuild completo. O fluxo automatico usa a reconciliacao incremental.

### Consistencia e concorrencia

- Manter um unico job de memory por workspace.
- Nao permitir reconciliacao incremental competir com rebuild completo.
- Uma falha antes da finalizacao nao pode publicar manifesto que afirme sucesso nem remover vetores validos prematuramente.
- O status deve distinguir `current`, `stale`, `rebuilding`, `error` e o modo em execucao quando isso puder ser exposto sem aumentar ruido na UI.
- Um novo evento de fonte durante um job deve ser reconciliado em uma proxima execucao ou marcado como stale. Nao iniciar trabalho paralelo.

## Criterios de Aceite

- Um corpus com muitos summaries longos nao solicita ao ONNX Runtime uma inferencia unica proporcional ao corpus inteiro.
- Um rebuild completo processa todos os records em varios batches e gera um indice equivalente ao fluxo atual.
- Adicionar uma summary fechada processa somente os records novos.
- Alterar uma summary fechada processa somente os records afetados.
- Remover uma summary fechada remove seus records do indice derivado.
- Uma reconciliacao sem mudancas nao carrega o modelo.
- Falha em um batch preserva o ultimo indice e manifesto coerentes.
- O lock por workspace continua impedindo jobs concorrentes.
- O rebuild manual completo continua disponivel pela UI e MCP.
- O provider e descartado ao fim de cada rebuild, inclusive em falhas.
- A UI nao fica bloqueada enquanto a reconciliacao ocorre.

## Validacao Planejada

- Testes unitarios do executor para tamanho maximo de batch, ordem dos vetores e descarte do provider.
- Testes de reconciliacao para adicao, alteracao, remocao e ausencia de mudanca.
- Testes de falha parcial para confirmar que indice e manifesto anteriores permanecem validos.
- Testes de lock e deduplicacao entre auto reconcile e rebuild completo.
- Testes de contrato MCP e daemon para status e operacoes manuais.
- Testes de UI para estados de processamento e erro se houver texto ou comportamento novo.
- Medicao local com summaries longos para registrar pico de memoria, numero de batches e duracao.
- Validacao final com `pnpm run validate`, `pnpm test` e `pnpm build`.

## Limites

- Esta oportunidade nao troca o modelo local, nao introduz provider remoto ou BYOK e nao amplia o corpus alem de summaries de threads fechadas.
- Esta oportunidade nao transforma memory em fonte de verdade.
- Configuracao de batch exposta ao usuario so deve ser adicionada se a medicao demonstrar necessidade. O padrao seguro deve permanecer interno inicialmente.

## Referencias

- marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
- marc://$oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896
