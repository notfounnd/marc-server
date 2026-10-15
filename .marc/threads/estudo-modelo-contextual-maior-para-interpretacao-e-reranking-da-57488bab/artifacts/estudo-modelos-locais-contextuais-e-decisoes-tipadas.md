# Estudo de modelos locais para interpretação e julgamento contextual da memory

Data do estudo: 12 de outubro de 2026.

Thread: marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab

## Síntese e parecer

**Vale experimentar um modelo mais capaz, mas não há evidência para substituir a busca atual apenas porque ele é maior.** O diagnóstico local encontrou perdas em elegibilidade, ordenação e cobertura de passagens. Um modelo colocado depois da lista final não corrige essas três situações.

A direção mais prática para o primeiro experimento é manter E5 e comparar um modelo gerativo local de aproximadamente 0,8B, em ONNX, atuando em interpretação e julgamento contextual. O candidato documental inicial é **Qwen3.5-0.8B-ONNX-OPT q4, somente texto**. Isso é uma prioridade de teste, não uma escolha definitiva ou uma afirmação de superioridade.

A pesquisa também encontrou alternativas reais à ideia de Jev:

- **Laya multilíngue:** pesos públicos, decisões tipadas e uma exportação ONNX disponível. A versão base tem desempenho zero-shot fraco no benchmark publicado e não deve ser presumida calibrada para o mARC.
- **Jev-Style 0.8B Decision v3:** checkpoint local especializado, inclusive em GGUF de aproximadamente 529 MB. É uma alternativa interessante de decisão, mas requer um runtime específico e não tem ONNX verificado nesta pesquisa.
- **JevEmbed 0.6B:** usa embeddings para decisões tipadas. Torna concreta a hipótese de compartilhar um checkpoint entre recuperação e julgamento, mas requer estudar exportação, quantização e preservação da qualidade de retrieval.
- **Qwen3-Reranker-0.6B:** controle especializado para verificar se um reranker treinado para a tarefa basta, sem atribuir todos os ganhos possíveis a um juiz gerativo.
- **LFM2.5-1.2B-Instruct ONNX:** controle de aumento de capacidade dentro da família já usada, com pacote q4 maior que o Qwen3.5 de 0,8B consultado.

**Parecer:** estudo documental e diagnóstico do baseline entregues. Substituição produtiva, consolidação de modelos e aprovação para 8 GB permanecem **pendentes de experimento com os novos pesos**. Nenhum desses modelos novos foi baixado ou executado nesta rodada.

## 1. Pergunta, escopo e limites

A pergunta é se um modelo local mais capaz pode melhorar interpretação, correção limitada e julgamento contextual, eventualmente reduzindo a quantidade de modelos, sem tornar inviável um PC de referência com 8 GB de RAM.

Foram incorporados os dois complementos do usuário:

1. Considerar o avanço dos modelos desde a proposta original, inclusive capacidade maior com menos disco.
2. Investigar Jev como conceito e possíveis pesos locais no Hugging Face, **não usar o provider da TypeSafe**.

O estudo não autoriza trocar a arquitetura em produção, remover Deep retry, mudar o limiar da busca, indexar novos tipos de conteúdo ou substituir E5. Também não autoriza escolher um vencedor por benchmark de marketing.

Não houve envio de queries ou conteúdo do workspace para uma API de inferência externa. Fontes públicas, documentação e metadados foram consultados; as buscas de avaliação foram locais.

### Tipos de evidência

- **Medido no mARC:** 30 consultas históricas, oito controles, três diagnósticos por etapa, geração e hash do índice, inventário de cache atual.
- **Verificado em fontes primárias:** formatos disponíveis, bytes dos arquivos publicados, revisions, configuração dos modelos, métodos e resultados relatados pelos autores.
- **Inferência arquitetural:** ponto de integração, riscos de consolidar papéis, implicações do contexto e do ciclo de vida.
- **Ainda não medido:** qualidade dos novos pesos no mARC, pico de RAM, efeito da quantização no nosso domínio, carga fria/quente e viabilidade em 8 GB.

Resultados dos autores não são resultados reproduzidos neste ambiente.

## 2. O que o baseline atual realmente faz

A configuração encontrada no código e no índice é:

| Responsabilidade | Configuração |
| --- | --- |
| Embeddings | Xenova/multilingual-e5-small, int8, 384 dimensões |
| Reranking | cross-encoder/mmarco-mMiniLMv2-L12-H384-v1, O4 |
| Interpretação e correção | onnx-community/LFM2.5-350M-ONNX, q4 |
| Recuperação | LanceDB híbrido, canais de identidade, passagem e texto |
| Fonte indexada | SUMMARY.md de threads fechadas |
| Contrato | Schema 6, field-aware-hybrid-v2 |
| Chunking documentado | Passagens de 320 tokens do reranker, overlap de 48 |
| Ciclo de vida | Worker Node isolado por papel e workspace |

Os workers de embedding e reranking expiram após 30 segundos de inatividade. O de interpretação expira após 300 segundos. Esses tempos foram verificados em `inference-manager.ts` e `docs/memory.md`.

As três responsabilidades não são equivalentes:

- Embedding precisa preservar vizinhança e recall para recuperar candidatos.
- Interpretação precisa respeitar a intenção original e distinguir erro de digitação de termo válido.
- Julgamento precisa avaliar se a evidência de uma thread responde à consulta, em vez de aceitar qualquer ocorrência textual ou relação temática genérica.

Ter o mesmo checkpoint em duas funções não obriga misturar seus contratos. Ter dois workers carregando o mesmo checkpoint também não garante economia de RAM.

### Um modelo para os três papéis

Não existe uma impossibilidade arquitetural, mas não foi encontrado neste estudo um bundle já validado que reúna recuperação, correção aberta e julgamento de relevância no mARC. Extrair um vetor de hidden states de um modelo causal não o transforma automaticamente em um retriever treinado. O espaço vetorial, pooling, instruções e objetivo de treinamento precisam sustentar recuperação.

Qwen ou LFM como interpretador e juiz podem reduzir três checkpoints para dois, preservando E5. JevEmbed aproxima recuperação e decisões, mas a correção por Choice precisa de opções fornecidas e seu retrieval após fine-tuning ainda deve ser testado. A consolidação deve ser definida por capacidades comprovadas, não pela quantidade aparente de nomes no cache.

## 3. Bateria empírica e diagnóstico

A matriz completa, os valores brutos, a reprodução e o inventário remoto estão em [Evidências da avaliação](avaliacao-baseline-e-diagnostico-memory.md).

### Resultado da rodada

Foram reexecutadas as 30 perguntas históricas com `queryMode: auto`, `depth: 0` e `limit: 10`, no índice de 53 summaries.

| Grupo | Alvo histórico em Top-1 |
| --- | --- |
| Diretas | 10/10 |
| Indiretas | 8/10 |
| Implícitas | 9/10 |
| Total | 27/30 |

O alvo ficou em Top-3 e Top-10 em 27/30. Uma resposta ficou vazia. As duas correções aplicadas indevidamente alteraram gramática, mas não retiraram o alvo do primeiro lugar.

O percentual total coincide com o relatório de agosto, mas os casos falhos mudaram e o corpus cresceu. **Não é uma comparação pareada de versões nem uma taxa completa de relevância.** Um alvo histórico ausente não significa que todos os resultados sejam inúteis. É necessário rotular também threads novas e alternativas legítimas.

### Onde os três alvos foram perdidos

| Caso | O que foi observado | Consequência para a hipótese |
| --- | --- | --- |
| 3P, indicador de saúde da memory | Alvo em identidade e passagem na posição 3; posição 5 pré-filtro; elegibilidade própria aproximadamente 0,025; nenhuma thread elegível | O alvo foi recuperado. Julgar somente a lista final vazia não funciona |
| 6I, remoção de aliases MCP | Alvo em passagem 4 e reranker 2; posição 5 pré-filtro; elegibilidade própria 0,427 e valor após teto 0,062 | O limiar e o acoplamento à ordem merecem ablação; remover só o teto não basta |
| 9I, auditoria | Identidade 34; nenhuma passagem recuperada; alvo elegível, mas posição 15 pré-filtro | Falta de evidência de passagem e ordenação, não o mesmo mecanismo dos outros dois |

O canal vetorial de identidade retornou as 53 threads em todos os três diagnósticos. Portanto, os resultados não sustentam a explicação simples de que E5 não encontrou os alvos.

O código calcula elegibilidade com uma transformação logística de coeficientes fixos e impõe um teto monotônico pela ordem previamente calculada. Esse valor não deve ser tratado automaticamente como confiança probabilística validada. Um candidato posterior pode ter elegibilidade própria maior, mas herdar o teto de anteriores.

Não é recomendação de remover essa lógica imediatamente. É evidência para compará-la explicitamente com um julgamento independente antes de atribuir o problema a tamanho de modelo.

### Controles que ajudam a interpretar o resultado

- As duas perguntas com alteração gramatical indevida continuaram recuperando o alvo em primeiro no modo literal. A alteração não era necessária.
- `toogle` gerou sugestão de `toggle`, sem correção aplicada; a resposta foi vazia tanto no modo automático quanto no literal.
- `brutalismp` foi corrigido para `brutalism`, mas ficou vazio.
- `interface com brutalism` encontrou a thread de estilo neo-brutalism para a UI como único resultado.
- Duas consultas exploratórias de domínio externo, sobre tokamak e irrigação de soja, ficaram vazias.

Os oito controles não são uma nova avaliação estatisticamente suficiente. Demonstram por que é importante medir interpretação, consultas curtas, contexto e abstenção separadamente.

## 4. Jev, decisões tipadas e o que existe para uso local

### 4.1 O Jev da TypeSafe

O anúncio e a documentação apresentam decisões estruturadas em três primitivas:

- **Choice:** escolher entre opções fornecidas.
- **Score:** decidir um nível em uma escala definida.
- **Noul:** avaliar uma pergunta binária.

Isso combina com a tarefa de decidir se uma evidência é útil e escolher entre IDs autorizados, sem pedir uma resposta textual aberta. A documentação consultada do serviço usa API da TypeSafe. Não foi localizado, nesta pesquisa, um checkpoint oficial desse serviço com pesos públicos e ONNX no Hugging Face.

