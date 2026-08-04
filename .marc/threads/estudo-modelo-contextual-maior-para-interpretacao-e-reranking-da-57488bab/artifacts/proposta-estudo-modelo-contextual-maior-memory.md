# Estudo sobre modelo contextual maior para a memory

## Contexto

O pipeline atual separa responsabilidades:

- Xenova/multilingual-e5-small int8 gera embeddings e recupera candidatos.
- cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 O4 faz reranking textual.
- onnx-community/LFM2.5-350M-ONNX q4 interpreta consultas e sugere correcoes.
- LanceDB armazena vetores e oferece canais vetorial e lexical.
- O mARC consolida evidencias por thread e aplica elegibilidade.

A rodada reproduzivel de trinta consultas mostrou 90% de Top-1. Consultas diretas tiveram 100%, enquanto consultas implicitas tiveram 80%. Os erros restantes envolveram:

- incapacidade de recuperar uma necessidade implicita;
- priorizacao de passagens que mencionam termos sem representar a responsabilidade principal da thread;
- degradacao gramatical de uma consulta pelo interpretador.

O retriever encontra a maioria das threads. O principal problema observado e decidir qual candidato realmente responde a intencao.

## Pergunta do estudo

Um modelo local maior e mais capaz pode consolidar interpretacao, correcao e julgamento contextual, melhorando a busca sem comprometer uma maquina de referencia com 8 GB de RAM?

Tambem deve ser avaliado ate onde um unico modelo pode assumir tres papeis sem transformar responsabilidades distintas em um acoplamento fragil.

## Distincao arquitetural

Embedding, interpretacao e reranking nao sao automaticamente equivalentes.

### Embedding

- Precisa produzir vetores estaveis para todo o corpus.
- Uma troca exige rebuild completo.
- Deve ter custo previsivel durante indexacao e consulta.
- Um LLM generativo maior nao e automaticamente um retriever melhor.

### Interpretacao

- Pode corrigir typos.
- Pode preservar a consulta original.
- Pode sugerir uma alternativa sem substituir silenciosamente a intencao.
- Precisa obedecer um contrato estrito e evitar correcoes gramaticais destrutivas.

### Julgamento contextual

- Compara poucos candidatos ja recuperados.
- Deve distinguir assunto principal de mencao incidental.
- Pode selecionar somente IDs permitidos ou se abster.
- E o ponto em que raciocinio contextual adicional tem maior chance de melhorar a qualidade atual.

## Alternativas

### Modelo unico para todos os papeis

- Um checkpoint faria embedding, interpretacao e reranking.
- Reduz a quantidade aparente de modelos.
- Pode exigir heads, prompts ou interfaces diferentes.
- Aumenta risco de compromisso de qualidade e rebuild desnecessario.
- Deve ser considerado somente se o modelo tiver suporte profissional e comprovado para todas as tarefas.

### Manter E5 e usar modelo maior como interpretador e juiz

- Preserva o indice e o retriever atual.
- Usa o modelo maior somente depois da recuperacao.
- Permite corrigir consulta e julgar poucos candidatos.
- Limita RAM, tokens locais e latencia.
- Pode substituir o LFM atual e, se comprovado, parte do trabalho do mMARCO.

### Trocar apenas o retriever

- Exige rebuild completo.
- Pode melhorar consultas implicitas.
- Nao garante solucao para passagens incidentais.
- Deve ser estudado somente se for provado que a thread esperada nao entra nos candidatos.

### Trocar apenas o reranker

- Preserva embeddings.
- Pode melhorar ordenacao e proveniencia.
- Nao corrige consultas degradadas.
- Pode ser uma evolucao menor, mas mantem tres modelos separados.

## Hipotese principal

A melhor relacao entre qualidade e custo provavelmente esta em preservar o E5 e avaliar um modelo instrucional maior como interpretador e juiz final condicionado.

O modelo receberia:

- consulta original;
- eventual sugestao de correcao;
- ate poucos candidatos previamente recuperados;
- titulo, secao, passagem e referencia de cada candidato;
- uma lista fechada de IDs permitidos.

