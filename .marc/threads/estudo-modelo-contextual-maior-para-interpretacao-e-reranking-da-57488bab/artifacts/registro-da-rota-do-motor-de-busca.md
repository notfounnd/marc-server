# Registro da rota do motor de busca

## Propósito

Este documento registra a rota aprovada pelo humano para o novo motor de busca da memory. Ele consolida:

- a análise arquitetural de marc://#msg_f03b5dbcb9da4264ab;
- a réplica do arquiteto Codex em marc://#msg_e54bf642b9944616a6;
- as decisões do humano tomadas depois disso.

Quando este documento diverge do artifact `analise-arquitetural-e-direcao-do-motor-de-busca.md`, **vale este documento**. A análise original continua válida como diagnóstico e contexto, com as correções listadas abaixo.

## Correções à análise original

| Ponto | Antes | Agora |
|---|---|---|
| Causa do platô | "O platô não está nos modelos" | A dependência da elegibilidade em relação aos candidatos foi demonstrada (estudo 2), mas não está provado que ela explique todo o platô nem todas as perdas de Top 1 do Qwen. A E0 mede quanto de cada perda vem de cada etapa |
| Incerteza | "Diferenças de ±2 casos ficam dentro do ruído" | Sem medição de incerteza não dá para distinguir ganho de ruído. Ausência de evidência de melhora não demonstra equivalência. A E0 entrega intervalos pareados |
| Tempos | "Cerca de 24 minutos por captura nos estudos 1 e 4" | Os 1.343 s do estudo 1 eram só de reranqueamento com o mMARCO. O ciclo de captura do estudo 4 durou cerca de 9h42min25s. O humano anotou 12h05m05s de atividade no estudo, um escopo diferente |
| Significado das faixas | "Um score de 0,8 corresponde a cerca de 80% de relevância" | O significado probabilístico das faixas é um critério a verificar em dados separados e no segundo corpus, não uma premissa |
| Acerto literal | Viraria uma feature com peso aprendido, podendo admitir resultados | A regra do humano é mantida: o acerto literal não admite resultado sozinho |
| Interpretação | Busca simultânea com a consulta original e a corrigida, removendo o LFM | Descartada por ferir a transparência. Ver a decisão D7 e a hipótese H3 |
| Calibração por projeto | Thread de origem como positivo e todas as outras como negativas | Outras threads podem ser relevantes, então rótulos incompletos precisam de mitigação e validação. Ver a hipótese H2 |

## Decisões do humano

As decisões abaixo são de produto ou de restrição e estão tomadas. A implementação de cada uma ainda passa pelos critérios de aceite da etapa correspondente.

- **D1. Rota:** o motor passa a ser separado em fontes → candidatos → features absolutas → score calibrado → faixas → apresentação. O primeiro passo é a E0.
- **D2. Contrato único para UI e MCP:** score calibrado, faixas (alta, média e baixa) e abstenção iguais nos dois.
  - A UI exibe alta e média, e a faixa baixa fica recolhida em "mostrar resultados menos prováveis".
  - O MCP devolve até 5 resultados com a faixa de cada um.
- **D3. Profundidade:** o botão Deep sai da UI. `depth` continua no core e no MCP e passa a significar camadas de corpus:
  - nível 0: `SUMMARY.md`;
  - nível 1: artifacts, `RULES.md` e documentos configurados;
  - nível 2: `CHAT.md`.
- **D4. Cobertura:** somente threads fechadas entram no índice, em qualquer camada.
- **D5. Documentos externos:** só entram por configuração explícita nas settings JSON do workspace. O padrão é vazio, os caminhos ficam presos à raiz do workspace, os documentos entram na camada 1 e a autoridade é declarada por fonte. ADRs e docs do mARC não viram fonte fixa do produto.
- **D6. Acerto literal:** a regra de marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba é mantida. O acerto literal só ajuda a ordenar e a subir de faixa uma thread que já tem proximidade semântica mínima. Sozinho, não faz nada aparecer.
- **D7. Interpretação transparente:** a etapa de interpretação permanece:
  - a consulta efetiva é sempre uma só e é exibida;
  - a correção aplicada é avisada;
  - a sugestão "você quis dizer…" é clicável e aparece também quando a consulta original tem resultados.
  - A busca simultânea com duas consultas está descartada.
