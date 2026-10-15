# Evidências da avaliação de memory

## Escopo e identificação

Data: 12 de outubro de 2026. Workspace: `marc-dd422176e1`, raiz `C:\Projetos\marc`.

Esta é uma avaliação da configuração existente, não um benchmark de novos pesos. Nenhum modelo novo foi baixado ou executado. As consultas foram executadas pelo MCP oficial e os três diagnósticos por etapa usaram os providers e o store existentes em um processo Node isolado.

- Geração: `20261012171458084_59902dec`.
- Manifesto: `.marc/memory/manifest.json`.
- SHA-256 antes da bateria, depois dos diagnósticos e depois dos controles: `5bd9ff94b34cd7afca843d91504ef85d1ac54048513420266a1be554ef9227c3`.
- Schema: 6. Contrato de recuperação: `field-aware-hybrid-v2`.
- Corpus observado pelo índice: 53 summaries de threads fechadas.
- Busca: `depth: 0`, `limit: 10`, `minScore` não fornecido. A bateria histórica usou `queryMode: "auto"`.
- Configuração: E5 small int8, mMARCO O4, LFM2.5-350M q4 e recuperação híbrida LanceDB.
- Máquina observada: Windows x64, Intel Core i5-1335U, 12 CPUs lógicas, 16.855.916.544 bytes de RAM total. Não é uma máquina de 8 GB.

O corpus difere daquele de agosto. Não atribuir diferenças de posições a uma troca de modelo. As 30 perguntas e seus alvos foram reaproveitados da avaliação histórica. O arquivo foi analisado com parser Markdown, não com recorte arbitrário de linhas.

## Resultado agregado

| Métrica | Resultado |
| --- | --- |
| Alvo histórico em Top-1 | 27/30, 90% |
| Alvo histórico em Top-3 | 27/30, 90% |
| Alvo histórico em Top-10 | 27/30, 90% |
| Consultas diretas em Top-1 | 10/10 |
| Consultas indiretas em Top-1 | 8/10 |
| Consultas implícitas em Top-1 | 9/10 |
| Respostas vazias na bateria de 30 | 1/30 |
| Correções automáticas aplicadas | 2, nos casos 2I e 9P |
| Controles adicionais | 8 |

Essas métricas medem a recuperação de um alvo histórico por pergunta. Não medem a precisão de todos os resultados nem provam que qualquer thread diferente do alvo seja irrelevante. Para comparação de modelos, é necessário rotular também alternativas válidas e menções incidentais.

A rodada antiga tinha Top-1 27/30, Top-3 27/30 e alvo em Top-10 28/30. Os casos sem Top-1 eram 3P, 9I e 10P. Nesta rodada são 3P, 6I e 9I. O mesmo percentual agregado esconde diferenças de cobertura.

## Matriz das 30 consultas

As perguntas abaixo preservam exatamente o texto histórico, inclusive grafia, ausência de acentos e pontuação. Isso é necessário para reproduzir a avaliação.

