# Oportunidade - Atalhos de teclado em sheet lateral

Thread: `oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1`
Created: `2026-07-20T22:59:58.906Z`

<!-- marc-message
id: msg_102a5d5cf3ec4a4f95
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-07-20T23:00:35.168Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para abrir os atalhos de teclado em um sheet lateral.

Direcao inicial:
- substituir a apresentacao atual por um sheet que siga o padrao ja usado nas configuracoes da workspace;
- preservar o acionador existente no footer, navegacao por teclado, foco, fechamento e bloqueio de background;
- manter os atalhos e seu conteudo, alterando apenas a superficie e a experiencia de abertura;
- validar alinhamento com os modos de tres colunas e viewports estreitos.

O objetivo e unificar a experiencia de superficies laterais sem transformar o link de atalhos em um novo fluxo de navegacao.

<!-- /marc-message -->

<!-- marc-message
id: msg_ce6d620c9f754c16ab
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T05:34:32.750Z
agentId: codex-software-architect
artifacts: artifacts/proposta-sheet-atalhos.md
-->

Proposta estruturada no plano anexado: migrar os atalhos para o Sheet direito existente, preservando conteúdo, footer, foco e fechamento, com validação de responsividade via Playwright CLI.

Execução autorizada pelo usuário nesta sessão. Perfis reutilizados: principal marc://@codex-software-architect e desenvolvedor marc://@codex-dev. Configuração humana confirmada: principal ≥ medium; desenvolvedor gpt-6-luna/xhigh. Modo sequencial, um desenvolvedor ativo.

Fontes inspecionadas via context-mode e histórico consultado por memory_recall. Sem mudanças em persistência; Markdown permanece fonte de verdade. A thread ficará aberta para revisão humana.

<!-- /marc-message -->

<!-- marc-message
id: msg_19798a1246254ff7b0
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T05:38:37.861Z
agentId: codex-software-architect
-->

OK_BOOTSTRAP verificado do runtime /root/shortcuts_sheet, perfil marc://@codex-dev: workspace marc-dd422176e1 e C:\Projetos\marc corretos; contrato, fontes e escopo do plano lidos; alvos existentes e hashes registrados. Configuração solicitada gpt-6-luna/xhigh, confirmada pelo usuário; cliente sem introspecção separada. Sem edição até este checkpoint.

Autorizo explicitamente a implementação no escopo do plano anexado, com correção local de foco se a validação indicar necessidade. Manter execução sequencial, preservar trabalho existente e reportar qualquer mudança de validate fora do escopo antes de continuar.

<!-- /marc-message -->

<!-- marc-message
id: msg_c9a8483ba7204b209d
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T06:25:48.168Z
agentId: codex-software-architect
artifacts: artifacts/resultado-sheet-atalhos.md
-->

Desenvolvimento e revisão técnica concluídos. O sheet direito preserva o footer e os atalhos, restaura foco ao fechar e mantém conteúdo rolável, com layout empilhado até 480 px.

Execução: perfil marc://@codex-dev, runtime /root/shortcuts_sheet, gpt-6-luna/xhigh confirmado pelo usuário. Revisão independente do principal via context-mode e Playwright CLI: nove casos de viewport/fechamento aprovados; fixtures confirmaram workspace, thread, agent e overview. Documentação da UI atualizada.

Checks executados pelo principal: pnpm validate e pnpm build passaram; pnpm test passou, 199/199. Vite emitiu aviso de tamanho do bundle. Validate também gravou saídas automáticas em 86 arquivos fora da feature; foram preservadas, com inventário e limitação da comparação no resultado anexado.

Aprovação técnica concedida. Resultado disponível para revisão humana; thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_86b80e4d093d4ebeba
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T12:20:17.764Z
agentId: codex-software-architect
artifacts: artifacts/plano-header-compartilhado-sheets.md
-->

Plano aprovado pelo usuário para centralizar header e Close dos quatro sheets. Handoff anexado define interface, escopo de três arquivos e validação, preservando DOM, classes, foco e animação existentes.

Inspeção via context-mode e histórico via memory_recall concluídos. Preflight técnico pnpm code:check passou (lint e formatação), sem escrita. Perfis e configurações confirmados nesta sessão serão reutilizados: principal marc://@codex-software-architect; desenvolvedor marc://@codex-dev, gpt-6-luna/xhigh, runtime /root/shortcuts_sheet. Execução sequencial, um desenvolvedor ativo.

Markdown permanece fonte de verdade. Sem alterações de API pública ou persistência.

<!-- /marc-message -->

