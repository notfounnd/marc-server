# Relatório de implementação

## Objetivo entregue

A memory passou a usar recuperação semântica em duas etapas, com embeddings multilíngues para recuperar candidatos e um reranker dedicado para decidir quais resultados são realmente relevantes ao contexto da consulta.

A implementação preserva Markdown como fonte de verdade. O índice vetorial, o manifesto e os processos de inferência continuam sendo derivados e reconstruíveis.

## Arquitetura de recuperação

- Retriever local: `Xenova/multilingual-e5-small` em ONNX int8
- Prefixos E5 aplicados corretamente: `passage:` ao indexar e `query:` ao consultar
- Reranker local: `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`
- O reranker usa a representação estruturada `Title`, `Section` e `Content` de cada resumo candidato
- O limiar semântico calibrado é `0.20`
- A lista final é ordenada por score do reranker, com score vetorial e ID como desempates estáveis
- Não há fallback por match literal, fuzzy, prefixo, lista de stopwords ou regras específicas por idioma

Essa decisão evita retornar uma thread apenas porque contém uma palavra isolada. O termo e o contexto precisam sustentar relevância no reranking.

## Corpus e contexto

- O corpus permanece restrito a `.marc/threads/*/SUMMARY.md` de threads fechadas
- O título canônico de `CHAT.md` passa a compor o contexto indexado e o texto avaliado pelo reranker
- Alterar esse título muda o hash da fonte e torna o índice incrementalmente atualizável
- A expansão de contexto não transforma arquivos de conversa em nova fonte de corpus

## Profundidade e candidatos

A profundidade configurável da busca controla somente a quantidade de candidatos semânticos enviados ao reranker:

| Nível | Candidatos |
| --- | ---: |
| Edge 0 | 100 |
| Deep 1 | 200 |
| Deep 2 | 300 |
| Deep 3 | 400 |

Cada consulta nova começa em Edge 0. A retentativa manual avança apenas um nível. O modo automático só avança quando a etapa anterior não encontrou resultados. O limite de resposta é aplicado depois do reranking e da deduplicação.

## Modelo, memória e processos

- Embedding e reranking executam em workers Node filhos isolados por workspace e função
- Cada worker tem fila serial própria
- Workers sem uso são encerrados após 30 segundos
- O encerramento do processo devolve a memória nativa do ONNX Runtime ao sistema operacional
- `Prepare models` prepara os dois modelos
- O status distingue disponibilidade do retriever, do reranker, da reconstrução e da busca

O gerenciador usa os nomes-base corretos de arquivo para os modelos ONNX, incluindo as variantes quantizadas disponíveis por arquitetura.

## Interfaces e contratos

- O rebuild manual continua oferecendo incremental e full
- O CLI aceita `marc memory rebuild --mode incremental|full`
- A UI expõe `Inference batch size`, `Prepare models`, profundidade de busca e as duas modalidades de rebuild
- A busca MCP e a API HTTP usam o contrato de profundidade em vez do parâmetro histórico `minScore`
- O campo `minScore` é rejeitado para impedir a reintrodução da calibragem anterior

## Qualidade e documentação

Foi adicionado `pnpm run memory:quality`, que executa consultas reais contra o índice local, verifica expectativas de ordenação e confirma que os workers de embedding e reranking foram encerrados após o TTL.

A documentação em `docs/memory.md` foi atualizada com arquitetura, modelos, ciclo de vida de workers, profundidade de candidatos, limiar semântico, contratos e o novo comando de qualidade.

## Evidências de validação

- `pnpm run validate` passou
- `pnpm test` passou com 141 testes
- `pnpm run build` passou
- `pnpm run memory:quality -- --workspace C:/Projetos/marc` passou
- `marc memory prepare --workspace C:/Projetos/marc` preparou retriever e reranker
- Rebuild full local foi concluído
- `marc memory status --workspace C:/Projetos/marc` confirmou 38 de 38 resumos indexados e as quatro capacidades prontas
- A auditoria de mensagens da thread não encontrou findings

Na validação de qualidade, `brutalism` e `interface com brutalism` retornaram a thread esperada no topo. `toogle` e `toggle` permaneceram sem resultado acima do limiar, comportamento registrado como observação semântica e não compensado por heurística lexical.

## Reinício necessário

Daemon, MCP e UI precisam ser reiniciados antes do teste manual, pois workers, contratos de rota e schemas das ferramentas são carregados na inicialização.