| Caso | Estilo | Consulta | Alvo, sufixo | Posição do alvo | Quantidade retornada | Primeiro, sufixo |
| --- | --- | --- | --- | --- | --- | --- |
| 1D | Direta | separar INSTRUCTIONS.md gerenciado do RULES.md customizavel no bootstrap | d34b7486 | 1 | 10 | d34b7486 |
| 1I | Indireta | onde fica o protocolo operacional estavel e onde ficam as regras comportamentais do workspace? | d34b7486 | 1 | 1 | d34b7486 |
| 1P | Implícita | agentes estao editando o arquivo de instrucoes geradas e misturando custom rules, qual decisao historica evita isso? | d34b7486 | 1 | 2 | d34b7486 |
| 2D | Direta | rebuild incremental da memory com batches limitados | 3e422682 | 1 | 3 | 3e422682 |
| 2I | Indireta | como evitar reprocessar summaries inalterados e o pico de RAM do ONNX? | 3e422682 | 1 | 1 | 3e422682 |
| 2P | Implícita | a reconstrucao tentou alocar 2,67 GiB; qual solucao foi adotada mantendo o full explicito? | 3e422682 | 1 | 1 | 3e422682 |
| 3D | Direta | indicador visual de memory no card da workspace | 174c48b6 | 1 | 3 | 174c48b6 |
| 3I | Indireta | qual icone mostra indice pronto, stale, erro ou rebuild? | 174c48b6 | 1 | 7 | 174c48b6 |
| 3P | Implícita | preciso enxergar no card se a base de conhecimento esta saudavel sem abrir as configuracoes | 174c48b6 | Ausente | 0 | — |
| 4D | Direta | esquemas de visualizacao das colunas da UI para Threads, Marckers e arquivo | 604ad99b | 1 | 5 | 604ad99b |
| 4I | Indireta | como funcionam os modos exclusivos e a rolagem propria nas tres colunas? | 604ad99b | 1 | 1 | 604ad99b |
| 4P | Implícita | ao abrir agentes ou arquivo, somente o conteudo ativo e o botao de fechar devem permanecer na coluna central | 604ad99b | 1 | 1 | 604ad99b |
| 5D | Direta | gramatica marc:// para referencias internas de artifacts e mensagens | 3c4261b4 | 1 | 10 | 3c4261b4 |
| 5I | Indireta | como navegar para um artifact vinculado a uma mensagem de outra thread? | 3c4261b4 | 1 | 3 | 3c4261b4 |
| 5P | Implícita | quero copiar um endereco canonico que abra agente, thread, mensagem ou anexo dentro da UI | 3c4261b4 | 1 | 3 | 3c4261b4 |
| 6D | Direta | remover aliases legados do MCP e manter nomes canonicos como thread_create | 034ad1bf | 1 | 3 | 034ad1bf |
| 6I | Indireta | por que create_thread e read_thread deixaram de ser expostos? | 034ad1bf | Ausente | 2 | 2f441fa7 |
| 6P | Implícita | a lista de ferramentas esta duplicada e gasta contexto com comandos equivalentes | 034ad1bf | 1 | 1 | 034ad1bf |
| 7D | Direta | tuning de recall e ranking da memory para token da interface | c147b8bb | 1 | 4 | c147b8bb |
| 7I | Indireta | como fazer uma decisao historica especifica superar threads genericas semanticamente proximas? | c147b8bb | 1 | 2 | c147b8bb |
| 7P | Implícita | a busca acha a decisao correta, mas coloca resultados genericos de UI antes dela | c147b8bb | 1 | 1 | c147b8bb |
| 8D | Direta | status health e rebuild do thread-index em background | 6340b186 | 1 | 7 | 6340b186 |
| 8I | Indireta | como a UI serve um snapshot stale enquanto o indice reconstrói? | 6340b186 | 1 | 1 | 6340b186 |
| 8P | Implícita | a listagem nao pode travar durante uma reconstrucao pesada e ainda precisa indicar degradacao | 6340b186 | 1 | 1 | 6340b186 |
| 9D | Direta | workspace_audit para Custom Rules com Trigger, Do instead, Evidence e Severity | 184fd8bb | 1 | 6 | 184fd8bb |
| 9I | Indireta | qual ferramenta verifica referencias, artifacts, mensagens e regras antes de fechar uma thread? | 184fd8bb | Ausente | 10 | 2f441fa7 |
| 9P | Implícita | agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado? | 184fd8bb | 1 | 3 | 184fd8bb |
| 10D | Direta | ordenar threads mais novas no topo por closedAt e createdAt | 394a14b9 | 1 | 2 | 394a14b9 |
| 10I | Indireta | qual regra ordena threads abertas e encerradas na listagem? | 394a14b9 | 1 | 4 | 394a14b9 |
| 10P | Implícita | trabalhos recentes aparecem enterrados e a UI nao deveria reordenar no cliente | 394a14b9 | 1 | 2 | 394a14b9 |

### Threads-alvo

- marc://$oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
- marc://$oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
- marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6
- marc://$oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b
- marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
- marc://$remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf
- marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
- marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
- marc://$oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
- marc://$oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9

### Correções observadas

- **2I:** `summaries inalterados` tornou-se `summaries inalterado`.
- **9P:** `nem anexam artefatos corretamente` tornou-se `nem anexar artefatos corretamente`.

