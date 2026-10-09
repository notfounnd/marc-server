# Atividade e revisão final: migração para Toast do Neobrutalism

## Decisão, fontes e configuração

A proposta da thread 594973bb foi estruturada no plano anexado antes do desenvolvimento e aprovada no chat. O usuário solicitou a execução em 2026-10-09. A entrega substitui Sonner pelo componente local do registro oficial Neobrutalism, baseado em Base UI, preservando a API pública de notificações e a identidade visual existente. A apresentação não altera persistência: Markdown permanece a fonte de verdade.

Workspace confirmado: marc-dd422176e1, C:\Projetos\marc. Principal: perfil codex-software-architect, gpt-6.1-sol/high, configuração humano-confirmada. Desenvolvedor: perfil compartilhado codex-dev, instância /root/toast_migration, gpt-6-luna/xhigh, confirmação humana no chat. Execução sequencial com um desenvolvedor; sem delegação pelo executor. Revisor auxiliar /root/toast_review, gpt-6.1-sol/high, atuou somente em leitura; seu parecer não substitui a revisão do principal.

Fontes: plano desta thread; mensagem inicial msg_fef6a0d3094942f9b8; decisão histórica 024e05b1 recuperada por memory_recall e lida; README, AGENTS.md, marc-ops, docs/agent-workflows.md, docs/harness-engineering.md, docs/ui-and-daemon.md e ADRs 0001/0003/0004/0007/0008. Registro oficial https://neobrutalism.dev/r/toast.json e documentação https://www.neobrutalism.dev/docs/toast; documentação Base UI consultada via Context7. Inspeção e revisão dos resultados realizadas via context-mode.

## Controle e escopo

O principal estabeleceu bootstrap, verificou identidade e contrato completo, atualizou recomendações e registrou o plano com metadata. Auditoria preflight: ok, zero findings. O desenvolvedor realizou bootstrap independente e devolveu OK_BOOTSTRAP antes de editar, confirmando fontes, regras críticas, configuração, escopo e estado dos alvos. O principal verificou o acknowledgement e autorizou a implementação pelo canal entre agentes. Configuração efetiva foi estabelecida por confirmação humana, sem introspecção runtime.

Foram observados: Bash; nenhuma operação Git; native apply_patch para edição manual; Playwright CLI; en-US em código, produto, teste e documentação; pt-BR na comunicação; escopo restrito, sem alteração de Button, modais, daemon, tsconfig ou infraestrutura de testes. A autorização inicial de nove paths foi ampliada explicitamente para o singleton em toast-manager.ts. Esse módulo pequeno evita que o adaptador .ts importe o grafo TSX sob NodeNext, preserva a fronteira atual do typecheck e mantém um único objeto compartilhado.

Entrega nos dez paths autorizados:

- src/components/ui/toast.tsx: componente local, wrappers Base UI, apresentação, rótulos recebidos e integração com overlays.
- src/components/ui/toast-manager.ts: singleton criado por createToastManager, compartilhado com componente, adaptador e teste.
- src/components/ui/sonner.tsx: removido.
- src/ui/notifications.ts: API preservada, tabela de despacho e timeout.
- src/ui/app.tsx: montagem única do Toaster, linha 303.
- package.json e pnpm-lock.yaml: @base-ui/react ^1.9.0 adicionado e Sonner removido.
- public/locales/en_US/translation.json: Close toast e Notifications.
- test/ui-notifications.test.ts: regressão pela API pública toast.add.
- docs/ui-and-daemon.md: componente, duração, acessibilidade e integração com dialogs/sheets, linha 68.

Comparação de hashes sem Git, com baseline anterior de 272 arquivos: seis arquivos existentes modificados, três novos e um removido na implementação. Comparação final também encontrou alterações concorrentes em AGENTS.md e docs/agent-workflows.md; elas não integram esta entrega e foram preservadas. A origem não foi atribuída pelo principal. Os contratos atuais foram considerados na revisão e nesta consolidação.

Artefatos gerados pelo CLI também foram preservados: alteração do log preexistente .playwright-output/console-2026-10-09T06-08-56-718Z.log e novos console-2026-10-09T19-33-29-877Z.log e page-2026-10-09T19-33-46-051Z.yml. Nenhum cleanup ou revert amplo foi realizado.

## Evidências verificadas

Runtime: Node 22.20.0, pnpm 10.10.0 e playwright-cli 0.1.13.

