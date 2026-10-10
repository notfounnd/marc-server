# Atividade: correção do teste de auto-idle

Plano aprovado e execução solicitada pelo usuário em 2026-10-09. Workspace marc-dd422176e1, C:\Projetos\marc. O principal registrou o plano antes de desenvolvimento, preservando a análise causal existente.

Principal codex-software-architect, gpt-6.1-sol/high; desenvolvedor codex-dev, gpt-6-luna/xhigh; configurações humano-confirmadas na sessão e reutilizadas. Um desenvolvedor sequencial. Único path de implementação autorizado: test/daemon-runtime.test.ts, cenário de auto-idle.

Inspeção e prova de viabilidade anteriores via context-mode: sem fetch, 8/8 processos novos aprovados; controle negativo encerrou por timeout e executou limpeza. Runtime e arquivos do projeto não foram editados nessa prova.

Baseline atual de 250 arquivos coletado antes desta execução, sem Git. Registros mARC, dependências, builds, logs CLI e caches excluídos. Documentação de produto revisada e não requer alteração, pois a política do daemon permanece igual.

## Controle da execução e evidências

Desenvolvedor /root/auto_idle_fix, perfil codex-dev, selecionado explicitamente como gpt-6-luna/xhigh. OK_BOOTSTRAP independente recebido antes de edição: workspace/root corretos, contrato completo e Custom Rules, AGENTS/marc-ops, plano/análise/thread, README, docs de workflows/daemon, ADR 0001, skills TDD/verification e código alvo. memory_recall recuperou a decisão histórica 39436d9c, lida pelo desenvolvedor. Configuração efetiva estabelecida pela confirmação humana do handoff, sem alegação de introspecção.

O principal conferiu identidade, fontes, regras, configuração e hash do alvo 75c6381f5d220e260acc64216bd33303122a6bf2ee5b64b7bc38a61db4a10f63, igual ao baseline. Autorização explícita enviada no canal de agentes antes da edição. Plano registrado previamente e auditoria preflight: zero findings. O loop permaneceu interno; esta atividade consolida a entrega.

Implementação final em test/daemon-runtime.test.ts:114-139: cenário recebe context e timeout 5000; registra limpeza após criar o servidor; observa close com once antes de listen; verifica listening true, aguarda close e verifica false. Requisição HTTP e sua asserção foram removidas somente desse cenário. autoIdleMs 20, modo detached, porta 0, nome e demais cenários permanecem iguais.

| Evidência | Resultado real |
| --- | --- |
| RED do executor antes de editar | Processo novo, exit 1, fetch failed, 0 pass/1 fail, duração do subteste 57.56 ms. |
| GREEN do executor | GREEN_AUTO_IDLE_01 a GREEN_AUTO_IDLE_08: oito processos novos sequenciais, sem warmup, cada um exit 0 e 1 pass/0 fail. |
| Controle negativo do executor | NEGATIVE_AUTO_IDLE: falha esperada pelo timeout 5000, exit 1; blocked_auto_idle_close=160, cleanup_close_calls=1, cleanup_close_events=1. Runtime/test no disco não foram alterados pelo controle. |
| pnpm validate | VALIDATE_AUTO_IDLE_20261009_01: exit 0; lint, Prettier e typecheck aprovados. Formatter afetou apenas o alvo; escopo conferido independentemente por hashes. |
| pnpm build | BUILD_AUTO_IDLE_20261009_01: exit 0, 2391 módulos Vite, build em 27.41 s. dist recriado como previsto pelo script. |
| pnpm test | TEST_AUTO_IDLE_20261009_01: exit 0, 210 testes, 210 pass, 0 fail/cancelled/skipped, duração 12162.7568 ms. |
| Arquivo completo pelo principal | PRINCIPAL_AUTO_IDLE_FILE_REVIEW: comando Node sobre test/daemon-runtime.test.ts, exit 0, seis testes, 6 pass/0 fail; cenário de auto-idle aprovado. |
| Negativo independente do principal | PRINCIPAL_FINAL_SOURCE_NEGATIVE_AUTO_IDLE: cenário final extraído do arquivo e transpilado em memória; fechamento automático bloqueado, cleanup preservado por referência original. Exit 1 esperado, testTimeoutFailure após 5000 ms, cleanup chamado e close observado, sem kill pelo limite externo. blocked=159. |