São alterações gramaticais indevidas, não correções de erro de digitação necessárias. O alvo ainda ficou em primeiro nos dois casos. Acertar o ranking não transforma essas alterações em um comportamento aceitável.

## Oito controles adicionais

Todos usaram `depth: 0` e `limit: 10`. Não houve Deep retry.

| Caso | Modo | Consulta original | Consulta efetiva | Resultados | Primeiro, sufixo | Sugestão |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | literal | como evitar reprocessar summaries inalterados e o pico de RAM do ONNX? | como evitar reprocessar summaries inalterados e o pico de RAM do ONNX? | 1 | 3e422682 | — |
| C2 | literal | agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado? | agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado? | 2 | 184fd8bb | — |
| C3 | auto | toogle | toogle | 0 | — | toggle |
| C4 | literal | toogle | toogle | 0 | — | — |
| C5 | auto | brutalismp | brutalism | 0 | — | brutalism |
| C6 | auto | interface com brutalism | interface com brutalism | 1 | 024e05b1 | — |
| C7 | literal | diagnóstico de fusão nuclear no reator tokamak | diagnóstico de fusão nuclear no reator tokamak | 0 | — | — |
| C8 | literal | manejo de irrigação por gotejamento em soja | manejo de irrigação por gotejamento em soja | 0 | — | — |

### Leitura dos controles

- C1 e C2 mantiveram os alvos históricos em primeiro sem a alteração gramatical aplicada pelo modo automático. Isso não prova equivalência de todos os resultados, mas mostra que a correção indevida não era necessária para recuperar esses alvos.
- C3 sugeriu `toggle`, sem aplicar a correção. A consulta efetiva permaneceu `toogle`. C4 confirmou a resposta vazia em modo literal.
- C5 aplicou `brutalismp → brutalism`, mas a resposta ficou vazia.
- C6 recuperou `oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1` como único resultado.
- C7 e C8 são controles exploratórios de assuntos externos ao domínio do projeto. Ambos retornaram vazio. Dois exemplos não estabelecem uma taxa confiável de falsos positivos.

Não foi realizada validação da UI. Esses resultados descrevem o MCP e os providers atuais, não uma sessão de navegador nem todos os níveis de profundidade.

## Diagnóstico por etapa dos três alvos ausentes

Foram usadas as mesmas consultas originais, sem correção aplicada nesses três casos. Cada canal usou limite 100, definido pela profundidade 0. Isso é diferente do limite 10 da resposta final.

| Caso | Posição na identidade vetorial | Passagens recuperadas do alvo | Hits lexicais do alvo | Posição do reranker | Posição pré-filtro | Elegibilidade própria | Elegibilidade após teto | Threads elegíveis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3P | 3 | 2 | 5 | 11 | 5 | 0.024870 | 0.014329 | 0 |
| 6I | 20 | 2 | 3 | 2 | 5 | 0.426598 | 0.062389 | 2 |
| 9I | 34 | 0 | 0 | 11 | 15 | 0.904547 | 0.671608 | 15 |

Nos três diagnósticos, o canal de identidade retornou as 53 threads. O canal de passagens retornou 100 hits. O limiar de elegibilidade é 0,5.

### 3P, indicador de saúde da memory

O alvo apareceu em identidade e passagem na posição 3, e na posição 5 da lista pré-filtro. O reranker deu suporte muito baixo. Nenhuma das 53 threads passou o limiar. Não é uma falha de ausência do alvo no retriever. Um juiz que receba apenas os resultados finais recebe uma lista vazia e não tem como recuperar a thread.

### 6I, remoção dos aliases legados

O alvo apareceu em identidade na posição 20, em passagem na posição 4 e no reranker na posição 2. Ficou na posição 5 pré-filtro. Sua elegibilidade própria foi aproximadamente 0,427, abaixo do limiar; o teto monotônico reduziu o valor publicado para aproximadamente 0,062. Remover só o teto não seria suficiente para fazê-lo passar o limiar atual.

A resposta final trouxe threads sobre criação pela UI e ferramentas para summaries. Elas têm relação geral com MCP, mas o trecho retornado não explica a remoção de `create_thread` e `read_thread`. Esse caso merece rótulos graduados de relevância, não somente comparação de IDs.

### 9I, ferramenta de auditoria

