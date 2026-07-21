# Proposta - Elegibilidade semântica e candidatos lexicais da memory

## Contexto

A busca atual da memory começa por candidatos vetoriais e depois aplica ranking híbrido. O fluxo já combina score vetorial, termos exatos normalizados e boost de seção.

A investigação de consultas reais revelou duas propriedades importantes:

- O parâmetro `limit` controla tanto a quantidade de resultados devolvidos quanto o tamanho do conjunto vetorial candidato.
- Um termo literal presente no corpus pode ficar fora dos candidatos e nunca chegar ao reranking lexical.

A UI passou a usar `limit: 50`, enquanto a tool MCP preservou o default `limit: 5`. A política atual de candidatos calcula `min(max(limit * 6, 30), 100)`. Portanto, mudar o limite de exibição também muda a recuperação:

- `limit: 5` avalia até 30 candidatos vetoriais.
- `limit: 10` avalia até 60 candidatos vetoriais.
- `limit: 50` avalia até 100 candidatos vetoriais.

Esse acoplamento explica o comportamento observado para `brutalism`: com mais candidatos, summaries que já continham o termo passaram a alcançar o reranking e receberam o sinal de termo exato.

## Diagnóstico

### Caso `brutalism`

O corpus contém summaries relevantes para `brutalism`.

A matriz atual mostrou:

| Limit | Min score | Resultado relevante |
| --- | --- | --- |
| 5 | 0.15 | Não |
| 10 | 0.15 | Sim |
| 50 | 0.15 | Sim |

A mudança não foi causada pelo Deep retry. O aumento de `limit` ampliou o conjunto de candidatos antes do ranking.

### Caso `toogle`

O termo `toogle` não aparece literalmente nos `SUMMARY.md`.

A matriz atual mostrou:

| Limit | Min score | Resultado |
| --- | --- | ---|
| 5 | 0.15 | Vazio |
| 10 | 0.15 | Vazio |
| 50 | 0.15 | Vazio |
| 50 | 0.10 | Resultados semânticos permissivos |
| 50 | 0.05 | Mais resultados semânticos permissivos |
| 50 | 0.00 | Mais resultados semânticos permissivos |

Esse caso confirma que o Deep retry controla a permissividade semântica. Ele não é um fallback lexical.

### Falso negativo lexical

Também existe ao menos um summary com o termo literal `toggle`. Mesmo assim, o termo pode não chegar ao reranking quando o record fica fora da seleção vetorial inicial.

Isso é um falso negativo de recall. A busca sabe avaliar termos exatos, mas somente depois que o vetor permitir a entrada do record no conjunto candidato.

## Objetivo

Separar claramente três responsabilidades:

1. Recuperar candidatos amplos.
2. Avaliar se cada candidato tem contexto semântico suficiente.
3. Ordenar e limitar os resultados elegíveis.

O objetivo não é fazer uma busca textual simples nem devolver um resultado apenas porque contém a palavra pesquisada.

## Decisão de produto

Termo literal é sinal de recall, não regra de aceite.

Um match lexical exato pode colocar um record entre os candidatos avaliados. Ele não pode, sozinho, permitir que o record seja devolvido à UI ou à tool MCP.

A elegibilidade final precisa continuar dependente do contexto semântico e do nível de profundidade ativo.

Exemplos esperados:

- `brutalism`: match lexical relevante e contexto semântico suficiente. Deve aparecer sem depender do limite de exibição.
- `toggle`: deve ser avaliado por existir no corpus, mas só deve aparecer quando o contexto semântico satisfizer o nível consultado.
- `toogle`: não possui match lexical. Deve depender exclusivamente da recuperação semântica e do Deep retry.

## Direção arquitetural

### 1. Desacoplar limite de saída e candidatos

O contrato interno deve distinguir:

- `resultLimit`: máximo de resultados devolvidos.
- `candidateLimit`: quantidade de records vetoriais examinados antes do ranking.

A UI poder exibir até 50 itens não deve modificar silenciosamente quais records são elegíveis para avaliação.

A tool MCP pode preservar `resultLimit: 5` sem receber menos candidatos internos por esse motivo.

O valor de `candidateLimit` deve ser uma política interna explícita e testada. Não deve derivar do `resultLimit` sem uma decisão documentada.

### 2. Mesclar candidatos vetoriais e lexicais

O conjunto de candidatos deve ser construído como união deduplicada de:

- candidatos vetoriais, obtidos pela política interna;
- records com match lexical exato normalizado em título, título de seção ou texto do summary.

Para cada record lexicalmente encontrado, a implementação ainda deve disponibilizar ou calcular seu score semântico. Sem isso, não há como decidir elegibilidade com contexto.

