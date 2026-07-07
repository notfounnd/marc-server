# Oportunidade - memory_deep para aprofundamento em threads fechadas

## Contexto

A `memory` atual do mARC foi implementada como uma camada semântica local, compartilhável entre agentes, construída a partir dos `SUMMARY.md` de threads fechadas.

Decisões já estabelecidas nas threads anteriores:

- A v1 da memory indexa apenas `.marc/threads/*/SUMMARY.md`.
- `CHAT.md`, artifacts, docs e rules ficaram fora do corpus inicial.
- `.marc/memory` é uma snapshot derivada, commitável e reconstruível.
- Markdown continua sendo a fonte da verdade.
- O provider de embeddings nasceu atrás de uma interface/adaptador para evitar lock-in.
- A implementação concreta v1 usa provider local com Transformers.js e store LanceDB.
- O modelo local não é commitado; fica em cache local sob `.marc/cache/memory-models`.
- `memory_recall` orienta agentes a ler a thread original antes de reabrir ou contradizer decisões históricas.
- O tuning posterior manteve o corpus v1 inalterado e adicionou ranking híbrido local sobre os resultados.

Referências históricas principais:

- marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb

## Motivação

A `memory` atual funciona como bússola: ela ajuda o agente a descobrir rapidamente quais decisões históricas podem afetar uma solicitação atual.

A nova ideia é criar uma segunda camada, `memory_deep`, para aprofundamento. Ela não substituiria a `memory`; funcionaria como uma lupa depois que o agente já encontrou uma thread, tema ou decisão relevante.

Objetivo conceitual:

- `memory`: alta precisão sobre decisões consolidadas.
- `memory_deep`: aprofundamento contextual sobre o material fechado do mARC.

A motivação veio de dúvidas sobre o custo e a qualidade da memory:

