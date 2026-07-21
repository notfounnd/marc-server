# Plano - Busca gradual da memory na UI

## Contexto e decisao

Esta evolucao amplia apenas a experiencia de busca humana na UI.

Nao altera:

- o core de `memory_recall`;
- o ranking hibrido;
- candidate threshold;
- LanceDB;
- o corpus de `SUMMARY.md`;
- defaults da tool MCP.

A busca do MCP continua com `limit: 5` e `minScore: 0.15`. A UI continua chamando a mesma rota de recall, mudando somente os parametros `limit` e `minScore` quando o usuario iniciar ou aprofundar uma busca.

A investigacao original sobre candidatos lexicais fica fora deste desenvolvimento. O caso de busca sem resultado sera explorado por retentativas da UI com `minScore` progressivamente menor, sem alterar como o core decide relevancia.

## Configuracao persistida

Adicionar `memory.searchRetryDepth` em `.marc/marc.config.json`.

Contrato:

- inteiro entre `0` e `3`;
- default `0`;
- persistido por workspace;
- validado no core e na rota de settings;
- refletido no health entregue para a UI;
- preservado em merge com `autoRebuild` e `embeddingBatchSize`.

O slider ficara somente no painel de configuracao da workspace.

Posicoes:

| Posicao | Nome | Tentativas automaticas | Scores possiveis |
| --- | --- | --- | --- |
| 0 | Edge | nenhuma | 0.15 |
| 1 | nivel 2 | uma | 0.15, 0.10 |
| 2 | nivel 3 | duas | 0.15, 0.10, 0.05 |
| 3 | Deep | tres | 0.15, 0.10, 0.05, 0.00 |

O slider afeta apenas novas buscas. Ele nao aparece na coluna 2.

## Estado por busca

Separar a preferencia persistida do estado transitorio:

```text
workspace settings
  searchRetryDepth

active search
  query
  configuredDepth
  manualDeepRetries
  result
```

Quando o usuario submeter qualquer query:

1. A UI cria uma nova active search.
2. Copia o `searchRetryDepth` atual para `configuredDepth`.
3. Define `manualDeepRetries = 0`.
4. Descarta resultado e profundidade manuais da busca anterior.
5. Inicia sempre em `minScore: 0.15`.

A busca inicial gera uma sequencia comeca em `0.15` e so avanca quando a chamada anterior retorna vazia. Ela para assim que encontrar resultados ou alcancar `configuredDepth`.

Isso garante que uma nova busca nunca herda a profundidade manual anterior. Mesmo se a busca anterior chegou a `0.00`, a proxima comeca em `0.15`.

## Deep retry

A coluna 2 permanece limpa e contem somente campo, acao de busca, estado vazio, resultados e `Deep retry`.

O botao aparece abaixo dos resultados ou do estado vazio quando ainda houver nivel disponivel.

Calculo:

```text
nextDepth = configuredDepth + manualDeepRetries + 1
```

Se `nextDepth <= 3`, o clique:

1. Incrementa `manualDeepRetries`.
2. Executa uma chamada com o score final daquele nivel.
3. Substitui o snapshot da busca pelo resultado ampliado.
4. Persiste o novo estado no localStorage.

Scores manuais por nivel seguinte:

- proxima profundidade 1 usa `0.10`;
- proxima profundidade 2 usa `0.05`;
- proxima profundidade 3 usa `0.00`.

Se `nextDepth > 3`, `Deep retry` nao e exibido.

Exemplo com workspace configurada na posicao 1:

```text
Nova busca
  configuracao permite 0.15 e 0.10 somente se 0.15 vier vazia
  manualDeepRetries = 0

Deep retry
  nextDepth = 1 + 0 + 1
  consulta 0.05
  manualDeepRetries = 1

Deep retry
  nextDepth = 1 + 1 + 1
  consulta 0.00
  manualDeepRetries = 2
```

A proxima query cria um novo estado e volta a iniciar em `0.15`.

O provider local ja e reutilizado pelo daemon durante sua janela de idle. As chamadas progressivas nao recarregam o modelo, embora cada consulta continue criando o embedding da mesma query pela rota existente.

## Limite e localStorage

Adicionar `MEMORY_SEARCH_UI_LIMIT = 50`.

A UI envia `limit: 50`. A tool MCP mantem seu default de `5`.

O unico snapshot de localStorage continua isolado por workspace e sobrescrito a cada busca concluida. Ele passa a armazenar:

- query;
- resultado compacto de ate 50 hits;
- configuredDepth;
- manualDeepRetries.

Incrementar a versao do schema para invalidar snapshots antigos que nao possuem estado de profundidade.

O restore apos F5 so recupera a mesma busca. Submeter uma query sempre substitui esse snapshot, portanto nao pode iniciar no deep de uma busca anterior.

## Estados e erros

- Durante uma sequencia automatica, a UI permanece em `searching` ate encontrar resultados, esgotar o nivel configurado ou receber erro.
- Um erro interrompe a sequencia. A UI mostra erro e nao continua baixando score.
- Estado vazio com nivel disponivel explica que a busca pode ser aprofundada e exibe `Deep retry`.
- Estado vazio no maximo informa que a profundidade maxima ja foi consultada.
- Um resultado em qualquer nivel pode exibir `Deep retry` enquanto houver uma expansao manual possivel.
- Uma nova query e o unico evento que reseta `manualDeepRetries`.

## Implementacao

1. Estender settings, tipos, health, daemon settings e callbacks da UI para `searchRetryDepth`.
2. Criar politica pura de profundidade para mapear nivel em score, gerar a sequencia automatica e derivar o proximo deep retry.
3. Atualizar o hook de busca para iniciar em `0.15`, executar a sequencia automatica, isolar estado por query e aplicar deep retry apenas na busca ativa.
4. Atualizar painel de busca, textos de estado e estilos para o botao abaixo do conteudo na coluna 2.
5. Atualizar persistencia da busca e seu schema para armazenar os 50 resultados e a profundidade da busca ativa.
6. Atualizar documentacao de memory.

## Testes e validacao

Cobrir:

- default, validacao, merge e persistencia de `searchRetryDepth`;
- retorno de settings e health sem regressao para os campos de memory existentes;
- sequencias automaticas para os quatro niveis;
- parada na primeira resposta com resultados;
- nova query inicia em `0.15` mesmo apos uma busca anterior manualmente aprofundada;
- calculo de deep retry, limite maximo e reset de estado por query;
- estado vazio com e sem aprofundamento disponivel;
- persistencia no localStorage, restore da mesma busca, substituicao por nova query e invalidez do schema anterior;
- limite 50 apenas na UI e default 5 preservado na MCP.

Executar:

```bash
pnpm run validate
pnpm test
pnpm build
```

Reiniciar daemon e MCP antes da validacao de runtime. Nenhum rebuild da memory sera necessario, pois o indice e o corpus nao mudam.