# Rodada de avaliacao aleatoria da busca da memory

## Objetivo

Avaliar a qualidade do mecanismo de busca atual fora das familias usadas durante a calibragem, usando uma amostra reproduzivel de threads fechadas e consultas com diferentes graus de explicitacao.

## Metodo

- Data da rodada: 2026-08-04.
- Corpus: `SUMMARY.md` de threads fechadas.
- Amostragem: dez threads pseudoaleatorias com semente fixa `20260804`.
- Consultas: tres por thread, definidas antes da execucao.
- Estilos: direta, indireta e implicita.
- Contrato executado: `memory_recall`, `queryMode: auto`, `depth: 0` e `limit: 10`.
- O ID esperado foi usado somente na avaliacao, nunca como entrada da busca.
- Nenhum Deep retry foi executado nesta matriz.

## Amostra

1. INSTRUCTIONS.md e RULES.md no bootstrap
   - Thread: marc://$oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
2. Rebuild incremental e batches limitados
   - Thread: marc://$oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
3. Indicador visual de memory
   - Thread: marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6
4. Esquemas das colunas da UI
   - Thread: marc://$oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b
5. Referencias internas e mencoes
   - Thread: marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
6. Remocao de comandos MCP legados
   - Thread: marc://$remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf
7. Tuning de recall e ranking
   - Thread: marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
8. Status health e rebuild em background
   - Thread: marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
9. workspace_audit e Custom Rules
   - Thread: marc://$oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
10. Ordenacao de threads recentes
   - Thread: marc://$oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9

## Resultado agregado

| Metrica | Resultado |
| --- | ---: |
| Top-1 | 27/30 (90%) |
| Top-3 | 27/30 (90%) |
| Presenca no Top-10 | 28/30 (93,3%) |
| Erro no Top-1 | 3/30 (10%) |
| Busca vazia | 1/30 (3,3%) |
| Media de resultados por consulta | 2,83 |

## Resultado por estilo

| Estilo | Top-1 | Top-10 | Media de resultados |
| --- | ---: | ---: | ---: |
| Direta | 10/10 | 10/10 | 4,2 |
| Indireta | 9/10 | 10/10 | 2,8 |
| Implicita | 8/10 | 8/10 | 1,5 |

## Matriz das 30 consultas

| Caso | Estilo | Consulta | Rank esperado | Resultados | Avaliacao |
| --- | --- | --- | ---: | ---: | --- |
| 1D | Direta | separar INSTRUCTIONS.md gerenciado do RULES.md customizavel no bootstrap | 1 | 7 | Top-1 |
| 1I | Indireta | onde fica o protocolo operacional estavel e onde ficam as regras comportamentais do workspace? | 1 | 1 | Top-1 |
| 1P | Implicita | agentes estao editando o arquivo de instrucoes geradas e misturando custom rules, qual decisao historica evita isso? | 1 | 2 | Top-1 |
| 2D | Direta | rebuild incremental da memory com batches limitados | 1 | 2 | Top-1 |
| 2I | Indireta | como evitar reprocessar summaries inalterados e o pico de RAM do ONNX? | 1 | 1 | Top-1 |
| 2P | Implicita | a reconstrucao tentou alocar 2,67 GiB; qual solucao foi adotada mantendo o full explicito? | 1 | 1 | Top-1 |
| 3D | Direta | indicador visual de memory no card da workspace | 1 | 4 | Top-1 |
| 3I | Indireta | qual icone mostra indice pronto, stale, erro ou rebuild? | 1 | 7 | Top-1 |
| 3P | Implicita | preciso enxergar no card se a base de conhecimento esta saudavel sem abrir as configuracoes | - | 0 | Nao recuperada |
| 4D | Direta | esquemas de visualizacao das colunas da UI para Threads, Marckers e arquivo | 1 | 5 | Top-1 |
| 4I | Indireta | como funcionam os modos exclusivos e a rolagem propria nas tres colunas? | 1 | 1 | Top-1 |
| 4P | Implicita | ao abrir agentes ou arquivo, somente o conteudo ativo e o botao de fechar devem permanecer na coluna central | 1 | 1 | Top-1 |
| 5D | Direta | gramatica marc:// para referencias internas de artifacts e mensagens | 1 | 8 | Top-1 |
| 5I | Indireta | como navegar para um artifact vinculado a uma mensagem de outra thread? | 1 | 3 | Top-1 |
| 5P | Implicita | quero copiar um endereco canonico que abra agente, thread, mensagem ou anexo dentro da UI | 1 | 3 | Top-1 |
| 6D | Direta | remover aliases legados do MCP e manter nomes canonicos como thread_create | 1 | 1 | Top-1 |
| 6I | Indireta | por que create_thread e read_thread deixaram de ser expostos? | 1 | 1 | Top-1 |
| 6P | Implicita | a lista de ferramentas esta duplicada e gasta contexto com comandos equivalentes | 1 | 1 | Top-1 |
| 7D | Direta | tuning de recall e ranking da memory para token da interface | 1 | 4 | Top-1 |
| 7I | Indireta | como fazer uma decisao historica especifica superar threads genericas semanticamente proximas? | 1 | 2 | Top-1 |
| 7P | Implicita | a busca acha a decisao correta, mas coloca resultados genericos de UI antes dela | 1 | 2 | Top-1 |
| 8D | Direta | status health e rebuild do thread-index em background | 1 | 6 | Top-1 |
| 8I | Indireta | como a UI serve um snapshot stale enquanto o indice reconstrói? | 1 | 1 | Top-1 |
| 8P | Implicita | a listagem nao pode travar durante uma reconstrucao pesada e ainda precisa indicar degradacao | 1 | 1 | Top-1 |
| 9D | Direta | workspace_audit para Custom Rules com Trigger, Do instead, Evidence e Severity | 1 | 3 | Top-1 |
| 9I | Indireta | qual ferramenta verifica referencias, artifacts, mensagens e regras antes de fechar uma thread? | 7 | 8 | Recuperada em 7 |
| 9P | Implicita | agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado? | 1 | 2 | Top-1 |
| 10D | Direta | ordenar threads mais novas no topo por closedAt e createdAt | 1 | 2 | Top-1 |
| 10I | Indireta | qual regra ordena threads abertas e encerradas na listagem? | 1 | 3 | Top-1 |
| 10P | Implicita | trabalhos recentes aparecem enterrados e a UI nao deveria reordenar no cliente | - | 2 | Nao recuperada |

