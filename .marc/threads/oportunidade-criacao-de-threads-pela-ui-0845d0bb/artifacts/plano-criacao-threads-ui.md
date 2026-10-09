# Plano de criação de threads pela UI

## Objetivo e decisões aprovadas

Permitir que o usuário crie uma thread no workspace selecionado sem recorrer a um agente. Botão antes da busca, ícone Lucide `PencilSparkles`, formulário em Sheet lateral direito equivalente ao de anexos. Pedir somente o título e abrir a thread vazia para escrever a primeira mensagem no composer existente.

Decisões confirmadas pelo usuário nesta sessão: título somente; ícone pencil-sparkles; reutilização dos perfis principal codex-software-architect e desenvolvedor codex-dev, gpt-6-luna/xhigh, execução sequencial. O usuário autorizou a implementação do plano. Não há questão de produto pendente.

## Fontes e análise

- Thread atual, mensagens msg_068f6c3994634a8986, msg_05be6e74ad7e4605af e msg_4e6df3635f5b47dd9e.
- README, docs/architecture.md, docs/ui-and-daemon.md, docs/development.md, docs/agent-workflows.md, docs/harness-engineering.md, ADRs 0001, 0003, 0004, 0007, 0008 e 0009.
- Contrato completo do workspace marc-dd422176e1, C:\Projetos\marc, retornado por workspace_bootstrap; skill marc-ops e Custom Rules.
- memory_recall e leitura das summaries das threads de Sheet de atalhos 5845b8a1 e background memory aa4908aa. Reutilizar Sheet e ModalSheetHeader, preservando a composição compartilhada e o comportamento dos consumidores existentes.
- Inspeção via context-mode: createThread no core aceita somente título; daemon expõe listagem e postagem, mas não criação; composer funciona em thread sem mensagens; listagem usa índice derivado e SSE.
- Node v22.20.0, pnpm 10.10.0; lucide-react instalado 1.23.0 exporta PencilSparkles.

## Implementação e interfaces

### API e fonte de verdade

Adicionar POST /api/workspaces/:workspaceId/threads, autenticado pelo mecanismo atual. Entrada JSON com title string; resposta HTTP 201 com ThreadInfo existente. Validar JSON, payload de objeto, tipo string, título não vazio após trim e sem CR/LF. HTTP 400 para entrada inválida e 404 para workspace inexistente; autenticação atual fornece 401. Falha de persistência segue o tratamento 500 atual.

Reutilizar createThread, sem alterar contratos MCP/core ou formatos. O core gera ID, CHAT.md e diretório artifacts; não criar mensagem inicial, perfil ou SUMMARY.md. Markdown continua a fonte de verdade. Reconciliar índice derivado e emitir workspace-changed. Depois da escrita canônica, falha de índice não transforma a criação em erro: preservar 201 e programar recuperação pelo mecanismo existente.

### UI e integração

Botão PencilSparkles de 15 px antes de Search no modo Threads; tooltip e aria-label Create thread. Desabilitar sem workspace ou sem token bloqueado e válido. Não condicionar à disponibilidade da busca de memory.

Sheet lateral direito, com ModalSheetHeader, identidade do workspace, campo Title e Cancel/Create thread. Reutilizar geometria, tokens, animação e body lock. Foco inicial no título, retorno ao acionador ao cancelar, Tab contido. Campo simples, sem limite arbitrário adicional; validar título antes do POST. Cancelar descarta o formulário. Enter envia. Bloquear envio duplo, edição e fechamento durante a requisição. Se necessário, adicionar opção de desabilitar Close no header compartilhado, padrão false.

Falha de criação mantém título e erro no painel. Após 201, inserir ThreadInfo sem duplicação na lista, selecionar e carregar pelo fluxo existente, fechar o Sheet. Manter estados de sucesso da criação e erro de leitura separados: falha posterior oferece retry de leitura e não permite repetir criação. Limpar payload anterior ao exibir a nova seleção para evitar conteúdo da thread anterior. Preservar comportamento atual de rascunhos do composer e seleção após reload.

Preservar em memória, por workspace, somente criações já confirmadas pelo core que ainda não aparecem no índice retornado pela listagem. Mesclar essas entradas durante refresh/SSE até a primeira listagem que reconheça os IDs, sem duplicação; então liberar a retenção. Isso cobre lista anterior durante rebuild concorrente ou falha derivada após 201. Não persistir esse buffer, não reter indiscriminadamente threads removidas e não alterar core.

Capturar workspace de destino ao abrir e não aplicar resposta tardia ao workspace que passou a estar selecionado. A UI modal bloqueia navegação de fundo; ainda assim proteger contra troca programática/SSE. Não ampliar alterações para corrigir outros problemas do app.

Textos UI em en-US no catálogo i18n e comunicação operacional em pt-BR. Atualizar o estado vazio que orienta criar threads por agente. Documentar o novo fluxo e endpoint.

## Handoff atômico ao desenvolvedor

