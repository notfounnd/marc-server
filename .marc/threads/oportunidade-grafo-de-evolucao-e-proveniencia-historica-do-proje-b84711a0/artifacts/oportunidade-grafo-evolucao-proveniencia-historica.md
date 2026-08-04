# Oportunidade - Grafo de evolução e proveniência histórica do projeto

Status: discovery
Data: 2026-08-03

## Resumo executivo

O mARC preserva em Markdown uma dimensão que normalmente falta às ferramentas para agentes: a trajetória histórica que levou o projeto ao estado atual. Ferramentas de code intelligence e grafos de código descrevem arquivos, símbolos, chamadas e dependências presentes, mas não explicam adequadamente por que uma decisão foi tomada, que problema a motivou, quais alternativas foram descartadas, o que a validou e como ela foi substituída ou refinada ao longo do tempo.

A busca sobre a memory resolve parte desse problema ao recuperar threads historicamente relevantes para uma intenção. Entretanto, uma consulta tende a privilegiar relevância direta. Relações indiretas ao redor da thread encontrada podem ficar de fora, mesmo quando são essenciais para reconstruir a evolução de uma decisão. Também existem casos em que nenhuma thread aparece na busca porque o agente ainda não possui o vocabulário, o ponto de entrada ou a formulação adequada.

A oportunidade é criar uma projeção em grafo sobre o histórico do mARC. Esse grafo não substituiria a busca, não participaria inicialmente do ranking e não seria fonte de verdade. Ele serviria como uma superfície complementar de navegação, exploração e formulação de novos caminhos de recuperação.

A proposta possui dois fluxos principais:

1. search-first: uma busca encontra uma thread e o grafo expõe seu entorno histórico;
2. graph-first: o agente explora comunidades, componentes, decisões, períodos ou relações para encontrar pontos de entrada e então realiza novas buscas ou leituras.

O diferencial não é construir um knowledge graph genérico do repositório. É representar a linhagem de problemas, decisões, mudanças, validações e resultados preservados pelo mARC.

## Contexto estratégico

A maior parte do ecossistema de ferramentas para agentes se concentra no estado atual do projeto:

- árvore de arquivos;
- símbolos e referências;
- imports e dependências;
- call graphs;
- arquitetura atual;
- documentação vigente;
- mudanças presentes no working tree.

Esse contexto ajuda o agente a entender como o projeto funciona hoje. Porém, não explica necessariamente:

- por que uma abstração existe;
- por que uma biblioteca ou provider foi escolhido;
- que limitação levou a determinada arquitetura;
- que alternativa foi tentada e descartada;
- que incidente motivou uma correção;
- que decisão foi substituída;
- que evidência sustentou a conclusão;
- quais follow-ups permaneceram abertos.

O mARC já preserva parte importante dessa história por meio de threads, mensagens, artifacts, regras, referências e summaries. O problema deixa de ser somente captura de conhecimento e passa a ser recuperação e navegação desse conhecimento.

Iniciativas relacionadas:

- marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- marc://$oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
- marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
- marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae

## Problema

O histórico existe, mas ainda é predominantemente linear e documental.

A busca semântica ajuda quando o agente consegue formular uma consulta que possui correspondência suficiente com uma ou mais threads. Mesmo com boa recuperação, ela responde principalmente:

> Quais threads parecem diretamente relevantes para esta intenção?

Ela não responde com a mesma naturalidade:

- O que motivou essa decisão?
- Que thread anterior iniciou essa linha de investigação?
- Qual abordagem foi substituída?
- Que implementação concretizou o plano?
- Que validação confirmou ou refutou a hipótese?
- Quais oportunidades nasceram como consequência?
- Que partes do projeto foram afetadas posteriormente?
- Qual sequência histórica conecta dois estados do projeto?
- Que outros caminhos merecem investigação quando a busca não encontra nada?

Essas perguntas exigem direção, temporalidade, causalidade, lineage e provenance. Similaridade semântica pode sugerir que dois documentos tratam de temas parecidos, mas não estabelece que um motivou, substituiu, implementou ou validou o outro.

## Hipótese

Uma projeção em grafo sobre o histórico fechado do mARC permitirá que agentes:

- expandam o entorno de uma thread recuperada;
- encontrem relações indiretas que uma busca direta omite;
- reconstruam cadeias históricas de problema até resultado;
- descubram vocabulário e pontos de entrada quando a busca falha;
- conectem decisões atuais a antecedentes e consequências;
- diferenciem relações explícitas de inferências;
- naveguem com orçamento de contexto limitado;
- abram apenas as fontes necessárias para confirmar uma conclusão.

