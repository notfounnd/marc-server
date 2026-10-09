# Plano e handoff: header compartilhado dos sheets

## Objetivo e aceitação

Extrair header e botão Close repetidos dos quatro sheets existentes para um componente compartilhado, mantendo aparência, conteúdo, acessibilidade e comportamento. Consumidores: KeyboardShortcutsModal, ArtifactModal, ArtifactViewerModal e WorkspaceSettingsModal. Usuário aprovou o plano e solicitou implementação nesta sessão.

A extração deve remover a composição repetida e preservar a estrutura DOM relevante, as classes, os textos e os ícones atuais. Deve manter nomes acessíveis de título/descrição e fechamento via Radix SheetClose, sem alterar estados, foco, animação, corpos roláveis ou ações dos consumidores.

## Fontes

- AGENTS.md, skill marc-ops e contrato do bootstrap do workspace marc-dd422176e1, C:\Projetos\marc, incluindo Custom Rules.
- Thread oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1, plano e resultado anteriores: proposta-sheet-atalhos.md e resultado-sheet-atalhos.md.
- README, docs/agent-workflows.md, docs/harness-engineering.md, docs/ui-and-daemon.md e ADRs 0001/0003/0004/0007/0008.
- Inspeção context-mode atual dos dois consumidores, primitivo Sheet, CSS overlays e teste ui-workspace-settings.
- memory_recall da refatoração executado pelo principal; histórico de sheets/settings e modos das colunas lido, preservando decisões de foco e geometria.

## Interface e implementação determinadas

Criar e exportar ModalSheetHeader em src/ui/modal-sheet-header.tsx.

Props internas:

- title: ReactNode, obrigatório.
- description: ReactNode, obrigatório.
- eyebrow?: ReactNode.
- className?: string.
- titleClassName?: string.
- descriptionClassName?: string.

O componente retorna um Fragment, com SheetHeader e SheetClose como irmãos diretos, sem div adicional. O header usa a classe modal-head combinada com className. Renderiza eyebrow opcional em div.eyebrow, SheetTitle com titleClassName e SheetDescription com descriptionClassName. Renderiza uma única composição SheetClose asChild + Button, com classes button-icon modal-sheet-close, title e aria-label traduzidos pela chave Close e X size 15. Use as primitivas existentes, Button, useTranslation e o utilitário cn existente; não adicionar dependências.

Migrar os três componentes de modals.tsx e o componente de workspace-settings-modal.tsx. Títulos e eyebrow recebem ReactNodes construídos pelos consumidores, preservando ícones e textos atuais. Atalhos continuam fornecendo modal-head-shortcuts, modal-title-icon e sr-only nas respectivas props. Os outros três usos mantêm eyebrow, título e descrição atuais. Remover apenas imports que ficarem sem uso; SheetClose em modals.tsx continua necessário para Cancel da criação do anexo.

Não criar props de callback de fechamento: SheetClose usa o contexto do Root existente. Não adicionar variações por tipo de sheet nem validação de dados que não existia antes.

## Escopo exato e exclusões

Escrita manual autorizada exclusivamente:

- Criar src/ui/modal-sheet-header.tsx.
- Alterar src/ui/modals.tsx.
- Alterar src/ui/workspace-settings-modal.tsx.

Não editar CSS, primitivos compartilhados, footer, app/global state, hooks de foco/animação, docs, testes, dependências, perfis ou registros mARC. Não remover dialog.tsx nem renomear consumidores. Se aparecer necessidade de outro caminho, comunicar ao principal antes de editar. Evidências e scripts temporários podem ser escritos por apply_patch em C:\Users\junior\AppData\Local\Temp; saídas automáticas da CLI em .playwright-output/ ou .playwright-cli/ e build em dist/ são autorizadas. Usar Bash e context-mode; sem Git, PowerShell ou Playwright MCP. Não reverter alterações existentes.

## Papéis e autorização

Principal: perfil codex-software-architect, runtime /root; plano, dispatch, revisão independente, aprovação técnica e publicação. Desenvolvedor: perfil compartilhado codex-dev, runtime /root/shortcuts_sheet; gpt-6-luna/xhigh previamente solicitado e confirmado pelo usuário nesta sessão, configuração mantida. Perfil principal e mínimo de reasoning humano-confirmados; não há introspecção separada. Modo sequencial: um desenvolvedor ativo. Não criar perfis, postar mensagens mARC ou delegar novamente.

Antes de editar: bootstrap independente (ou confirmação explícita do contrato ainda válido, conforme skill), ler fontes e retornar OK_BOOTSTRAP com identidade, fontes, checklist crítico, modelo/reasoning e fonte, escopo e estado dos alvos. Aguardar autorização explícita do principal.

## Validação e evidência

O principal executou pnpm code:check antes do handoff: lint e Prettier passaram, sem escrita. Esta é a baseline; não repetir o mesmo preflight sem mudança que o justifique.

1. Após implementação, relatar caminhos/linhas e confirmar DOM e classes equivalentes. Sem else ou if aninhado; opcional eyebrow é guard simples.
2. Via Playwright CLI, verificar quatro sheets em desktop e mobile, títulos/descrições/ícones, Close sem colisão, rolamento, fechamento por Close/Escape/backdrop, reabertura e foco. Atalhos devem manter retorno ao link. Exercitar ações/formulário de anexo e configurações com fixtures sintéticas que não escrevam registros reais. Preserve os tratamentos de foco distintos dos consumidores. Evidência pode incluir capturas e script temporário via apply_patch; não criar testes que apenas reproduzam JSX.
3. Não executar checks globais até coordenar com o principal: ele pode executar validate/build/test enquanto o desenvolvedor conclui navegador, evitando duplicação. Snapshot de hashes antes/depois de validate deve cobrir alvos de lint/Prettier; reportar qualquer escrita fora do escopo ao principal, sem revert. Comandos exigidos: pnpm validate, pnpm build, pnpm test.
4. Rever documentação ao concluir: pela ausência de mudança de produto/API pública, não há atualização prevista; informar se isso continuar válido ou apontar necessidade ao principal.
5. Retornar resumo, arquivos e linhas, comandos realmente rodados/resultados, caminhos de evidência, riscos e estado de processos/aprovações. Principal revisa toda mudança e retorna achados ao mesmo desenvolvedor até aprovação.

## Registros e conclusão

### Ajuste necessário de integração: contrato i18n

A suíte completa reproduziu a falha keeps i18n usage scoped to the web UI: test/i18n.test.ts mantém uma lista explícita de arquivos autorizados a importar tradução, e o novo arquivo de UI ainda não estava nela. O principal inspecionou a causa e autoriza ampliar o escopo exclusivamente para adicionar src/ui/modal-sheet-header.tsx nessa lista. Não alterar regex, diretórios autorizados ou outras asserções; não criar testes que espelhem JSX. O mesmo desenvolvedor aplicará a linha e rodará o teste i18n existente; o principal repetirá os checks necessários sobre o estado final. Essa atualização preserva o limite de localização da ADR 0008.

Principal anexa este plano antes da implementação, executa workspace_audit preflight e registra ACK/autorização. Ao concluir, anexa resultado, audita artifacts e messages com metadata já presente e concede aprovação técnica. A thread permanece aberta para aceitação humana. Markdown segue fonte de verdade; não há mudança de persistência.
