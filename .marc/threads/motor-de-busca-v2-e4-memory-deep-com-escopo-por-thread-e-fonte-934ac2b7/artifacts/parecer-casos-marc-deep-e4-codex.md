# Parecer dos 14 casos marc-deep — E4

## Veredito

**Pendente apenas de ajustar a evidência de D03 e a redação de D12.**

Coaprovo os demais casos e a composição do protocolo. Não consultei resultados de busca ou de variantes para escolher casos ou sugerir alterações. Não atribuí graus às futuras células: a avaliação de relevância por passagem continuará independente na worksheet.

## Fontes e método

Li marc://msg_52977da9be4c4929b9, casos-marc-deep-e4.md, os 14 casos do dataset e as fontes Markdown das citações, com contexto. Conferi as passagens correspondentes pela leitura do store existente, sem inferência, reconstrução ou captura.

Executei evidenceMatchesOf em memória para cada citação. Comparei também os IDs do corpus com as pastas de threads com SUMMARY.md não vazio. Toda a inspeção e o processamento foram feitos via context-mode.

## Conferências estruturais

- Exatamente 14 casos, 4 sem threadId e 10 com threadId.
- As quatro consultas originais do plano estão preservadas literalmente.
- **18 de 18 citações** existem literalmente nos arquivos originais.
- **18 de 18** estão integralmente contidas em uma passagem já indexada, com passageId identificável.
- As citações dos casos scoped pertencem à thread escolhida e a um tipo de fonte permitido pelo filtro.
- O corpus tem **62 IDs únicos** e coincide com as 62 threads fechadas atuais: nenhum ID faltando ou excedente.
- Não rodei uma consulta de recall/deep nem usei sua posição, score ou sucesso previsto nesta revisão.

A conferência sobre o índice existente não substitui a verificação de evidência da futura captura: se as fontes/segmentação mudarem, ela precisa detectar essa diferença.

## Casos sem escopo

### D01 — Coaprovado

Consulta: por que a rotação de token não foi implementada?

A passagem do summary trata da capacidade limitada da API e da ausência de ameaça prática demonstrada no cenário local. A mensagem de conclusão no CHAT diz que não foi identificado valor para rotação automática e encerra a investigação sem desenvolvimento. No contexto integral, sustentam a justificativa histórica, e não apenas a existência de um token.

### D02 — Coaprovado, com amplitude registrada

Consulta: quais regras definem organização das informações na UI?

O artifact contém a regra do dono semântico e a organização Thread/Message/Artifact/SUMMARY. A passagem do outro summary descreve a separação de modos e a posição dos Marckers nas colunas. É evidência parcial substantiva de organização, embora não seja uma lista universal de regras.

Preservar a consulta original. Sua amplitude não autoriza considerar qualquer menção a UI como resposta; a worksheet continuará julgando a utilidade do trecho concreto.

### D03 — Ajustar a primeira evidência

Consulta: qual foi o raciocínio para indexar apenas summaries na memory v1?

A primeira citação atual comprova **qual foi a decisão**, não o raciocínio da escolha. A segunda explica a motivação da memory compartilhada, mas isoladamente não distingue o recorte em summaries de uma indexação de todas as fontes. O caso não deve transformar uma decisão de escopo em justificativa por inferência.

**Troca proposta, preservando a consulta e o número de casos:**

Substituir a primeira evidência, hoje no plano, pela seguinte frase literal do CHAT.md da mesma thread 0e4dbaac:

> Criar recuperação semântica e cronológica local sobre o histórico documentado, injetando no contexto do agente apenas evidências executivas relevantes à tarefa atual.

Fonte: threads/oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac/CHAT.md, mensagem de abertura, seção de objetivo.

Conferi que a frase é literal e cabe inteira na passagem .marc/threads/oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac/CHAT.md#35f55350464b3efc. A mesma passagem enumera reduzir leitura repetida e fundamentar decisões consolidadas. Isso fornece motivação substantiva para o recorte executivo, em vez de apenas repetir que ele foi adotado.

Manter a segunda evidência como contexto da memória compartilhada. Não afirmar que o registro contém uma comparação experimental entre summaries e todas as outras fontes: ele não contém. A relevância final dos trechos continuará sujeita à escala, sem pré-atribuir sucesso ao caso.

### D04 — Coaprovado

Consulta: quais regras operacionais dizem para preservar Markdown como fonte da verdade?

A RULES é uma fonte normativa direta; o summary de concorrência registra a aplicação dessa decisão e distingue Markdown de índices/locks derivados. A consulta não precisa ser estreitada a uma única thread.

