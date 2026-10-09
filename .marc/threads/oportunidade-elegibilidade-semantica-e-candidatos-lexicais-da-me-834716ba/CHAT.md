# Oportunidade - Elegibilidade semântica e candidatos lexicais da memory

Thread: `oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba`
Created: `2026-07-21T04:34:08.950Z`

<!-- marc-message
id: msg_2e2614cafa6445abb9
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-07-21T04:35:14.256Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-elegibilidade-semantica-candidatos-lexicais.md
-->

Oportunidade registrada para separar candidatos lexicais da elegibilidade semântica da memory.

Decisão de produto preservada:
- Um termo literal pode ampliar o conjunto de records avaliados.
- Ele não pode, sozinho, fazer um record virar resultado.
- O contexto semântico e o minScore ativo continuam determinando a elegibilidade.

O diagnóstico cobre o acoplamento atual entre resultLimit e candidateLimit, os casos brutalism, toggle e toogle, alternativas técnicas, critérios de aceite, riscos e benchmarks de regressão.

Detalhes: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba

<!-- /marc-message -->

<!-- marc-message
id: msg_0a91d31909214b1fa9
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-07-28T00:40:18.915Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-elegibilidade-semantica-candidatos-lexicais.md
-->

Análise concluída e plano anexado antes do desenvolvimento.

Decisões confirmadas:
- Separar o limite de saída da coleta interna de candidatos vetoriais.
- Incluir candidatos por termo literal sem usar esse sinal como passe para elegibilidade.
- Usar `vectorScore` e o `minScore` ativo como barreira de contexto semântico.
- Começar pela varredura dos records persistidos, adequada aos 241 chunks atuais e sem novo formato derivado.

Fluxo planejado:
vector candidates + exact lexical candidates -> dedupe -> semantic eligibility -> hybrid ranking -> result limit.

Plano: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba

Inicio agora a implementação e as validações previstas.

<!-- /marc-message -->

<!-- marc-message
id: msg_f3739f278b1a41a499
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-07-28T01:04:33.491Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluído. A thread permanece aberta aguardando seu feedback.

Realizado:
- A coleta vetorial passou a usar política interna fixa de 100 candidatos, independente do `limit` de saída.
- O recall adiciona candidatos por termos literais normalizados dos records persistidos e une as duas origens por `recordId`.
- A elegibilidade agora exige `vectorScore >= minScore` ativo antes do ranking híbrido. Termos exatos ampliam candidatos e influenciam ranking, mas não aprovam um resultado sozinhos.
- Deep retry continua reduzindo somente a barreira semântica.
- LanceDB e o store em memória implementam a mesma busca lexical.
- `docs/memory.md` documenta a política compartilhada entre UI e MCP.

Ajuste identificado durante validação:
- O LanceDB retorna vetores persistidos como `apache-arrow` `Vector`, não como array nativo. A fronteira de leitura agora aceita vetores iteráveis. Foi adicionada cobertura direta para esse caminho.

Validação:
- `pnpm run validate` passou.
- `pnpm test` passou com 141 testes.
- `pnpm build` passou.
- A auditoria da thread não encontrou falhas em regras, mensagens, referências, artefatos ou preflight. Restaram somente três avisos preexistentes de Description ausente em perfis de outros agentes.

Para usar a lógica nova no daemon já em execução, será necessário reiniciar os recursos.

<!-- /marc-message -->

<!-- marc-message
id: msg_38ae5d9c05b54e66af
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-07-28T06:10:26.970Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-refinamento-semantico-da-memory.md
-->

Plano revisado anexado. Ele substitui a proposta híbrida anterior e registra o pipeline semântico com E5, mMARCO, workers isolados, profundidade por candidatos e migração por full rebuild.

Aguardo sua avaliação antes de iniciar o desenvolvimento.

<!-- /marc-message -->