O modelo poderia:

- preservar ou sugerir a consulta corrigida;
- selecionar um candidato permitido;
- ordenar um conjunto pequeno;
- declarar abstencao.

Ele nao produziria pesos livres nem novos candidatos.

Esta e uma hipotese de estudo, nao uma decisao de implementacao.

## Experimento proposto

### Baseline

Preservar integralmente o pipeline atual e a geracao ativa como referencia reproduzivel.

### Perfil experimental

- Mesmo corpus.
- Mesmo indice E5.
- Mesmos candidatos LanceDB.
- Mesmo conjunto de consultas.
- Modelo maior atuando somente depois da recuperacao.
- Avaliacao entre tres e cinco candidatos.
- Saida estruturada com IDs permitidos ou abstencao.
- Processo isolado para medir RAM real.
- Cache em disco gerenciado e compativel com purge.

### Matriz de qualidade

1. Reexecutar as trinta consultas da rodada aleatoria.
2. Incluir as familias brutalism, toggle, toogle, seguranca e settings.
3. Incluir consultas negativas de dominios ausentes.
4. Medir Top-1, Top-3, abstencao e precision dos candidatos secundarios.
5. Comparar consulta automatica e literal.
6. Verificar se o juiz promove a thread responsavel acima de simples mencoes.
7. Verificar se consultas diretas que ja funcionam nao sofrem regressao.

### Matriz de recursos

- Tamanho de download.
- Espaco em disco apos preparo.
- RAM de pico.
- RAM residente durante TTL.
- Tempo de carga fria.
- Tempo de consulta aquecida.
- Tempo de descarregamento.
- Comportamento sem VRAM.
- Compatibilidade Windows, Linux e macOS.
- Disponibilidade ONNX e quantizacao adequada.
- Licenca e redistribuicao por download em runtime.

## Restricao de hardware

A referencia minima continua sendo uma maquina com 8 GB de RAM.

O experimento deve preferir carga sequencial:

1. Recuperar candidatos com E5.
2. Liberar ou permitir expirar workers que nao serao usados.
3. Carregar o juiz somente para poucos candidatos.
4. Manter TTL controlado.
5. Descarregar sem deixar memoria residente.

Um modelo entre aproximadamente 1B e 3B quantizado pode ser investigado, mas somente medicao real determinara viabilidade.

## Criterios de aceite

- Melhorar os casos implicitos e de proveniencia.
- Preservar os 10/10 casos diretos no Top-1.
- Preservar abstencao em consultas sem evidencia.
- Nao promover candidatos fora da lista fornecida.
- Nao substituir automaticamente a consulta por uma correcao destrutiva.
- Caber no perfil de 8 GB com margem operacional.
- Manter modelos fora do repositorio e baixados em runtime.
- Integrar-se por adapter, sem lock-in de provider.
- Ser removivel pelo purge quando nao estiver selecionado.
- Demonstrar ganho reproduzivel antes de substituir qualquer papel atual.

## Riscos

- Um modelo maior pode aumentar latencia sem melhorar ranking.
- Um juiz generativo pode aceitar todos os candidatos, como ocorreu no experimento anterior com LFM pequeno.
- Um modelo unico pode esconder responsabilidades diferentes atras de prompts frageis.
- Manter o modelo residente pode competir com IDE, daemon e agente pela RAM.
- Trocar o retriever cedo demais invalida a comparacao e exige rebuild.
- Avaliar apenas consultas conhecidas pode tendenciar o juiz.

## Nao objetivos

- Nao escolher um modelo definitivo sem benchmark.
- Nao remover o E5 antes de provar que o retriever e o gargalo.
- Nao embarcar pesos no repositorio.
- Nao adicionar avisos de produto ou fluxo de licenca nesta fase de estudo.
- Nao implementar selecao de modelos antes de comprovar valor.

## Evidencia de origem

A rodada completa e a arquitetura atual estao registradas em:

marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
