# Revisão final integrada da E1

**Revisor:** marc://@claude-software-architect, coaprovador do programa motor de busca v2.
**Estado revisado:** todo o trabalho autorizado da E1, já integrado:
- T1 a T4 e a T4b;
- os três recuos de normalização (T5, T7 e T9);
- as correções dos bloqueios da revisão independente (T12, T12b e T13).

**Veredito (revisão 3):** aprovado na revisão técnica, aguardando a re-revisão de marc://@codex-software-architect e a aceitação do humano. Esta revisão substitui duas anteriores, que perderam a validade com os pareceres pendentes do Codex e as correções que vieram depois:
- a revisão 1 (msg_207c6836744e4b56a4), invalidada pelo parecer msg_f4452bdab4bd47cebb;
- a revisão 2 (msg_ea77238a852e443286), invalidada pelo parecer msg_aedf1373da8a487597.

## Revisão 3: O7 promovido a bloqueio

Na re-revisão, o Codex confirmou que B1 a B3 estavam resolvidos e promoveu o O7 a bloqueio. O contrato da T1 manda remover código que não seja prosa nem shell, e ele não pode depender de os corpora atuais não terem fences em outras formas. Concordo. A entrega 4 do desenvolvedor está em msg_c9bb7ed8d85e43afb6.

- **Uma única definição.** O módulo novo sources/fences.ts:1-94 define a fence:
  - abre com 3 ou mais crases ou tis, com até 3 espaços de indentação;
  - uma fence de crase não aceita crase na info string;
  - fecha com o mesmo caractere, numa sequência igual ou maior;
  - se não fechar, vai até o fim do texto, como no CommonMark.
  A segmentação (sections.ts:1 e :39) e a regra 2 da normalização (markdown-text.ts:29-31 e 58-76) leem dessa definição. As regexes duplicadas saíram.
- **Lista de regras.** A regra 2 virou uma função na mesma posição. As outras regras são envolvidas por replacePattern, com o mesmo padrão e o mesmo substituto.
- **Política inalterada.** O corpo fica só em "", text, txt, bash, sh, shell e console. Os delimitadores nunca entram no texto.
- **Testes:**
  - test/core-memory-markdown-text.test.ts:229-286: 6 formas × (ts removida, text e bash mantidas). Mais indentação de 4 espaços, fechamento com o caractere errado e fence sem fechamento.
  - test/core-memory-sources-fences.test.ts:63 e 145-209: integração pelo leitor de summary, com SENTINEL_CODE excluído em cada forma e linhas conferidas.
  - Os casos antigos de três crases passam sem mudança na expectativa.
- **Reprodução minha, pelo build.**
  - Til, quatro crases, indentação de 2 espaços e fechamento mais longo: todos produzem "Prose before. Prose after. pnpm test". A fence ts sai e a bash fica.
  - Fence sem fechamento: remove tudo até o fim, como foi definido.
  - Indentação de 4 espaços: não é fence, e o texto fica.
- **Equivalência repetida.** O script agora replica flattenSources em vez de importar a função. Resultado: marc 8af296ddeca8 com 351/351 e ledgerline-en 4dad1e8eaea7 com 136/136 registros idênticos, mesma ordem, 0 divergentes. Não há recaptura.
- **Checks.** Do desenvolvedor: testes focados 172/172, pnpm validate com exit 0 (sem efeito fora do escopo), build ok e pnpm test 566/566. Meus: pnpm test 566/566, 0 falhas, 0 skips, e o manifest de produção continua igual.
- **Limitação aceita.** Com indentação de 4 espaços, o CommonMark lê um bloco de código indentado. Aqui ele vira texto comum, e as crases ficam no texto, como na E0. Nenhum corpus tem esse caso. Fica registrado para a próxima revisão da normalização.

## Revisão 2: bloqueios da revisão independente

Conferi os três bloqueios no código antes de despachar a correção. Os três procediam. A entrega 3 do desenvolvedor está em msg_99792a2fd59544939d.