| Verificação | Resultado e origem |
| --- | --- |
| Regressão do adaptador | RED funcional com chamadas capturadas vazias enquanto o adaptador usava Sonner; GREEN com os três payloads esperados. Teste usa mock.method em toast.add público, sem APIs privadas nem mutação de factory. Principal inspecionou e executou o teste focal: 1/1. |
| Checks independentes do principal | pnpm run code:check e pnpm run typecheck passaram; teste focal passou. Fonte context-mode: Toast principal independent contract and read-only code checks. |
| pnpm validate após correções finais | Exit 0; lint/fix, Prettier/fix, checks e typecheck padrão aprovados. Fonte: Toast final validate after overlay fixes. Efeitos de escrita conferidos pelo comparador de hashes. |
| pnpm build após correções finais | Exit 0, 2391 módulos, JS 671.12 kB / gzip 212.92, CSS 51.28 kB. Fonte: Toast final build after overlay fixes. |
| pnpm test final | Primeira execução após correções: 209/210, falha fetch failed em daemon-runtime.test.ts:127, subteste 128 de auto-idle. Arquivo isolado: 6/6, ISOLATED_EXIT=0. Repetição completa: 210/210, TEST_REPEAT_EXIT=0. Fonte: Toast final isolated daemon-runtime after transient fetch / Toast final complete suite repeat after transient fetch. Principal verificou os sumários indexados. |
| Checagem adicional TSX | Principal criou programa TypeScript com opções Bundler e typeRoots do workspace: Toast e dependências sem diagnósticos, inclusive após o handler final. App inteira apresenta quatro diagnósticos preexistentes fora do escopo, descritos abaixo. |
| Playwright CLI | Executor verificou tipos, fechamento, expiração, pausa por hover/foco, teclado F6/Tab/Escape/Enter, empilhamento, texto longo e viewport estreita. Principal revisou evidência de browser, código e capturas, incluindo desktop, Sheet e mensagem estável de 497 caracteres. |

Intermitência: o mesmo teste do daemon também havia falhado em uma execução anterior e passado isoladamente e na repetição completa. AutoIdleMs 20 pode contribuir para uma corrida de timing, mas a causa não foi confirmada. Nenhuma alteração foi feita no runtime ou teste do daemon; a repetição verde não elimina essa limitação de confiabilidade da suíte.

Limite do typecheck padrão: o tsconfig não cobre todo o grafo TSX. A checagem adicional da App encontrou content-header.tsx:98 (TS2677), :112 (TS2339), :158 (TS2345) e thread-create-modal.tsx:213 (TS2345). Hashes desses arquivos são idênticos ao baseline; os diagnósticos são anteriores à tarefa. Não há diagnóstico no Toast novo e não foram realizadas correções fora do escopo.

Capturas temporárias revisáveis em C:\Users\junior\AppData\Local\Temp:

- toast-migration-desktop-final.png
- toast-migration-overlay-final.png
- toast-migration-narrow-stable-304.png
- toast-migration-narrow-stable-497.png

A captura narrow-final feita durante entrada não foi usada como evidência de layout estável. Em 390×844, mensagens persistentes de 304 e 497 caracteres estabilizaram respectivamente em 358×344 e 358×538, terminando em y828, com margens de 16 px e sem overflow horizontal. Conteúdo ilimitado ou maior que a tela não foi comprovado por esses cenários.

## Revisão final integrada do principal

Escopo revisto: todo o estado integrado dos dez paths, plano, contrato atual, decisão visual histórica, documentação, dependências, teste público, evidência dos checks e cenários de browser. O principal inspecionou diretamente o código final via context-mode, comparou hashes e capturas e avaliou os limites do relatório executor. O parecer auxiliar foi usado como complemento para APIs, React 19 e propagação de eventos.

| Critério | Avaliação do estado final |
| --- | --- |
| Contrato de notificações | notifications.ts preserva assinatura, retorno void, mensagem e sucesso padrão. A tabela mapeia ok/success, warn/warning e error/error; timeout permanece 2400 ms. O teste verifica esses payloads e protege a migração sem acoplar ao estado privado da biblioteca. |
| Integração e manutenção | O singleton de três linhas é importado pelo adaptador e reexportado pelo componente. App monta somente um Toaster. Não há gerenciadores concorrentes nem mudança global de resolução de módulos. Sonner está ausente dos caminhos de implementação, manifest e lock. |
| Visual e interação | Tokens existentes, Button atual, superfícies neutras, bordas, sombra e tipografia permanecem coerentes nas capturas. Base UI mantém transições, pausa e limite padrão de três toasts visíveis; um quarto root limitado/inert no DOM não viola esse limite. Quebra de palavras e margens atendem os cenários longos e estreitos verificados. |
| Overlays | O registro oficial usava z-50 e o toast ficava atrás da Sheet real. O viewport final usa z-[100], comprovado por hit-test e captura. O clique Close também dispensava a Sheet por pointerDownOutside; o handler final em bubble chama o callback recebido e para propagação, sem preventDefault/capture. Após fechamento e 900 ms, Sheet permaneceu aberta e toastCount foi zero. A correção fica no Toast e não altera focus trap nem comportamento dos modais. |
| Acessibilidade e localização | Rótulos Close toast e Notifications passam pela camada UI e catálogo en-US. Ícones decorativos são aria-hidden. Root/Close e teclado foram verificados pelo executor; a integração conserva as primitivas Base UI. Não foi realizada auditoria abrangente com leitor de tela. |
| Regras e documentação | Variações usam tabelas de despacho; guarda de ícone usa early return; não há else nem if aninhado no código novo. Documentação foi atualizada e descreve duração, componente e fechamento independente dos overlays. Persistência e fonte Markdown não mudam. |
| Evidência e escopo | Validação padrão, build e repetição completa passaram no estado final. Comparação preserva arquivos externos e limita a implementação aos paths autorizados. As falhas intermitentes do daemon e os quatro diagnósticos TSX preexistentes estão explícitos; não são ocultados pelo resultado verde. |