<!-- marc-message
id: msg_e80c437293f940d597
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-07-29T04:07:35.244Z
agentId: codex-dev
role: developer
artifacts: artifacts/relatorio-implementacao-retrieval-semantico.md
-->

## Implementação concluída

Foi entregue a recuperação semântica em duas etapas com E5 multilíngue e reranker mMARCO, sem fallback lexical. A indexação preserva apenas resumos de threads fechadas como corpus e incorpora o título canônico da thread ao contexto avaliado.

Também foram concluídos:

- workers isolados para embedding e reranking com encerramento após 30 segundos de inatividade
- profundidade progressiva de 100 a 400 candidatos
- contratos de UI, API, MCP e CLI para profundidade, preparação de modelos e rebuild incremental ou full
- relatório de qualidade executável e documentação da arquitetura

### Validação

- `pnpm run validate` passou
- `pnpm test` passou com 141 testes
- `pnpm run build` passou
- `pnpm run memory:quality -- --workspace C:/Projetos/marc` passou
- preparação local dos dois modelos, rebuild full e status do índice foram validados

A auditoria de mensagens não encontrou findings. O artefato anexado contém a arquitetura, a calibragem, as evidências e a observação registrada sobre consultas sem resultado acima do limiar.

### Reinício necessário

Reinicie daemon, MCP e UI antes do teste manual. Os workers, contratos de rota e schemas das ferramentas são carregados na inicialização.

Aguardo seu feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_0639002fe6824a9490
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-07-29T18:05:48.040Z
agentId: codex-dev
role: developer
artifacts: artifacts/investigacao-estabilidade-ranking-memory.md
-->

## Investigação registrada

A reprodução confirmou que a reordenação no Deep não veio de índice desatualizado.

- O retriever vetorial prioriza corretamente Estilo neo-brutalism para a UI.
- O resumo global duplicado da thread de processamento só entra no Deep.
- A variante quint8 muda os scores quando o lote muda, portanto não pode ordenar resultados com confiança.

O artefato anexado contém os ranks, os tempos e a matriz de estabilidade que orientam a correção.

<!-- /marc-message -->

<!-- marc-message
id: msg_4031fea176334ba7bc
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-07-29T18:06:31.938Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-iteracao-estabilidade-e-passagens.md
-->

## Próxima iteração iniciada

A próxima iteração substitui a variante instável por mMARCO O4, converte o corpus em passagens tokenizadas e consolida o ranking por thread antes do retorno à UI.

O plano anexado define os contratos de estabilidade, qualidade e rebuild full. Inicio agora a implementação e os testes previstos.

<!-- /marc-message -->

<!-- marc-message
id: msg_f6765909a9a44695b1
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-07-31T01:45:53.287Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-correcao-estrutural-busca-memory-schema-v4.md
-->

Plano aprovado registrado antes do desenvolvimento.

- Corrigir a busca com schema v4, recuperação por identidade e passagens, consolidação por thread e elegibilidade separada do ranking.
- Adotar rebuild geracional e purge seguro de modelos e índices não utilizados.
- Validar com julgamentos graduados, matriz completa de depths e consultas reais, sem usar tempo como gate.

O desenvolvimento começa agora. O artifact anexado contém o plano detalhado e os critérios de aceite.

<!-- /marc-message -->

<!-- marc-message
id: msg_1641fb4b43bf40d0a5
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-08-01T05:23:12.137Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-interpretacao-consultas-correcao-assistida.md
-->

Plano detalhado registrado antes do desenvolvimento.

A proposta adiciona interpretação de consultas com o LFM2.5 350M Q4, preserva a busca literal como fallback e mantém correção, recuperação e reranking como responsabilidades independentes.

O desenvolvimento ainda não foi iniciado. Aguardando autorização para prosseguir.

<!-- /marc-message -->

<!-- marc-message
id: msg_03fbaa836f3f4642b8
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-08-03T13:42:39.205Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-adjudicacao-semantica-lfm-e-ttl-por-papel.md
-->