Principal codex-software-architect, runtime /root; executor codex-dev, modelo solicitado gpt-6-luna, raciocínio xhigh. Configuração humano-confirmada nesta sessão, não runtime-introspectada. Principal gpt-6.1-sol/high conforme perfil existente, confirmação humana reutilizada. Limite um desenvolvedor ativo; não despachar outros agentes.

Antes de editar: bootstrap independente; ler contrato completo, fontes acima, skill marc-ops e este plano; retornar OK_BOOTSTRAP com identidade/path, fontes, regras críticas, configuração solicitada e efetiva quando verificável, fonte de confirmação, escopo e estado dos alvos. Aguardar autorização explícita do principal. Não administrar perfis, usar Git ou escrever fora do escopo.

Arquivos autorizados existentes:

- src/daemon/routes.ts
- src/ui/app.tsx
- src/ui/app-actions.ts
- src/ui/app-sync.ts
- src/ui/app-modals.tsx
- src/ui/app-sidebar.tsx
- src/ui/app-sidebar-middle.tsx
- src/ui/app-sidebar-lists.tsx
- src/ui/modal-sheet-header.tsx
- src/ui/use-app-shell-effects.ts
- src/ui/types.ts
- src/ui/styles/overlays.css
- public/locales/en_US/translation.json
- test/i18n.test.ts
- test/ui-app-sidebar.test.ts
- docs/ui-and-daemon.md

Novos arquivos autorizados, conforme necessidade da separação de responsabilidades:

- src/daemon/thread-routes.ts
- src/ui/thread-creation.ts
- src/ui/use-thread-creation.ts
- src/ui/use-app-data-actions.ts
- src/ui/thread-create-modal.tsx
- test/daemon-thread-creation.test.ts
- test/ui-thread-creation.test.ts
- test/ui-thread-create-modal.test.ts

Evidências do executor autorizadas apenas em artifacts/resultado-criacao-threads-ui.md nesta thread; evidências temporárias fora dos arquivos de produto podem ficar no diretório temporário do sistema. Principal administra plano e atividade. Exclusões: core/MCP, perfis, regras gerenciadas, configurações de cliente/hook, dependências, lockfile, histórico, threads externas. Solicitar ampliação ao principal se necessária, sem executar antes de autorizada.

## Verificação e critérios de aceite

1. API cria thread canônica aberta sem mensagens; permite título com acentos e espaços normalizados nas extremidades. Listagem, leitura e postagem posterior funcionam.
2. Sem token, workspace inexistente, JSON inválido, null/array, tipo errado, vazio/espaços e CR/LF: erro correto e nenhuma thread criada.
3. Índice reconstruído antes da listagem normal; evento contém workspaceId/threadId. Falha derivada preserva criação e recuperação. Sem alteração de RULES ou perfis.
4. Workflow UI: somente um POST durante duplo envio; título preservado em erro; sucesso sem duplicação; retry após erro de leitura não repete POST; resposta tardia não muda outra seleção.
5. Playwright CLI com fixtures ou workspace temporário: ordem e ícone; habilitação por workspace/token; título/Enter; cancelamento/Close/Escape/backdrop; busy bloqueia interação e fechamento; foco/body lock/animação; erros; criação e composer vazio; refresh e sincronização. Desktop 1440x900, mobile 390x844 e viewport baixa 320x240, sem overflow horizontal ou ações inalcançáveis.
6. Tests de API/workflow primeiro, confirmar falha da feature ausente antes de código. Usar checks comportamentais; evitar testes que apenas repetem implementação.
7. Executar pnpm validate, pnpm build e pnpm test via context-mode. Antes de validate, capturar baseline de conteúdo para detectar side effects de lint/Prettier; ele escreve globalmente. Se houver mudança fora do escopo, reportar conflito antes de qualquer reversão. Não limpar trabalho existente.
8. Revisar documentação; branches sem else/nested if, guards early return, dispatch para variantes. Não adicionar dependências ou migração.

## Revisão e entrega

Ampliação técnica autorizada pelo principal durante validação: use-app-data-actions.ts compõe useAppSync e useThreadCreation, controla o buffer de criações confirmadas e expõe os callbacks necessários. Não acoplar infraestrutura de sync à feature. AppModals recebe o controlador de criação como prop único tipado. Extração necessária para respeitar o limite de 300 linhas do lint de app.tsx; não alterar comportamento ou ampliar funcionalidades.

Executor retorna paths/linhas, resumo, comandos/resultados reais, documentação, riscos e desvios. Principal revisa independentemente toda a integração e evidências, não somente relatório/testes. Registrar na atividade fontes/escopo, critérios ligados a código/evidência, descobertas/limitações e veredito explícito approved/pending/rejected. Enviar achados ao executor; qualquer correção exige nova revisão e checks afetados. Auditar artifacts/messages após metadata. Aprovação técnica não equivale a aceite humano; manter thread aberta até autorização explícita de fechamento.
