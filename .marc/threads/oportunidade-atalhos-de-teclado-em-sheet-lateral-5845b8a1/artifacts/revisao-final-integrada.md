# Revisão final integrada: atalhos em Sheet e header compartilhado

## Conclusão

Revisão final integrada realizada em 2026-10-09 pelo principal, após a solicitação explícita do usuário. Abrange a implementação acumulada das duas etapas da thread, confrontada com ambos os planos, critérios de aceitação, contrato do workspace, documentação e evidências de validação. As revisões das entregas individuais não substituíam este checkpoint final.

Não foram identificados defeitos novos ou violações de regra que exijam correção no escopo funcional integrado. A migração para Sheet e a composição compartilhada recebem aprovação técnica final do principal. Nenhuma edição de código foi necessária nesta revisão. Aceitação humana permanece pendente; a thread continua aberta.

## Fontes, responsabilidades e método

O principal releu a thread inteira, proposta-sheet-atalhos.md, resultado-sheet-atalhos.md, plano-header-compartilhado-sheets.md e resultado-header-compartilhado-sheets.md. Aplicou AGENTS.md, skill marc-ops, contrato completo de bootstrap, docs/agent-workflows.md e os documentos e ADRs referenciados nos planos.

A inspeção final via context-mode cobriu modals.tsx completo, modal-sheet-header.tsx, workspace-settings-modal.tsx, Sheet e Button, CSS de overlays/responsividade/footer, app-content.tsx, AppModals, estado e callbacks de app.tsx, useModalBodyLock, estilos de bloqueio do fundo, i18n, catálogo, teste de localização e documentação UI/daemon. Sem Git ou PowerShell.

Uma segunda leitura independente foi feita pelo runtime /root/final_sheet_review, somente leitura, usando a skill requesting-code-review. O revisor realizou bootstrap independente no workspace marc-dd422176e1, C:/Projetos/marc, leu contrato, thread, quatro artifacts, README, workflows, harness, UI/daemon e ADRs 0001/0003/0004/0007/0008. Inspecionou o estado integrado e devolveu matriz de cobertura e avaliação de correção, arquitetura, manutenção, regras e documentação; não encontrou defeitos novos. Não editou arquivos, publicou registros, administrou perfis ou despachou agentes. Sem aprovação pendente.

O principal não substituiu sua avaliação pelo relatório do revisor: inspecionou a integração, verificou as evidências e executou uma nova sessão independente de navegador. Publicação sob o perfil codex-software-architect; catálogo atual conferido. Configuração herdada do principal e mínimo de reasoning humano-confirmados nesta sessão; sem introspecção adicional para afirmar configuração efetiva do revisor. Nenhum perfil novo foi criado.

## Matriz de aceitação final

| Critério | Avaliação e evidência |
| --- | --- |
| Superfície lateral e acionador | Sheet direito utiliza geometria e primitivas existentes. Footer mantém href e callback, com preventDefault; não introduz navegação ou novo fluxo. |
| Conteúdo | Quatro atalhos, descrições, ícone e chaves de tradução preservados. |
| Acessibilidade | SheetTitle/SheetDescription mantêm nomes e vínculos acessíveis; descrição de atalhos permanece sr-only; Close tem title e aria-label traduzidos. |
| Foco de atalhos | Captura do elemento anterior e restauração local preservadas; foco inicial interno e Tab/Shift+Tab comprovados no estado integrado. |
| Fechamento e reabertura | Close, Escape e backdrop convergem para open=false; callback final ignora animações de filhos e remove o consumidor. Nove casos finais passaram, com reabertura e sem sheet ou bloqueio remanescente. |
| Fundo | Radix e estado global mantêm bloqueio modal; useModalBodyLock e CSS permanecem coerentes. Liberação comprovada após fechamento. |
| Layout e rolamento | Geometria herdada, flex/min-height zero, scrollbar-gutter e linhas empilhadas até 480 px preservados. Quatro sheets verificados em três viewports, sem overflow horizontal ou colisão com Close. |
| Composição compartilhada | Fragment mantém Header e Close irmãos diretos. Props ReactNode e classes opcionais preservam conteúdo específico dos quatro consumidores; componente não assume estado ou callbacks dos consumidores. |
| Ações existentes | Formulário, Cancel, Save, visualização e callbacks de configurações permanecem nos consumidores. POST do anexo foi interceptado e alterou apenas a fixture. |
| Arquitetura e manutenção | Extração pequena, sem dependências, wrappers ou variantes de comportamento adicionais. Responsabilidades de conteúdo/estado continuam locais. Persistência permanece intacta; Markdown continua fonte de verdade. |
| Regras e localização | Conteúdo técnico em en-US; comunicação em pt-BR. Sem else ou if aninhado nas alterações; guards planos. Tradução restrita à UI pela entrada específica na allowlist existente. |
| Documentação | UI/daemon descreve sheet, acionador e fechamento. README, workflows, harness e ADRs não exigem atualização pela composição interna. |