## Investigação concluída

- O segundo reranking agregado com mMARCO foi descartado porque não generalizou entre as famílias de consulta.
- O fluxo permanece com E5, reranking de passagens com mMARCO e fusão determinística por thread.
- O LFM será avaliado como árbitro condicionado entre até três candidatos. Ele poderá selecionar um candidato permitido ou se abster, mas não produzirá pesos livres.
- A política atual de 30 segundos será separada por papel. O LFM ficará disponível por cinco minutos, enquanto embedding e reranking manterão 30 segundos.

## Próxima iteração

O plano detalhado foi anexado antes das novas alterações. A integração ao ranking só será mantida se o harness com o modelo real demonstrar ganho sem regressão.

<!-- /marc-message -->

<!-- marc-message
id: msg_8920b30140fe4970b4
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-08-03T14:17:53.453Z
agentId: codex-dev
role: developer
-->

## Resultado da experiência com LFM no reranking

- A adjudicação entre três candidatos falhou nos casos de estilo, toggle, segurança e abstenção.
- A classificação binária respondeu positivamente para todos os onze pares, inclusive candidatos sem relação com `invoice reconciliation`.
- Uma segunda prova com exemplos balanceados manteve o mesmo viés.
- A capacidade experimental foi removida integralmente e não influencia o ranking.
- O LFM permanece restrito à correção de typo.
- O TTL do papel de interpretação passou de 30 segundos para cinco minutos. Embedding e reranking continuam com 30 segundos.

Validação parcial: 17 testes focados e typecheck aprovados.

<!-- /marc-message -->

<!-- marc-message
id: msg_2d6db4498fb449a6bb
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-08-03T14:39:43.050Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-experimento-porte-dos-modelos-de-busca.md
-->

## Nova hipótese experimental

Será medida separadamente a influência do porte do retriever e do reranker por uma matriz 2x2.

- O índice de produção não será alterado.
- Cada perfil rodará em processo isolado.
- Corpus, chunks, consultas, ranking e elegibilidade permanecerão fixos.
- Qualidade, RAM, disco e latência serão medidos.
- Nenhum modelo será promovido sem superar o baseline e preservar todas as invariantes.

O plano detalhado foi anexado antes do início do desenvolvimento.

<!-- /marc-message -->

<!-- marc-message
id: msg_8ef3280a8fd040159f
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-08-04T00:36:50.659Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-recuperacao-hibrida-orientada-por-campos-lancedb.md
-->

Plano detalhado anexado antes do desenvolvimento.

- Arquitetura aprovada: recuperação híbrida orientada por campos.
- LanceDB fornecera os canais vetorial e BM25.
- O mARC manterá consolidação por thread, reranking e elegibilidade semântica.
- Match lexical isolado não poderá tornar uma thread elegível.
- A implementação incluirá migração de schema, rebuild geracional seguro e uma bateria de qualidade com casos positivos e negativos.

Inicio agora a implementação orientada pelo artefato anexado.

<!-- /marc-message -->

<!-- marc-message
id: msg_55d2c11a33e4497e88
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-08-04T03:51:50.519Z
agentId: codex-dev
role: developer
artifacts: artifacts/avaliacao-aleatoria-30-consultas-memory.md
-->

## Rodada de avaliação registrada

A busca foi avaliada com dez threads fechadas selecionadas por amostragem pseudoaleatória reproduzível e trinta consultas definidas antes da execução.

### Resultado

- Top-1: 27/30, ou 90%.
- Top-10: 28/30, ou 93,3%.
- Consultas diretas: 10/10 no Top-1.
- Consultas indiretas: 9/10 no Top-1.
- Consultas implícitas: 8/10 no Top-1.

### Falhas relevantes

- Uma consulta implícita sobre o indicador visual de memory retornou vazio.
- Uma consulta indireta sobre auditoria recuperou a thread correta somente na posição 7, atrás de menções incidentais.
- Uma consulta implícita sobre ordenação não recuperou a thread esperada e foi degradada pelo interpretador antes da busca.

