# Migração Neo-Brutalism Ampla Controlada da UI do mARC - Plano de Implementação

**Objetivo:** adotar componentes oficiais do registry `neobrutalism.dev`, com fundação `shadcn/ui` + Tailwind CSS v4 para Vite, migrando a camada visual sem substituir a arquitetura operacional própria do mARC.

**Fontes analisadas:** thread atual; artefato `neobrutalism-bootstrap.md`; thread marc://$oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b; inspeção context-mode de `src/ui`, `styles.css`, testes e documentação; documentação oficial do neobrutalism; documentação shadcn/Tailwind/Radix consultada via Context7.

## Decisões Fixadas

- Escopo: migração ampla controlada, em vez de CSS inspirado ou adoção parcial duradoura.
- Identidade: manter teal e superfícies quentes do mARC; usar do neobrutalism bordas, sombras sólidas, estados e primitives.
- Contrato das modais: fechar por backdrop, botão `X` e `Escape`; enquanto aberta, bloquear interação e rolagem do background.
- Estrutura preservada: grid de três colunas, modos Threads/Marckers/arquivo, barras independentes com gutter estável, header na área rolável e footer fixo da terceira coluna.
- Playwright: validar somente via CLI.

## Fundação Técnica

- Adicionar Tailwind CSS v4 ao Vite com `tailwindcss` e `@tailwindcss/vite`.
- Criar `components.json` com TypeScript, CSS variables, ícones `lucide`, CSS global em `src/ui/styles.css` e aliases `@/components`, `@/components/ui`, `@/lib` e `@/hooks`.
- Configurar alias `@` para `src` no Vite e no TypeScript.
- Adicionar `src/lib/utils.ts` para `cn` e manter os componentes registry em `src/components/ui`.
- Reestruturar `src/ui/styles.css`: imports Tailwind/animações, tokens neo-brutalism configurados para a paleta atual e regras estruturais/de domínio que continuarem próprias do app.

## Tema e Identidade

- Separar superfícies do aplicativo dos tokens consumidos pelos componentes oficiais.
- Preservar o canvas e colunas atuais com neutros quentes; mapear `--main` para o teal atual `#0f766e`.
- Usar foreground/border/ring de alto contraste e sombra sólida `4px 4px 0 0 var(--border)`.
- Usar radius mínimo coerente com a referência e preservar pills somente quando comunicarem status ou metadado compacto.
- Não incorporar a paleta padrão do bootstrap da referência.

## Componentes Oficiais

- Incorporar pelo registry: `button`, `badge`, `card`, `input`, `label`, `textarea`, `tooltip`, `dropdown-menu`, `dialog`, `sheet` e `sonner`.
- Não incorporar `sidebar`: a composição de três colunas e seus modos pertencem ao mARC.
- Não incorporar `scroll-area`: a rolagem estrutural possui contratos próprios já estabilizados.
- Adaptar o `Sonner` gerado para o tema fixo do mARC, sem introduzir `next-themes`, pois dark mode não faz parte desta entrega.

## Migração Visual

- Migrar controles compartilhados para `Button`, `Input`, `Textarea`, `Label` e `Tooltip` oficiais.
- Migrar status e metadados para `Badge`, com wrapper local para tons semânticos existentes.
- Migrar token panel, summaries, cartões de mensagem, painéis de Markdown apropriados e composer para composição `Card`, mantendo conteúdo e handlers de domínio.
- Migrar menu de artifacts para `DropdownMenu`, preservando lista e abertura do artifact.
- Manter autocomplete do composer próprio, pois ele implementa navegação semântica de referências mARC.
- Migrar atalhos de teclado para `Dialog` centralizado e artifacts para `Sheet side="right"`, controlados pelo estado atual do app.
- Substituir toast artesanal por `Sonner`, concentrando chamadas em helper local para não espalhar API externa pelas actions.

## Limpeza do CSS e Código Próprio

- Remover de `styles.css` regras substituídas pelos componentes oficiais: buttons, badges, cards genéricos, fields genéricos, tooltip, menu de artifacts, shell visual de modais e toast.
- Manter no CSS próprio: tokens, layout/scroll/responsividade, modal background lock, composição específica de listas/headers/footer/metadados, Markdown rendering e estados de domínio.
- Remover estado/tipo/timer de toast artesanal depois da integração do helper Sonner.
- Manter `common.tsx` apenas para helpers e componentes de domínio que ainda sejam necessários, em vez de primitives visuais duplicadas.

## Contratos e Documentação

- Nenhuma alteração em API HTTP, tools MCP, Markdown como fonte de verdade, schema de thread/message/artifact ou referências `marc://`.
- Atualizar `docs/ui-and-daemon.md` para registrar a fundação visual baseada em fontes locais do registry, a preservação da estrutura operacional e o contrato consolidado das modais.
- Manter código, UI e documentação técnica em en-US; manter comunicação da thread em pt-BR.

## Testes e Validação

- Verificar configuração do Vite/Tailwind/aliases e compilação dos componentes registry.
- Validar por Playwright CLI em `http://127.0.0.1:4187/`: tela inicial, seleção de workspace/thread, modos Threads/Marckers/arquivo, menu de artifacts, composer/autocomplete, toasts, footer e rolagem independente.
- Validar modal central e sheets laterais: abrir, bloquear fundo, fechar por backdrop, `X` e `Escape`.
- Validar desktop e viewport reduzida, sem deslocamento de controles, overflow indevido ou sobreposição.
- Executar `pnpm run validate`, `pnpm test` e `pnpm build` antes do comentário final na thread.
- Revisar mudanças concorrentes no worktree sem reverter arquivos fora do escopo.