## Casos scoped

| Caso | Parecer | Evidência e distinção |
|---|---|---|
| D05 | Coaprovado | Entregas identifica cursor_not_found e shouldReadFullThread:true; a resposta não é apenas uma descrição genérica de cursores. |
| D06 | Coaprovado | Resultado enumera as ferramentas livres naquele registro histórico de bootstrap. O escopo é a thread citada, não uma afirmação de que o catálogo atual ainda contém todas elas. |
| D07 | Coaprovado | Risco residual explica a ausência de transação multi-arquivo e o artifact órfão após interrupção. O filtro summary/artifact mantém a resposta. |
| D08 | Coaprovado | Decisoes distingue observar rebuilding de enfileirar outro rebuild. Outras partes da thread sobre locks não bastam por associação temática. |
| D09 | Coaprovado | Histórico da correção descreve EACCES em thread não relacionada quebrando consulta válida; artifact-only é respeitado. |
| D10 | Coaprovado | Resultado implementado explica unchanged antes da revisão e preservação de bytes/mtime, não só que existe update de summary. |
| D11 | Coaprovado | A mensagem do parecer explica a colisão entre passagens distintas que compartilham o intervalo da seção; chat-only mantém a evidência. |
| D12 | Ajustar a consulta | A evidência trata de preservar a geração correta do índice ao ler o manifest sob o lock, e não de uma corrida específica na escolha/download dos modelos. |
| D13 | Coaprovado | A seção de sobrevivência lista os seis casos perdidos no modo cosine e distingue perdas de passagem/grupo; artifact-only mantém essa evidência. |
| D14 | Coaprovado | Corpus e materialização enumera as fontes excluídas da ablação, em vez de apenas citar o estudo. |

### D12 — Troca proposta

De:

> qual corrida foi encontrada no purge dos modelos da memory?

Para:

> que problema de concorrência foi corrigido no purge da memory?

Manter a thread, a citação e os filtros atuais. A nova pergunta abrange a manutenção da memory, sem atribuir ao ciclo de vida dos modelos um defeito que o registro localiza no manifest/geração do índice. Não revela na própria pergunta a resposta sobre a posição do lock.

## Estratificação e filtros

Contagens verificadas nos records kind=passage, sem identity:

| Caso | Thread inteira | Depois de sourceTypes |
|---|---:|---:|
| D05 | 9 | 9 |
| D06 | 12 | 12 |
| D07 | 20 | 14 |
| D08 | 36 | 36 |
| D09 | 62 | 48 |
| D10 | 104 | 104 |
| D11 | 129 | 34 |
| D12 | 194 | 194 |
| D13 | 502 | 408 |
| D14 | 597 | 597 |

São três threads abaixo de 31 e quatro acima de 120. Esse último número é por **thread inteira**, conforme o plano; após o filtro de chat em D11, seu escopo tem 34 passagens. Não apresentar quatro escopos efetivos acima de 120: são três.

D13 e D14 continuam acima de B=232 **depois** de sourceTypes. O ramo truncado tem cobertura real sem precisar alterar o tamanho do dataset.

Os filtros variam entre ausência de restrição, um tipo e dois tipos. Todos são válidos; não removem a evidência declarada.

## Seções específicas e não trivialidade

Os sete casos D08–D14 têm fatos localizados em seções/mensagens específicas: decisão de concorrência, revisão de EACCES, idempotência de summary, identidade de passagem, corrida do purge, lista de perdas e fontes excluídas do estudo. Os escopos contêm outros tópicos e menções adjacentes; recuperar apenas a thread ou uma menção genérica não satisfaz as perguntas.

Não encontrei cópia de resposta na redação das consultas. Há termos temáticos em comum, como é natural em perguntas diretas, mas não são fornecidas as listas, os códigos de erro, o efeito do lock ou a decisão substantiva. D13 pede os casos sem enumerá-los; D14 não entrega a lista de fontes excluídas. Os casos mais simples D05/D06 são controles diretos úteis, não precisam ser artificialmente obscurecidos.

## Limites e próximos passos

Não editei datasets ou outros arquivos protegidos, não usei Git e não rodei rebuild, capture ou validate. Não foram produzidas notas nem expectativas de acerto do modelo.

Aplicar as duas trocas propostas e conferir a redação final antes da coaprovação para captura. Preservar os 14 casos, os escopos, o critério 12/14 e a estratificação. Nenhum resultado de modelo orientou os ajustes.

Thread mantida aberta.