O artifact anexado contém método, semente, amostra, as trinta consultas, ranks, métricas, limitações e pontos para decisão.

Nenhuma alteração de código foi feita nesta rodada. Aguardo a decisão sobre a próxima investigação.

<!-- /marc-message -->

<!-- marc-message
id: msg_e3b66cccce2e4226a2
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T16:00:23.014Z
agentId: codex-dev
role: architect
artifacts: artifacts/plano-conclusao-documentacao-scripts-e-validacao.md
-->

## Retomada para conclusão

- Plano anexado antes do desenvolvimento.
- Escopo: remover o script obsoleto, revisar a documentação e executar a validação final. A busca atual será preservada.
- Execução por subagentes gpt-6-luna com reasoning xhigh, um desenvolvedor por vez nesta rodada.
- Cada desenvolvedor deverá confirmar o bootstrap e as regras antes de receber liberação para editar. Eu farei a revisão e devolverei os ajustes necessários.
- Esperas por aprovação na TUI serão preservadas.
- Ao concluir, registrarei as evidências e aguardarei sua revisão. A thread continuará aberta até sua autorização final.

<!-- /marc-message -->

<!-- marc-message
id: msg_ceca363290eb4852a6
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T16:12:04.837Z
agentId: codex-dev
role: architect
-->

## Tarefa de scripts aprovada

- Removido somente o script legado memory-quality.ts, sem consumidores ativos e dependente de uma constante já eliminada.
- Os quatro scripts ativos e os comandos de qualidade e benchmark foram preservados. Conferi seus hashes por context-mode.
- O desenvolvedor executou o teste focado de relatórios de benchmark: 3/3 aprovados.
- A próxima tarefa é revisar os docs. O novo desenvolvedor está no onboarding e deverá confirmar o bootstrap antes das edições.

<!-- /marc-message -->

<!-- marc-message
id: msg_db65f9d2ddd341b3b6
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T16:41:39.784Z
agentId: codex-dev
role: architect
artifacts: artifacts/relatorio-conclusao-documentacao-scripts-e-validacao.md
-->

## Entrega pronta para revisão

### Realizado

- Revisados os documentos do projeto e atualizados cinco arquivos para refletir os contratos atuais de busca, modelos, preparo, rebuild, purge e avaliação.
- Removido somente o script legado memory-quality.ts. Os quatro scripts ativos e os comandos públicos foram preservados.
- Executadas duas atividades sequenciais por subagentes gpt-6-luna com reasoning xhigh. Ambos confirmaram bootstrap antes das edições.
- Revisão do arquiteto devolveu uma referência residual ao schema 4. O mesmo subagente corrigiu para schema 6 antes da aprovação.

### Validação

- pnpm run validate aprovado.
- pnpm test aprovado com 185/185 testes.
- pnpm build aprovado, mantendo o aviso conhecido de bundle acima de 500 kB.
- Conferidos 33 links locais, sem links quebrados.
- Comparação SHA-256 confirmou código da busca, testes, configurações e manifesto da memória ativa inalterados.

### Próximo passo

Relatório detalhado anexado pelos metadados desta mensagem. A auditoria será executada depois deste registro completo.

Não é necessário restart ou rebuild para esta rodada. Aguardo seu feedback para orientar a finalização. A thread permanece aberta, sem SUMMARY.md.

<!-- /marc-message -->

<!-- marc-message
id: msg_c8ee47570b1046c296
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T19:15:31.343Z
agentId: codex-dev
role: architect
artifacts: artifacts/revisao-integral-qualidade-e-pendencias.md
-->

## Revisão integral de qualidade

A aprovação anterior cobriu apenas scripts e documentação. Ela não representa aprovação integral da funcionalidade. O crivo do loop foi ampliado para a entrega acumulada da thread.

### Decisão preservada

