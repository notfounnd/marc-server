# Re-revisão independente do harness da E3 — Entrega 1b

## Veredito

**Pendente apenas dos aceites de regressão B4 e B6. As oito correções de código estão confirmadas.**

Não encontrei persistência dos defeitos funcionais B1 a B8 nas reproduções anteriores. Entretanto, dois testes novos podem passar sem exercitar a mudança que devem proteger. O ajuste pedido é restrito às fixtures e às asserções desses testes, sem redesenho do harness.

A decisão de DEPTH0 na revisão 6 corresponde ao voto já publicado: não inferioridade contra a baseline congelada, não identidade, incluindo explicitamente a divergência vetorial observada.

## Fontes e método

- Mensagens msg_edac8527d2954c50a2 e msg_515535cc44f84702ac.
- Entrega-1b-e3.md, plano revisão 6 e parecer anterior.
- Código atual no disco e os cinco arquivos test/memory-eval-t1d-*.test.ts.
- Inspeção por context-mode; 94 testes puros executados e typecheck do projeto sem emissão.
- Repetição dos casos anteriores em memória. Para o complemento, filesystem virtual com escrita atômica interceptada e um par textual realmente novo; nenhuma captura ou rebuild foi executado.

## Matriz dos oito aceites

| Item | Conferência independente | Situação |
|---|---|---|
| B1 | capture-plan.ts:57-62 chama interpretationRowsOf; :119-122 lê INTERPRETATION_LAYERS pelo store, como o core. Executei planCase com stores controlados: leu [0] e não ofereceu “toggle”, presente apenas na camada 1, como candidato de “toogle”. | Corrigido |
| B2 | capture-scope.ts:75-120 une scopeAt por depth, com catálogo filtrado pelas camadas permitidas. Na reprodução com 31 grupos novos na depth 2, a passagem oculta do finalista da depth 0 agora entra no escopo. | Corrigido |
| B3 | funnel-run.ts:201-208 e :246-277 usa catálogo para budget/all, mas canais e rerankingEvidence para consolidated. ALL_PASSAGES pediu A-hidden e A-visible; ALL_CANDIDATES identity-only pediu a identity e admitiu o grupo. O replay constrói catálogo completo e recusa versão E3 antiga sem compatibilidade silenciosa. | Corrigido |
| B4 | capture-complement.ts:111-151 reaproveita chaves textuais existentes e pontua cada texto novo uma vez; grava casos e agregado (:56-64). capture.ts:244 e :263-266 preserva complementRounds no resume. Prova com adições reais passou; a regressão persistente precisa ser reforçada. | Código corrigido; teste pendente |
| B5 | capture-gate.ts:14-33 soma matriz e production recall. capture.ts:184-185 usa gateCountsOf antes de scoreCase; capture-count compartilha a regra. A fronteira 507.167+120 pares recusa em 12,002816 h, como deve. | Corrigido |
| B6 | funnel-admission.ts:92-104 mantém as três passagens consolidadas do canal nos sinais, separadas da evidência e do score selecionados. Repeti P=3 contra P=12: ambas as eligibilities são 0,9720774262159271. O teste persistente não varia a seleção. | Código corrigido; teste pendente |
| B7 | funnel-run.ts:171-182 procura qualquer faixa alta. O teste path executa runFunnel com a configuração ADAPTIVE, médio primeiro e alto segundo: para na camada 0. | Corrigido |
| B8 | required-cells é compartilhado pela worksheet e pelas métricas; replay/evaluation propagam presentLayers e gradesByLayer. O caso G=1 no summary, artifact existente e não julgado, agora é incomplete com pendência explícita de G/camada 1. | Corrigido |

## Pendência B4 — O teste deve adicionar uma célula nova de verdade

**Local:** test/memory-eval-t1d-complement.test.ts:84-150.

O teste “a complement writes the cases back; a resume keeps…” verifica round, igualdade entre arquivo de caso e agregado, e preservação no resume. Não exige que o complemento tenha adicionado qualquer par ou chave.

A fixture usa três threads, e JUDGED acrescenta referências a @rules e ao chat de THREAD_SETTINGS. Ela não prepara um grupo/passagem fora do escopo inicial para exigir uma célula nova. Com K_max=30 e esse corpus pequeno, o teste pode preservar apenas o que já estava capturado. A igualdade dos arquivos e das rodadas não prova a preservação de uma célula recém-adicionada.

O segundo teste também não exige que a primeira complementação faça inferência: afterFirst pode ser zero, e as asserções continuam passando.

**Aceite pedido, mantendo o escopo original de B4:**

- preparar ao menos um par textual novo fora do conjunto inicialmente pontuado;
- confirmar sua ausência antes e presença após o complemento;
- exigir addedPairs > 0 e pontuação positiva na primeira complementação;
- conferir esse valor novo após o resume, além dos scores antigos, dos casos e dos rounds;
- a segunda complementação continua sem novas pontuações e sem reescrita do prefixo do log;
- manter também o cenário de dois IDs com o mesmo texto, reutilizando o valor já conhecido.

Não é pedido para executar uma captura real. A fixture pode usar provedores falsos ou um snapshot mínimo determinístico.