A hipótese deve ser validada antes de qualquer decisão sobre banco de grafos, biblioteca externa ou extração semântica por modelo.

## Distinção central

### Grafo de estado atual

Um grafo tradicional de código tende a representar:

```text
File -> imports -> Module
Function -> calls -> Function
Class -> implements -> Interface
Component -> depends_on -> Service
```

Ele explica estrutura e dependência presentes.

### Grafo de evolução histórica

O grafo proposto representa:

```text
Problem
  -> MOTIVATED
Investigation
  -> LED_TO
Decision
  -> IMPLEMENTED_BY
Change
  -> VALIDATED_BY
Evidence
  -> REVEALED
Outcome
  -> LED_TO | SUPERSEDED_BY
New Decision
```

Ele explica trajetória, justificativa e transformação.

As duas visões podem se conectar no futuro, mas são produtos conceitualmente distintos. O diferencial do mARC está na segunda.

## Relação entre busca, grafo e leitura profunda

As três superfícies possuem responsabilidades independentes.

### Busca

Pergunta principal:

> Onde começar?

A busca encontra threads com relevância direta para uma consulta. Ela deve continuar responsável por interpretação, recuperação, elegibilidade e ranking.

### Grafo

Perguntas principais:

> O que existe ao redor deste resultado?
> Para onde posso seguir?
> Como dois elementos históricos se conectam?
> Que pontos de entrada existem quando ainda não sei o que procurar?

O grafo expõe relações, caminhos, comunidades e evolução temporal.

### Leitura profunda

Pergunta principal:

> Qual evidência original sustenta esta afirmação ou relação?

A leitura da thread ou uma futura camada de memory_deep recupera mensagens, artifacts, regras e trechos originais.

Fluxo recomendado:

```text
query
  -> memory recall
  -> historical anchor
  -> bounded graph exploration
  -> source selection
  -> thread read or memory deep
  -> evidence-backed context pack
```

Fluxo alternativo:

```text
current component | period | agent | graph community
  -> graph exploration
  -> candidate historical anchors
  -> refined search
  -> source reading
```

## Casos de uso

### 1. Entorno de uma thread recuperada

Uma consulta encontra a thread que implementou determinada funcionalidade. O grafo revela:

- diagnóstico que motivou o desenvolvimento;
- plano aprovado;
- abordagem anterior substituída;
- validação executada;
- correções posteriores;
- follow-ups ainda abertos.

### 2. Busca sem resultado

Uma consulta usa vocabulário diferente daquele registrado nos summaries. O grafo pode oferecer comunidades ou nós relacionados ao componente atual, sugerindo termos, decisões ou threads que orientem uma nova consulta.

### 3. Explicação do estado atual

O agente parte de um componente, regra ou comportamento atual e percorre relações históricas até encontrar:

- decisão que o introduziu;
- problema original;
- restrições conhecidas;
- experimentos realizados;
- mudança que refinou o comportamento.

### 4. Evolução de uma decisão

O agente acompanha uma cadeia:

```text
initial decision
  -> challenged_by
investigation
  -> superseded_by
revised decision
  -> validated_by
benchmark
```

### 5. Descoberta de impacto indireto

Uma thread encontrada não menciona diretamente determinada área, mas um follow-up ou artifact conectado revela que a decisão afetou outro componente.

### 6. Visão humana do histórico

Uma representação visual futura pode permitir que pessoas identifiquem:

- linhas de evolução;
- áreas com muitas correções;
- decisões centrais;
- comunidades de oportunidades;
- bifurcações e abordagens abandonadas;
- períodos de maior mudança.

A visualização é uma possível experiência de produto, não o requisito inicial do grafo.

## Modelo conceitual

### Thread como envelope de provenance

A thread não deve ser a única unidade semântica. Ela é principalmente um envelope histórico que contém ou referencia problemas, decisões, evidências e resultados.

Usar apenas threads como nós produziria um mapa de documentos. Para representar evolução, o grafo precisa poder distinguir os significados contidos nesses documentos.

### Tipos de nó candidatos