O alvo apareceu em identidade na posição 34, mas sem passagem no conjunto recuperado. Passou a elegibilidade e ficou na posição 15 pré-filtro, fora dos 10 resultados finais. O primeiro trecho retornado era uma tabela de evidências de validação de outra atividade, e não a explicação central da ferramenta de auditoria.

Não é o mesmo mecanismo de perda de 3P e 6I. Um juiz de três a cinco candidatos não verá esse alvo. O experimento precisa medir cobertura de candidatos e de passagens antes de escolher um tamanho de shortlist.

### Valores brutos

O JSON abaixo preserva sinais internos úteis para repetir e contestar o diagnóstico. Valores chamados de probabilidade no código não são, por si só, evidência de calibração no corpus.

```json
[
  {
    "id": "3P",
    "expected": "oportunidade-indicador-visual-de-memory-na-interface-174c48b6",
    "generation": "20261012171458084_59902dec",
    "candidateLimit": 100,
    "identities": 53,
    "identityTargetRank": 3,
    "passages": 100,
    "targetPassages": 2,
    "lexicalTargetHits": 5,
    "rankedThreads": 53,
    "eligibleThreads": 0,
    "threshold": 0.5,
    "targetRankBeforeFinalFilter": 5,
    "target": {
      "identityRank": 3,
      "passageRank": 3,
      "rerankerRank": 11,
      "rankingScore": 0.8484848484848484,
      "semanticEligibility": 0.02486967284512684,
      "eligibility": 0.01432937236766969,
      "signals": {
        "bestDenseScore": 0.868346631526947,
        "channelAgreement": 1,
        "evidenceConcentration": 0.3333333333333333,
        "identityRerankerAgreement": 0.0010359478500814748,
        "identitySupport": 0.3333333333333333,
        "passageSupport": 0.3333333333333333,
        "rankingMargin": 0,
        "rerankerScore": 0.0011395426350896223,
        "rerankerSupport": 0.09090909090909091
      }
    }
  },
  {
    "id": "6I",
    "expected": "remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf",
    "generation": "20261012171458084_59902dec",
    "candidateLimit": 100,
    "identities": 53,
    "identityTargetRank": 20,
    "passages": 100,
    "targetPassages": 2,
    "lexicalTargetHits": 3,
    "rankedThreads": 53,
    "eligibleThreads": 2,
    "threshold": 0.5,
    "targetRankBeforeFinalFilter": 5,
    "target": {
      "identityRank": 20,
      "passageRank": 4,
      "rerankerRank": 2,
      "rankingScore": 1.3,
      "semanticEligibility": 0.42659813100618854,
      "eligibility": 0.0623891861932409,
      "signals": {
        "bestDenseScore": 0.8825135827064514,
        "channelAgreement": 1,
        "evidenceConcentration": 0.5,
        "identityRerankerAgreement": 0.05,
        "identitySupport": 0.05,
        "passageSupport": 0.25,
        "rankingMargin": 0,
        "rerankerScore": 0.2478501067604313,
        "rerankerSupport": 0.5
      }
    }
  },
  {
    "id": "9I",
    "expected": "oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb",
    "generation": "20261012171458084_59902dec",
    "candidateLimit": 100,
    "identities": 53,
    "identityTargetRank": 34,
    "passages": 100,
    "targetPassages": 0,
    "lexicalTargetHits": 0,
    "rankedThreads": 53,
    "eligibleThreads": 15,
    "threshold": 0.5,
    "targetRankBeforeFinalFilter": 15,
    "target": {
      "identityRank": 34,
      "rerankerRank": 11,
      "rankingScore": 0.21122994652406418,
      "semanticEligibility": 0.904546672107498,
      "eligibility": 0.6716080709198571,
      "signals": {
        "bestDenseScore": 0.8534740805625916,
        "channelAgreement": 0,
        "evidenceConcentration": 0,
        "identityRerankerAgreement": 0.029411764705882353,
        "identitySupport": 0.029411764705882353,
        "passageSupport": 0,
        "rankingMargin": 0,
        "rerankerScore": 0.6563620013799084,
        "rerankerSupport": 0.09090909090909091
      }
    }
  }
]
```

## Procedimento de reprodução