Os resultados do executor foram enviados com trechos reais de TAP/outputs pelo canal de agentes; os rótulos de seu índice context-mode não estavam acessíveis ao índice do principal. A revisão distingue essas evidências delegadas das execuções independentes diretas do principal.

Oito wrappers iniciais de GREEN não chegaram ao teste por cwd ausente e foram descartados como erros de setup. Os oito GREEN considerados acima executaram efetivamente o cenário. Nenhum erro de setup é contado como RED ou GREEN.

## Revisão final integrada do principal

Fontes revistas: plano aprovado, análise causal, contrato e histórico de lifecycle, estado final do cenário e restante do arquivo, resultados reais do executor, documentação e comparação de hashes. O principal executou o arquivo completo e um controle negativo sobre o código final, além de inspecionar a ordem de registro/await e os efeitos de escopo.

| Critério | Avaliação técnica integrada |
| --- | --- |
| Eliminar a corrida identificada | A primeira requisição deixou de ser condição do teste de auto-idle. O cenário observa o evento de ciclo de vida diretamente; os oito processos novos aprovados demonstram independência de aquecimento prévio. A verificação HTTP de status continua no cenário foreground, aprovado na execução independente 6/6. |
| Preservar a prova de comportamento | listening true após listen comprova abertura; a Promise registrada antes de listen observa close, e listening false comprova encerramento. O teste não verifica apenas setup nem assume sucesso por passagem de tempo. |
| Detectar regressão sem pendurar | O watchdog de 5000 limita falha do teste, sem aumentar autoIdleMs 20. O controle negativo derivado do código final confirmou timeout, cleanup, close e término do processo; a limpeza não transforma a falha em aprovação. |
| Integração e manutenção | Alteração local usa node:test e helper existente, sem novos imports, helpers, bibliotecas ou políticas. Não há variações/guardas novas, else ou if aninhado no trecho. Textos de teste permanecem en-US; registros em pt-BR. |
| Preservar escopo e trabalho existente | Comparação final dos 250 arquivos: somente test/daemon-runtime.test.ts mudou, nenhum arquivo adicionado/removido. SHA final 6ec5d5a43d5e9e201b4047729f60eece157cb147bfe40361e6ec1a2f7d3d7f42. Reconstruir o arquivo substituindo apenas o cenário pela versão anterior reproduziu exatamente o hash original, comprovando que nenhum outro trecho mudou. Runtime, Toast, dependências e configuração preservados. |
| Documentação e evidência | README e docs/ui-and-daemon.md revisados; nenhuma mudança técnica necessária porque o produto continua igual. Validação/build/suíte aprovados no estado final. Não há limitação específica ou falha restante identificada nesta correção. |

O principal considera o teste representativo do requisito de encerramento sem atividade e a correção proporcional à causa. A mudança remove o requisito HTTP alheio ao cenário sem enfraquecer a prova de abertura/fechamento. O negativo confirma que o teste continua falhando quando a ação esperada deixa de ocorrer. A revisão não depende apenas do executor, dos checks verdes ou de auditoria estrutural.

**Veredito: approved — aprovação técnica do principal em 2026-10-09.** Nenhum achado bloqueante. Não foram modificados arquivos de implementação depois desta avaliação. Achados e aprovação devolvidos ao desenvolvedor; nenhum comando ou aprovação pendente. O usuário autorizou o encerramento em 2026-10-10. Hash do alvo confirmado igual ao estado aprovado; auditoria de mensagens sem findings. SUMMARY.md consolida o fechamento autorizado.