Achados relevantes foram corrigidos no mesmo desenvolvedor e reavaliados após a última mudança: camada de overlay e propagação de pointerdown. O handler preserva controles e início dos gestos internos porque a interceptação ocorre no viewport em bubble; seu callback não é sobrescrito pelo spread. A solução é pequena, específica à integração entre portais Base UI/Radix e documentada. Não resta achado concreto bloqueante na migração revisada.

**Veredito: approved — aprovação técnica do principal em 2026-10-09.** A implementação atende o plano e seus critérios no estado final, com evidência de contrato, integração e comportamento. A corrida de startup no teste de auto-idle foi posteriormente diagnosticada e encaminhada à thread 504e1898, como detalhado abaixo. Permanecem as limitações dos diagnósticos TSX anteriores e da cobertura manual de browser descrita. Aprovação técnica e autorização humana de fechamento são etapas distintas. O usuário autorizou o encerramento em 2026-10-09; SUMMARY.md registra o fechamento após auditoria de mensagens sem findings e atualização do backlog Playwright. A thread 504e1898 permanece aberta.

## Esclarecimento sobre a origem das falhas

Após questionamento do usuário, o principal revisou a atribuição causal. A expressão anterior “intermitência independente” excedia a evidência: não há execução completa imediatamente anterior à troca de dependências nesta tarefa, nem comparação com o grafo de dependências antigo. Portanto, não está demonstrado que a falha seja preexistente ou independente da migração.

Comparação adicional via context-mode: 66 arquivos do daemon, testes existentes e configuração conferidos sem mudança em relação ao baseline; entre os paths comparados, apenas package.json e pnpm-lock.yaml mudaram. A migração removeu Sonner, adicionou Base UI e acrescentou ui-notifications.test.ts, que importa o manager e carrega Base UI. Isso muda o trabalho da suíte; não comprova aumento de carga como causa.

O executor confirmou que validate, build e test foram sequenciais nas duas execuções que falharam, com o mesmo script pnpm test. Na segunda, Vite e a sessão Playwright estavam ativos, com browser ocioso; não há confirmação de Vite ativo na primeira. Nenhuma causa foi estabelecida a partir dessas condições.

O principal repetiu a suíte completa: 210/210, exit 0. Depois executou os arquivos existentes com exclusão explicitamente conferida do novo teste: 209/209, exit 0. Esse controle conserva as dependências novas, não reproduz a falha e não constitui comparação completa antes/depois. Uma primeira tentativa de exclusão não reconheceu separadores Windows e rodou 210 testes; foi identificada e não é usada como controle. Resultado causal permanece inconclusivo. O daemon não foi editado, mas uma regressão indireta não foi descartada; a hipótese de corrida com autoIdleMs 20 continua sendo hipótese.

## Diagnóstico posterior e encaminhamento

A investigação causal solicitada pelo usuário confirmou a corrida de startup: o teste original sozinho falhou 8/8, sem executar notificações novas. Com troca HTTP nativa anterior no mesmo processo, passou 8/8. O trace sem atraso artificial mostrou listen concluído em 40.19 ms, fetch iniciado em 40.20, server.close por leases.ts:76 em 47.34 antes de qualquer request recebido e fetch failed/ECONNRESET em 52.43. O timer de 20 ms é instalado antes de listen e a inicialização de abertura/conexão pode consumir o intervalo. O resultado inconclusivo da seção anterior é superado por essa evidência.

O grafo estático de config.ts/server.ts tem 59 arquivos com hashes idênticos ao baseline, nenhum arquivo UI/components e somente imports externos estáticos node:*. Toast/Base UI não participam da reprodução. Classificação: fragilidade temporal no teste de ciclo de vida, fora da demanda de Toast. Registrada análise, reproduções duráveis e critérios de correção em marc://$corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898. Não foi alterado código de produto ou teste nessa investigação. Correção pendente na thread separada, conforme solicitação humana.
