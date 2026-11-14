# Entrega B2 da F4: padrão da escuta e orientação gerenciada

Autor: claude-dev (developer). Escopo: tarefa B2 do plano `plano-f4-automatico-limitado.md`, seção 4 (Desenho 4) e Maquete de UI.

## Resultado

- Configuração `listening.defaultOn` em `.marc/marc.config.json`, padrão `false`. Preferência, sem autorização de ativação.
- Rota de configurações (`POST /api/workspaces/:id/settings`) aceita `listening.defaultOn` e recusa tipo inválido com 400.
- `marc_helper` (tópico `listening`) devolve `listeningDefault`: `off` sem arquivo, com arquivo ilegível ou com valor inválido, e `on` quando o padrão está ligado.
- Orientação atualizada na skill gerenciada, no helper, em `docs/agent-workflows.md`, no README, em `docs/mcp-tools.md`, no ADR 0014 e no `NEXT_STEP.timeout`.
- Linha nova no modal de configurações da workspace, depois do limite de tempo do turno, com o texto aprovado na maquete.

## Correções ao briefing

- Arquivo: `.marc/marc.config.json`, e não `.marc/settings.json`. Correção confirmada pelo principal.
- Limite de 300 linhas de código (`max-lines`, erro no ESLint):
  - os tipos `WorkspaceDocumentSource`, `WorkspaceSettings` e `WorkspaceSettingsInput` saíram de `src/core/types.ts` para `src/core/workspace-settings-types.ts`, e `types.ts` reexporta os três;
  - a validação da seção `listening` fica em `src/core/listening-settings-input.ts`, no padrão de `activation-settings-input.ts`.
- Leitura do helper em `src/core/workspace-settings-file.ts`, que não alcança `src/core/memory`. O teste de imports estáticos de `helper.ts` pegou a primeira versão, que estava em `memory/settings.ts`.
- Fixture de `test/core-memory-sources-documents.test.ts` (linha 234) recebeu `listening: { defaultOn: false }`, porque o typecheck exige o campo.
- `src/ui/app.tsx` não mudou: ele já repassa o objeto `workspaceMemoryActions.settings` inteiro.

## Arquivos e linhas

- `src/core/types.ts` 270-274: reexport dos tipos de configuração.
- `src/core/workspace-settings-types.ts` (novo): tipos com o campo `listening`.
- `src/core/memory/settings.ts`:
  - 15: import de `SETTINGS_FILE`;
  - 32: padrão `listening`;
  - 66-113: gravação, com a seção `listening` preservada crua quando a chamada não a traz;
  - 163-173: mesclagem;
  - 212-217: `renderSettings`;
  - 238-270: normalização e padrão.
- `src/core/workspace-settings-file.ts` (novo): `SETTINGS_FILE` e `readListeningDefaultSync`.
- `src/core/listening-settings-input.ts` (novo): validação do corpo.
- `src/daemon/memory-routes.ts`: 24 (import), 57 (corpo), 284-290 (entrada do save). A autorização de ativação não roda para `listening`.
- `src/mcp/helper.ts`: 1 (import), ~233-236 (`purpose` e `whenToUse`), 251-253 (notas), 270 (`listeningDefault`). As mudanças das tarefas A e B1 foram preservadas.
- `src/core/marc-ops-skill.ts` 108 e 111: seção "Listening for Mentions". As mudanças de A e B1 foram preservadas.
- `src/cli-wait-status.ts` 45: `NEXT_STEP.timeout`, com a nota de reserva retida mantida.
- `docs/agent-workflows.md`: seção "Listening for mentions", com o padrão, as regras de quando armar, a linha 7 da tabela e a nota do exit 7. As mudanças de A foram preservadas.
- `README.md` (~196): frase de quando armar.
- `docs/mcp-tools.md` (~326): campo `listeningDefault`.
- `docs/adrs/0014-policy-gated-mention-activation.md` 16: parágrafo da decisão F4.
- `src/ui/use-workspace-memory-actions.ts`: 16 (tipo), 54-68 (leitura), 149-157 (ação `listening`).
- `src/ui/app-modals.tsx`: 9, 64, 93-94.
- `src/ui/workspace-settings-modal.tsx`: 14-33 e 68-72.
- `src/ui/workspace-settings-panel.tsx`: 8, 17-35 e 86-93.
- `src/ui/workspace-settings-listening.tsx` (novo): `ListeningDefaultField`, com `.workspace-settings-cycles-row` e `-text` e um `Switch`. Nenhum CSS novo.
- `public/locales/en_US/translation.json` 344-345: duas chaves.
- Testes novos: `test/core-listening-settings.test.ts` (12), `test/daemon-listening-settings.test.ts` (8) e `test/mcp-listening-default.test.ts` (7).

## Verificação

- `pnpm typecheck`, `pnpm code:check` (ESLint e Prettier) e `pnpm build` (tsc e vite) passaram.
- Conjunto direcionado: 111 de 111, incluindo `cli-wait-static`.
- `pnpm test` completo: 2601 de 2601. A base anterior eram 2574, mais os 27 testes novos.
- Visual, com Playwright CLI headless, daemon temporário na porta 4290 e dados no scratchpad:
  - linha desligada: `aria-checked=false`;
  - após o clique, `aria-checked=true`, e a API confirmou `listening.defaultOn: true`, com a ativação inalterada (ciclos 5, limite de turno 60);
  - capturas em `scratchpad/visual/settings-listening-off.png` e `scratchpad/visual/settings-listening-on.png`.
- Rota, pela API no build final: ligar grava `true`, salvar memória mantém a escuta, valor inválido dá 400, desligar grava `false`.

## Limites

- `pnpm validate` não foi rodado, por decisão do principal.
- `workspace_update_recommendations` não foi rodado. A cópia da skill em `.agents/skills/marc-ops` só muda nessa rodada.
- A UI ainda não tem typecheck de `.tsx` no projeto. A checagem da UI foi feita pelo build do vite, que resolve os aliases.

## Achado fora do escopo

- O daemon em modo destacado caiu durante a validação visual, com `SyntaxError: Unexpected end of JSON input` em `readDaemonRuntimeState` (`src/daemon/lifecycle.ts`, ~linha 34), chamado por `patchDaemonRuntimeState` (`lifecycle.ts`, ~45) via `syncRuntimeState` (`src/daemon/server.ts`, 66-74).
- `syncRuntimeState` roda em `trackActivity` (`server.ts`, 77) como `void`, sem `catch`. Há leitura, modificação e escrita sem trava, e `writeFile` trunca o arquivo antes de gravar. Sob tráfego concorrente da UI, uma leitura pega o arquivo vazio.
- Não corrigi, por estar fora do escopo. Recomendo tarefa própria: escrita atômica, escrita serializada e `catch` no `void`.
- A validação visual usou o modo `foreground` (`marc daemon`), que não executa essa sincronização.
- Não inspecionei o estado do daemon real (4187). O mesmo caminho vale para qualquer daemon destacado.

## Pendente

- Revisão integrada do principal. Esta entrega não é aprovação técnica.