Conforme complemento do usuário, manter a versão atual do motor. Esta revisão não reabre calibragem, modelos ou arquitetura de busca.

### Achados que impedem o aceite integral

- P1: purge captura a geração antes do lock e pode remover uma geração recem-publicada por rebuild concorrente. Reproduzido em memória, sem apagar a base real.
- P2: a UI pode ocultar Deep depois de obter resultados apenas em depth 0, pois confunde profundidade configurada com executada.
- P2: o harness retorna sucesso com zero consultas quando um filtro não encontra casos. Reproduzido com código de saída zero e caseCount zero.

### Validação

A bateria completa com modelos reais ficou inconclusiva por timeout da ferramenta, não por falha de relevância. O processo residual exclusivo dessa validação foi identificado e encerrado. Não houve alteração do motor nem rebuild.

O relatório anexado detalha fontes, reproduções, impactos e três correções atômicas. A entrega integral ainda não está aprovada. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_2f702662cfd545228b
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T19:18:41.449Z
agentId: codex-dev
role: architect
artifacts: artifacts/plano-loop-correcao-purge-deep-e-harness.md, artifacts/revisao-integral-qualidade-e-pendencias.md
-->

## Loop de correção iniciado

O plano desta iteração foi registrado pelo MCP antes das edições. O relatório da revisão também foi regravado pelo MCP, preservando seu conteúdo.

### Execução

- Corrigir snapshot do purge sob lock.
- Corrigir progressão Deep pela profundidade realmente executada.
- Impedir aprovação do harness sem consultas selecionadas.

Desenvolvimento sequencial por subagentes gpt-6-luna com reasoning xhigh. Cada agente confirma bootstrap antes de editar. O arquiteto revisa e devolve ajustes até o aceite técnico.

A versão do motor da busca será preservada. Não havera parada entre tarefas para pedir nova autorização. A thread permanece aberta para sua revisão depois do meu aceite.

<!-- /marc-message -->

<!-- marc-message
id: msg_4d2881cbbf51494fa2
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T19:31:22.513Z
agentId: codex-dev
role: architect
-->

## Tarefa 1 aprovada no loop

- Purge lê o manifesto dentro de memory-operation.
- Teste RED reproduziu a intercalação A antes do lock e B publicado depois.
- GREEN preserva B; busy não lê manifesto nem remove recursos; ausência de manifesto preserva comportamento.
- Revisão independente do arquiteto e 15/15 testes focados aprovados.
- Alterações limitadas a operations.ts e core-memory-maintenance.test.ts.

Turing concluiu a tarefa. Início agora a tarefa da progressão Deep, sem parar o loop.

<!-- /marc-message -->

<!-- marc-message
id: msg_58fbf90d54ec4a78af
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T19:52:27.772Z
agentId: codex-ui-memory-depth-dev
role: developer
-->

Tarefa atômica 2 implementada para revisão.

O fluxo de recall agora retorna o último depth cuja chamada apiPost concluiu. O hook usa esse valor para Deep e para o snapshot schema 5; sucesso antecipado em 0 habilita Deep 1 mesmo com limite configurado 3. Consultas novas e alternativas começam em 0; retries preservam a interpretação efetiva em modo literal. Respostas stale são descartadas por request id e workspace. Snapshots legacy versionados sem depth observado são removidos e ignorados.

Arquivos: src/ui/use-memory-search.ts, src/ui/memory-search.ts, src/ui/memory-search-depth.ts, test/ui-memory-search.test.ts, test/ui-memory-search-depth.test.ts, test/ui-memory-search-workflow.test.ts e docs/memory.md.

RED foi capturado antes da implementação: 7 falhas nos testes focados, incluindo next depth inválido, persistência sem lastExecutedDepth e cenários de loop/stale ausentes. GREEN final: 16/16 testes runtime; typecheck, ESLint focado e Prettier focado passaram. O teste async cobre chamadas apiPost sequenciais, sucesso antecipado com configurações 1 e 3 e persistência/restauração do depth observado, esgotamento até 3, consulta efetiva literal, alternativa em 0 e resposta stale após troca de workspace.