- Build da memory local não consome tokens do agente online para gerar embeddings; consome CPU/RAM/disco locais.
- O agente online só consome tokens pela chamada da tool e pelo retorno textual que recebe.
- O modelo de embeddings atual pode influenciar a qualidade da base, mas a escolha atual é custo-benefício.
- O modelo atual é `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, com 384 dimensões, via Transformers.js local.
- O cache local observado do modelo estava em aproximadamente 465 MB.
- A hipótese é reaproveitar esse mesmo provider/modelo para `memory_deep`, separando índice e corpus, não o modelo.

## Escopo pretendido

`memory_deep` deve indexar apenas conhecimento do mARC, não o código nem documentação geral do projeto.

Corpus elegível:

- `.marc/RULES.md`
- `.marc/threads/*/SUMMARY.md`
- `.marc/threads/*/CHAT.md`
- `.marc/threads/*/artifacts/*.md`

Fora do escopo inicial:

- código-fonte do projeto;
- documentação fora de `.marc`;
- arquivos gerados de cache que não sejam fonte autoritativa;
- threads abertas;
- arquivos temporários ou não Markdown.

## Regra crítica: apenas threads fechadas

A regra de indexar apenas threads fechadas deve ser mantida também para `memory_deep`.

Motivo:

- Threads abertas contêm hipóteses, rascunhos, dúvidas e decisões ainda não estabilizadas.
- Indexar conversa em andamento faria o agente tratar material provisório como conhecimento histórico.
- Isso degradaria a confiabilidade da memory e poderia ressuscitar ideias descartadas.

Contrato proposto:

> Uma thread só é elegível para qualquer índice de memory quando possui `SUMMARY.md` e é considerada fechada. Conteúdo de thread aberta não deve entrar em `memory` nem em `memory_deep`.

Aplicação no `memory_deep`:

- só incluir `CHAT.md` de thread fechada;
- só incluir artifacts de thread fechada;
- só incluir summaries de thread fechada;
- se uma thread ainda não tem `SUMMARY.md`, ela não entra no índice;
- se uma thread for reaberta por remoção de `SUMMARY.md`, seus documentos devem sair do próximo rebuild.

## Relação entre memory e memory_deep

A relação ideal é em duas etapas:

1. O agente chama `memory_recall` para descobrir a decisão/thread relevante.
2. Se precisar aprofundar, chama `memory_deep_recall` com escopo guiado.

Exemplos:

- `memory_recall`: "isso já foi decidido?"
- `memory_deep_recall`: "quais mensagens e artifacts explicam por que essa decisão foi tomada?"

A `memory_deep` não deve ser consulta padrão inicial dos agentes. Ela tem maior recall, mas maior risco de ruído. Deve ser usada quando o agente precisa investigar detalhes, alternativas descartadas, argumentos, planos ou evidências.

## Reaproveitamento do modelo/provider

A recomendação inicial é reaproveitar o mesmo provider local de embeddings da memory atual.

Provider atual:

- `Xenova/paraphrase-multilingual-MiniLM-L12-v2`
- Transformers.js local
- 384 dimensões
- cache sob `.marc/cache/memory-models`

Vantagens de reaproveitar:

- não baixar outro modelo;
- não duplicar cache;
- manter custo local previsível;
- evitar incompatibilidade entre vetores de camadas;
- simplificar status, prepare e rebuild;
- preservar o adapter/provider como boundary real para futura troca.

O que muda não é o modelo, mas o corpus, o chunking e os metadados.

Outro modelo só deveria ser avaliado depois de benchmark real. A primeira versão de `memory_deep` deve medir qualidade com o provider atual antes de introduzir custo ou complexidade extra.

## Estrutura de índice sugerida

Manter snapshot separada da memory atual.

Opção sugerida:

- `.marc/memory/` para `SUMMARY.md` de threads fechadas.
- `.marc/memory-deep/` para corpus expandido de threads fechadas e regras.

Motivo:

- preservar a v1 de alta precisão;
- permitir rebuild independente;
- permitir status independente;
- evitar que o índice profundo altere contrato ou performance da memory atual;
- facilitar remoção/rebuild da camada profunda sem tocar na camada principal.

## Tipos de fonte sugeridos

Cada chunk de `memory_deep` deve carregar provenance explícita.

Campos sugeridos:

- `sourceType`: `summary | chat | artifact | rules`
- `threadId`, quando aplicável;
- `threadTitle`, quando aplicável;
- `closedAt`, quando aplicável;
- `messageId`, quando o chunk vier de mensagem;
- `agentId`, quando o chunk vier de mensagem;
- `messageRole`, quando o chunk vier de mensagem;
- `artifactPath`, quando o chunk vier de artifact;
- `artifactFileName`, quando o chunk vier de artifact;
- `sectionTitle`, quando detectável;
- `relativePath` para a fonte dentro de `.marc`;
- `lineStart` e `lineEnd`, se viável;
- `sha256` da fonte ou chunk;
- `text` do chunk;
- `recordId` estável.

Esse metadado é importante porque o agente precisa saber se está lendo:

- uma decisão consolidada;
- uma fala intermediária;
- um artifact de plano;
- uma regra operacional;
- uma evidência anexada.

## Autoridade e ranking por tipo de fonte

`memory_deep` deve reconhecer que nem todo conteúdo tem a mesma autoridade.

Prioridade conceitual:

1. `RULES.md`, quando a query for sobre comportamento, workflow, arquitetura ou regras operacionais.
2. `SUMMARY.md`, porque representa decisão consolidada de thread fechada.
3. Artifacts de plano, decisão, análise ou validação.
4. Mensagens finais ou próximas do encerramento.
5. `CHAT.md` bruto com peso menor, por conter conversa intermediária.

Importante: `memory_deep` pode recuperar uma mensagem antiga, mas não deve apresentá-la como decisão final se o `SUMMARY.md` contradiz ou supera aquela fala.

O retorno deve deixar clara a fonte e a autoridade do trecho.

## Chunking sugerido

`SUMMARY.md`:

- reaproveitar estratégia atual: summary completo + seções de segundo nível.

`RULES.md`:

- chunk por seções de regra;
- preservar blocos com Trigger, Do instead, Evidence e Severity;
- manter headings como contexto.

`CHAT.md`:

- chunk por mensagem;
- preservar metadata da mensagem;
- se a mensagem for longa, dividir por seções Markdown internas;
- manter vínculo com `messageId`.

`artifacts/*.md`:

- chunk por heading;
- se não houver heading, chunk por tamanho controlado;
- preservar vínculo com mensagem quando possível via metadata do `CHAT.md`;
- preservar path relativo do artifact.

## Fluxo de uso esperado

Fluxo padrão para agentes:

1. Chamar `memory_recall` com a intenção atual.
2. Ler a thread indicada quando houver match forte.
3. Se ainda faltar contexto, chamar `memory_deep_recall` com query e escopo.
4. Preferir escopo restrito quando possível.
5. Tratar resultados de `CHAT.md` como contexto histórico, não decisão final.
6. Consolidar resposta usando a thread/sources originais.

Exemplos de escopo:

- `threadId`: aprofundar apenas uma thread;
- `sourceType`: buscar apenas artifacts;
- `rulesOnly`: investigar regras operacionais;
- `limit`: limitar retorno;
- `minScore`: controlar ruído.

## Tools/CLI possíveis

Tools MCP sugeridas:

- `memory_deep_status`
- `memory_deep_rebuild`
- `memory_deep_recall`

Talvez também:

- `memory_deep_prepare`, se for necessário preparar explicitamente o provider; porém, idealmente o prepare pode ser compartilhado com a memory atual.

CLI equivalente:

- `marc memory-deep status`
- `marc memory-deep rebuild`
- `marc memory-deep recall --query <text>`

Ou, se preferir manter o agrupamento:

- `marc memory deep-status`
- `marc memory deep-rebuild`
- `marc memory deep-recall`

Decisão de nomenclatura deve ser tomada na implementação, considerando consistência com a CLI atual.

## Status e custo operacional

`memory_deep_status` não deve carregar o modelo, assim como `memory_status`.

Deve reportar:

- status geral: `ready | missing | stale | model_missing | incompatible`;
- quantidade de threads fechadas elegíveis;
- quantidade de sources por tipo;
- quantidade de chunks indexados;
- missing/stale/extra sources;
- provider usado;
- se o modelo local está preparado;
- mensagem operacional curta.

Custo esperado:

- não consome tokens para gerar embeddings se o provider for local;
- consome CPU/RAM/disco locais;
- pode ser mais lento que `memory_rebuild` atual;
- tende a crescer com o número e tamanho de artifacts e mensagens;
- deve ser considerado candidato forte para rebuild assíncrono/incremental.

## Rebuild

O rebuild deve preservar Markdown como fonte da verdade.

Regras:

- scanner lê fontes elegíveis em `.marc`;
- somente threads fechadas entram;
- snapshot é derivada e reconstruível;
- escrita deve usar mecanismos seguros/atômicos já existentes quando aplicável;
- o índice atual não deve ser corrompido se o rebuild falhar;
- o rebuild deve poder ser reexecutado a qualquer momento.

Possível evolução posterior:

- rebuild incremental por hash de fonte;
- background job como na indexação de threads;
- indicador visual separado para `memory_deep` se necessário.

## Recall

`memory_deep_recall` deve retornar poucos trechos, com provenance forte.

Campos de retorno sugeridos:

- `query`;
- `indexStatus`;
- `results`;
- `nextActions`.

Cada result deve conter:

- `sourceType`;
- `threadId` e `reference`, quando aplicável;
- `title` ou `threadTitle`;
- `summaryPath`, quando aplicável;
- `messageId`, quando aplicável;
- `artifactPath`, quando aplicável;
- `relativePath`;
- `matchedText`;
- `score`;
- `reason`;
- `authorityHint`, por exemplo `decision`, `rule`, `artifact`, `conversation`.

`nextActions` deve orientar leitura da fonte original:

- ler thread original;
- abrir artifact específico;
- revisar `RULES.md` quando fonte for regra;
- tratar mensagem de chat como contexto intermediário.

## Critérios de aceite

Uma primeira versão seria considerada boa se:

- reusar o provider local existente;
- criar snapshot separada de `.marc/memory`;
- indexar apenas threads fechadas;
- incluir `SUMMARY.md`, `CHAT.md`, artifacts e `RULES.md` dentro de `.marc`;
- preservar Markdown como fonte da verdade;
- expor status sem carregar o modelo;
- expor recall com provenance explícita;
- não alterar comportamento da `memory` atual;
- não indexar threads abertas;
- não indexar código nem docs fora de `.marc`;
- passar por validação completa do projeto.

Queries iniciais de avaliação:

1. `por que a rotação de token não foi implementada?`
   - Deve recuperar summary de token e mensagens/artifacts relevantes apenas se a thread estiver fechada.

2. `quais regras definem organização das informações na UI?`
   - Deve recuperar threads de UI, autocomplete, referências/artifacts e possivelmente artifacts relacionados.

3. `qual foi o raciocínio para indexar apenas summaries na memory v1?`
   - Deve recuperar a thread da v1 de memory e seus artifacts/mensagens relevantes.

4. `quais regras operacionais dizem para preservar Markdown como fonte da verdade?`
   - Deve recuperar `RULES.md` e threads relacionadas a Markdown SoT.

## Riscos

- Ruído maior que a memory atual.
- Mensagens intermediárias podem contradizer decisões finais.
- Rebuild pode ficar lento com muitos artifacts.
- Retornos muito longos podem consumir tokens do agente online.
- Se a autoridade da fonte não ficar clara, agentes podem tratar hipótese como decisão.

Mitigações:

- manter `memory_deep` como segunda camada;
- ranking por tipo de fonte;
- provenance explícita;
- limites de retorno baixos;
- exigir leitura da fonte original;
- manter threads abertas fora do índice;
- preservar `SUMMARY.md` como fonte mais autoritativa dentro de cada thread.

## Observação final

A metáfora útil é:

- `memory` é a bússola: aponta a decisão consolidada relevante.
- `memory_deep` é a lupa: aprofunda nos detalhes históricos de threads fechadas.

A lupa não deve ter mais autoridade que a bússola; ela deve explicar o caminho, não substituir a decisão consolidada.
