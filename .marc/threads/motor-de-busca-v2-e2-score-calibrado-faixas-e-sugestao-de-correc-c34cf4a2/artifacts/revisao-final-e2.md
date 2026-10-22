# Revisão final integrada da E2

## Resumo

Revisão independente de marc://@claude-software-architect sobre o estado integrado de todo o trabalho autorizado da E2: a Fase A (harness), a Fase B (captura, julgamento e decisão) e a Fase C (T2, T5, T6 e a medição de ponta a ponta).

**Veredito: aprovado na revisão técnica, depois da correção do B1, aguardando a coaprovação de marc://@codex-software-architect e a aceitação do humano.** O critério 8 (rebuild produtivo) só começa depois da aceitação, com autorização do humano.

A primeira versão desta revisão (msg_aabc24de80f1474382) foi invalidada pelo achado bloqueante B1 do parecer do Codex (msg_7cffb5f48beb448ba4). Esta versão revisa o estado integrado depois da correção. Ver "Re-revisão após o B1".

O que a E2 entrega à produção, conforme a decisão coaprovada e a consulta D10 aprovada pelo humano:

- a busca mantém a ordem e a admissão do M0 (recuo de H1);
- cada resultado ganha uma faixa heurística de confiança (alta, média ou baixa), calculada a partir da eligibility com os cortes de produção do recuo;
- o resultado ganha `abstained`, verdadeiro só quando a busca rodou e não admitiu nada;
- o contrato é o mesmo no core, no MCP, no HTTP, na CLI e na UI;
- não há juiz, calibração por projeto nem troca do interpretador.

## Escopo e fontes revisadas

- **Plano e contratos:** plano revisão 3 (plano-e2-score-calibrado-faixas-e-sugestao.md), adendo de H7 e H8, handoff-e2-correcoes.md, decisao-e2.md com a seção "Coaprovação", parecer-codex-decisao-e2.md e handoff-e2-fase-c.md.
- **Thread:** abertura da execução, entrega 1 (artifact entrega-1-fase-a.md), revisões do harness por marc://@codex-software-architect (msg_ec097746247f49a9a4, msg_5aff3ba583d24616ae e msg_23e48a49642b41268c), critério de custo coaprovado (msg_88d8e478f40a49e19d), consenso dos julgamentos (msg_bae9ae91de3347019f), proposta de decisão (msg_155b5ce737b54867a4), parecer do Codex (msg_18507202fa664195bb), decisão fechada (msg_2beae3d36292411a9d), entrega 2 de marc://@claude-dev (msg_c2bd5911ed084fb9bd) e parecer do Codex sobre a revisão final (msg_7cffb5f48beb448ba4, artifact revisao-independente-final-e2-codex.md).
- **Código integrado:** lido diretamente no disco, com context-mode e leitura de arquivos, sem Git. Arquivos centrais: `src/core/memory/scoring/bands.ts`, `types.ts`, `semantic-ranking.ts`, `operations.ts`, `recall-support.ts`, `src/mcp/memory-tools.ts`, `src/cli.ts`, `src/ui/types.ts`, `src/ui/memory-search.ts`, `src/ui/memory-search-panel.tsx`, a tradução `en_US`, os testes novos e alterados, os docs e o ADR 0011.
- **Evidência da medição:** `.marc/cache/memory-eval/marc/b72e80e00309/` (capture.json, latency.json, replay) e a cópia da base `1b68a7e3f4e6/latency-m0-fase-b.json`.

## Configuração e processo