1. Obter bootstrap do workspace e confirmar identidade, regras e perfil.
2. Verificar que a geração e o hash do manifesto correspondem ao snapshot acima.
3. Repetir cada consulta da matriz por `memory_recall` com `bootstrapConfirmed: true`, `queryMode: "auto"`, `depth: 0` e `limit: 10`. Não fornecer `minScore`.
4. Registrar consulta original e efetiva, correção/sugestão, resultados ordenados, prontidão, geração e duração. Não rebuildar entre consultas.
5. Repetir os controles com os modos da tabela.
6. Para os três diagnósticos, obter `getWorkspaceInfo` e `readMemoryManifest`, sem `initWorkspace`. Usar `LocalEmbeddingProvider.embedQuery`, `LanceDbMemoryVectorStore.searchVector` separado para identidade e passagem, `searchLexical` separado para título e summary, e `rankHybridMemoryCandidates` com `LocalRerankingProvider`.
7. Registrar a lista antes do filtro final, os sinais e a cobertura do alvo. Descartar somente os workers do processo diagnóstico ao terminar.
8. Verificar novamente o hash. Se geração ou corpus mudarem, não tratar a rodada como comparação pareada.

As três consultas diagnósticas são multitermais; não usaram o caminho de prefixo de título destinado a consultas simples. O diagnóstico não chamou rebuild, purge ou preparação de novos modelos.

### Fontes locais do diagnóstico

- `src/core/memory/model-config.ts`.
- `src/core/memory/search-depth.ts`.
- `src/core/memory/hybrid-ranking.ts`.
- `src/core/memory/semantic-ranking.ts`.
- `src/core/memory/semantic-eligibility.ts`.
- `src/core/memory/local-provider.ts`, `local-reranker.ts` e `store.ts`.
- `src/core/memory/inference-manager.ts`.
- `docs/memory.md`.
- `scripts/memory-quality-v4.ts`, inspecionado, não executado nesta bateria.

O script existente filtra consultas cadastradas; seu `--query` não é uma entrada livre para qualquer pergunta. Ele também tem perfis de benchmark que não devem ser presumidos equivalentes à recuperação híbrida de produção. A presente bateria usou as APIs atuais diretamente.

## Tempos e limites da medição

A bateria de 30 consultas somou 762.7 segundos de duração observada por chamada. Os tempos individuais foram de 19.177 a 34.529 segundos. Esses números incluem o fluxo MCP e a inferência corrente. Não são um benchmark controlado de carga fria, TTL ou concorrência.

Não houve medição de pico de RAM, comparação de novos pesos, execução em Linux/macOS nem máquina de 8 GB. Nenhum vencedor de qualidade ou viabilidade de hardware pode ser declarado a partir desta rodada.

## Inventário remoto dos candidatos

Somente metadados públicos do Hugging Face foram consultados. Os arquivos selecionados e seus bytes são reproduzidos abaixo para evitar confundir o tamanho de um grafo com os dados externos, ou o tamanho total de todos os formatos com um download específico.

