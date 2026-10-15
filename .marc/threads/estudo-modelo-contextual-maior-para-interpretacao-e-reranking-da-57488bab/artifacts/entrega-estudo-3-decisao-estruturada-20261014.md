# Estudo 3/4: Executor de Decisões Estruturadas

**Estado:** implementação congelada e entregue para revisão integrada do principal. Nenhuma inferência ONNX experimental foi executada.

## Escopo e protocolo

Workspace: marc-dd422176e1, C:/Projetos/marc. Perfil compartilhado: codex-dev; configuração confirmada pelo humano: gpt-6-luna, reasoning xhigh. Plano final: SHA-256 89d1774429e92e2442824b1228919259e2b5ea11620ec48378bcee41f936d91d.

A extensão está somente em C:/Users/junior/AppData/Local/Temp/marc-decision-study-57488bab-20261014/. Os 12 módulos/testes abaixo são todos os arquivos .mjs autorizados e encontrados. Nenhuma fonte produtiva, plano, cache, memória, peso, índice, dependência, Git ou captura anterior foi alterada. A entrega é classificada como executor isolado de estudo, não mudança ou release de produto. Nenhuma documentação foi alterada porque o escopo é temporário.

O preflight permanece sem pipeline. CLI confirmou 62 casos, 49 decisões e 13 bypasses. A execução futura continua bloqueada até revisão integrada e autorização separada do principal.

## Correção final e evidência de API

Em decision-runtime.mjs:174, scoreMessages usa o forward direto do modelo. Após forward, registra output.logits.dims real em originalLogitsDimensions e expõe a forma da fatia com nome separado lastTokenDimensions (linhas 181, 184, 189-190). decision-scores.mjs:11 valida logits [batch, sequence, vocabulary], fatia o último token sem remover o eixo de sequência e libera a fatia. O teste scoreMessages usa forma original [1,3,2] e verifica forma last-token [1,1,2], além da ausência do campo ambíguo dimensions. O teste de Tensor Transformers instalado também valida a fatia real sintética, sem sessão ONNX.

agreementCount é especificamente a contagem de linhas S1 em que ambas as ordens, após remapeamento canônico, favorecem a proposta: normalLogOdds > 0 e reversedLogOdds > 0. Não representa estabilidade total. decision-evaluation.mjs:8 define essa política; decision-report.mjs:60 conta somente agreement === true. Discordância geral pode ser calculada separadamente a partir dos sinais canonizados.

O contrato existente também mantém freeze de seleção após a cobertura completa de calibração e antes de qualquer validação, bypasses sem chamadas, contagem de invocações reais generate/forward, resume sem repetir forwards concluídos e dispose antes da conclusão. RSS é amostrado somente no processo coordenador via process.memoryUsage().rss; não é soma nem estimativa de RAM de processos filhos.

## Validação executada

1. `node --import tsx --test C:/Users/junior/AppData/Local/Temp/marc-decision-study-57488bab-20261014/decision.test.mjs C:/Users/junior/AppData/Local/Temp/marc-decision-study-57488bab-20261014/decision-lifecycle.test.mjs`: exit 0, 28/28, zero falhas e zero skips.
2. `node --import tsx C:/Users/junior/AppData/Local/Temp/marc-decision-study-57488bab-20261014/decision-cli.mjs --validate-inputs`: exit 0, pipelineLoaded false, 62 casos, 49 decisões, 13 bypasses, 147 prompts e 294 verificações de sufixo; contexto máximo 128000 e maior prompt+label 264. Transformers.js 4.3.1; onnxruntime-node 1.30.0.
3. Fingerprint final do preflight: `0a5f033613600bcbe2300b594faff0025a91b0ae374f6e643fc372077ce87a5d`.
4. Auditoria estática somente leitura: inventário exato dos 12 módulos; todos com no máximo 300 linhas não brancas; parse AST e `node --check` em todos passaram; zero `else`, `if` aninhado e condicionais/skips nos testes.
5. Nenhum `--run`, captura, carregamento ONNX ou geração real foi iniciado. Nenhum teste antigo de execução de modelo foi rodado.

Comando reservado ao principal após a revisão e autorização explícita separada: `MARC_DECISION_STUDY_RUN_AUTHORIZED=1 node --import tsx C:/Users/junior/AppData/Local/Temp/marc-decision-study-57488bab-20261014/decision-cli.mjs --run`. Este comando não foi executado.

## Arquivos finais e SHA-256

- decision-checkpoint.mjs — 158 linhas não brancas — 3b4b60e300fdf203faeec3bd52fb1e4efbbe8f7b40158eea1f49ddc9d94da306
- decision-cli.mjs — 100 — 4601b46a49d73895df23c4eff4241ccb28b3ecde348af970fea53b720c8a6fe3
- decision-evaluation.mjs — 125 — 16ad979bd0f413dfe8b2fed05593f2c7be38e1fc571ee7afe1321743fe6fbb37
- decision-executor.mjs — 250 — 67afe7f88f96d72bc16d429bde39cda0d62c24aff94c125bb9e611de1dcca9ad
- decision-inputs.mjs — 232 — 1bc1ced7e7d8eeeda4a0e6acefbff77e960659737a2992ebed5ba0a91f08af3d
- decision-lifecycle.test.mjs — 191 — 89c28b6840036147f9f7fab77f2bc63e43daaf48a2fda8ea55e1f434caf476d1
- decision-protocol.mjs — 37 — 39a3e8e391c56e728800b1573775e3a3958b176dde55777b3dd5d9597afc8c0d
- decision-report.mjs — 258 — daecc57b534f0123a2b97863e90996076d57581e9f6e5f86c3b3dcef546cfdd5
- decision-run-state.mjs — 112 — aab421516308a33bd0ceea77a3b05129125e8d59452588fcad92693181637a77
- decision-runtime.mjs — 237 — f5dcf6220dae5b40aadfec93261c05624e87bb50c02f243275c7fae49180d093
- decision-scores.mjs — 75 — 62ee6aee5fa187aa5d4369551498b15240c0d91aa276aec79c648270a2d9f082
- decision.test.mjs — 261 — b5a922203c411fca7ec8128d834af8a79ab5ed51291b9257a26bed8873d69ca6

**Riscos/limites:** o preflight valida assets e tokenização sem inferência, mas não confirma que uma rodada real completará; isso permanece pendente do principal. Métrica RSS não observa nem agrega filhos. Não há aprovação integrada nem autorização de execução nesta entrega.