- **Desenvolvedor:** perfil compartilhado claude-dev, com Haiku 5.5 em xhigh, confirmado pelo humano em 19/10. Modo sequencial, com um desenvolvedor.
- **Bootstrap e autorização:** o desenvolvedor devolveu o próprio `OK_BOOTSTRAP` antes da primeira edição. Cada tarefa e cada correção foram autorizadas pelo canal entre agentes.
- **Entregas do desenvolvedor:** entrega 1 (Fase A) e entrega 2 (msg_c2bd5911ed084fb9bd), as duas publicadas pelo próprio perfil claude-dev. Conferi a autoria e o conteúdo da entrega 2 contra a evidência. Os números de latência foram recalculados por mim a partir do latency.json e batem.
- **Segundo aprovador:** marc://@codex-software-architect revisou o harness antes da captura, a adjudicação dos julgamentos e a decisão.
- **Incidente de processo, registrado também na entrega 2:** durante a T5, o desenvolvedor encerrou processos pelo texto da linha de comando, em vez de encerrar só os PIDs que ele tinha iniciado.
  - node 32512 e 20412 eram o daemon de teste da porta 4291.
  - sh 22732, bash 35216, 31984 e 31600 e powershell 25096 têm origem incerta.
  - O daemon real, na porta 4187, continuou no ar.
  - Depois disso, a regra passou a ser encerrar só os PIDs iniciados pelo próprio agente. Na captura e na latência, nenhum processo foi encerrado.

## Critérios de aceite da etapa

| # | Critério | Evidência verificada | Situação |
|---|---|---|---|
| 1 | Decisões de H1, H2, H3, H6, H7 e H8 registradas com a evidência do harness | decisao-e2.md (critérios, números e coaprovação), msg_155b5ce737b54867a4, msg_18507202fa664195bb e msg_2beae3d36292411a9d. Consulta D10 aprovada pelo humano | Cumprido |
| 2 | A implementação corresponde exatamente à alternativa decidida | Ver "Implementação contra a decisão" e "Re-revisão após o B1" | Cumprido depois do B1 |
| 3 | Propriedade de D6 coberta por teste | `test/memory-eval-calibrated.test.ts:99` (evidência lexical sozinha nunca admite) e `test/core-memory-hybrid-ranking.test.ts:17` (a admissão de produção, sem mudança, nunca admite candidato só lexical) | Cumprido |
| 4 | Contrato igual na UI e no MCP; UI validada com Playwright CLI | Ver "Contrato único" e "Re-revisão após o B1" | Cumprido depois do B1, com dois limites |
| 5 | Critérios da tabela cumpridos ou recuados conforme previsto | Ver "Critérios de avaliação" | Cumprido |
| 6 | `pnpm validate`, `pnpm build` e `pnpm test` passam; regras de estilo e teste respeitadas | Ver "Validação" | Cumprido |
| 7 | `docs/memory.md`, `docs/mcp-tools.md` e o ADR atualizados | `docs/memory.md`, `docs/mcp-tools.md` e `docs/development.md` atualizados. `docs/adrs/0011-memory-confidence-bands.md` criado, com link em `docs/adrs/README.md:19` | Cumprido |
| 8 | Depois da aceitação, um único rebuild produtivo autorizado pelo humano, e `memory_status` volta a `ready` | Ainda não se aplica. `.marc/memory/manifest.json` continua com o sha256 `1540264d0d52643474c62104d58050de46324c92280adbe77214dd0724f2045d` e 60 registros. A pasta `.marc/memory` tem 31 entradas. Conferido depois da captura, da latência e da correção do B1 | Pendente da aceitação |

## Implementação contra a decisão

- **Recuo de H1.**
  - O `score` continua sendo a eligibility do M0.
  - `semantic-eligibility.ts`, `semantic-ranking.ts` e `hybrid-ranking.ts` permanecem. A lista de remoção da correção 16 não se aplica.
  - A faixa é atribuída em `semantic-ranking.ts:103` com `memoryBandOf(hit.eligibility)`.
- **Cortes de produção.** Os três valores de `MEMORY_BAND_CUTS` em `scoring/bands.ts` são idênticos aos de `production.fallbackCuts` no fit.json da captura 1b68a7e3f4e6. `memoryBandOf` percorre uma tabela em ordem decrescente e devolve o primeiro corte atingido, sem `else` nem `if` aninhado.
- **H2 reprovada.** Não existe `scoring/calibration.ts`, a T3 não foi executada e não há arquivo de calibração em `.marc/memory/`.
- **H7 reprovada.** Não há juiz em produção. `inference-*`, `model-config.ts` e `maintenance.ts` não foram tocados.
- **H3 e H8: a alternativa A fica.** O interpretador LFM continua, e `query-interpretation*` não foi tocado. `pnpm-lock.yaml` está intacto.
- **ADR com nome diferente do plano.** O ADR saiu como `0011-memory-confidence-bands.md`, e não `0011-calibrated-memory-score.md`, porque o score calibrado foi reprovado. A mudança estava prevista no handoff da Fase C.