| Tipo | Papel |
|---|---|
| Thread | Fonte histórica e unidade de conversa |
| Summary | Síntese autoritativa de uma thread fechada |
| Message | Fonte intermediária com autor e timestamp |
| Artifact | Plano, diagnóstico, relatório, benchmark ou evidência |
| Rule | Regra operacional vigente |
| Agent | Autor ou participante |
| Problem | Problema que motivou investigação ou mudança |
| Hypothesis | Hipótese avaliada durante a thread |
| Decision | Escolha consolidada |
| RejectedAlternative | Alternativa considerada e rejeitada |
| Change | Alteração realizada |
| Validation | Teste, benchmark, auditoria ou revisão |
| Outcome | Resultado observado |
| FollowUp | Continuidade ou oportunidade criada |
| Component | Área funcional, módulo ou conceito do produto |
| CodeSymbol | Possível integração futura com o estado atual do código |

Nem todos esses tipos precisam existir na primeira versão.

### Relações estruturais

Extraídas de metadata e estrutura conhecida:

- THREAD_HAS_SUMMARY
- THREAD_HAS_MESSAGE
- MESSAGE_AUTHORED_BY
- MESSAGE_ATTACHES_ARTIFACT
- THREAD_REFERENCES_THREAD
- SOURCE_MENTIONS_REFERENCE
- THREAD_CLOSED_AT
- RULE_DEFINED_IN
- ARTIFACT_ATTACHED_TO

### Relações históricas e causais

- MOTIVATED
- INVESTIGATES
- PROPOSES
- DECIDES
- REJECTS
- IMPLEMENTS
- VALIDATES
- INVALIDATES
- REVEALS
- RESULTS_IN
- LED_TO
- FOLLOW_UP_OF
- SUPERSEDES
- BLOCKED_BY
- AFFECTS
- RELATED_TO

Relações genéricas como RELATED_TO devem ter prioridade baixa. Relações direcionais como SUPERSEDES, FOLLOW_UP_OF e VALIDATES possuem maior valor para reconstrução histórica.

## Provenance e confiança

Toda aresta precisa ser explicável.

Campos conceituais:

- edgeId;
- relationType;
- sourceNodeId;
- targetNodeId;
- sourceRef;
- sourceType;
- sourceLocation;
- evidenceText;
- confidence;
- authorityHint;
- observedAt;
- validFrom;
- validTo;
- generation;
- sourceHash.

Níveis sugeridos:

### Structural

Relação derivada diretamente de estrutura ou metadata, como artifact anexado a mensagem.

### Declared

Relação afirmada explicitamente na fonte, por exemplo:

> Este plano substitui a proposta anterior.

### Inferred

Relação sugerida por análise semântica, mas não declarada diretamente.

### Ambiguous

Relação possível que exige confirmação humana ou leitura adicional.

Uma aresta inferred ou ambiguous não deve ser apresentada como fato consolidado. O retorno precisa manter sua classificação e orientar a leitura da fonte.

## Autoridade das fontes

Fontes diferentes têm papéis diferentes. Não deve existir necessariamente uma pontuação global única; a autoridade depende da pergunta.

Princípios:

- SUMMARY.md representa a síntese consolidada da thread fechada;
- RULES.md representa contrato operacional vigente;
- artifact pode representar plano, diagnóstico ou evidência;
- CHAT.md preserva evolução e contexto intermediário;
- uma mensagem pode conter hipótese posteriormente descartada;
- uma decisão substituída continua historicamente relevante, mas não representa o estado vigente.

O grafo deve preservar essas diferenças por meio de sourceType, authorityHint, temporalidade e relações como SUPERSEDES ou INVALIDATES.

## Elegibilidade de fontes

Recomendação inicial:

- indexar apenas threads fechadas;
- usar SUMMARY.md como gate de elegibilidade;
- permitir CHAT.md e artifacts somente quando pertencem a thread fechada;
- remover a projeção quando uma thread deixa de ser elegível;
- nunca tratar conteúdo de thread aberta como memória histórica consolidada;
- manter Markdown como fonte de verdade;
- tratar o grafo como snapshot derivada e reconstruível.

Uma camada futura pode representar trabalho em andamento como grafo efêmero separado, mas ela não deve se misturar à memória histórica.

## Temporalidade

História exige mais que timestamps de criação.

O grafo deve poder representar:

- quando uma fonte foi observada;
- quando uma decisão entrou em vigor;
- quando deixou de ser vigente;
- qual decisão a substituiu;
- qual evento produziu a mudança;
- qual versão do grafo continha a relação.

Campos temporais não precisam ser completos na primeira versão. Entretanto, o modelo não deve impedir a evolução para validade temporal.