## Falhas observadas

### 3P - Indicador visual de memory

- Consulta: `preciso enxergar no card se a base de conhecimento esta saudavel sem abrir as configuracoes`.
- Resultado: busca vazia.
- O interpretador preservou a consulta efetiva.
- Leitura inicial: falha de recuperacao ou elegibilidade semantica para uma necessidade implicita sem os nomes `memory`, `status` ou `indicator`.

### 9I - workspace_audit

- Consulta: `qual ferramenta verifica referencias, artifacts, mensagens e regras antes de fechar uma thread?`.
- A thread esperada foi recuperada apenas na posicao 7.
- Os tres primeiros resultados foram autocomplete de referencias, referencias internas e processamento em background da memory.
- Leitura inicial: o mecanismo reconheceu os substantivos da consulta em passagens incidentais, mas nao priorizou a thread cuja responsabilidade principal e realizar a verificacao completa.
- Este caso reforca a necessidade de distinguir assunto principal de uma thread e simples mencao em uma passagem.

### 10P - Ordenacao de threads recentes

- Consulta: `trabalhos recentes aparecem enterrados e a UI nao deveria reordenar no cliente`.
- A thread esperada nao foi recuperada.
- Foram retornadas uma thread sobre `agent_register` e outra sobre coordenacao de rebuild.
- O interpretador alterou a consulta para `trabalho recente aparecer enterrados e a UI nao deveria reordenar no cliente`.
- Leitura inicial: e necessario comparar `queryMode: literal` e `queryMode: auto` antes de atribuir a falha ao retriever, pois a interpretacao degradou a frase.

## Observacoes adicionais

- Consultas diretas tiveram 100% de Top-1, mas retornaram em media 4,2 resultados.
- Varias consultas diretas apresentaram candidatos secundarios com scores proximos de `1`, sinal de saturacao da elegibilidade e baixa separacao entre o resultado principal e mencoes relacionadas.
- Consultas implicitas foram a categoria mais fragil: 80% de Top-1 e duas ausencias completas da thread esperada.
- A consulta 9I demonstra que recuperar a thread no Top-10 nao e suficiente para uma boa experiencia quando seis candidatos menos representativos aparecem antes.
- As sugestoes do interpretador produziram diversas frases gramaticalmente piores. Na maioria dos casos elas nao substituíram a consulta efetiva, mas o comportamento merece avaliacao isolada.

## Limites desta rodada

- As consultas foram sintetizadas a partir dos summaries, portanto a rodada mede recuperabilidade controlada e nao substitui consultas espontaneas de usuarios.
- O julgamento principal cobre a posicao da thread esperada. A relevancia de todos os candidatos secundarios ainda nao foi rotulada individualmente.
- A matriz cobre somente Edge. Ela nao mede a capacidade de recuperacao progressiva do Deep retry.
- Dez threads fornecem um sinal util, mas nao constituem um benchmark estatisticamente completo do corpus.

## Pontos para decisao

1. Adicionar esta matriz ao harness permanente de qualidade.
2. Executar A/B literal versus automatico nos casos alterados pelo interpretador.
3. Medir proveniencia e assunto principal para reduzir passagens incidentais antes do resultado responsavel.
4. Investigar recall de consultas implicitas sem relaxar globalmente a elegibilidade.
5. Rotular candidatos secundarios para medir precision, nao apenas Top-k da thread esperada.