## Contrato único (D2)

- **Core.**
  - `MemoryBand` e `MemoryRecallHit.band` estão em `types.ts:198` e `:223`, e `MemoryRecallResult.abstained` em `:207`.
  - No caminho em que a busca roda, a lista admitida deduplicada é guardada em `admitted` (`operations.ts:237`). A resposta usa `admitted.slice(0, limit)` (`:250`), e `abstained` é calculado como `admitted.length === 0` (`:257`), antes do corte. Isso corrige o B1.
  - O único construtor de resultado vazio, `emptyMemoryRecallResult` (`recall-support.ts:35`), usa `false`. Ele cobre os caminhos sem busca: índice indisponível, operação concorrente e manifest sem registros.
- **MCP.** `memory_recall` devolve o resultado do core. A descrição (`memory-tools.ts:50`) explica a faixa como ordem relativa e diz que ela não é probabilidade. O `limit` padrão continua 5 (`operations.ts:40`), com teste em `test/core-memory-recall.test.ts:106`.
- **HTTP e CLI.**
  - A rota HTTP devolve o resultado do core. A CLI imprime o resultado em JSON (`cli.ts:80`), então `band` e `abstained` aparecem sem código novo.
  - O domínio de `limit` não mudou: o HTTP aceita qualquer número finito, a CLI converte o argumento e o MCP exige inteiro positivo. Com o B1 corrigido, um `limit` que esvazia a resposta não gera abstenção falsa. Os docs dizem que `abstained` reflete a admissão e não depende de `limit` (`docs/memory.md:204`, `docs/mcp-tools.md:101`).
- **UI.**
  - Os tipos duplicados ganharam `band` e `abstained` (`src/ui/types.ts`).
  - `MEMORY_SEARCH_SCHEMA_VERSION` subiu de 5 para 6.
  - A validação do estado guardado rejeita faixas inválidas.
  - Alta e média aparecem na lista principal, e a baixa fica num `<details>` com o rótulo "Show less likely results". O painel não mostra o score.
  - Com `abstained`, a busca continua para a próxima profundidade, coberto por `test/ui-memory-search-workflow.test.ts:179`.
- **Playwright CLI**, com interceptação do recall:
  - as três faixas aparecem;
  - o bloco recolhido abre e fecha;
  - o score não aparece;
  - uma busca com `abstained` percorre as profundidades de 0 a 3 e termina em "No results";
  - o console fica sem erros.

**Limites aceitos:**

- Uma faixa inválida numa resposta ao vivo aparece com rótulo vazio. A UI confia na resposta do daemon local e só valida o estado guardado.
- Os testes HTTP com recall injetado não enviam `depth`, porque o tipo de `depth` do core é mais estreito que o da entrada da rota. Em produção, a rota repassa a entrada completa ao `recallMemory` real, como antes.

O limite da primeira versão, "teste da rota HTTP sem `band` nos resultados", foi fechado pela correção do B1 (ver "Re-revisão após o B1").

## Critérios de avaliação

| Hipótese | Resultado | Desfecho previsto e aplicado |
|---|---|---|
| H1 | Top1-alvo −0,010, inconclusivo, logo reprova. O alvo de 3P não foi admitido | Recuo: ordem e admissão do M0, faixa pela eligibility |
| H2 | N1 e N2 ultrapassam 0,10 de diferença e ficam abaixo de 80% na mesma faixa (46,6% e 14,0%) | Calibração padrão |
| H6 | Reprovada nos dois ramos, inclusive no ajuste de cortes por corpus | Limite declarado e consulta D10. O humano aprovou as faixas como indicador heurístico, sem promessa de precisão |
| H7 | Os dois juízes reprovam (Top1-alvo inconclusivo e precisão sem melhora) | Sem juiz |
| H3 e H8 | Nenhuma alternativa supera A no critério (soma de erros de A = 132; C = 21, mas com menos acertos) | Fica a A |
| Latência | Mediana 18.193,4 ms contra 18.167,3 ms do M0: razão 1,0014, abaixo do limite de 1,2 (21.800,8 ms) | Cumprido, com o rótulo "medido" |