```json
[
  {
    "id": "onnx-community/laya-multilingual-ONNX",
    "sha": "46b77bbf5642fec5f14e540570228a8cbe8ab81f",
    "shaMatches": true,
    "license": "apache-2.0",
    "gated": false,
    "bytes": 681756308,
    "files": [
      {
        "name": "config.json",
        "size": 2859
      },
      {
        "name": "onnx/model_fp16.onnx",
        "size": 3572287
      },
      {
        "name": "onnx/model_fp16.onnx_data",
        "size": 643817472
      },
      {
        "name": "tokenizer.json",
        "size": 34363188
      },
      {
        "name": "tokenizer_config.json",
        "size": 502
      }
    ]
  },
  {
    "id": "onnx-community/Qwen3.5-0.8B-ONNX-OPT",
    "sha": "969350d5f4647ec9ac277110f8974c65d8c10e4b",
    "shaMatches": true,
    "license": "apache-2.0",
    "gated": false,
    "bytes": 666370346,
    "files": [
      {
        "name": "config.json",
        "size": 2849
      },
      {
        "name": "generation_config.json",
        "size": 248
      },
      {
        "name": "onnx/decoder_model_merged_q4.onnx",
        "size": 576621
      },
      {
        "name": "onnx/decoder_model_merged_q4.onnx_data",
        "size": 483655680
      },
      {
        "name": "onnx/embed_tokens_q4.onnx",
        "size": 857
      },
      {
        "name": "onnx/embed_tokens_q4.onnx_data",
        "size": 162897920
      },
      {
        "name": "tokenizer.json",
        "size": 19226111
      },
      {
        "name": "tokenizer_config.json",
        "size": 10060
      }
    ]
  },
  {
    "id": "LiquidAI/LFM2.5-1.2B-Instruct-ONNX",
    "sha": "10f72e70abf67ac0fd7ebf15bc5854726891d864",
    "shaMatches": true,
    "license": "other",
    "gated": false,
    "bytes": 853544357,
    "files": [
      {
        "name": "config.json",
        "size": 1599
      },
      {
        "name": "generation_config.json",
        "size": 131
      },
      {
        "name": "onnx/model_q4.onnx",
        "size": 183173
      },
      {
        "name": "onnx/model_q4.onnx_data",
        "size": 850059264
      },
      {
        "name": "tokenizer.json",
        "size": 3297799
      },
      {
        "name": "tokenizer_config.json",
        "size": 2391
      }
    ]
  },
  {
    "id": "onnx-community/Qwen3-Reranker-0.6B-ONNX",
    "sha": "9995c50e2310679108a55f5ccd16ba8be9f17c20",
    "shaMatches": true,
    "license": "apache-2.0",
    "gated": false,
    "bytes": 1006665497,
    "files": [
      {
        "name": "config.json",
        "size": 1359
      },
      {
        "name": "generation_config.json",
        "size": 214
      },
      {
        "name": "onnx/model_q4.onnx",
        "size": 995235866
      },
      {
        "name": "tokenizer.json",
        "size": 11422654
      },
      {
        "name": "tokenizer_config.json",
        "size": 5404
      }
    ]
  },
  {
    "id": "chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF",
    "sha": "edf37c26a1098f83cf4264b8adbe0dca2d2ebb0c",
    "shaMatches": true,
    "license": "apache-2.0",
    "gated": false,
    "bytes": 529296864,
    "files": [
      {
        "name": "Jev-Style-0.8B-Decision-v3-Q4_K_M.gguf",
        "size": 529296864
      }
    ]
  },
  {
    "id": "HIT-TMG/JevEmbed-Qwen3-Embedding-0.6B",
    "sha": "e4a71aacd9b47ae6106fe57b7bf1c39992dc7ab1",
    "shaMatches": true,
    "license": "apache-2.0",
    "gated": false,
    "bytes": 2394574975,
    "files": [
      {
        "name": "1_Pooling/config.json",
        "size": 313
      },
      {
        "name": "config.json",
        "size": 720
      },
      {
        "name": "config_sentence_transformers.json",
        "size": 375
      },
      {
        "name": "model.safetensors",
        "size": 2383139480
      },
      {
        "name": "modules.json",
        "size": 349
      },
      {
        "name": "sentence_bert_config.json",
        "size": 59
      },
      {
        "name": "tokenizer.json",
        "size": 11423973
      },
      {
        "name": "tokenizer_config.json",
        "size": 9706
      }
    ]
  }
]
```

O inventário seleciona arquivos de inferência e configuração, não a totalidade do repositório. O pacote real pode incluir arquivos auxiliares, dependências e binários do runtime. O arquivo GGUF inclui o checkpoint, mas não contabiliza o executável customizado de inferência.

## Validação e limites de entrega

Entrega classificada como estudo e registros mARC. Foram verificados snapshot, consultas, diagnósticos, metadados remotos, fontes primárias e estrutura Markdown. O relatório principal registra a avaliação integrada e os próximos experimentos necessários.

Nenhum arquivo executável do projeto foi alterado, nenhum comando Git foi executado e nenhuma configuração de produção foi substituída. `pnpm validate`, `pnpm build` e `pnpm test` não são checks aplicáveis a esta entrega editorial. Não representam checks aprovados nem pendentes.

A auditoria estrutural da mensagem de entrega é executada depois da criação dos arquivos e dos metadados, separadamente da avaliação técnica do estudo.
