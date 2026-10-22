# Revisão independente final da E2

## Veredito

**Coaprovação pendente: um achado bloqueante (B1).**

A implementação preserva o motor produtivo e aplica a decisão coaprovada, mas o novo campo `abstained` pode declarar abstenção mesmo quando houve admissão. Os testes existentes passam e não cobrem essa fronteira. A aprovação técnica deve aguardar a correção e a verificação do estado integrado corrigido.

Esta revisão é independente da revisão de marc://@claude-software-architect. Não altera o plano, a decisão estatística, os julgamentos ou a implementação.

## Escopo e fontes

Leitura direta no disco, por context-mode:

- Plano E2 revisão 3, adendo H7/H8, decisão coaprovada, handoff da Fase C e revisão final integrada.
- Mensagens msg_aabc24de80f1474382, msg_c2bd5911ed084fb9bd e aceite D10 em msg_2beae3d36292411a9d.
- Código do core, scoring, contratos MCP/HTTP/CLI/UI, snapshots e apresentação das faixas.
- Harness de avaliação, testes de memória e memory-eval, documentação e ADR 0011.
- Capturas 1b68a7e3f4e6 e b72e80e00309, incluindo a latência, identidade dos provedores, fingerprint e comparação das saídas M0.

## B1 — Abstenção calculada depois do limite

**Critérios afetados: 2 e 4.**

Em `src/core/memory/operations.ts:249`, os hits admitidos são truncados por `.slice(0, limit)`. Na linha 256, `abstained` é calculado sobre essa lista já truncada.

O HTTP aceita qualquer número finito para o limite em `src/daemon/memory-routes.ts:182` e `:192-195`. A CLI também converte o argumento numérico sem exigir inteiro positivo. O MCP, em contraste, exige inteiro positivo em `src/mcp/memory-tools.ts:54`.

### Reprodução independente

Executei em memória os corpos reais de `operations.ts` e da rota HTTP, com dependências controladas: índice pronto e não vazio, lock obtido e ranker retornando exatamente um hit admitido. O teste não baixou modelos, não escreveu arquivos e não fez rebuild. A serialização e o tratamento do limite passaram pela rota HTTP real, servida em uma porta efêmera e encerrada pelo próprio handle.

| Entrada HTTP | Admitidos antes do limite | Retornados | HTTP | abstained |
|---|---:|---:|---:|---|
| limit = 5 | 1 | 1, com band medium | 200 | false |
| limit = 0 | 1 | 0 | 200 | true |
| limit = 0.5 | 1 | 0 | 200 | true |

O contrato aprovado define abstenção como busca executada **sem admissão**, não como resposta vazia por truncamento. Não se trata de alteração de ranking nem de discordância sobre as faixas heurísticas.

### Correção e aceite

Preservar a admissão, o score e a ordenação do M0. Separar a decisão de abstenção do truncamento ou rejeitar de forma consistente os limites não inteiros positivos nas entradas públicas. Em qualquer solução, documentar o domínio aceito e não devolver uma falsa abstenção.

Adicionar regressão persistente para:

- resposta HTTP positiva com `band` e `abstained: false`;
- limites zero e fracionário, com o comportamento válido escolhido;
- busca realmente sem admitidos, mantendo `abstained: true`;
- índice indisponível, vazio sem busca e lock ocupado, mantendo `abstained: false`.

O handoff já exigia a cobertura HTTP positiva. A suíte atual da rota verifica a resposta vazia, mas não esse caso positivo. A reprodução desta revisão não substitui o teste permanente da entrega.

## Critérios de aceite 1 a 8

