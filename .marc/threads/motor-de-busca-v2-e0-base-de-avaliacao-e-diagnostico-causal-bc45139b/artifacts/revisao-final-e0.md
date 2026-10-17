# Revisão final integrada da E0

## Resumo

Revisão independente do estado integrado de toda a E0, de T1 a T7, feita por marc://@claude-software-architect depois da última mudança autorizada. A entrega do desenvolvedor é a msg_f044e6610f5b4da788, de marc://@claude-dev, que executou como subagente do Claude Code com Haiku 5.5 e reasoning xhigh, configuração confirmada pelo humano.

**Veredito: aprovado na revisão técnica, aguardando a aceitação do humano.** Os oito critérios de aceite estão atendidos. O coaprovador concordou, e as duas ressalvas dele foram corrigidas e verificadas. O CA1b tem um desvio, o caso 9I, aceito pela condição de impacto da revisão 7, e essa condição foi cumprida. A aprovação técnica não substitui a aceitação do humano, e a thread continua aberta.

## Escopo e fontes revisadas

- O plano, na revisão 8: plano-e0-base-de-avaliacao-e-diagnostico-causal.md.
- A entrega 1 (msg_50f79445e0164eb8a2) e a entrega 2 (msg_f044e6610f5b4da788).
- O registro do consenso: consenso-julgamentos-e0.md (msg_c9ebd42d9a9a42d098).
- Os relatórios report-e0-marc.md e report-e0-ledgerline-en.md, comparados com o report.json de cada captura.
- O código de scripts/memory-eval/, principalmente cli.ts, metrics.ts, attribution.ts, variants.ts, capture.ts, capture-channels.ts, latency.ts e report.ts.
- A subsecção "Evaluation harness (memory:eval)" de docs/memory.md.
- O estado do repositório, conferido com Git só em leitura, que o humano autorizou: git status e git diff, sem nenhum commit nem stage.

## Critérios de aceite

| Critério | Resultado | Evidência verificada pelo principal |
| --- | --- | --- |
| CA1a, exatidão do caminho | Atendido | Verificação com o reranker vivo no layout de produção, fora do harness: 40 de 40 casos no ledgerline-en e 114 de 114 no marc, com todas as sequências iguais e delta máximo de 0 (o limite é 1e-9). Detalhes na seção "Evidência própria". |
| CA1b, fidelidade da matriz | Atendido com desvio aceito | 40 de 40 no ledgerline-en e 113 de 114 no marc. O caso 9I inverte as posições 9 e 10, ocupadas por duas threads de grau 1 (aa4908aa e c147b8bb). Condição de impacto: as nove métricas da lista admitida são idênticas entre M0 e PRODUCTION_RECALL nos dois corpora. As diferenças em fullRecall10 e fullMrr10 são estruturais, porque PRODUCTION_RECALL só tem a lista admitida (variants.ts:85-90) e o M0 mede o top-10 da lista completa. |
| CA2, offline | Atendido | test/memory-eval-replay-isolation.test.ts: o replay e as variantes não importam nenhum provedor local, e um score ausente no cache interrompe o replay em vez de carregar um modelo. |
| CA3, dataset | Atendido | O validate passa nos dois datasets. O marc.json tem 114 casos (52 migrados mais 62 de A1) e o ledgerline-en.json tem 40. |
| CA4, julgamentos | Atendido | M0, D0 e ORACLE_ADMISSION completos nos dois corpora, com 0 pares pendentes. Kappa da primeira rodada: 0,683 no ledgerline-en e 0,395 no marc, com a flag kappa_below_threshold. Divergências: 75 e 482, todas adjudicadas. |
| CA5, relatório completo | Atendido, depois da correção 4 | Os dois report.md trazem tudo o que a seção 9 pede: identificação com os modelos e as versões, equivalência, métricas por variante com intervalo e McNemar contra M0, atribuição e Top1 da admissão perfeita, interpretação, latência, kappa, folds e tamanho do corpus. O McNemar do Top1-alvo de ORACLE_ADMISSION contra M0 é 0/27 com p = 1,49e-8 no marc e 0/2 com p = 0,5 no ledgerline-en. |
| CA6, produção intacta | Atendido | Nenhum arquivo de src/ alterado ou novo. O hash do manifest de produção, 123a7720…ba0d7, é o mesmo antes e depois da T7. As mudanças rastreadas são package.json (só o script memory:eval), docs/memory.md (só a subsecção nova) e os registros das threads do programa. As novas são scripts/memory-eval/, os testes test/memory-eval-* e test/fixtures/memory-eval/. |
| CA7, validação | Atendido | No estado final, o desenvolvedor rodou: pnpm validate com exit 0, que só reformatou o teste novo, dentro do escopo; pnpm build com exit 0; e pnpm test com 410 de 410. O principal repetiu a suíte do harness (109 de 109) e o typecheck, sem erros. O código novo de report.ts não tem else nem if aninhado (mcnemarCell usa early return), e o teste novo é declarativo, sem ramificação. |
| CA8, documentação | Atendido, depois das correções 1 a 3 | A subsecção "Evaluation harness (memory:eval)" de docs/memory.md descreve: os comandos na ordem real, as saídas de cada um, os corpora, a agregação, o vocabulário de decisão (termos, margens, bootstrap e a coluna Non-inferior), a atribuição, a equivalência, a condição da latência, os julgamentos e o baseline datado. O texto anterior sobre memory:quality e memory:benchmark continua igual. |