## Evidência final de navegador do principal

Playwright CLI, sessão independente final-review-5845, http://127.0.0.1:5181/. API integralmente interceptada nas fixtures: 22 requisições, zero rotas faltantes; POST de anexo somente sintético. Sem alteração de registros reais.

Os quatro sheets foram medidos em 1440×900, 390×844 e 320×240. Em todas as 12 combinações: Header/Close irmãos diretos; sem colisão entre título e Close; sem overflow horizontal documental ou do painel; rolamento alcançável. Painéis: desktop [712,32,696,836], mobile [16,16,358,812], compacto [16,16,288,208].

| Sheet | Rolamento interno em 320×240 |
| --- | --- |
| Atalhos | Range 337 px; alcançável. |
| Configurações | Range 578 px; alcançável. |
| Criação de anexo | Range 557 px; alcançável. |
| Visualização de anexo | Range 1412 px; alcançável. |

Em seguida, o principal executou nove combinações de atalhos: três viewports × Close/Escape/backdrop. Todas passaram nas asserções de Sheet, quatro linhas, foco inicial interno, Tab/Shift+Tab contidos, fundo bloqueado, retorno ao acionador, ausência de overflow, zero sheets remanescentes e liberação de modal-open/data-scroll-locked e bloqueio do root.

Scripts existentes reutilizados:

- C:/Users/junior/AppData/Local/Temp/shared-modal-sheet-fixtures-20261009.js
- C:/Users/junior/AppData/Local/Temp/principal-shortcuts-review.js

As oito capturas shared-modal-* de desktop/mobile foram atualizadas pela execução final; já haviam sido inspecionadas individualmente pelo principal. A lacuna de métricas compactas do relatório anterior foi resolvida pela nova execução, cuja saída foi processada e preservada de forma resumida via context-mode.

Erros de SSE no console decorrem do abort explícito da rota de eventos na fixture. O favicon ausente pertence ao preview, sem relação com os sheets. Nenhuma exceção de produto apareceu na execução. A sessão própria final-review-5845 foi fechada; default e o servidor iniciado pelo desenvolvedor foram preservados.

## Checks e integridade do estado

Os checks obrigatórios já foram executados pelo principal nesta sessão sobre o estado final de produção: pnpm validate e pnpm build com exit 0; pnpm test 199/199, sem falhas, skips ou cancelamentos. Após a correção exclusiva da allowlist de i18n, validate e a suíte completa foram repetidos; o código de produção não mudou desde o build aprovado.

Na revisão final, os hashes de modals.tsx, modal-sheet-header.tsx, workspace-settings-modal.tsx e test/i18n.test.ts coincidem com o estado validado. A inspeção de src/test também não encontrou gravações posteriores ao checkpoint dos checks finais. Não houve correção nova que justificasse repetir checks globais. Validate final havia comparado 191 arquivos e não gerou alterações automáticas.

O aviso de bundle acima de 500 kB continua registrado, sem falha de build.

## Limites e aceitação

Configurações e os dois consumidores de anexos preservam onOpenAutoFocus.preventDefault() e o foco inicial externo existente. Não é regressão da extração e não foi alterado nesta tarefa.

A primeira etapa teve 86 arquivos gravados pelo formatter global sem baseline semântica completa. O inventário e essa limitação permanecem no resultado inicial; esta revisão não inventa equivalência semântica para mudanças desconhecidas fora da feature. Isso não substitui nem elimina a revisão final integrada do escopo funcional, concluída acima.

Não há correção funcional pendente no escopo revisado. Aprovação técnica final concedida pelo principal; aceitação e autorização de fechamento cabem ao usuário.