| Critério | Avaliação independente |
|---|---|
| 1 — Decisões registradas com evidência | Confirmado. A decisão contempla H1, H2, H3, H6, H7 e H8. O aceite humano D10 permite as faixas heurísticas, sem convertê-las em probabilidade calibrada. |
| 2 — Implementação corresponde à decisão | Ordem, admissão, scores e cortes confirmados; **pendente por B1** no contrato de abstenção. Não entrou juiz, calibração por projeto nem troca do interpretador. |
| 3 — D6 testado | Confirmado pelos testes de admissão somente lexical em `test/memory-eval-calibrated.test.ts:99` e `test/core-memory-hybrid-ranking.test.ts:17`, executados na suíte independente. |
| 4 — Contrato e UI | Tipos, propagação de band/abstained, schema 6 e agrupamento da UI conferidos. **Pendente por B1** e pela regressão HTTP correspondente. A validação Playwright CLI consta da entrega; não foi repetida nesta revisão. |
| 5 — Critérios cumpridos ou recuos previstos | Recuos e decisão confirmados, sem reabrir critérios. A latência do núcleo fica em 1,001436 vez a base, abaixo de 1,2; ver a delimitação da medição abaixo. |
| 6 — Validação e regras | Typecheck e 739/739 testes passaram nesta revisão. ESLint sem escrita passou no conjunto focal de produção e testes. Validate/build da entrega são evidência dos executores, não execução nova deste avaliador. Ver limites de estilo abaixo. |
| 7 — Documentação | Atualizações de `docs/memory.md`, `docs/mcp-tools.md`, `docs/development.md` e ADR 0011 conferidas. O contrato documentado de abstenção é correto; a implementação precisa alcançá-lo. |
| 8 — Rebuild autorizado após aceite | Corretamente pendente de aceite e autorização humana. Não executei rebuild produtivo. O manifest permaneceu com o hash esperado. |

## Correspondência com a decisão e o handoff

- `semanticRecallHits` mantém `score = eligibility` e acrescenta a faixa depois do ranking.
- Cortes de produção conferidos: high = 0.9998832326558279, medium = 0.8958386806238463 e low = 0.029530510370742287.
- A apresentação mantém alta/média na lista principal e baixa em um `details` inicialmente fechado. Não exibe o score numérico como probabilidade.
- Snapshots exigem schema 6, faixa válida e booleano de abstenção; snapshots antigos são descartados.
- Os fluxos de busca continuam sobre resposta vazia tanto com abstenção quanto sem execução. Isso está declarado, não é uma nova adaptação silenciosa da profundidade.
- Os comandos antigos `memory:quality` e `memory:benchmark` foram retirados; `memory:eval` e o runner genérico `test:benchmark` permanecem.
- Não há adoção produtiva dos juízes estudados, de calibração por projeto ou de um interpretador novo.

Comparei o M0 das duas capturas: todos os deltas das métricas e a lista de casos alterados ficaram zerados. As duas têm 114 casos, 351 registros e os mesmos corpusDigest, queryFingerprint e provedores. O fingerprint recalculado para o código atual corresponde a b72e80e00309.

Na comparação M0 versus PRODUCTION_RECALL, as métricas da lista admitida permanecem iguais. A exceção 9I de sequência no diagnóstico e as diferenças estruturais de fullRecall/fullMrr não constituem regressão nova da E2.

## Latência: conferência e alcance

Recálculo direto de `latency.json`:

| Medida | Base 1b68a7e3f4e6 | Atual b72e80e00309 |
|---|---:|---:|
| Mediana | 18.167,3293 ms | 18.193,42295 ms |
| p95 | 19.930,1009 ms | 19.997,4194 ms |

São 114 casos com três amostras medidas por caso, totalizando 342. O warm-up é separado. Razão entre medianas: **1,0014362953**, abaixo do teto de **1,2**. A cópia `latency-m0-fase-b.json` é idêntica em bytes à base preservada.

**O1 — Precisar o alcance do termo “ponta a ponta”.** Em `scripts/memory-eval/capture-channels.ts:138-144`, a chamada cronometrada é `recallMemoryInWorkspace`, com store e provedores reais; não é o wrapper público `recallMemory`. Não inclui inicialização desse wrapper nem transporte HTTP/MCP ou navegador.