## Arquitetura conceitual

```text
.marc Markdown sources
        |
        +--> summary memory projection
        |      identity + passages + embeddings + ranking
        |
        +--> historical graph projection
               nodes + typed edges + provenance + generations
```

As projeções compartilham fontes, mas possuem manifestos e ciclos de vida independentes.

Motivos:

- mudança no schema vetorial não deve invalidar o grafo;
- mudança na ontologia do grafo não deve exigir novos embeddings;
- rebuild e falhas podem ser isolados;
- a busca em desenvolvimento não precisa conhecer o grafo;
- experimentos de grafo não alteram ranking ou elegibilidade.

## Possíveis interfaces para agentes

Os nomes abaixo são conceituais e precisam respeitar o padrão final de tools do mARC.

### memory_map

Objetivo: encontrar pontos de entrada quando não existe uma thread-semente clara.

Entradas possíveis:

- query opcional;
- component opcional;
- agentId opcional;
- período opcional;
- tipos de nó;
- máximo de comunidades ou nós.

Retorno:

- comunidades;
- nós centrais;
- conceitos recorrentes;
- períodos;
- referências de origem;
- sugestões de exploração.

### memory_explore

Objetivo: expandir uma vizinhança limitada.

Entradas:

- nodeRef ou threadId;
- depth, inicialmente 1;
- relationTypes;
- direction;
- maxNodes;
- maxEdges;
- includeInferred.

Retorno:

- nó inicial;
- nós vizinhos;
- arestas tipadas;
- evidências;
- referências;
- caminhos resumidos;
- nextActions.

### memory_path

Objetivo: explicar como dois elementos históricos se conectam.

Entradas:

- from;
- to;
- maxHops;
- relationTypes;
- includeInferred.

Retorno:

- um ou poucos caminhos;
- significado de cada relação;
- provenance;
- classificação de confiança;
- fontes recomendadas para leitura.

A primeira versão pode oferecer apenas memory_explore. As três operações representam necessidades distintas, não uma obrigação de três tools imediatas.

## Controle de contexto

O grafo precisa reduzir leitura, não gerar novo excesso de contexto.

Guardrails:

- depth baixo por padrão;
- limite explícito de nós e arestas;
- penalização ou exclusão de hubs genéricos;
- filtro por relationType;
- preferência por relações direcionais e com forte provenance;
- expansão incremental;
- subgrafo compacto;
- leitura da fonte somente quando necessária;
- orçamento de tokens conhecido pelo chamador.

## Referências externas

### Graphify

Graphify demonstra práticas úteis:

- pipeline separado entre detecção, extração, construção, clustering e exportação;
- representação local em graph.json;
- provenance por source file e localização;
- distinção entre relações extraídas, inferidas e ambíguas;
- operações de vizinhança, comunidades e shortest path;
- execução sem graph database obrigatório.

Referências:

- https://github.com/Graphify-Labs/graphify
- https://github.com/Graphify-Labs/graphify/blob/v8/ARCHITECTURE.md

Graphify deve ser tratado inicialmente como referência, não dependência escolhida. Seu domínio principal é análise de código e documentos, sua ontologia é genérica e sua adoção adicionaria runtime Python ao core Node do mARC.

### Graphiti

Graphiti oferece referências conceituais relevantes:

- episódios como provenance;
- validade temporal;
- histórico de fatos substituídos;
- construção incremental;
- recuperação híbrida;
- ontologia prescrita ou aprendida.

Referência:

- https://github.com/getzep/graphiti

Sua infraestrutura é mais pesada, normalmente envolvendo Python, graph database, embeddings e modelos para extração. O custo parece desproporcional ao corpus atual e deve ser avaliado somente se um protótipo menor comprovar valor.

## Alternativas

### A. Sidecar nativo e determinístico

Construir uma projeção local específica do domínio mARC.

Vantagens:

- alinhamento com Markdown como fonte de verdade;
- integração natural com referências marc://;
- sem novo runtime;
- rebuild previsível;
- provenance controlada;
- evolução incremental;
- baixo risco para a busca atual.

Desvantagens:

- exige definir ontologia e travessia;
- menos funcionalidades prontas;
- extração causal limitada no início.

Recomendação inicial.

### B. Executar Graphify sobre o workspace

Usar Graphify como ferramenta de geração e consulta.

Vantagens:

- pipeline pronto;
- visualização;
- clustering;
- consultas e caminhos;
- bom instrumento para spike comparativo.

