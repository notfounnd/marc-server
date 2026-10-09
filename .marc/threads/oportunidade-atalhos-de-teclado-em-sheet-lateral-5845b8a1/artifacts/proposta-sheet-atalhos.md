# Proposta e plano: atalhos em sheet lateral

## Resumo

Substituir o diálogo central de atalhos por um sheet à direita, seguindo a superfície existente de configurações da workspace. Preservar o link no footer, os quatro atalhos, o conteúdo traduzível, o bloqueio do fundo e os caminhos de fechamento. Não alterar navegação, persistência, APIs ou contratos MCP.

## Fontes e decisões

- Thread `oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1`, mensagem `msg_102a5d5cf3ec4a4f95`.
- Bootstrap confirmado no workspace `marc-dd422176e1`, raiz `C:\Projetos\marc`; contrato completo e Custom Rules lidos.
- README, docs de agent workflows, harness engineering e UI/daemon; ADRs 0001, 0003, 0004, 0007 e 0008.
- Histórico consultado por memory_recall e thread_read: sheets das configurações e artifacts; modal original de atalhos no autocomplete.
- Inspeção via context-mode: `modals.tsx`, configurações, Sheet, CSS de overlays, footer e responsividade.

## Solução

Usar Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription e SheetClose existentes. Reutilizar `useAnimatedSheetClose` de `modals.tsx`, as classes de geometria `.artifact-sheet` e o fechamento após a animação. O header mantém título e ícone; o botão Close deve continuar acessível. Manter os atalhos e descrições existentes, inclusive as chaves i18n. Criar corpo rolável com min-height zero e scrollbar-gutter estável; impedir recorte horizontal em telas estreitas. Preservar ou corrigir foco inicial e retorno ao acionador conforme evidência de navegador. A implementação não deve depender de nova biblioteca.

## Handoff atômico

### Papéis e configuração

- Principal: perfil `codex-software-architect`, runtime `/root`, responsável por plano, autorização, revisão independente e publicação.
- Desenvolvedor: perfil compartilhado `codex-dev`, runtime a registrar após spawn; modelo solicitado `gpt-6-luna`, reasoning solicitado `xhigh`.
- Confirmação: resposta humana nesta sessão confirma principal com reasoning equivalente a medium ou superior e desenvolvedor gpt-6-luna/xhigh. Os perfis existentes registram o mesmo modo de trabalho. Configuração efetiva só deve ser declarada quando verificável pelo cliente.
- Execução sequencial, máximo de um desenvolvedor ativo, conforme trial vigente; não delegar novamente.

### Escopo de escrita autorizado

- `src/ui/modals.tsx`: migrar a superfície e remover imports/helper de Dialog que ficarem sem uso.
- `src/ui/styles/overlays.css`: estilos locais de header/corpo do sheet, remoção de regras obsoletas exclusivas dos atalhos se comprovada ausência de outros consumidores.
- `src/ui/styles/responsive.css` e `src/ui/styles/composer-footer.css`: somente ajustes necessários aos atalhos em viewport estreito.
- `docs/ui-and-daemon.md`: atualizar descrição da superfície.
- Evidência temporária de navegador em `C:\Users\junior\AppData\Local\Temp`; arquivos automáticos de Playwright em `.playwright-cli/` ou `.playwright-output/` (conforme versão da CLI) e build em `dist/` permitidos.

Não alterar footer, estado global, configuração da workspace, primitivos compartilhados, bibliotecas, outros docs, testes, perfis ou registros mARC. Não usar Git. Usar Bash, context-mode e apply_patch. Não postar mensagens nem administrar perfis. Se surgir necessidade fora do escopo, comunicar ao principal antes de editar.

### Procedimento

1. Bootstrap independente e leitura das fontes; retornar OK_BOOTSTRAP com identidade, regras críticas, modelo/reasoning, fonte da confirmação, escopo e estado atual dos alvos. Aguardar autorização explícita do principal antes de editar.
2. Aplicar mudança mínima da superfície, com guards planos, sem else ou if aninhado; não refatorar outros sheets.
3. Revisar documentação e atualizar as duas menções ao modal central.
4. Verificar o comportamento via Playwright CLI: abertura pelo footer, foco contido, Tab/Shift+Tab, fechamento por Close/Escape/backdrop, retorno do foco, reabertura, bloqueio de interação/scroll do fundo, rolamento interno e ausência de overflow horizontal. Cobrir os modos disponíveis de três colunas e viewport estreito/baixo.
5. Executar `pnpm validate`, `pnpm build`, `pnpm test`. Validate faz lint/format em modo escrita: registrar hash prévio dos arquivos abrangidos, comparar após execução e reportar qualquer mudança fora do escopo; não reverter trabalho alheio. Se houver conflito, parar e informar.
6. Entregar caminhos e linhas, resumo, checks realmente executados, documentação, riscos e limitações. Principal revisa a implementação acumulada e as evidências; retorna achados ao mesmo desenvolvedor até aprovação técnica.

## Aceitação

- Atalhos aparecem em sheet direito alinhado ao padrão atual; conteúdo e acionador preservados.
- Fechamento e reabertura funcionam, sem sheet invisível remanescente; foco e bloqueio do fundo verificados.
- Layout cabe em viewport estreito e baixo, com conteúdo rolável e sem corte de texto.
- Documentação descreve o sheet; conteúdo técnico permanece en-US.
- Checks padrão passam, ou falhas preexistentes/bloqueios são identificados com evidência.
- Registros em Markdown permanecem fonte de verdade; não há mudança de persistência.
- Auditorias preflight e messages realizadas. Thread permanece aberta para revisão humana.

## Perguntas pendentes

Nenhuma decisão de produto pendente. Eventuais limitações do navegador ou divergências de validação devem ser reportadas com evidência.

## Resolução de escopo durante a validação

O principal executou os checks globais enquanto o desenvolvedor concluía somente fixtures, sem novas edições ou checks concorrentes. Validate passou e gravou saídas automáticas fora da feature em 86 arquivos. O principal preservou essas saídas, informou o efeito ao usuário e registrou inventário e limitações no resultado; não houve limpeza ou reversão global. Build e os 199 testes passaram sobre esse estado. O escopo manual da feature permanece nos quatro arquivos de componente, CSS e documentação descritos no resultado.

## Revisão do plano

| Tarefa | Coerência e dependências |
| --- | --- |
| Migração única do sheet | Componente, CSS e documentação pertencem à mesma entrega; sem tarefas concorrentes ou interfaces novas. |
| Validação | Navegador comprova comportamento; checks padrão comprovam integração. Não criar testes que apenas espelhem JSX. |

O usuário autorizou estruturar a proposta e executar o desenvolvimento nesta sessão. A configuração necessária foi confirmada antes do dispatch.