**Detalhe da medição**, conferido no latency.json da captura b72e80e00309:

- **Alcance:** a chamada cronometrada é `recallMemoryInWorkspace`, o núcleo da busca. Não inclui o wrapper público nem os transportes HTTP e MCP;
- 114 casos, com 3 amostras cronometradas cada (342 no total) e 1 aquecimento por caso;
- p95 de 19.997,4 ms; mínimo de 11.867,4 ms; máximo de 21.736,7 ms;
- memória livre mínima por caso de 4.631 MB, e mínima amostrada de 4.303 MB, segundo o desenvolvedor;
- a base do M0 está preservada, com `latency-m0-fase-b.json` byte a byte igual ao latency.json original (sha256 467895f8…);
- a captura foi refeita porque a T2 mudou o código de `src/core/memory`, que entra no fingerprint. O captureId passou de 1b68a7e3f4e6 para b72e80e00309;
- a equivalência do replay falhou só no caso 9I, uma troca de duas threads adjacentes de grau 1, já registrada na decisão. A diferença nas métricas é zero;
- a correção do B1 tocou `operations.ts`, então o captureId derivado do código atual passou a 5bd43e2180bb. A captura não foi refeita. A mudança vem depois do ranking: só guarda a lista antes do corte e lê o tamanho dela, com custo constante. Ranking, admissão, ordem e score não mudaram, como mostram os testes de núcleo e de HTTP. A latência medida em b72e80e00309 continua valendo para essa cadeia.

## Validação

- **Desenvolvedor, na entrega 2:**
  - `pnpm validate` com exit 0 e nenhum arquivo alterado (454 hashes comparados);
  - `pnpm build` com exit 0;
  - `pnpm test` com 739 de 739.
- **Principal, na primeira versão:** `pnpm build` com exit 0 e `pnpm test` com 739 de 739.
- **Desenvolvedor, depois do B1:** `pnpm validate` com exit 0, sem alterar arquivos (454 hashes comparados); `pnpm build` com exit 0; `pnpm test` com 744 de 744.
- **Principal, depois do B1:** `pnpm build` e `pnpm test` reexecutados no estado corrigido. Resultado: build com exit 0 e testes com 744 de 744 (0 falhas, 0 pulados, 0 cancelados). Por data de modificação, os arquivos alterados depois do início da captura são exatamente os oito listados abaixo.
- **Mudanças depois da captura:** só os arquivos da correção do B1. São eles `src/core/memory/operations.ts`, `src/daemon/server.ts`, `src/daemon/routes.ts`, `src/daemon/memory-routes.ts`, `test/core-memory-recall-abstained.test.ts`, `test/daemon-memory-search.test.ts`, `docs/memory.md` e `docs/mcp-tools.md`.
- **Estilo.**
  - Zero `else` nos 16 arquivos de produção tocados pela E2: os 13 da primeira versão, mais `server.ts`, `routes.ts` e `memory-routes.ts` do daemon.
  - Os testes novos e alterados não têm `if`, `else`, `switch` nem ternário.
  - Os dois ternários em `test/ui-memory-search-workflow.test.ts:158-159` são de um teste anterior à E2, fora do escopo.
- **Escopo.** As remoções da T6 conferem com o handoff. `test:benchmark` foi mantido, porque é o executor genérico de `performance/` (ajuste aceito na revisão do Codex). `dataset.ts:41` e os rótulos de origem "memory-quality-v4" em marc.json são dados e ficaram.

## Re-revisão após o B1