As latências anunciadas pelo provider não descrevem inferência local em CPU de um PC básico. Garantia de tipo elimina certas falhas de formato, não erros de interpretação, vieses ou confiança mal calibrada.

Fontes: [anúncio oficial](https://typesafe.ai/blog/introducing-system-one-models-and-jev), [documentação de Jev](https://docs.typesafe.ai/introduction), [harness descrito pela LangChain](https://www.langchain.com/blog/building-a-harness-with-jev).

### 4.2 Laya multilíngue

O Laya multilíngue é um modelo não autoregressivo baseado em mmBERT, de aproximadamente 322M parâmetros, com suporte multilíngue que inclui português. Produz decisões tipadas sem gerar uma longa resposta.

Há duas rotas de ONNX diferentes:

- O runtime autoral `laya-ts` usa exportação separada em `encoder.onnx` e `head.onnx`.
- `onnx-community/laya-multilingual-ONNX` publica um grafo único com encoder e head, entradas adicionais de marcadores e tipo de pergunta, e arquivos externos de pesos.

**Esses bundles não são intercambiáveis.** A exportação de grafo único exige um adapter compatível ou o runtime correspondente. Não basta trocar o ID no pipeline atual de classificação.

O card da conversão reporta paridade com PyTorch e Node em um conjunto de casos; também reporta aproximadamente **35% de acurácia zero-shot** no benchmark de decisões tipadas, em ambas as precisões. São medições do autor, não uma avaliação do mARC.

A configuração consultada contém temperaturas `[1, 1, 1]` e nenhum ajuste por quantidade de opções. O card da família alerta para overconfidence e necessidade de calibração. A palavra “calibrated” na apresentação não prova calibração para nossas perguntas.

Outra limitação é funcional: Choice pode escolher `toggle` se essa opção for fornecida, mas não inventa livremente a grafia corrigida. Substituir LFM exige preservar uma forma de propor opções ou abandonar a geração de correções. Não é um substituto direto para todas as funções do interpretador.

Fontes: [modelo multilíngue original](https://huggingface.co/convaiinnovations/laya-multilingual), [família e limites](https://huggingface.co/convaiinnovations/laya), [conversão ONNX](https://huggingface.co/onnx-community/laya-multilingual-ONNX), [runtime TypeScript do autor](https://github.com/NandhaKishorM/laya/tree/main/laya-ts).

### 4.3 Laya ajustado para português e espanhol

`telepatia-ai/laya-pt-es-typed` publica um ajuste multilíngue para português e espanhol. Seu card descreve ganhos em tarefas tipadas de domínios próprios, com avaliação e calibração específicas.

Isso não demonstra julgamento de relevância sobre histórico de desenvolvimento. Também não permite presumir que a exportação ONNX do modelo-base contenha esse ajuste. O checkpoint consultado está em Safetensors e exigiria uma exportação própria e paridade.

É uma referência de que adaptação ao domínio pode importar mais que aumento bruto de parâmetros, não um vencedor para o mARC.

Fonte: [card autoral do ajuste pt/es](https://huggingface.co/telepatia-ai/laya-pt-es-typed).

### 4.4 Jev-Style 0.8B Decision v3

É um modelo independente, ajustado a partir de Qwen3.5-0.8B para decisões por distribuição sobre opções. Não é o checkpoint oficial do serviço Jev.

O autor publica pesos, benchmarks fora e dentro dos domínios usados no treinamento, builds GGUF e MLX e código específico de inferência. O build GGUF q4 consultado tem 529.296.864 bytes. A inferência GGUF usa um scorer específico sobre prefill, não deve ser confundida com pedir JSON a um chat comum.

Os benchmarks documentados justificam investigação, mas não demonstram compreensão das threads do mARC nem calibração das nossas classes de relevância. Vieses do processo de treinamento podem persistir mesmo com uma saída tipada.

Não foi verificado um bundle ONNX desse ajuste. Usar o ONNX do Qwen-base não equivale a usar os pesos Jev-Style. Adotar GGUF acrescentaria um runtime nativo, distribuição multiplataforma e responsabilidades de manutenção.

Fontes: [checkpoint e avaliação do autor](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3), [build GGUF e inferência](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF).

### 4.5 JevEmbed e a hipótese de compartilhar recuperação e decisão

`HIT-TMG/JevEmbed-Qwen3-Embedding-0.6B` é um modelo de embeddings ajustado para Choice, Score e Noul. As decisões usam instruções, representações de estado/opções e funções de pontuação por similaridade.

O card publica embeddings de 1024 dimensões e resultado de 82,30% em sua avaliação de hard labels após ajuste. Isso é um resultado do dataset do autor. Não é uma medição de retrieval do mARC nem prova de preservação da qualidade de busca do modelo-base.

Esta é a alternativa mais diretamente relacionada à hipótese de **um checkpoint compartilhar recuperação e decisão**. Entretanto:

- Não há bundle ONNX no release consultado.
- O modelo publicado em Safetensors ocupa aproximadamente 2,383 GB só em pesos. Ele não é um download q4 de 300 MB.
- Migrar do E5 de 384 dimensões para esse embedding de 1024 exige índice experimental separado e rebuild.
- Preservar dimensão ou truncar vetores não resolve diferenças de treinamento, pooling e instruções.
- Julgar opções por embeddings não é o mesmo mecanismo de um cross-encoder lendo consulta e passagem juntos.
- Decisões tipadas não geram uma correção ortográfica arbitrária; para esse papel seria necessário fornecer opções válidas ou manter um gerador.
- Mesmo com um checkpoint, diferentes chamadas e representações são necessárias. “Um modelo” não significa “uma inferência”.

O braço experimental deve medir retrieval antes e depois do ajuste JevEmbed, em conjunto separado da avaliação de decisões. Se ganhar em decisão e perder recall, a consolidação não atende ao propósito.

Fontes: [checkpoint JevEmbed](https://huggingface.co/HIT-TMG/JevEmbed-Qwen3-Embedding-0.6B), [implementação e documentação do método](https://github.com/HITsz-TMG/JevEmbed).

### 4.6 Outros pesos com Jev no nome

A busca pública encontrou projetos independentes de tamanhos, bases e runtimes diferentes. O nome Jev não define origem, tarefa, compatibilidade ou licença.

Por exemplo, NeoHorse-Jev-4B publica uma implementação especializada e aproximadamente 9 GB de pesos do backbone, além de head, com stack de inferência diferente da atual. Releases com adapters de poucos MB também precisam do modelo-base completo.

Esses exemplos não são a primeira prioridade para um produto local com referência de 8 GB. Não são descartados por uma regra abstrata de “4B nunca cabe”, mas pelo bundle e runtime efetivamente publicados.

Fonte: [NeoHorse-Jev-4B](https://huggingface.co/TokenRhythm/NeoHorse-Jev-4B).

## 5. Comparativo de disco e prontidão técnica

Os valores abaixo foram somados a partir dos metadados públicos dos arquivos selecionados. **MB usa base decimal de 1.000.000 bytes.** Não é soma de todos os formatos do repositório e não é estimativa de RAM.

| Candidato | Conjunto selecionado | Bytes | Tamanho decimal | Licença declarada no card |
| --- | --- | --- | --- | --- |
| onnx-community/laya-multilingual-ONNX | ONNX FP16, grafo único + dados + tokenizer/config | 681.756.308 | 681,8 MB | apache-2.0 |
| onnx-community/Qwen3.5-0.8B-ONNX-OPT | ONNX q4, somente texto + tokenizer/config | 666.370.346 | 666,4 MB | apache-2.0 |
| LiquidAI/LFM2.5-1.2B-Instruct-ONNX | ONNX q4 + dados + tokenizer/config | 853.544.357 | 853,5 MB | other |
| onnx-community/Qwen3-Reranker-0.6B-ONNX | ONNX q4 + tokenizer/config | 1.006.665.497 | 1006,7 MB | apache-2.0 |
| chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF | GGUF Q4_K_M, sem binário do runtime | 529.296.864 | 529,3 MB | apache-2.0 |
| HIT-TMG/JevEmbed-Qwen3-Embedding-0.6B | Safetensors e configuração de embeddings, não ONNX | 2.394.574.975 | 2394,6 MB | apache-2.0 |

Todos os seis releases acima foram consultados como `gated: false`. Isso descreve disponibilidade técnica na data, não um parecer jurídico sobre qualquer utilização. A licença de LFM exige consultar seus próprios termos; as demais listam Apache-2.0. Não foi proposto um novo fluxo de avisos na UI.

### Custo atual e economia possível

O cache corrente informou:

| Componente atual | Bytes |
| --- | --- |
| E5 small | 135.138.424 |
| mMARCO | 252.543.992 |
| LFM 350M | 297.116.035 |
| Total de modelos em uso | 684.798.451 |

A soma dos componentes que se deseja potencialmente consolidar, mMARCO e LFM, é 549.660.027 bytes.

- **E5 + Qwen3.5-0.8B text-only:** aproximadamente 801,5 MB nos arquivos considerados. É mais que o cache atual, não menos, ainda que use dois checkpoints.
- **E5 + LFM1.2B:** aproximadamente 988,7 MB se esse modelo realmente substituir interpretação e reranking. Só substituir LFM mantém também mMARCO.
- **E5 + Laya FP16:** aproximadamente 816,9 MB, mas retirar LFM exigiria resolver a geração/proposição de correções. Mantendo LFM, o conjunto fica maior.
- **E5 + Jev-Style GGUF q4:** aproximadamente 664,4 MB em arquivos de modelo. Seria ligeiramente menor que o cache atual se substituísse os dois papéis, mas não inclui o runtime e não resolve geração aberta de correção.
- **E5 + LFM350M + Qwen reranker q4:** aproximadamente 1438,9 MB, sem consolidar os três modelos.
- **JevEmbed:** o pacote consultado tem aproximadamente 2394,6 MB em Safetensors e configuração. Ainda não há um custo real de seu hipotético bundle ONNX quantizado.

Essas comparações servem para decidir o que medir. Pacote selecionado remoto e cache instalado são bases próximas, mas não idênticas. O runtime pode baixar arquivos auxiliares adicionais.

O Qwen3.5 consultado tem gráficos separados de texto e visão. O subconjunto acima exclui visão. A versão instalada de Transformers.js, 4.2.0, expõe as classes de Qwen3.5, e a implementação diferencia causal LM somente texto da variante multimodal. Isso é viabilidade estática, não prova de execução bem-sucedida.

O card original do Qwen3.5-0.8B enquadra o modelo como opção para prototipagem, pesquisa e ajuste específico de tarefa. Ele opera por padrão em modo non-thinking. Isso reforça a necessidade de validar o contrato limitado de busca e de não transferir benchmarks genéricos para o mARC. Contexto máximo anunciado não é orçamento recomendável para uma CPU com 8 GB.

Também foi verificado que q4 nem sempre é o menor arquivo publicado: em Qwen3-0.6B ONNX, o grafo q4 consultado é maior que o int8; em Qwen3-1.7B, há diferenças relevantes entre q4, int8 e q4f16. Precisão de componentes e decisões da exportação importam mais que multiplicar parâmetros por quatro bits. Formatos com ativações FP16 não devem ser automaticamente preferidos para CPU.

### Revisões fixadas

- [onnx-community/laya-multilingual-ONNX](https://huggingface.co/onnx-community/laya-multilingual-ONNX/tree/46b77bbf5642fec5f14e540570228a8cbe8ab81f), revisão `46b77bbf5642fec5f14e540570228a8cbe8ab81f`.
- [onnx-community/Qwen3.5-0.8B-ONNX-OPT](https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX-OPT/tree/969350d5f4647ec9ac277110f8974c65d8c10e4b), revisão `969350d5f4647ec9ac277110f8974c65d8c10e4b`.
- [LiquidAI/LFM2.5-1.2B-Instruct-ONNX](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-ONNX/tree/10f72e70abf67ac0fd7ebf15bc5854726891d864), revisão `10f72e70abf67ac0fd7ebf15bc5854726891d864`.
- [onnx-community/Qwen3-Reranker-0.6B-ONNX](https://huggingface.co/onnx-community/Qwen3-Reranker-0.6B-ONNX/tree/9995c50e2310679108a55f5ccd16ba8be9f17c20), revisão `9995c50e2310679108a55f5ccd16ba8be9f17c20`.
- [chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/tree/edf37c26a1098f83cf4264b8adbe0dca2d2ebb0c), revisão `edf37c26a1098f83cf4264b8adbe0dca2d2ebb0c`.
- [HIT-TMG/JevEmbed-Qwen3-Embedding-0.6B](https://huggingface.co/HIT-TMG/JevEmbed-Qwen3-Embedding-0.6B/tree/e4a71aacd9b47ae6106fe57b7bf1c39992dc7ab1), revisão `e4a71aacd9b47ae6106fe57b7bf1c39992dc7ab1`.

O inventário detalhado dos arquivos está no anexo de evidências. Os tamanhos são relativos a essas revisões, não a qualquer atualização futura de `main`.

## 6. RAM de 8 GB e execução local

### O que pode ser afirmado

Os bundles compactos encontrados justificam experimentar modelos locais menores que 2B. **Ainda não há medição que aprove qualquer novo candidato em 8 GB.**

A máquina da bateria tem aproximadamente 16 GB de RAM. Rodar um modelo nela não provaria, por si só, margem suficiente em 8 GB. Tampouco o tamanho de disco estabelece pico de RAM.

Devem entrar na medição:

- Pesos, páginas mapeadas e eventual transformação de quantização.
- Tokenizer, runtime ONNX, buffers de entrada/saída e arenas de alocação.
- Ativações, comprimento de contexto e batch.
- Estados de atenção/cache e estados específicos da arquitetura, quando existentes.
- Workers simultâneos, daemon, LanceDB e UI.
- IDE, agente de desenvolvimento e sistema operacional, que compartilham o PC.

A referência de 8 GB exige margem operacional real, não apenas “o processo não caiu”. Se houver swap intenso, o modelo pode tecnicamente executar e ainda tornar o produto inadequado.

### Política de ciclo de vida a experimentar

1. Recuperar com E5 e reunir evidências sem carregar todos os modelos ao mesmo tempo.
2. Usar batches limitados e respeitar orçamento de tokens.
3. Compartilhar uma instância quando o mesmo checkpoint assumir interpretação e julgamento, mantendo contratos separados.
4. Serializar ou limitar as solicitações ao worker compartilhado. Não duplicar o modelo silenciosamente por papel.
5. Medir primeiro com unload verificável, depois avaliar retenção por TTL.
6. Medir a busca seguinte dentro e fora do TTL e o RSS depois da liberação.

Aumentar TTL reduz recargas somente quando o worker é realmente reutilizado. Não melhora compreensão, cobertura de candidatos ou calibração. Não deve mascarar duplicação de sessões.

Não há meta nova de latência arbitrária. A prioridade indicada pelo usuário permanece qualidade antes de otimização. A duração observada é registrada como diagnóstico, não como critério de vitória.

### Plataformas

- **Windows:** baseline e diagnósticos executados neste estudo.
- **Linux e macOS:** não executados; requerem validação de instalação, ORT, provider CPU, cache e encerramento de workers.
- **Apple Silicon:** uma publicação em WebGPU ou MLX não prova o mesmo resultado no caminho Node/ONNX CPU.
- **GPU/NPU/VRAM:** opcionais, não pressupostas na referência mínima.

## 7. Onde o modelo contextual deve entrar

O experimento deve distinguir duas tarefas, com interfaces e métricas próprias.

### Antes da recuperação, interpretação limitada

Entrada: consulta original, contexto mínimo necessário e opções de preservação/correção quando aplicável.

Saída: preservar, sugerir ou corrigir um erro limitado. Identificadores técnicos, negações, intenção e termos válidos devem ser preservados. Correção gramatical geral não faz parte dessa tarefa.

Um modelo gerativo pode propor uma grafia nova; um modelo tipado precisa receber alternativas. Essa diferença deve ser resolvida no desenho, não escondida por prompts.

A validação deve impedir IDs inventados, alteração de intenção e reescrita irrestrita. Se a saída não cumprir o contrato, preservar a consulta original. Não usar listas linguísticas hardcoded como substituto do entendimento.

### Depois da recuperação, antes da exclusão irreversível

Entrada: candidatos autorizados e evidências identificáveis, ainda antes de descartar threads por elegibilidade. Cada candidato deve incluir identidade, propósito e passagem suficiente para julgar a pergunta.

Saída: classes limitadas de relevância, escolha entre IDs fornecidos ou abstenção. O modelo não cria threads, candidatos nem pesos livres.

Um desenho viável compara:

- Responde diretamente à consulta.
- Ajuda parcialmente ou fornece contexto útil.
- Apenas menciona termos/assuntos, sem responder.
- Não oferece evidência suficiente.

A classe deve se apoiar na evidência apresentada, não em conhecimento externo sobre o projeto. Conteúdo de summary ou artifact deve ser tratado como dado, não como instrução executável ao juiz.

### Por que não fixar três a cinco candidatos

O caso 9I ficou na posição 15 e não tinha passagem recuperada. Uma shortlist fixa de três a cinco não o inclui. Mesmo 3P não existe na lista final.

O tamanho da shortlist deve ser escolhido por **Recall@K de candidatos e cobertura de evidência**, com conjunto separado de avaliação. Começar uma varredura em K de 5, 10, 20 e 40 é uma proposta de experimento, não escolher 20 porque um exemplo particular precisa de 15.

Se o alvo não estiver no pool, ampliar o pool de forma explícita. Se a identidade estiver presente sem passagem, recuperar evidência do summary autorizado antes de julgar. Nenhum juiz compensa informação que não recebeu.

### Orçamento de contexto

O Laya consultado usa orçamento padrão de 1024 tokens, com 256 para a cabeça da pergunta/opções e o restante para estado. Cinco passagens de 320 tokens, mais títulos e pergunta, já ultrapassariam esse total; os tokenizers também são diferentes.

Não enviar apenas títulos para caber no contexto e depois anunciar que se avaliou contexto completo. Testar pequenos grupos ou julgamento por candidato, com seleção de evidência que preserve propósito. Cada pergunta do bundle Laya forma sua própria sequência; batch de perguntas não implica custo de um único estado compartilhado.

Opções, ordem, label wording e presença de “nenhum” precisam de testes de estabilidade. A distribuição sobre opções é relativa ao conjunto fornecido; adicionar uma opção pode alterar a confiança sem mudar a evidência.

## 8. Protocolo do próximo experimento

Esta seção é uma recomendação de estudo experimental. Não é um plano de implementação produtiva já aprovado.

### Etapa A, congelar corpus e rótulos

- Fixar snapshot, hashes, provider, tokenizer, índices e contrato.
- Preservar as 30 perguntas históricas, mas não ajustar o modelo ou limiar só nesses exemplos.
- Rotular alternativas válidas e relevância graduada, além do único alvo de origem.
- Acrescentar famílias de consultas curtas, erros de digitação, frases indiretas, consultas em mais de um idioma, negações e consultas sem resposta.
- Separar desenvolvimento, calibração e teste. Parafrasear a mesma pergunta nos dois lados não produz independência suficiente.
- Incluir threads novas e antigas, evitando um benchmark centrado em brutalism.

### Etapa B, braços comparáveis

| Braço | Mudança experimental | Pergunta isolada |
| --- | --- | --- |
| A0 | Configuração atual e replay de candidatos | Referência |
| A1 | Manter candidatos e interpretar com Qwen3.5-0.8B q4 | A capacidade extra melhora apenas interpretação? |
| A2 | Consulta literal fixa e juiz Qwen sobre candidatos pré-filtro | O julgamento melhora sem mudar o retriever? |
| A3 | Compartilhar Qwen entre interpretação e julgamento | A consolidação mantém os ganhos e economiza sessões? |
| A4 | LFM1.2B com o mesmo contrato e pool | Um upgrade dentro da família oferece resultado melhor? |
| A5 | Qwen3-Reranker-0.6B com o mesmo pool | O ganho vem de reranking especializado? |
| A6 | Decisão tipada Laya ou Jev-Style | A interface tipada oferece ganho real ou apenas formato? |
| B1 | JevEmbed com índice experimental e contrato próprio | Compartilhar embedding e decisão preserva recall e qualidade? |

Não executar todos de uma vez. Começar por A0, A1 e A2 para isolar efeitos; testar A3 se houver ganho consistente. A4/A5 são controles para comparar explicações. A6 e B1 exigem seus próprios requisitos de runtime/exportação e não devem bloquear o primeiro experimento.

Uma ablação do limiar e do teto monotônico deve ser separada da comparação de pesos. Mudar modelo, shortlist e lógica de elegibilidade simultaneamente impede entender a causa do ganho.

### Etapa C, métrica e confiança

- Recall@K antes do filtro e cobertura de passagem por alvo.
- Top-1/Top-3 e posição recíproca do alvo, acompanhados de relevância graduada.
- nDCG e precisão de resultados secundários.
- Falso positivo em consultas sem resposta e cobertura de abstenção.
- Correções corretas, alterações destrutivas e preservação em modo literal.
- Estabilidade à ordem das opções, tamanho da lista e pequenas paráfrases.
- Calibração de scores e confiança em conjunto separado, com ECE/Brier e curvas de precisão versus cobertura.
- IDs fora da lista, outputs inválidos e tentativas de seguir instruções contidas no corpus.

Uma escala ordinal tipada não deve ser transformada em probabilidade calibrada sem teste. Temperatura ou limiar devem ser ajustados no conjunto de calibração, não nos exemplos que se deseja demonstrar.

### Etapa D, recursos e produto

- Medir todos os processos envolvidos, não apenas o pai Node.
- Registrar pico durante carga, prefill, julgamento, unload e chamadas sequenciais.
- Medir em máquina real de 8 GB ou ambiente com limite de memória verificável, acompanhado de margem para o restante do produto.
- Fixar revisão, dtype, arquivos, device, batch, tokens e threads de CPU.
- Validar falha de download, ausência de modelo, cancelamento, timeout e recuperação.
- Comprovar que fallback conserva a consulta e não muda silenciosamente o contrato de busca.
- Validar Windows/Linux/macOS antes de declarar suporte multiplataforma.

### Critérios de aceite e falsificação

Preservar o acerto das consultas diretas, melhorar casos implícitos/indiretos e relevância graduada, não criar falsos positivos relevantes e não introduzir correções destrutivas. Exigir evidência de cobertura e orçamento de RAM com margem.

Uma vitória em 3P, 6I e 9I não é suficiente se os demais piorarem. Também não basta um score médio maior, um modelo que aceita tudo ou um formato sempre válido.

A hipótese deve ser rejeitada ou restrita se:

- O juiz não melhorar a qualidade em teste separado.
- O ganho desaparecer ao rotular alternativas legítimas.
- A consolidação degradar correção ou retrieval.
- O consumo real tornar 8 GB impraticável.
- O custo de runtime/exportação/manutenção superar o ganho observado.

É aceitável terminar o experimento mantendo o baseline, ou manter o novo modelo apenas em uma função. A pesquisa não deve obrigar uma troca para justificar o investimento.

## 9. Sanitização, cache e versões

O projeto já tem purge manual, inventário de recursos e coordenação de operações. A futura integração deve reutilizar esses limites, não criar uma segunda política de limpeza desconectada.

Requisitos para os próximos experimentos e uma eventual implementação:

- Manter caches e gerações experimentais separados da configuração produtiva.
- Registrar checkpoint, revisão, precisão, gráficos e arquivos externos como identidade do bundle.
- Baixar apenas os arquivos necessários ao papel; um modelo multimodal não exige visão numa busca textual.
- Não considerar download parcial como preparação concluída.
- Preservar modelos em uso por workers ou operações ativas.
- Antes de excluir um bundle, liberar sessões e impedir novas cargas concorrentes.
- Preservar a geração ativa e os formatos autoritativos de configuração e registros.
- Registrar bytes realmente liberados, distinguindo modelos, índices e arquivos temporários.
- Manter migração reversível: troca de retriever exige índice novo; troca de interpretador/juiz não exige reembeddar se E5 e o contrato forem mantidos.
- Permitir limpeza manual de modelos não selecionados, sem transformar cada atualização em download permanente acumulado.

Não foi executado purge neste estudo. O inventário atual informou zero bytes recuperáveis de modelos, mas existem gerações históricas no diretório de memory. Essa observação não autoriza apagá-las e não equivale a uma medição de todo o espaço recuperável.

## 10. Relação com as outras oportunidades

### Profundidade adaptativa e simplificação do Deep Search

marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f

O juiz poderia ajudar a decidir se há evidência suficiente ou se vale expandir candidatos. Isso não substitui a distinção entre ampliar recall e relaxar elegibilidade. Um NONE de um pool pequeno pode significar cobertura insuficiente, não inexistência de conhecimento.

Manter `depth` no core/MCP e reduzir interação manual é uma decisão de produto separada. O estudo atual não remove o botão nem muda seus níveis.

### Memory deep

marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae

Conteúdo adicional pode fornecer a evidência que um summary não contém. O juiz não reconstrói fatos ausentes. A proposta histórica separa uma bússola de summaries de uma camada de aprofundamento, com origem forte dos trechos.

O ID de modelo citado naquela oportunidade é histórico, anterior à configuração E5 atual. Reutilizar o princípio de separação não significa reintroduzir automaticamente esse modelo.

Uma decisão tipada pode selecionar quais threads aprofundar e quais trechos merecem leitura, conservando path, tipo de fonte, mensagem e seção. Isso é triagem de evidência, não geração de fatos. O experimento deve incluir custo de contexto e casos em que a resposta está apenas no conteúdo aprofundado.

### Grafo de evolução e proveniência

marc://$oportunidade-grafo-de-evolucao-e-proveniencia-historica-do-proje-b84711a0

Um grafo pode distinguir origem, evolução e implementação posterior. Isso ajuda a avaliar consultas históricas nas quais uma thread nova também é relevante, mas não é a origem da decisão.

O modelo pode consumir relações explícitas como evidência; não deve inventar causalidade. Busca, grafo e leitura da fonte continuam responsabilidades distintas.

Um uso investigativo de Choice seria classificar uma relação candidata entre nós, incluindo uma opção de relação não sustentada, sempre com trechos e referências que a justifiquem. O resultado seria uma sugestão derivada para revisão, não alteração automática de histórico autoritativo. Temporalidade ou semelhança de palavras sozinhas não comprovam dependência.

## 11. Revisão integrada do estudo

### Fontes e cobertura

Foram lidos o contrato de bootstrap, a proposta da thread, seus quatro comentários e os registros das três oportunidades relacionadas. Foram revisados o guia de memory, o runner existente, os limites de profundidade, a configuração de modelos, os providers, o ranking híbrido/semântico, a elegibilidade e o gerenciador de inferência.

A investigação do repositório e a revisão de saídas usaram context-mode. Context7 foi usado para documentação de Transformers.js, conferida com a versão instalada; sequential-thinking apoiou a separação de hipóteses e a análise das evidências. As fontes externas são cards, documentação e implementação dos autores, não inferência sobre nomes de repositórios.

### Avaliação contra a proposta original

| Requisito | Evidência ou limite |
| --- | --- |
| Investigar modelo mais capaz e possibilidade de consolidação | Comparação de modelos gerativos, tipados e embedding-decision, com limites de cada papel |
| Jev local/Hugging Face, sem TypeSafe provider | Disponibilidade e alternativas verificadas; nenhuma inferência externa |
| Baseline e consultas reais | 30 perguntas históricas, oito controles e três diagnósticos |
| Evitar ajuste enviesado para um termo | Dez origens distintas, múltiplos estilos, controles e protocolo de teste separado |
| Identificar gargalo antes de trocar retriever | Cobertura por canal e mecanismo dos três alvos ausentes |
| Disco e RAM | Bytes e revisões verificados; RAM dos novos modelos explicitamente não medida |
| Sanitização e runtime | Contrato proposto compatível com cache/purge existentes, sem limpeza nesta execução |
| Benchmark de novos modelos | Pendente; nenhum vencedor declarado |
| Preservar arquitetura e fontes autoritativas | Nenhum arquivo executável, índice produtivo ou configuração alterado |

### Parecer final

**Aprovado como estudo documental e diagnóstico empírico do baseline. Pendente como validação de novos modelos.**

A recomendação é testar primeiro um modelo gerativo local compatível com o runtime existente, mantendo E5 e julgando evidências antes do descarte irreversível. A escolha definitiva depende de qualidade pareada, calibração, contratos e recursos medidos. Laya, Jev-Style e JevEmbed acrescentam hipóteses concretas, mas não tornam essa verificação dispensável.

Não há aprovação de substituição produtiva, promessa de busca perfeita ou declaração de suporte a 8 GB. A thread permanece aberta para discussão e aceite do usuário.

### Classificação da entrega

Estudo e registros mARC, sem alteração executável. Foram feitos checks de evidências, estrutura Markdown, caminhos/fontes citados e metadados de artifacts. A auditoria estrutural ocorre depois da publicação com os anexos.

Não foram executados Git, `pnpm validate`, `pnpm build` ou `pnpm test`. Os três comandos de validação do produto não são aplicáveis a esta entrega editorial; não são apresentados como passes nem pendências. A ausência deles não substitui a revisão substantiva registrada acima.

## 12. Referências complementares

- [Qwen3.5-0.8B original](https://huggingface.co/Qwen/Qwen3.5-0.8B).
- [Qwen3.5-0.8B ONNX-OPT](https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX-OPT).
- [LFM2.5-1.2B-Instruct ONNX oficial](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-ONNX).
- [Qwen3-Reranker-0.6B e método de scoring](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B).
- [Qwen3-Reranker-0.6B ONNX](https://huggingface.co/onnx-community/Qwen3-Reranker-0.6B-ONNX).
- [Transformers.js, seleção de dtypes](https://huggingface.co/docs/transformers.js/guides/dtypes).
- [Qwen3-0.6B ONNX, formatos publicados](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX).
- [Qwen3-1.7B ONNX, formatos publicados](https://huggingface.co/onnx-community/Qwen3-1.7B-ONNX).

Fontes de avaliação histórica: proposta desta thread e artifact `avaliacao-aleatoria-30-consultas-memory.md` da thread de refinamento.

marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba

Fontes locais de arquitetura: `docs/memory.md`, `src/core/memory/model-config.ts`, `search-depth.ts`, `semantic-eligibility.ts`, `semantic-ranking.ts`, `hybrid-ranking.ts` e `inference-manager.ts`.