- **D8. Modelos:** os modelos atuais continuam (E5-small, mMARCO MiniLM e, até prova em contrário, LFM 350M). O Qwen3-Reranker-0.6B está descartado neste momento por causa do tamanho (marc://#msg_c52a209d972f417794). Nenhum modelo maior entra no programa.
- **D9. Runtime:** a atualização do Transformers.js 4.3.1 é mantida, conforme a preparação de encerramento registrada em marc://#msg_30f607cc02dc4038ab e marc://#msg_1dd1bf19c56d4084b4.
- **D10. Governança técnica:**
  - O humano delega as escolhas técnicas aos aprovadores. Cada alternativa técnica vira hipótese com critério de aceite e caminho de recuo.
  - O humano só é consultado quando nenhuma alternativa cumprir o critério, ou em decisões de produto e autorizações.

## Hipóteses técnicas e critérios de aceite

Cada hipótese é verificada na base de avaliação da E0, com separação de treino e validação por família de thread e intervalos pareados. Se uma hipótese falhar, só aquela peça recua. O restante da rota segue.

### H1. Score calibrado no lugar da elegibilidade atual

- **Proposta:** features absolutas por par consulta/thread, combinadas por regressão logística com restrição de monotonicidade. Pesos versionados junto com o modelo de reranking.
- **Critério de aceite** (no conjunto de validação):
  - Top 1 não inferior ao M0;
  - melhora nos casos de admissão (por exemplo, 3P e 6I);
  - abstenção nos controles negativos não piora.
- **Restrição:** respeitar D6 por construção, com um piso semântico obrigatório para admissão.
- **Recuo:** manter a elegibilidade atual e usar só as correções de representação e de seleção de passagens.

### H2. Calibração da escala por projeto

- **Proposta:** consultas sintéticas tiradas do próprio corpus no rebuild, com ajuste monotônico apenas da escala e dos cortes. A amostragem tem semente fixa e o resultado é estado derivado em `.marc/memory`.
- **Mitigação de rótulos incompletos:** excluir dos negativos as threads que referenciam a de origem ou são muito semelhantes a ela, ou calibrar apenas a distribuição dos positivos. A E0 escolhe entre essas variantes.
- **Critério de aceite:** no mARC, as faixas obtidas com a calibração sintética precisam ser compatíveis com as obtidas com os rótulos reais da E0.
- **Recuo:** calibração padrão do pacote para todos os projetos.

### H3. Decisão da sugestão de correção

- **Alternativas,** todas com a mesma tela de D7:
  - **A:** o LFM decide, como hoje.
  - **B:** regra determinística (existe candidato → sugerir ou aplicar conforme a presença da grafia no corpus).
  - **C:** sugestão por evidência. A sugestão só aparece se a busca barata pelo candidato (denso + lexical, sem reranker) atingir a faixa alta. A correção é aplicada quando a grafia original não existe no corpus e os resultados da correção são bons.
- **Recomendação dos aprovadores:** C.
- **Critério de aceite:**
  - não sugerir menos que A nos typos reais;
  - sugerir menos indevidamente que A, considerando as 12 correções ruins do baseline e os casos 2I e 9P.
- **Recuo:** se C falhar, B. Se B falhar, A, mantendo o LFM. Se B ou C forem aceitas, o LFM sai do pacote (cerca de 297 MB).

### H4. Funil de latência

- **Proposta:** score barato para escolher de 15 a 20 threads finalistas, com reranqueamento de todas as passagens dos finalistas.
- **Critério de aceite:**
  - recall@K dos finalistas sem perda mensurável;
  - mediana ≤ 5 s e p95 ≤ 10 s por busca, em CPU, na máquina de referência do humano.
- **Recuo:** reranquear todas as passagens enquanto o corpus for pequeno.

### H5. Profundidade adaptativa por camadas

- **Critérios de aceite,** herdados de marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f:
  - Top 1 preservado ou melhor;
  - consultas implícitas sem perda de recall;
  - falsos positivos sem aumento;
  - expansão determinística e observável em diagnósticos.

### H6. Generalização para outros projetos

- **Proposta:** segundo corpus de validação, um projeto fictício em inglês com resumos e consultas gerados offline pelos agentes.
- **Critério de aceite:** as faixas mantêm o significado entre os dois corpora.
- **Recuo:** calibração separada por idioma, ou ajuste apenas dos cortes.

### Análise de causalidade exigida na E0

A E0 mede quanto de cada perda vem de cada etapa: recall de candidatos, seleção de passagens, ordenação e admissão. Inclui um teste de admissão perfeita, que mostra quanto o Top 1 subiria com um corte ideal. Essa medição responde à objeção 1 da réplica antes de qualquer mudança no motor.

## Mapa de threads

As threads rodam em sequência, com um desenvolvedor por vez.

| Etapa | Thread | Conteúdo |
|---|---|---|
| E0 | Nova | Base de avaliação, julgamentos graduados, segundo corpus, cache de features, harness offline, análise de causalidade e baseline do M0 com intervalos |
| E1 | Nova | Camada de fontes com origem por registro, correções de representação (`summaries.ts:234-243`) e configuração de documentos (D5) |
| E2 | Nova | Score calibrado e faixas (H1 e H2), contrato UI/MCP (D2) e decisão da sugestão (H3) |
| E3 | Nova | Profundidade em camadas (D3 e H5), retirada do Deep da UI e funil de latência (H4) |
| E4 | Reaproveitar marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae | `memory_deep` com escopo por `threadId` e tipo de fonte. O artifact original precisa ser atualizado antes: ainda cita `paraphrase-multilingual-MiniLM` e `minScore` |

E1 e E2 mudam índice e versionamento. A recomendação é um único rebuild completo para as duas.

**Threads abertas relacionadas:**

- **Esta thread:** pode ser encerrada depois deste registro, quando o humano autorizar.
- **marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f:** encerrar como superada. A pergunta foi respondida por D3, e os critérios dela foram herdados em H5.
- **marc://$oportunidade-grafo-de-evolucao-e-proveniencia-historica-do-proje-b84711a0:** continua aberta, fora do programa. A E1 produz a origem por registro de que ela vai precisar.

## Papéis

- **Aprovadores técnicos:** marc://@claude-software-architect e marc://@codex-software-architect, com veredito conjunto.
- **Desenvolvedor:** ainda a definir pelo humano, entre marc://@codex-dev e marc://@claude-dev. Por isso, cada plano de etapa precisa ser executável por qualquer um dos dois sem decisões de design em aberto: caminhos exatos e exclusões, passos ordenados, critérios de aceite, verificações exigidas e evidência esperada.
- **Humano:** aceitação do resultado integrado, autorizações e encerramento das threads.

## Próximos passos

1. O humano autoriza o encerramento desta thread e da `4f477d9f`.
2. Abrir a thread da E0 com o plano detalhado anexado antes de qualquer implementação.