<!-- marc-message
id: msg_25d7cb1025d64848bf
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T12:22:45.576Z
agentId: codex-software-architect
-->

OK_BOOTSTRAP verificado de /root/shortcuts_sheet: contrato independente desta sessão ainda vigente, workspace marc-dd422176e1 e raiz C:\Projetos\marc corretos; plano, resultado anterior, fontes e regras lidos. Configuração gpt-6-luna/xhigh mantém confirmação humana; sem introspecção separada. Dois consumidores existentes com hashes registrados; novo componente ainda ausente.

Autorizo explicitamente a edição dos três caminhos do handoff. Preservar DOM, classes, conteúdo e tratamentos de foco/animação. O principal executará checks globais após código final; desenvolvedor validará navegador com fixtures, sem edições concorrentes ou mudanças de registros reais.

<!-- /marc-message -->

<!-- marc-message
id: msg_63e80f3427cd4ebe88
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T12:31:55.862Z
agentId: codex-software-architect
-->

Revisão de código: composição compartilhada corresponde ao plano; fingerprints dos consumidores, excluindo somente imports/header/Close, iguais à baseline. Validate passou sem escrita adicional nos 191 arquivos comparados; build passou.

A suíte reproduziu 198/199: falha no contrato de i18n porque a lista explícita de arquivos autorizados ainda não inclui o novo componente UI. Causa confirmada em test/i18n.test.ts:49–85 via context-mode e systematic-debugging.

Autorizei o mesmo desenvolvedor a adicionar exclusivamente src/ui/modal-sheet-header.tsx nessa lista. Plano recebeu o adendo; regex e demais asserções permanecem. Correção necessária para preservar a ADR 0008, sem ampliar localização para backend.

<!-- /marc-message -->

<!-- marc-message
id: msg_a5455e083cc84b58ab
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T12:42:49.593Z
agentId: codex-software-architect
artifacts: artifacts/resultado-header-compartilhado-sheets.md
-->

Header compartilhado implementado nos quatro sheets: atalhos, criação/visualização de anexo e configurações do workspace. Revisão independente via context-mode confirmou preservação de DOM, classes, conteúdo e comportamento; as oito capturas desktop/mobile foram revisadas pelo principal.

Validação: pnpm validate e pnpm build aprovados; pnpm test aprovado com 199/199. Validate não alterou arquivos. A integração i18n recebeu apenas a entrada autorizada na allowlist. Documentação revisada, sem necessidade de atualização para esta composição interna.

Resultado detalhado anexado, com escopo, revisão, evidências Playwright CLI e estado dos recursos. Aprovação técnica concedida; aguarda revisão humana. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_25f595e572ab468caa
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T12:53:07.223Z
agentId: codex-software-architect
artifacts: artifacts/revisao-final-integrada.md
-->

Revisão final integrada concluída sobre toda a implementação acumulada: migração dos atalhos para Sheet e header compartilhado dos quatro consumidores. Este checkpoint complementa as revisões por etapa; elas não substituíam a revisão final exigida pelo fluxo.

Principal inspecionou código, integração, arquitetura, regras, documentação e evidências via context-mode. Segunda leitura independente, somente leitura, do runtime /root/final_sheet_review não encontrou defeitos novos. Nova sessão Playwright CLI do principal confirmou os quatro sheets em três viewports e nove casos de foco/fechamento/reabertura dos atalhos. Lacuna anterior de métricas 320×240 resolvida.

Nenhuma correção de código necessária. Validate/build e 199/199 testes já aprovados nesta sessão permanecem aplicáveis ao estado final, cuja integridade foi conferida. Matriz de aceitação, evidências e limites anexados. Aprovação técnica final concedida; thread permanece aberta para aceitação humana.

<!-- /marc-message -->

<!-- marc-message
id: msg_223147f2af8d48f1ba
threadId: oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
timestamp: 2026-10-09T13:05:45.449Z
agentId: codex-software-architect
artifacts: artifacts/revisao-final-integrada.md
-->

Encerramento explicitamente autorizado pelo usuário nesta conversa: “Pode encerrar a thread.” A revisão final integrada e a aprovação técnica estão registradas; não há correção funcional pendente no escopo.

Backlog UI revisado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a: expectativas atualizadas para Sheet lateral e header compartilhado, com cenários E2E duráveis ainda pendentes. Atualização registrada em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a/#msg_601069783c24469295.

Resumo executivo será preservado em SUMMARY.md, mecanismo canônico de encerramento. Resultados, validações e limitações continuam nos artefatos anexados.

<!-- /marc-message -->
