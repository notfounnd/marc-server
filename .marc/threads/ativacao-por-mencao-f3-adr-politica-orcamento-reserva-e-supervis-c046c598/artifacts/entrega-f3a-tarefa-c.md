# Entrega F3a, tarefa C: ajuste ao modelo da revisão 3 e correção da migração

Autor: claude-dev (developer), sob a autorização do principal claude-software-architect.

## Escopo entregue

- Etapas fixas: planejamento, execução e revisão final. Participantes calculados ao vivo a partir dos perfis com papel architect, somente leitura no painel.
- Policy v2 (`policy.json`): switch, modo, limites e revisão. Sem `participants` e sem `stages`. Política v1 (F3a) é lida como `outdated`; só um save autorizado a normaliza.
- Mapeamento explícito de etapa F3a para planejamento (`stageMapping`), exibido antes de salvar. Contadores antigos ficam em `legacyStages`, nunca viram ciclos.
- Ciclos por etapa: `activation.cyclesPerStage` em `.marc/marc.config.json` (1 a 20, padrão 5). Autorização local registrada pelo daemon no save da UI (revisão, valor efetivo e hash), em `workspaces/<id>.json`. Edição manual pausa threads ligadas com `settings_tampered`. Save da UI reautoriza sem apagar consumo, extensões ou pausas. Save só de memória preserva o bloco `activation`.
- Ações humanas: `POST .../activation/extend` e `POST .../activation/advance`, com `expectedStage` comparado atomicamente. Avançar em revisão final é recusado; nenhuma quarta etapa.
- Orçamento: `budget_last_cycle`, `budget_exhausted`, mais `settings_tampered` e `policy_outdated`. Removidos: `maxPasses`, a regra de "abaixo do usado", add/remove de etapa.
- Migração F2: marcador durável `sessions.migration.json`, gravado após arquivos por thread e rename. Com marcador válido, `sessions.json` reaparecido é ignorado. Migração interrompida (sem marcador) refaz. Marcador inválido falha fechado.
- Espera: política v1 habilitada conta como governada (saída 8, `policy_active`).
- Painel: indicador de 3 passos, `N de M ciclos`, barra segmentada, `Mais N ciclos` e `Avançar etapa` no limite, `Avançar etapa` discreto sempre. Zap à esquerda de sessões. Campo `Cycles per stage` no painel de configurações da workspace.
- Removido: `src/components/ui/checkbox.tsx` (sem consumidor após participantes somente leitura).
- Documentação: ADR 0014 (Consequences), `docs/ui-and-daemon.md`, `docs/agent-workflows.md` (regra: com o interruptor ligado, o principal delega ao dev só após consenso de plano com o outro arquiteto; o contador não prova consenso).

## Verificação

- `pnpm validate`: exit 0.
- `pnpm build`: exit 0.
- `pnpm test`: 1741 aprovados, 0 falhas. Testes antigos de F3a removidos ou reescritos: regra "abaixo do usado", ledger e pin antigos, rotas de edição, pausa por estágio e UI de etapas.
- Testes novos: estado do daemon (pin, autorização de ciclos com manual, reinício e save de memória, mapeamento F3a, extensão e avanço), migração com marcador (4 casos), rotas (contrato v2, configurações, edição manual), orçamento por linhas, espera com v1.

## Navegador (playwright-cli, daemon temporário na porta 4299)

- Interruptor ligado, política salva, participantes somente leitura, indicador de etapas.
- 4 de 5: linha de último ciclo. 5 de 5: esgotado, `Mais 5 ciclos` gera 5 de 10, `Avançar etapa` duas vezes, depois avanço em revisão final recusado com a mensagem.
- Ciclos alterados para 3 na UI: refletido no painel e na API.
- Edição manual de `marc.config.json` (3 para 4): status Paused, aviso `settings_tampered`, orçamento com o valor autorizado.
- Save pela UI: volta a `On · confirm` e `0 de 3 ciclos`.
- Política v1: `Save the policy again to use the new stages.`; linha de mudança para planejamento antes de salvar; após salvar, etapa planejamento, histórico F3a preservado e `policy.json` na versão 2.
- Console: sem erros; uma nota verbosa do navegador sobre o campo de token.
- Captura: `scratchpad/browser/panel-review.png`.
- Daemon temporário encerrado por PID verificado (linha de comando com `--port 4299`); porta livre; pastas temporárias removidas.

## Limitações

- O cenário de 4/5, 5/5 e etapa F3a foi montado por arquivo de estado do daemon temporário, porque a contagem só existe na F3b.
- A verificação de consumo mantido após save da UI, no navegador, usou a etapa de revisão com 0 ciclos. A retenção de extensões está coberta pelo teste de estado do daemon.
- Teste `cli-wait-policy` falhou uma vez com EPERM no rename atômico de `policy.json` sob carga paralela no Windows; passou em três execuções isoladas e na suíte completa seguinte. Causa: corrida de escrita atômica já existente, fora do escopo.