A fonte de verdade continua sendo Markdown. Qualquer índice lexical ou mapa de records deve ser derivado e reconstruível a partir dos `SUMMARY.md`.

### 3. Aplicar elegibilidade semântica antes da ordenação final

A sequência desejada é:

```text
vector candidates
+ lexical exact candidates
-> dedupe
-> semantic eligibility using active minScore
-> hybrid ranking
-> resultLimit
```

O `minScore` continua sendo a barreira de contexto semântico. O Deep retry reduz essa barreira de forma progressiva.

O sinal lexical deve atuar somente dentro do ranking de candidatos semanticamente elegíveis. Pode funcionar como bônus limitado ou desempate, mas nunca como passe livre.

### 4. Preservar o contrato externo

Não introduzir novos parâmetros obrigatórios em MCP, UI ou CLI.

A mudança pode permanecer interna ao `recallMemory`:

- MCP preserva default de cinco resultados.
- UI preserva o limite de apresentação que for decidido.
- Deep retry preserva a sequência `0.15 -> 0.10 -> 0.05 -> 0.00`.
- O campo `reason` pode explicar quando um termo exato contribuiu para o ranking, desde que isso não sugira que o termo foi suficiente para elegibilidade.

## Alternativas técnicas a avaliar

### Índice lexical derivado

Durante rebuild incremental, derivar um pequeno índice invertido normalizado por record e persistir junto à projeção de memory.

Vantagem: consultas lexicais rápidas e previsíveis.

Custo: novo formato derivado e migração/rebuild da projeção.

### Varredura limitada de records indexados

Carregar os records textuais existentes da projeção e encontrar matches exatos em memória durante o recall.

Vantagem: menor mudança estrutural inicial.

Custo: custo cresce com a quantidade de records. Deve ser medido contra o corpus de summaries fechados.

### Consulta textual nativa do LanceDB

Avaliar suporte de busca textual ou híbrida nativa apenas se ela permitir preservar a arquitetura local, derivada e sem lock-in de provider.

Vantagem: pode reduzir código próprio.

Custo: dependência de comportamento da biblioteca e necessidade de validar compatibilidade com a snapshot atual.

A escolha deve partir de benchmark e simplicidade operacional, não de preferência por uma tecnologia.

## Critérios de aceite

- `resultLimit` não altera quais candidatos entram no ranking para uma mesma query e profundidade.
- Um summary com termo exato é avaliado mesmo quando não aparece entre os candidatos vetoriais iniciais.
- Termo exato sem contexto semântico suficiente não é devolvido.
- A redução de `minScore` pelo Deep retry continua sendo o único mecanismo de relaxamento da elegibilidade semântica.
- A tool MCP preserva seu default de cinco resultados.
- A UI pode preservar seu limite de apresentação sem alterar silenciosamente a política de recall.
- Markdown continua como fonte de verdade. Índices adicionais são derivados e rebuildáveis.
- Não há dependência de API externa ou provider de embeddings adicional.

## Estratégia de testes

Criar fixtures e testes de regressão para:

1. `brutalism`
   - summaries exatos aparecem com o mesmo conjunto elegível para `resultLimit: 5` e `resultLimit: 50`;
   - a resposta final apenas é truncada pelo limite solicitado.

2. `toggle`
   - record com match literal fora dos candidatos vetoriais iniciais é avaliado;
   - ele só aparece quando seu score semântico satisfaz o `minScore` ativo;
   - match literal isolado não é suficiente.

3. `toogle`
   - sem match literal, a busca permanece guiada apenas por semântica;
   - a busca inicial pode ficar vazia;
   - cada Deep retry reduz apenas o limiar semântico;
   - resultados permissivos não recebem reason de termo exato.

4. Contrato
   - MCP mantém default `limit: 5`;
   - UI e MCP compartilham a mesma política de elegibilidade;
   - o ranking permanece determinístico por score final, score lexical, score vetorial e threadId.

## Riscos e perguntas para planejamento

- Qual limiar representa contexto semântico suficiente após separar a elegibilidade do score híbrido?
- O score vetorial bruto deve ser o único gate semântico ou a política precisa de uma medida contextual adicional?
- Como medir precision e recall sem tornar a busca curta excessivamente permissiva?
- Quantos records existem por summary e qual o custo real de uma varredura lexical local?
- O índice lexical derivado merece ser introduzido nesta fase ou uma varredura limitada resolve o corpus atual?
- A UI deve expor algum diagnóstico de profundidade ou o comportamento deve permanecer implícito?

## Fora de escopo

- Indexar conteúdo integral de threads. Isso pertence à oportunidade de memory deep.
- Alterar provider de embeddings, modelo local ou formato compartilhável da memory.
- Transformar a memory em busca textual pura.
- Alterar o corpus da v1, que continua limitado aos `SUMMARY.md` de threads fechadas.