**Achado (Codex, msg_7cffb5f48beb448ba4).** `abstained` era calculado depois de `.slice(0, limit)`. Pelo HTTP ou pela CLI, com `limit` 0 ou 0,5, uma busca que tinha admitido threads respondia lista vazia com `abstained: true`. Confirmei o achado no código. Ele afetava os critérios 2 e 4.

**Correção decidida.** Calcular a abstenção sobre a lista admitida, antes do corte. Ranking, admissão, score, faixas, ordem, `nextActions` e o domínio de `limit` ficam como estavam. Rejeitar os limites no HTTP e na CLI foi descartado: mudaria o que essas entradas aceitam e trataria o sintoma em dois lugares, em vez da causa no núcleo.

**Implementação revisada:**

- **Núcleo:** `operations.ts:237`, `:250` e `:257`, como descrito em "Contrato único".
- **Costura do teste HTTP:**
  - `createDaemonServer(config, dependencies = DEFAULT_DAEMON_DEPENDENCIES)` ganhou um segundo parâmetro opcional, com o tipo exportado `DaemonServerDependencies` (`src/daemon/server.ts:27-38`).
  - O padrão de produção é o `recallMemory` real. `RouteContext.memoryRecall` vem de `routes.ts:36`, e `postWorkspaceMemoryRecall` chama `context.memoryRecall` (`memory-routes.ts:71`).
  - O parse de `limit`, a validação e a serialização não mudaram. `DaemonConfig` e `core/types.ts` não foram tocados: configuração não carrega comportamento. Nenhum chamador de produção passa dependências.
- **Testes novos:**
  - `test/core-memory-recall-abstained.test.ts:163`: com um hit admitido, `limit` 0 e 0,5 dão lista vazia e `abstained` falso, e `limit` 5 dá um resultado com faixa e `abstained` falso.
  - `test/daemon-memory-search.test.ts:208` e `:221`: pela rota HTTP real, sobre um workspace temporário com provedores falsos e sem mock de módulo, a resposta positiva traz `band` e `abstained` falso, e `limit` 0 dá lista vazia com `abstained` falso.
  - Os casos anteriores continuam: abstenção real verdadeira; índice indisponível, manifest vazio e lock ocupado falsos.
- **Estilo:** sem `else`, sem `if` aninhado e testes declarativos. O `try/finally` do helper HTTP só fecha o servidor e não escolhe cenário.

## Achados e limites

- **Nenhum achado bloqueante em aberto.** O B1 foi corrigido e revisado.
- **Mudança observável:** quem chamava o HTTP com `limit` 0 recebia `abstained: true` e agora recebe `false` quando há admitidos. É o contrato pretendido.
- **Precisão das faixas** (limite registrado no ADR 0011 e aprovado na D10):
  - no marc, por bloco exclusivo, a faixa alta acerta 0,88, a média 0,41 e a baixa 0,20. A média fica abaixo da meta de 0,60;
  - no ledgerline-en, as três faixas acertam 1,0, ou seja, não há separação.
  - A faixa ordena a confiança, mas não promete acerto.
- **Faixa baixa limitada pela admissão.** O corte baixo (0,0295) fica abaixo do limiar de admissão do M0 (0,5). Toda thread admitida abaixo do corte médio cai na faixa baixa.
- **Módulos do harness em `src/core/memory/scoring/`.**
  - `features.ts`, `judge-document.ts` e `synthetic-queries.ts` só são importados pelo harness e pelos testes.
  - Ficam ali porque o plano os pôs como contrato compartilhado, e porque movê-los mudaria o fingerprint da captura sem ganho.
  - Recomendação: a E3, que trata o funil, decide se os reutiliza em produção ou os move para `scripts/memory-eval/`.
- **Dois limites de cobertura do contrato:** ver "Contrato único".
- **Incidente de processos:** ver "Configuração e processo". Sem dano conhecido, com regra corrigida.

## Próximos passos

1. Coaprovação de marc://@codex-software-architect sobre esta revisão.
2. Aceitação do humano.
3. Com autorização do humano, um único rebuild produtivo (critério 8), seguido da conferência de `memory_status` em `ready`.
4. A thread só é encerrada com autorização explícita do humano. Commit, só se o humano pedir.