### Prova independente que passou

Com as funções reais do complemento e do armazenamento, em filesystem virtual:

- um registro antigo com score 0,1;
- um ID novo com o mesmo texto, que reaproveitou 0,1;
- um registro de texto realmente novo, que recebeu 0,9;
- addedPairs = 2, mas só um documento novo enviado ao reranker;
- chave textual antiga e score por ID antigo preservados em 0,1;
- leitura do caso e dos rounds pelos helpers usados no resume igual ao estado complementado;
- segunda complementação: addedPairs = 0; nenhuma chamada adicional; prefixo do log preservado.

Essa prova confirma a correção funcional. Não transforma a fixture persistente atual em regressão não vazia.

## Pendência B6 — O teste compara listas idênticas

**Local:** test/memory-eval-t1d-funnel.test.ts:161-237.

Executei a função desse teste com observação das entradas e saídas reais, sem alterar o arquivo:

- budget = 232;
- K = 12;
- P da depth explícita = floor(232/12) = 19;
- o catálogo tem apenas cinco passagens;
- FUNNEL_D0 selecionou pg-best, pg-second, pg-third, pg-fourth e pg-fifth;
- ALL_PASSAGES_D0 selecionou exatamente os mesmos cinco IDs.

Logo, o cenário não amplia a seleção. A implementação anterior, que calculava sinais a partir das passagens escolhidas, também pode produzir igualdade nessa comparação. O teste novo de igualdade com M0, no arquivo path, usa exatamente três passagens e não cobre essa variação de cardinalidade.

**Aceite pedido, mantendo o escopo original de B6:**

- escolher um cenário em que as duas variantes realmente selecionem quantidades/conjuntos diferentes;
- afirmar primeiro essa diferença de IDs ou cardinalidade;
- manter iguais os canais e o melhor score do reranker;
- usar ranks que fariam a concentração densa mudar na implementação defeituosa, por exemplo a passagem de três para doze com ranks acima de dez;
- então exigir sinais/eligibility iguais no código corrigido.

A reprodução independente P=3/P=12 já confirma que o código atual suporta esse aceite. Falta torná-lo uma regressão persistente que detecte a causa original.

## Testes novos e limites de execução

Li os cinco arquivos t1d:

- funnel: escopo por depth, catálogo e identity-only; o último cenário tem a lacuna B6 descrita acima;
- guards: leitura por camada, recusa da captura antiga e regra de parada;
- path: configuração ADAPTIVE realmente executada e comparação com M0;
- required: célula pendente, conclusão após julgamento, compatibilidade antiga e compartilhamento da regra;
- complement: ciclo de persistência e gate, com a lacuna de adição real descrita acima.

Observação de precisão: o teste path intitulado “the interpretation of planCase…” chama buildMemoryQueryCandidates com interpretationRowsOf, não planCase inteiro. Minha reprodução independente chamou planCase de fato. Isso não reabre B1, mas o relato não deve chamar aquele teste de execução completa de planCase.

Não executei o arquivo t1d-complement: seus testes invocam captura/rebuild em fixtures. Respeitei a proibição desta rodada e conferi o código e o comportamento com estado virtual. Os resultados 953/956 da entrega e da revisão do principal não são apresentados como execução minha.

## Plano revisão 6 e contagem futura

A seção 1, linha 73, e o histórico registram corretamente:

- extensão explícita do recuo de DEPTH0 à divergência vetorial, além do BM25;
- baseline 1b68a7e3f4e6 congelada;
- casos comuns pareados;
- Top1-alvo, recall implicit e abstenção correta, δ=0,05;
- bootstrap por família, inconclusivo reprovando;
- causa no lote como hipótese não isolada;
- nenhuma declaração de que os três vetores diferentes sejam desprezíveis.

A formulação histórica de identidade em trechos anteriores deve ser lida à luz dessa decisão posterior, não usada como um gate concorrente.

Concordo com refazer a contagem depois dos casos novos. A união por depth mudou o escopo; os 6,47 h antigos não autorizam automaticamente a captura futura. A versão e3-v2 e o novo fingerprint impedem tratar uma captura anterior como equivalente.

## Checks e preservação

- Typecheck do projeto sem emissão: passou.
- Onze arquivos de testes puros, incluindo os quatro t1d sem operações de captura: **94/94**, zero falhas, skips ou cancelamentos.
- Reproduções adicionais dos defeitos anteriores: passaram no código corrigido.
- Manifest antes/depois: SHA-256 b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a, sem alteração.
- Nenhum comando Git, rebuild, captura ou pnpm validate.
- Nenhuma alteração em código, testes, docs, datasets ou .marc/memory.
- Uma primeira tentativa de isolamento criou dois JSON auxiliares de teste por uma escrita atômica não interceptada. Os arquivos e diretórios foram removidos; a prova foi repetida com essa fronteira também virtualizada. Ausência do diretório auxiliar conferida.
- Sem delegação e sem encerramento da thread.

## Próximo passo

Reforçar apenas as regressões B4 e B6 e devolver esses cenários para conferência. Não solicito outra alteração de arquitetura, dos critérios estatísticos ou das oito correções funcionais já confirmadas.
