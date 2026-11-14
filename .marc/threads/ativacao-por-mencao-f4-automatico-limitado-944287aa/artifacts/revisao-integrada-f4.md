# Revisão integrada da F4: ativação automática limitada

Autor: marc://@claude-software-architect. Data: 13/11/2026.

## Veredito

**Aprovado tecnicamente.** O estado integrado das tarefas A, B1, B2 e C atende ao plano `plano-f4-automatico-limitado.md` (marc://#msg_7c8869d8c96942d6ab) e às decisões do humano de 13/11/2026:
- a pergunta sobre a escuta é padrão do produto, com o padrão configurável no painel geral;
- o prazo da escuta passa a 8 h;
- na maquete, o humano escolheu a variante 1A e o ícone `user-check` depois do nome.

Ainda faltam a confirmação do Codex e o aceite do humano. A aprovação técnica não é aceite.

## Escopo e fontes revisados

- **Fontes:**
  - a thread inteira, com o plano e as cinco entregas de marc://@claude-dev:
    - A: marc://#msg_1e51fdfd474d4ec5ae;
    - B1: marc://#msg_f1606c65db0b4abb9e;
    - B2: marc://#msg_8a2f5b6737be4ac5b6, com a correção em marc://#msg_4c3d7f44a7d543d0a4;
    - C: marc://#msg_4cbd06f379774aceb9;
  - o diff integrado;
  - as capturas headless.
- **Revisões por tarefa:**
  - A, B1 e C passaram na primeira rodada.
  - A B2 teve um achado: a regra de começo não dizia quem arma a escuta.
  - Durante a execução, duas decisões do principal mudaram o desenho, e as duas estão registradas nas entregas:
    - a A passou a tratar como retomada legítima a mesma sessão com início novo no mesmo PID;
    - a B1 conta uma ida e volta como um ciclo.

## Critérios e evidência

1. **Identidade na sessão retomada** (A).
   - **Causa:** o vínculo só passa para o processo da sessão retomada num post na própria thread. A escuta lia o vínculo gravado e falhava em `not_descendant`.
   - **Correção, só de leitura:**
     - `src/daemon/waiter-identity.ts` sonda o slot com `probeFor` e passa o `resumedBy` quando o motivo é `session_resumed` para o holder;
     - `src/core/waiter-identity.ts` julga a escuta por esse processo, com fallback no dono gravado;
     - a tabela de nove códigos não muda, e nada é gravado.
   - **Evidência:**
     - `test/core-waiter-identity-resumed.test.ts` (5 linhas);
     - `test/daemon-activation-reservation-resumed.test.ts`: escuta sob o processo novo concedida, e escuta sob outra sessão retida;
     - `test/cli-diagnose-start-mismatch.test.ts` passou a usar um PID reaproveitado por outra sessão.
2. **Caminho do helper** (A).
   - `resolveWorkspace` é aplicado na origem (`workspace-tools.ts`, `server.ts`, `helper.ts`), e `buildMarcCommand` continua sem resolver caminhos.
   - **Evidência:** `test/mcp-listening-workspace.test.ts`.
3. **Freio do modo manual por ciclos** (B1).
   - `architectCycleCount` (`src/core/thread-mentions.ts`):
     - a menção de um arquiteto a outro abre um pedido;
     - a próxima mensagem do mencionado fecha o pedido e não abre outro;
     - a mensagem humana zera a contagem, e o dev é ignorado;
     - os arquitetos são os perfis mais os autores com papel de arquiteto.
   - O aviso do 👤 usa a mesma contagem, sem duplicação. O modo governado não muda.
   - **Evidência:** `test/core-thread-mentions-cycles.test.ts` (17 cenários): A→B→A dá 1, quatro mensagens dão 2, e a sexta dispara com max 3.
4. **Prazo e padrão da escuta** (B1 e B2).
   - `DEFAULT_TIMEOUT_MINUTES` vale 480.
   - A seção `listening.defaultOn` fica no `.marc/marc.config.json`.
     - A gravação preserva as seções de ativação e de escuta como o arquivo as guarda. A seção de memória é reescrita na forma normalizada, como em toda gravação de configuração antes da F4. Na validação do humano, isso tirou a chave obsoleta `searchRetryDepth`, que nada lê, e acrescentou o `documentSources` padrão.
     - A rota recusa um tipo inválido com 400.
     - Os tipos e a leitura ficam em módulos próprios, por causa do `max-lines` e da regra de imports estáticos da escuta.
   - O `marc_helper` (`listening`) devolve `listeningDefault`. A leitura é feita sem daemon e devolve "off" em caso de falha.
   - A orientação gerenciada (skill, helper, `agent-workflows.md`, README, `mcp-tools.md`) e o ADR 0014 dizem duas coisas:
     - só o principal segue o fluxo de começo e arma escutas;
     - com o padrão "off" ele pergunta, e com "on" ele arma e avisa, inclusive no vencimento.
   - **Evidência:**
     - `test/core-listening-settings.test.ts`, `test/daemon-listening-settings.test.ts` e `test/mcp-listening-default.test.ts`;
     - as capturas `settings-listening-off.png` e `settings-listening-on.png`.
5. **Aprovar só na primeira vez** (C).
   - **O registro:**
     - um Approve bem-sucedido grava `activation.approvals` com a revisão da política;
     - `activityAfterSave` não carrega as aprovações, então salvar a política com ela ligada as derruba;
     - uma aprovação só vale com a revisão em vigor, então desligar a política também a derruba.
   - **O início automático:**
     - a passada devolve os cards aguardando de arquitetos aprovados;
     - `passThread` inicia cada um pela ação `"auto"`, com as mesmas reconferências do Approve e o mesmo débito de ciclo;
     - uma recusa deixa o card aguardando, sem repetir na hora;
     - o retry e o continue de turnos que falharam continuam manuais;
     - o turno automático leva `auto: true`.
   - **A UI:**
     - o ícone `UserCheck` depois do nome, com `aria-label` e dica;
     - a nota com a política ligada;
     - o aviso "Saving clears the approval of N agents".
   - **Evidência:**
     - `test/daemon-supervision-auto-start.test.ts` (9 cenários): primeiro card, início automático, outro agente com card, política salva, política desligada e religada, saldo esgotado, pausa, turno que falhou e Approve recusado;
     - `test/daemon-activation-approvals.test.ts` e `test/ui-thread-activation-approvals.test.ts`;
     - as capturas `panel-f4-approval.png` e `panel-menu.png`, que batem com a maquete 2C.
6. **Documentação.** ADR 0014 (linhas 14, 16 e 59), `docs/ui-and-daemon.md`, `docs/agent-workflows.md`, README e `docs/mcp-tools.md`.

## Achados e decisões aceitas

- **Achado da B2, corrigido:** sem dizer quem pergunta, um dev delegado com o padrão ligado armaria uma escuta.
- **Teste da F3 ajustado na C:** `daemon-supervision-turn-run.test.ts` esperava um Approve na segunda menção. Agora o início é automático, e as asserções de retomada e de custo continuam.
- **Resumo:** o SUMMARY não separa os inícios automáticos. Só o `turn.auto` do último início fica no card. A decisão foi do principal, para não criar estado sem consumidor nem mudar o formato.
- **Card aguardando por um instante:** um card de arquiteto aprovado fica aguardando até o início da mesma passada.
- **Aprovações antigas:** depois que a política é salva desligada, as aprovações antigas ficam no arquivo até a próxima gravação ligada, mas não valem.

## Checagens do estado final (principal)

- `pnpm typecheck`, `pnpm code:check` e `pnpm build` com exit 0.
- `pnpm test` com 2637/2637. A base da F4 era 2548, então são 89 testes novos.

- O `pnpm validate` não rodou, que é a prática registrada deste programa. O `code:check` e o `typecheck` cobrem a verificação.

## Limites e pendências

- **Cópia gerada da skill:** `.agents/skills/marc-ops/SKILL.md` ainda tem o texto antigo. O servidor MCP desta sessão carregou o código antigo, então o `workspace_update_recommendations` precisa rodar depois de reiniciar o MCP.
- **O Codex** continua sem card e sem início automático. Isso fica para a F5.
- **Backlog novo:**
  - o daemon em segundo plano pode cair com "Unexpected end of JSON input", porque `patchDaemonRuntimeState` grava sem trava e é disparado com `void` sem catch (`src/daemon/lifecycle.ts`, `server.ts`);
  - um EPERM de limpeza de lock no Windows em `daemon-diagnostics-routes.test.ts` passou isolado.
- **Sem decisão:** a menção feita com a política desligada vira card quando ela é ligada.

## Confirmação do Codex e correção no aceite

- **Confirmação do Codex** (marc://#msg_58013290a78f49088c): aprovado tecnicamente, incluindo o desenho das cinco decisões que não tinham passado pelo alinhamento do plano antes do desenvolvimento.
- **Achado do humano no aceite:** a dica do ícone de aprovado não aparecia, porque o `title` estava como atributo do `<svg>`, e os navegadores não mostram dica nesse caso. A evidência da tarefa C conferia que o atributo existia, mas não que a dica aparecia. Aceitar isso foi falha minha.
- **Correção** (marc://@claude-dev, marc://#msg_5e4261a3812547829e):
  - um `span.activation-approved` com `role="img"`, `aria-label` e `title`, e o `UserCheck` dentro dele com `aria-hidden`;
  - o import de React que faltava no componente;
  - dois testes de render, que conferem o `title` no span e nenhum `title` no svg.
- **Reavaliação:** conferi o código e a captura `panel-approved-mark-menu.png`. No estado corrigido, rodei de forma independente `pnpm typecheck`, `pnpm code:check` e `pnpm build`, todos com exit 0, e `pnpm test` com 2639/2639. A auditoria de artefatos da thread não teve achados. O veredito técnico segue aprovado para o estado corrigido.
- **Texto da dica, escolhido pelo humano no aceite** (marc://@claude-dev, marc://#msg_fb68b65dc6bd4d0880):
  - a dica passou de "Approved: starts without a card in this thread" para "Approved to start on mention", e o `aria-label` continua "Approved";
  - a troca foi feita no componente, no catálogo en_US e no teste de render;
  - conferi que não sobra o texto antigo em `src`, `public`, `test` e `dist`, que o bundle novo traz o texto novo e que o `title` continua no span.
  - O dev rodou `typecheck`, `code:check`, `build` e o teste de render (12/12). A suíte completa não foi repetida, porque a mudança é só de texto e a máquina estava com pouca memória.
  - O veredito técnico segue aprovado.

## Para o humano

- **Reinicie o daemon e a sessão,** porque o MCP precisa carregar o código novo.
- **Validação sugerida:**
  1. No painel geral, ligue e desligue "Listen to threads by default".
  2. Numa thread com a política ligada, aprove o primeiro card de um arquiteto Claude. A segunda menção a ele deve iniciar sem card.
  3. Salve a política, e o card deve voltar.
  4. Uma escuta governada numa sessão retomada deve ser concedida.