A reprodução E2E RED reportada pelo arquiteto permanece como baseline; não rodei navegador nem reconstruí bundle. Não alterei configuração, engine, backend ou modelos e não rodei build amplo ou harness. Workspace permaneceu com autoRebuild=false e searchRetryDepth=0. Thread mantida aberta para revisão.

<!-- /marc-message -->

<!-- marc-message
id: msg_0934b0b7adb9432caa
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T19:52:59.464Z
agentId: codex-ui-memory-depth-dev
role: developer
-->

Complemento de validação para precisão do registro: antes da última restrição de escopo, rodei `pnpm exec vite build --outDir /tmp/marc-task2-build --emptyOutDir`. O bundle foi direcionado a /tmp, sem alterar dist ou configuração da workspace. Depois da restrição, não rodei build, navegador ou harness; limitei a validação final ao runtime focado, typecheck, ESLint e Prettier.

<!-- /marc-message -->

<!-- marc-message
id: msg_a6e232832b89400a93
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T20:01:42.789Z
agentId: codex-dev
role: architect
-->

Tarefa 2 aprovada na revisão do arquiteto.

- Código e estado de cache revisados. Progresso usa o último nível efetivamente executado, não o limite configurado.
- Validação independente via context-mode: 17 testes focados passaram e build passou.
- Playwright CLI em desktop e mobile confirmou sucesso em 0 seguido de Deep em 1, restauração em 2, esgotamento em 3 e reset em 0 para nova busca.
- Nenhum ajuste de ranking, modelos, pesos ou base real.

O loop segue para a tarefa 3. A thread permanece aberta para sua revisão após o aceite técnico final.

<!-- /marc-message -->

<!-- marc-message
id: msg_4a2d46ec6b7e4728aa
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T20:02:58.007Z
agentId: codex-dev
role: architect
artifacts: artifacts/avaliacao-motor-preservado-56-casos.md
-->

Bateria completa do motor atual registrada no anexo.

- Foram 56 casos, com 14 consultas em quatro profundidades. Todas as 32 execuções por família/profundidade terminaram.
- 28 casos passaram e 28 falharam nos gates existentes. Não considero memory:quality globalmente aprovado.
- As falhas restantes são de recall para toggle/toogle e candidatos adicionais classificados como incidentais pelos fixtures. A família brutalism e os casos negativos passaram em todos os níveis.
- Conforme sua orientação, o motor permanece preservado. Não vou alterar ranking ou julgamentos para ocultar esses resultados.

O loop de correção dos defeitos de implementação continua, separado destas limitações conhecidas.

<!-- /marc-message -->

<!-- marc-message
id: msg_6440ac6714354c6cbc
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T20:11:35.515Z
agentId: codex-ui-memory-depth-dev
role: developer
-->

## Tarefa 3 pronta para revisão

- A seleção de casos agora é validada antes de `initWorkspace`, da criação do intérprete, da leitura do manifesto e do ramo `--interpret-only`.
- Seleção vazia falha com mensagem que identifica os filtros. O seletor puro permite cobrir família, query exata e seleção padrão sem importar o script executável.
- `docs/development.md` documenta correspondência exata e a rejeição antes do acesso ao workspace.

Arquivos alterados: `scripts/memory-quality-v4.ts`, `scripts/memory-quality-selection.ts`, `test/memory-quality-v4-selection.test.ts`, `docs/development.md`.

### RED/GREEN

- RED: os dois testes de subprocesso falharam antes da correção; ambos chegaram a `readMemoryManifest` e terminaram com “Memory quality requires a schema v6 full rebuild” no workspace inexistente, em vez de rejeitar os filtros.
- GREEN: o teste focado passou com 5/5. Os subprocessos agora retornam o erro de seleção e confirmam que o workspace temporário não foi criado, inclusive em `--interpret-only`.
- Cobertura unitária também confirma família válida, query exata, combinação de filtros, seleção padrão integral e erro para seleção vazia sem filtros.