- **B1, contenção física.**
  - Correção: readRegularFile(rootPath, filePath) em sources/files.ts:16-44 exige que o realpath fique dentro do realpath da raiz e que o caminho relativo real seja igual ao léxico. No win32, a comparação ignora caixa.
  - Alcance: como a correção está no helper compartilhado, cobre os leitores de summary, chat, artifact, rules e document, e não só o de documentos.
  - Testes: test/core-memory-sources-documents.test.ts:46-56 cobre ancestral vinculado em entrada de arquivo e em entrada de diretório.
- **B2, seções e fences.**
  - Correção: sections.ts:35-146 marca as linhas que estão dentro de fences (``` ou ~~~, fechadas pelo mesmo caractere com sequência igual ou maior). Um heading nessas linhas não abre seção. O código usa guards e early return.
  - Testes: test/core-memory-sources-fences.test.ts, com 8 cenários, inclusive a integração pelo leitor de summary com lineStart e lineEnd.
- **B3, invalidação incremental.**
  - Correção: MemoryManifestRecord ganha layer e authority (types.ts:125-137). isChangedSource (rebuild-operations.ts:150-160) compara sha256, autoridade, tipo e camada.
  - Teste: test/core-memory-sources-rebuild.test.ts:197 troca reference por normative e confirma a reindexação.
  - Efeito: um manifest v7 de desenvolvimento sem esses campos reindexa tudo uma vez. A produção ainda está no v6.
- **T12b.** A função flattenSources tinha sido exportada só para um script de scratchpad. O export foi retirado (rebuild-operations.ts:240).
- **Medição preservada sem recaptura.** Um script de leitura mostrou que, na camada 0, o código corrigido gera registros idênticos aos das capturas aprovadas: marc 8af296ddeca8 com 351 de 351 e ledgerline-en 4dad1e8eaea7 com 136 de 136. Recordid, sectionTitle, texto, embeddingText, passageId, passageSha256, linhas e autoridade conferem. Antes, eu tinha conferido os SUMMARY.md do marc: 0 headings dentro de fences. O captureId mudaria só porque o fingerprint cobre sources/.
- **Checks.**
  - Do desenvolvedor: pnpm validate com exit 0, sem efeito fora do escopo; build ok; pnpm test 537/537 em três execuções (duas na T12 e uma na T12b).
  - Meus: pnpm test 537/537, 0 falhas, 0 skips, e manifest de produção ainda 89a984426b1157aaa8f9d2fdafe9b50ecd83239cd86e27dbb174f9a94fba491a.
  - A falha 525/526 vista pelo Codex numa primeira execução não se repetiu em nenhuma das quatro execuções seguintes.

## Escopo e fontes

- **Plano:** revisão 3, aprovada na msg_fa670bb9ec24468092 (plano-e1-camada-de-fontes-e-representacao.md), mais as correções de handoff 1 a 8 da abertura (msg_8be6579852304b0f8d).
- **Entregas do desenvolvedor:** msg_5d6a44cf722f47aebf (T1 a T4a) e msg_b80fcf5c827f49e4a9 (recuos, recaptura e compare). As duas foram publicadas sob marc://@claude-dev (Haiku 5.5, reasoning xhigh, configuração confirmada pelo humano em 17/10), em modo sequencial com um desenvolvedor.
- **Código conferido por inspeção (context-mode):**
  - src/core/memory/sources/ (contract.ts, index.ts, markdown-text.ts e os leitores);
  - rebuild-operations.ts, settings.ts e summaries.ts;
  - o harness em scripts/memory-eval/ (capture.ts, cli.ts e layers.ts);
  - os testes novos de memória;
  - docs/memory.md, docs/mcp-tools.md e o ADR 0010 com o índice.
- **Artefatos de medição:** os compare e os report anexados à entrega 2, e os relatórios de equivalence das capturas da E0, da 1352b4e4589c e da 8af296ddeca8.

## Critérios de aceite

| # | Critério | Evidência verificada | Situação |
|---|---|---|---|
| 1 | Top1-alvo e MRR não inferiores | marc 8af296ddeca8 contra 7020a9de1965: top1Target 0,670 → 0,660, Δ −0,010, limite inferior −0,034 (δ 0,05); MRR 0,7106 → 0,7056, Δ −0,005, limite inferior −0,017 (δ 0,03). McNemar b=1, c=0. ledgerline-en 4dad1e8eaea7 contra a3761dd19573: Δ 0. Os dois compare saíram sem variantes incompletas e com 0 pares pendentes | Passa |
| 2 | Exposição incidental e abstenção correta não inferiores | Δ 0 nos dois corpora (marc 0,43 e 1,0; ledgerline-en 0 e 1,0) | Passa |
| 3 | Atribuição de 3P, 6I e 9I antes e depois | report-no-latency do marc: 3P admission → admission (0,0142), 6I admission → admission (0,0615 → 0,0612), 9I ordering → ordering (0,6647). Em todas as linhas, a única mudança de categoria é A31 (success → ordering) | Passa |
| 4 | Proveniência | test/core-memory-provenance.test.ts:92 lê lineStart no arquivo e encontra "## título"; :143-146 confere passageSha256 contra o texto e o formato do passageId; :184 mostra que passagens diferentes da mesma seção têm passageId distintos | Passa |
| 5 | Produção intacta | manifest sha256 89a984426b1157aaa8f9d2fdafe9b50ecd83239cd86e27dbb174f9a94fba491a, conferido por mim antes e depois; nenhum rebuild produtivo | Passa |
| 6 | Validação e estilo | Estado final (T13): pnpm validate com exit 0 (sem efeito fora do escopo), build ok e test 566/566. Reexecutei por conta própria: 526/526 na revisão 1, 537/537 na revisão 2 e 566/566 na revisão 3, sem falhas nem skips. Nenhum `else` em sources/, nos arquivos de memória editados nem em layers.ts; nenhum if/switch/else/ternário nos testes novos | Passa |
| 7 | Documentação | ADR 0010 indexado em docs/adrs/README.md:18; docs/memory.md:41 descreve a normalização e o recuo; docs/mcp-tools.md atualizado na T4a | Passa, com uma observação (O5) |
| C7 | Baseline da E0 reexecutado com o código da E1 | Conferido por mim na T4: as 18 chaves de métrica fora da latência são idênticas ao report.json aprovado, nos dois corpora | Passa |

## Comportamento e arquitetura

- **Contrato único:** MEMORY_SCHEMA_VERSION = 7 e MEMORY_RETRIEVAL_CONTRACT = "source-layers-v1" ficam em sources/contract.ts:20-21, e os quatro pontos antigos leem dali. Um manifest v6 vira incompatible, então o próximo rebuild produtivo, depois da E2, vai ser completo.
- **Camadas:** INDEXED_LAYERS = [0] em sources/index.ts:28. O único ponto de injeção é rebuild-operations.ts:101 (options.indexedLayers ?? INDEXED_LAYERS). O ranking e semanticRerankingDocument não mudaram, e por isso o baseline reexecutado deu o mesmo resultado.
- **documentSources:** é opt-in, com padrão [] (settings.ts:28), e uma entrada inválida é descartada na leitura, sem lançar erro, como pede a correção 2.
- **Harness:**
  - productionCheck por schema (capture.ts:347);
  - fingerprint com indexedLayers só quando é diferente de [0];
  - --all-layers;
  - report --without-latency.
  Todos funcionaram nas capturas reais.
- **Markdown como fonte:** os registros indexados continuam derivados. A proveniência aponta para o arquivo e as linhas da seção de origem.

## Normalização: o que permanece

Os três recuos devolveram à classe de caracteres da E0 tudo o que mudava a ordem do topo: hífen (9D, A34, O02), underscore (A31, O02) e # > * (A25). A preservação de identificadores, objetivo original da regra, **foi revertida por completo**. Em relação à E0, ficam:

- o texto dos links, junto com a URL, e não só a URL;
- o corpo das fences de prosa e de shell (text, txt, bash, sh, shell, console ou sem linguagem). As outras fences continuam removidas;
- as tabelas, com pipes e linhas separadoras tratados;
- as regras em lista ordenada e declarativa, com teste por regra.

## Achados e limitações (nenhum bloqueante)

- **O1, corrigido na revisão 2.** Na revisão 1, eu disse que as regras 6, 7 e 9 tinham ficado redundantes com a regra 10. O Codex mostrou que não: sem a regra 7, "**bold**, tail" vira "bold , tail" em vez de "bold, tail". As regras continuam no código e retiro a recomendação de limpeza. Qualquer mudança nelas passa por medição.
- **O2, A31.** É o único caso que perde o top-1 (McNemar b=1). Os textos de c04986bd e de 92413b81 são idênticos nas duas capturas. O que mudou foram outros registros do pool (3c4261b4 e 834716ba), e isso altera a margem e o teto de elegibilidade do M0. É o mesmo efeito de segunda ordem visto no A25 e no O02, que estava em 0,5019, perto do limiar. Entra no diagnóstico da E2.
- **O3, equivalence do 9I.** A falha já existia na captura aprovada da E0 (scoreDelta máximo 0,036) e aparece de novo na 8af296ddeca8 (0,065), embora a 1352b4e4589c tenha passado. Os critérios de aceite da E0 já não contavam o equivalence. O ranking não mudou na E1, e a hipótese mais provável é ruído de score do reranker entre o replay e a produção. Como o Codex observou, isso não está comprovado causalmente, e a E2 deve investigar.
- **O4, corrigido na revisão 2.** Com n=100 no marc, um caso que cai de 1 para 0 no MRR dá um limite inferior de −0,034, já fora do δ de 0,03. Uma perda parcial passa: o A31 caiu de 1 para 0,5 e o critério foi aprovado. Por isso a formulação "qualquer regressão isolada" da revisão 1 foi ampla demais. Recomendo que a E2 calibre o δ ou o tamanho da amostra pela variância de um caso.
- **O7, resolvido na revisão 3.** A normalização reconhecia menos formas de fence que a segmentação. O Codex promoveu o achado a bloqueio, e ele foi corrigido com uma definição única de fence (ver "Revisão 3").
- **O5, termos do programa na documentação.** O docs/memory.md:41 cita "E0 baseline" e "E1 measurement", nomes internos do programa. No ADR isso é adequado. No guia de memória, recomendo trocar por "a normalização anterior" quando a E2 revisar o texto.
- **O6, riscos herdados da entrega 1, para a E3:**
  - o filtro FTS do LanceDB, pré ou pós, ainda não foi confirmado;
  - o status compara só summaries;
  - o custo do leitor de documentos.
  Os scripts memory:quality e memory:benchmark só rodam com o schema v6 e precisam ser removidos ou adaptados na E2.

## Medições para a E3 (--all-layers, T4b)

- marc: [0] tem 352 registros, com rebuild em 18,4 s; [0,1,2] tem 2.769 registros (camada 0: 352; camada 1: 1.906; camada 2: 511), com rebuild em 147,6 s.
- ledgerline-en: [0] tem 136 registros em 4,6 s; [0,1,2] tem 265 registros em 8,5 s.

## Julgamento incremental

Fiz todas as rodadas como avaliador a, e marc://@codex-software-architect como avaliador b, sem acesso cruzado. As divergências foram resolvidas por consenso registrado:

| Rodada (captura) | Pares | Divergências |
|---|---|---|
| 2e43dcb61754 | 156 | 13 |
| 2d6b749a9463 | 53 | 7 |
| 1352b4e4589c | 24 | 1 |
| 8af296ddeca8 | 3 | 1 |

Nenhum julgamento da E0 foi alterado.

## Veredito

**Aprovado na revisão técnica (revisão 3).** Os sete critérios e a verificação do baseline têm evidência verificada no estado integrado depois da T13. Os bloqueios B1 a B3 e o O7 foram corrigidos e cobertos por testes. A medição continua válida porque os registros da camada 0 são idênticos. Os achados O2 a O6 não bloqueiam a E1 e vão para a E2 e a E3. A thread continua aberta até a re-revisão do Codex e a aceitação do humano.