Desvantagens:

- ontologia não específica;
- runtime Python;
- extração semântica pode depender de modelo;
- integração com autoridade e lifecycle do mARC exigiria adaptação;
- risco de representar estado atual melhor que evolução histórica.

Útil como benchmark ou protótipo isolado.

### C. Adotar Graphiti ou graph database

Vantagens:

- temporalidade nativa;
- provenance rica;
- travessias escaláveis;
- experiência próxima de agent memory.

Desvantagens:

- infraestrutura e operação mais complexas;
- custo de extração;
- novo stack;
- governança adicional;
- escala atual pode não justificar adoção.

Manter como opção futura.

## Plano de discovery

### Etapa 1 - Auditoria do corpus

Objetivo: medir quanto sinal relacional já existe.

Levantar em threads fechadas:

- referências marc:// entre threads;
- artifacts anexados;
- seções Decisions;
- seções Follow-ups;
- expressões explícitas como substitui, motivou, implementa, valida e levou a;
- componentes mencionados;
- cadeias históricas observáveis.

Saída:

- densidade de referências;
- tipos de relação recorrentes;
- lacunas de metadata;
- amostra de threads com boa lineage.

### Etapa 2 - Gold graph manual

Selecionar 10 a 15 linhas históricas reais.

Para cada uma, registrar manualmente:

- nós;
- arestas;
- direção;
- fonte;
- evidência;
- confiança;
- estado temporal;
- perguntas que o caminho responde.

O gold graph serve como referência para avaliar qualquer extração automática.

### Etapa 3 - Experimento determinístico

Gerar apenas relações estruturais e declaradas:

- referências marc://;
- attachments;
- autoria;
- follow-ups explicitamente nomeados;
- decisões e relações declaradas em seções conhecidas.

Sem LLM e sem inferência semântica livre.

### Etapa 4 - Avaliação com agentes

Comparar três condições:

1. busca e leitura de uma thread;
2. busca, expansão do grafo e leitura seletiva;
3. exploração graph-first, nova busca e leitura seletiva.

Casos devem incluir:

- consulta com resultado direto;
- consulta com resultado incompleto;
- consulta sem resultado;
- explicação histórica de componente atual;
- decisão substituída;
- follow-up indireto;
- validação ou artifact distante da thread inicial.

### Etapa 5 - Decisão arquitetural

Escolher entre:

- não prosseguir;
- manter grafo determinístico;
- enriquecer summaries com relações explícitas;
- adicionar extração semântica controlada;
- avaliar biblioteca ou graph database.

## Métricas

### Qualidade

- precisão das arestas;
- recall de relações do gold graph;
- paths corretos;
- paths sem suporte;
- cobertura de evidências;
- relações indiretas relevantes descobertas;
- taxa de recuperação após busca sem resultado;
- capacidade de identificar decisão vigente e decisão substituída.

### Eficiência

- fontes abertas por tarefa;
- tokens consumidos;
- nós e arestas retornados;
- passos necessários até encontrar evidência;
- redução de leitura ampla;
- custo de rebuild;
- tamanho da projeção.

### Confiabilidade

- zero aresta sem sourceRef;
- zero vazamento de thread aberta;
- rebuild determinístico para as mesmas fontes;
- remoção correta após mudança de elegibilidade;
- classificação explícita de relações inferred e ambiguous;
- preservação da geração anterior em falha.

### Experiência humana

- compreensão de uma linha histórica;
- facilidade para encontrar bifurcações;
- identificação de decisões centrais;
- utilidade da visualização comparada à lista de threads;
- capacidade de navegar sem conhecer os termos exatos.

## Possível evolução do formato de summary

O discovery pode revelar que inferir relações de texto livre é desnecessariamente frágil. Uma evolução opcional seria permitir relações declarativas no próprio Markdown.

Exemplo:

```markdown
## Relations

- follows-up: marc://$thread-a
- supersedes: marc://$thread-b
- validates: marc://$thread-c
- affects: memory-recall
```

Vantagens:

- relação revisável por humanos;
- source of truth continua Markdown;
- grafo determinístico;
- menor risco de hallucination;
- rebuild simples;
- agentes podem propor relações durante o encerramento.

Essa estrutura não deve ser adotada antes da auditoria do corpus e da definição da ontologia mínima.

## Riscos e mitigações

### Grafo ruidoso

Risco: conceitos genéricos conectam quase tudo.

Mitigações:

- limitar tipos;
- penalizar hubs;
- usar direção;
- exigir provenance;
- manter depth pequeno;
- priorizar relações históricas específicas.

### Causalidade falsa

Risco: coocorrência interpretada como motivação ou consequência.

Mitigações:

- separar declared de inferred;
- exigir evidenceText;
- não promover inferência a decisão;
- validar contra gold graph;
- permitir confirmação humana.

### Knowledge poisoning

Risco: hipóteses de threads abertas entram como fatos.

Mitigações:

- somente threads fechadas;
- SUMMARY.md como gate;
- autoridade por sourceType;
- validade temporal;
- remoção em rebuild.

### Obsolescência

Risco: decisão antiga aparece como vigente.

Mitigações:

- SUPERSEDES e INVALIDATES;
- validFrom e validTo;
- destacar estado histórico;
- preferir síntese mais recente quando a pergunta for sobre estado vigente.

### Explosão de contexto

Risco: expansão retorna muitos vizinhos.

Mitigações:

- budgets;
- filtros;
- expansão incremental;
- máximo de hops;
- subgrafos;
- nextActions direcionadas.

### Acoplamento à busca

Risco: experimento de grafo interfere no ranking em desenvolvimento.

Mitigações:

- projeção independente;
- nenhum sinal de grafo na elegibilidade inicial;
- API separada;
- benchmark próprio;
- integração com busca somente por thread-semente.

### Infraestrutura prematura

Risco: graph database e modelos são adotados antes de comprovar valor.

Mitigações:

- gold graph manual;
- sidecar determinístico;
- escala real;
- decisão baseada em métricas.

## Não objetivos iniciais

- substituir memory_recall;
- alterar ranking ou elegibilidade;
- representar todo o código;
- competir com code intelligence;
- indexar threads abertas;
- responder perguntas sem evidência;
- adotar Neo4j, FalkorDB ou outro graph database por antecipação;
- produzir visualização completa antes de validar a experiência do agente;
- extrair causalidade livremente com LLM;
- criar ontologia exaustiva;
- transformar o grafo em fonte de verdade.

## Critérios para considerar a oportunidade validada

A oportunidade mostra valor quando:

1. relações indiretas relevantes são encontradas além do primeiro resultado da busca;
2. consultas sem resultado ganham novos pontos de entrada;
3. agentes abrem menos fontes irrelevantes;
4. cada caminho possui provenance verificável;
5. decisões substituídas são diferenciadas de decisões vigentes;
6. o contexto retornado permanece pequeno;
7. o rebuild é determinístico e seguro;
8. o benefício supera uma nova busca semântica simples;
9. a solução preserva Markdown como fonte de verdade;
10. o experimento não interfere na arquitetura de busca em desenvolvimento.

## Questões abertas

- O corpus atual possui referências explícitas suficientes?
- Thread, decisão ou evento deve ser o principal ponto de entrada?
- Qual ontologia mínima cobre a maioria das cadeias históricas?
- Como extrair relações declaradas de texto livre com segurança?
- Vale estruturar Relations em summaries futuros?
- Como representar decisões vigentes versus históricas?
- Que relações devem ser navegáveis por padrão?
- Qual budget de subgrafo é adequado para agentes?
- Uma visualização humana melhora compreensão ou apenas adiciona ruído?
- Como conectar no futuro componentes atuais a decisões históricas?
- O grafo deve ser commitado ou reconstruído localmente?
- É necessário um store especializado ou JSON/estruturas locais bastam?
- Quais métricas indicam ganho real sobre busca mais memory_deep?
- Qual é o comportamento correto quando o grafo não encontra ponto de entrada?

## Recomendação inicial

Registrar a oportunidade como discovery independente da implementação da busca.

Próximo passo recomendado:

1. auditar relações explícitas em threads fechadas;
2. montar um gold graph manual;
3. testar os fluxos search-first e graph-first;
4. comparar navegação com busca isolada;
5. somente então definir formato, tool surface e armazenamento.

A recomendação técnica provisória é um sidecar nativo, determinístico e específico do domínio mARC. Graphify e Graphiti permanecem referências para schema, confiança, travessia, temporalidade e provenance, não decisões de dependência.

## Resultado esperado

Se validada, esta oportunidade posiciona o mARC como uma camada de memória histórica que complementa ferramentas de estado atual.

Formulação de produto:

> O código mostra como o projeto funciona hoje. O histórico mARC, projetado como grafo, mostra como e por que ele chegou até aqui.