## Evidência própria do principal

- **CA1a:** um script no scratchpad passou o reranker vivo, no layout da chamada de produção, pelo caminho real do replay, e comparou o resultado com a elegibilidade de produção capturada. Os dois corpora deram allSequencesMatch true, nenhum caso acima de 1e-9 e worstDelta 0, com uma chamada viva por caso.
- **Latência:** a busca de produção no índice real, com os modelos carregados uma vez, confirma o harness. A consulta "brutalism" levou cerca de 12,0 s, contra 11,7 s no caso Q03. O caso 1D levou de 19 a 20 s, contra 21,5 s. O modo auto acrescenta só de 0,3 a 1,5 s em relação ao literal, então o custo está na recuperação e no reranking. O aquecimento e as amostras do latency.json têm medianas iguais (18.108 e 18.187 ms no marc), sem efeito de cache entre as repetições.
- **Manifest:** o hash foi conferido depois de cada passo que podia tocar o índice: a latência, as buscas de verificação e os reports.
- **Revisão dos relatórios:** os dois report.md foram comparados com o report.json e com o código das métricas.

## Achados da revisão e correções

Quatro achados foram devolvidos ao desenvolvedor e corrigidos. Conferi as correções no estado final.

1. **Ordem dos comandos na documentação:** o texto punha latency e report antes de worksheet e merge-judgments. Foi corrigido para o fluxo real e passou a explicar que o report já roda o replay (cli.ts:365) e que o compare exige o mesmo queryFingerprint e o mesmo corpusDigest.
2. **Regra de empate no lugar errado:** estava descrita como regra de agregação, mas só vale para a suspeita de seleção de trecho (attribution.ts:92-96). Foi movida para o bloco de atribuição.
3. **Vocabulário de atribuição ausente:** as categorias success, candidate_recall, admission e ordering aparecem no relatório, mas não estavam definidas. Foram documentadas como em attribution.ts:85-89.
4. **report.md sem os modelos e sem o McNemar (CA5):** os dois estavam só no report.json. A renderização ganhou as linhas dos provedores e a coluna "McNemar (b/c, p)", com um teste novo. Os reports foram gerados de novo: o report.json ficou com o hash idêntico ao anterior, e o report.md só ganhou as linhas novas. Os artifacts foram atualizados e são idênticos byte a byte aos report.md novos.

O meu brief também tinha um erro: pedia "MRR limitado ao top-10". O desenvolvedor seguiu o código e o plano, que calculam o mrr sobre toda a lista admitida e limitam ao top-10 só o fullMrr10. A documentação ficou certa, e o erro foi meu.

## Revisão do coaprovador

marc://@codex-software-architect publicou uma revisão independente na msg_de136b744e7c432389. O veredito foi "de acordo com ressalvas", e ele refez parte da verificação sozinho: recalculou as métricas do caso 9I a partir dos arquivos e confirmou, também caso a caso, que as métricas da lista admitida são idênticas. Concordou com a revisão 8. As duas ressalvas procedem, e o principal reproduziu as duas:

1. **CA7, ramificação em teste:** havia ternários na montagem dos fixtures, em test/memory-eval-attribution.test.ts, test/memory-eval-judgments.test.ts e test/memory-eval-metrics.test.ts. Os helpers foram trocados por versões explícitas (admittedResult, rejectedResult, identityRecord e passageRecord), e as tuplas de cenário passaram a declarar o score. Cenários, asserções e valores esperados não mudaram. O principal varreu todos os arquivos test/memory-eval-* e não encontrou nenhum ternário, if, else nem switch.
2. **CA8, comando documentado que não funciona:** com `pnpm run memory:eval -- <command>`, a CLI recebe "--" como nome do comando e sai com exit 2. A documentação passou a usar `pnpm memory:eval <command> --corpus <name>`. O principal confirmou que `pnpm memory:eval validate --corpus marc` funciona, com 0 issues.

Checks depois dessas correções: pnpm validate com exit 0, pnpm build com exit 0 e pnpm test com 410 de 410, rodados pelo desenvolvedor. O principal rodou de novo a suíte do harness (109 de 109) e conferiu o manifest (123a7720…ba0d7) e src/, sem nenhuma alteração.

## Limitações

- **Latência sob carga de desktop:** a revisão 8 registra a condição: navegador, editor, terminais, mensageiro e dois agentes de código abertos e sem uso, 15,7 GiB de RAM, cerca de 5,8 GiB livres no início, na tomada. Isso vale como referência para as próximas etapas, que devem repetir a condição, mas não como prova para máquinas de 8 GB. A CPU só foi lida no início de cada medição.
- **Kappa do marc abaixo de 0,6:** a escala foi revisada e as divergências foram adjudicadas em conjunto. O valor reportado continua sendo o da primeira rodada. Os julgamentos do marc têm, portanto, menos concordância independente que os do ledgerline-en.
- **Inversão de cauda:** 1 em 154 casos, e entra nos riscos da E2.
- **Escala da latência:** o p95 de 20,3 s no marc é o baseline de hoje, não uma meta.

## Achados para as próximas etapas

- **E2:** a perda do M0 no marc está na admissão (32 threads de grau 3) e na ordenação (14), e nenhuma no recall de candidatos. A admissão perfeita levaria o Top1-alvo de 0,67 para 0,94. No McNemar exato, b = 0 e c = 27, com p = 1,49e-8. A exposição incidental do M0 é 0,43. No marc, a interpretação sugeriu correção sem necessidade em 15 de 26 consultas (suggestionUndue 0,58).
- **E2, hipótese registrada a pedido do humano:** tratar a interpretação como uma escolha tipada entre os candidatos de correção que já existem, com limite calibrado, no padrão dos modelos "System One" como o Jev da TypeSafe, só com modelo local. É uma alternativa a remover o LFM pela H3.
- **E3:** a busca leva de 12 a 20 s por consulta mesmo com os modelos carregados, e o custo está na recuperação e no reranking. A latência do funil deve medir por estágio.
- **Fora do escopo:** o comando marc memory recall da CLI fica aberto cerca de 300 s depois de responder, porque o timer de inatividade do interpretador (MEMORY_INTERPRETATION_IDLE_TIMEOUT_MS, em inference-manager.ts:15) segura o processo. Pela MCP isso não aparece.

## Configuração e fluxo

- O desenvolvedor usou o perfil compartilhado claude-dev, com Haiku 5.5 e reasoning xhigh confirmados pelo humano. Fez o próprio bootstrap e respondeu OK_BOOTSTRAP antes da T1, e cada etapa teve autorização explícita pelo canal entre agentes.
- O modo foi sequencial, com um desenvolvedor por vez, como no trial do workspace.
- O desenvolvedor publicou as próprias entregas: a 1 (msg_50f79445e0164eb8a2) e a 2 (msg_f044e6610f5b4da788). Conferi a entrega 2 contra os relatórios, os checks e o estado do repositório, e ela confere.

## Veredito

**Aprovado na revisão técnica do principal, com a concordância do coaprovador. As duas ressalvas dele foram resolvidas, e o estado final foi reavaliado.** O harness, os datasets, os julgamentos com consenso, os relatórios e a documentação da E0 atendem a CA1a, CA2, CA3, CA4, CA5, CA6, CA7 e CA8. O CA1b também é atendido, com o desvio do caso 9I aceito, porque a condição de impacto da revisão 7 foi cumprida.

O baseline M0 fica estabelecido como referência das etapas E1 a E4.

Pendências que dependem do humano:
- a aceitação do resultado;
- a autorização para encerrar a thread, que continua aberta.

Qualquer mudança de implementação depois desta revisão invalida o veredito para o novo estado.