### Verificações

- `pnpm exec node --import tsx --test test/memory-quality-v4-selection.test.ts`: 5/5 aprovado.
- Prettier focado: sem apontamentos.
- ESLint focado: sem erros.
- Não rodei validate, suíte geral, build, browser ou motor/modelos reais; ficam para a validação final do arquiteto.
- Nenhum caso, julgamento, métrica, ranking, modelo, peso, schema ou base real foi alterado. Thread permanece aberta.

Fontes revisadas via context-mode: `scripts/memory-quality-v4.ts`, `docs/development.md`, `revisao-integral-qualidade-e-pendencias.md` e `plano-loop-correcao-purge-deep-e-harness.md`.

<!-- /marc-message -->

<!-- marc-message
id: msg_19cb8e1f5a1d4d10a0
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T20:14:54.489Z
agentId: codex-memory-quality-harness-dev
role: developer
-->

## Correção de autoria da entrega T3

A entrega do harness registrada na mensagem msg_6440ac6714354c6cbc foi publicada sob perfil inadequado. Corrijo a atribuição: o desenvolvimento e os testes focados são de codex-memory-quality-harness-dev (developer, gpt-6-luna-reasoning-xhigh), perfil próprio para esta tarefa, com descrição em en-US.

O escopo, as evidências RED/GREEN e as verificações permanecem conforme o registro anterior. Não houve alteração de código. A thread permanece aberta para revisão.

<!-- /marc-message -->

<!-- marc-message
id: msg_ded39786c182477e89
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T20:18:08.366Z
agentId: codex-dev
role: architect
artifacts: artifacts/revisao-final-e-aceite-tecnico-loop.md, artifacts/validacao-integrada-final-loop.md, artifacts/avaliacao-motor-preservado-56-casos.md, artifacts/evidencia-motor-preservado-56-casos.md
-->

## Aceite técnico do loop

As três correções foram aprovadas após revisão independente do arquiteto.

- Purge protege a geração lida dentro do lock. Deep usa o último nível efetivamente executado. Harness rejeita filtros sem casos antes do acesso ao workspace ou modelos.
- Validate, 198/198 testes e build passaram. Playwright CLI confirmou a progressão e o reset da busca em desktop e mobile.
- Documentação revisada, script obsoleto removido e ferramentas ativas preservadas. Registros e evidências anexados pelo MCP.
- Motor e manifesto preservados por hashes. A bateria real terminou com 28/56 casos aprovados nos gates existentes; as limitações estão documentadas e não foram mascaradas por recalibragem.
- Reinicie daemon/MCP e recarregue a UI para carregar as correções. Não é necessário rebuild da memória.

A thread permanece aberta. Aguardo sua revisão e orientação para o fechamento efetivo.

<!-- /marc-message -->

<!-- marc-message
id: msg_774744109653425bb8
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T20:20:38.388Z
agentId: codex-dev
role: architect
artifacts: artifacts/validacao-integrada-final-loop.md, artifacts/evidencia-motor-preservado-56-casos.md
-->

## Ajuste dos anexos de evidência

A auditoria de registros apontou duas referências como ausentes. Os arquivos existiam, mas a auditoria atual só enumera anexos Markdown.

- Evidências reapresentadas pelo MCP em anexos .md, com o JSON original preservado dentro deles.
- Metadados da mensagem de aceite corrigidos via apply_patch, pois não existe ferramenta MCP de edição de mensagem.
- As duas copias .json criadas nesta rodada foram removidas. Nenhum código, critério, resultado de teste ou dado do usuário foi alterado.

A revalidação da auditoria verifica especificamente a correção desses achados. O aceite técnico do código permanece baseado na revisão e na validação independente.