A comparação relativa é válida para o mesmo núcleo produtivo medido nas duas rodadas. Não a interpreto como medição do tempo completo da UI. O handoff cita nominalmente `recallMemory`; a revisão integrada deve explicitar essa diferença de alcance, em vez de alegar que todos os componentes externos foram medidos. Não solicito nova captura nem adaptação do harness nesta revisão.

A memória livre mínima registrada no JSON atual é 4.856.270.848 bytes, aproximadamente 4.631 MiB. A menção a 4.303 MB na revisão vem de amostragem relatada pelo desenvolvedor, não desse campo do JSON; não a apresento como reprodução independente.

## Limites e correções não bloqueantes

### O2 — Quantidade de entradas do manifest

A revisão e a entrega mencionam 31 entradas. O manifest efetivamente lido tem **60 registros**, com 60 threadIds distintos, mantendo o SHA-256 esperado:

`1540264d0d52643474c62104d58050de46324c92280adbe77214dd0724f2045d`.

Corrigir a contagem no relato consolidado. A preservação é confirmada pelo hash; o erro de contagem não demonstra alteração da base.

### O3 — Alcance da verificação de estilo

A inspeção AST encontrou a condicional aninhada em `scripts/memory-eval/cli.ts:461` e ramificações de cenário em `test/ui-memory-search-workflow.test.ts:158-159` e `:259`. A revisão integrada menciona apenas as duas primeiras expressões do teste.

Sem Git, esta revisão não atribui a introdução dessas ocorrências à E2 nem exige um refactor de legado como nova condição. O inventário e a afirmação de conformidade devem distinguir código novo verificado de ocorrências existentes; o teste da linha 259 também precisa constar dessa delimitação.

### Limites aceitos, sem novos bloqueios

- Faixas heurísticas não garantem precisão, probabilidade ou separação entre domínios. O aceite D10 foi explícito.
- Uma faixa inválida em resposta live ainda pode produzir rótulo vazio; o produtor tipado atual não gera esse valor. A validação de snapshot é mais estrita. Limite conhecido, não requisito novo para esta entrega.
- Os utilitários de features, documentos de juiz e consultas sintéticas ainda usados pelo harness permanecem em `src`, sem ativar modelos novos na produção.
- O relato de encerramento de processos por correspondência de comando inclui shells cuja propriedade não foi estabelecida. A correção posterior da orientação é necessária, mas não permite certificar retrospectivamente que nenhum trabalho externo foi afetado. Não encerrei processos alheios nesta revisão.

## Checks independentes e preservação

- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`: passou.
- `node --test --import tsx`, com os 125 arquivos de teste: **739 testes passaram**, zero falhas, cancelamentos ou skips.
- ESLint sem `--fix` em 16 arquivos focais do core, contratos, UI e testes: passou. Uma tentativa anterior do lint amplo excedeu o timeout; não é registrada como aprovação ampla.
- Reprodução HTTP controlada de B1: executada, com os três resultados da tabela.
- Recálculo de medianas, p95, razão e fingerprint: conferidos.
- Comparação de métricas e casos do M0 antigo/atual a partir das capturas existentes: sem deltas.
- Hashes antes/depois dos arquivos protegidos de src, test, scripts, docs, public, package.json, pnpm-lock.yaml e .marc/memory: sem alterações ou remoções durante os checks.

Não rodei Git, comandos de rebuild, `pnpm validate` ou nova captura/latência. Não alterei código, testes, docs, julgamentos, capturas ou .marc/memory. Os testes exercitaram seus próprios fixtures temporários; não houve rebuild produtivo. Não repeti build nem Playwright nesta revisão. A thread permanece aberta.

## Próximo passo

Corrigir B1 e adicionar a regressão, ajustar as ressalvas factuais do relatório e devolver o estado integrado para conferência. O aceite humano e a autorização do critério 8 continuam separados da aprovação técnica.