<!-- /marc-message -->

<!-- marc-message
id: msg_337d63a6fbdc436d92
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T22:25:34.474Z
agentId: codex-dev
role: architect
-->

## Verificação após restart

- Bootstrap refeito após restart. MCP e HTTP respondem.
- memory_status confirmou ready, 38 summaries indexados e três modelos preparados. Sem erro de rebuild.
- Verificação via context-mode confirmou que JS e CSS servidos pela UI são idênticos ao build aprovado.
- Configuração atual: autoRebuild false, batch size 4, searchRetryDepth 0. Inventário com zero bytes recuperáveis.

Resta apenas a revisão visível do usuário: sucesso precoce com limite automático 3 deve manter Deep disponível, reload deve preservar o progresso e nova consulta deve reiniciar em 0. Depois do teste, restaurar a configuração preferida. Não é necessário purge ou rebuild adicional.

Thread permanece aberta aguardando feedback.

<!-- /marc-message -->

<!-- marc-message
id: msg_6b52657be73b45fc9b
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T22:33:23.369Z
agentId: codex-dev
role: architect
-->

## Validação visual do usuário após restart

O usuário apresentou quatro capturas da mesma consulta brutalism: busca inicial e três ações Deep.

- Deep permanece visível nas três primeiras capturas.
- Depois da terceira ação Deep, a quarta captura não apresenta o botão.
- O resultado permanece a thread de estilo neo-brutalism durante a sequência.

A visibilidade e o esgotamento apresentados correspondem ao comportamento esperado. As capturas não incluem os payloads depth das requisições; não são evidência adicional desses valores.

Para completar o smoke test visível, recarregar no estado final deve manter Deep ausente; submeter uma nova busca deve iniciar novo ciclo e reapresentar Deep se houver sucesso antes do último nível. Thread permanece aberta aguardando feedback.

<!-- /marc-message -->

<!-- marc-message
id: msg_1638b4366f6b42a8a5
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T22:34:50.306Z
agentId: codex-dev
role: architect
-->

## Smoke test após restart concluído

O usuário confirmou as duas checagens restantes:

- Recarregar a página depois de esgotar os retries manteve Deep ausente.
- Submeter nova busca por brutalism reapresentou Deep, iniciando novo ciclo.

A sequência visual inicial mais três Deep, a persistência depois de reload e o reset para nova busca foram validados pelo usuário no sistema reiniciado.

Sem pendência de validação das correções deste loop. Aceite técnico mantido; o motor continua na versão preservada, com suas limitações registradas. A thread está pronta para encerramento e permanece aberta até a orientação do usuário.

<!-- /marc-message -->

<!-- marc-message
id: msg_6a5cd03809d44aacaf
threadId: oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
timestamp: 2026-10-08T22:41:01.159Z
agentId: codex-dev
role: architect
artifacts: artifacts/revisao-final-e-aceite-tecnico-loop.md, artifacts/validacao-integrada-final-loop.md, artifacts/avaliacao-motor-preservado-56-casos.md, artifacts/evidencia-motor-preservado-56-casos.md
-->

## Thread encerrada

Encerramento autorizado pelo usuário após o smoke test no sistema reiniciado.

- SUMMARY.md criado com a entrega consolidada, as decisões, a revisão integral e as limitações do motor preservado.
- Aceite técnico e validação do usuário concluídos. Validate, 198/198 testes e build aprovados; sem nova alteração de código neste fechamento.
- Backlog de browser/E2E revisado e atualizado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a, sem confundir validação ad hoc com suite E2E automatizada pronta.
- O motor permanece na versão aceita. Os resultados 28/56 da bateria real continuam documentados.
- Como autoRebuild está desligado, o novo resumo pode tornar a memory stale até um rebuild incremental explícito. Não é necessário full rebuild.

A classificação closed será confirmada pela leitura de metadados do MCP.

<!-- /marc-message -->
