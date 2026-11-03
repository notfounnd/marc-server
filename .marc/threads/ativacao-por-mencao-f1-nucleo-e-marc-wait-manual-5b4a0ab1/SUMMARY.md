# Ativação por menção - F1 Núcleo e marc wait manual

Thread: marc://$ativacao-por-mencao-f1-nucleo-e-marc-wait-manual-5b4a0ab1

Closed: `2026-11-03T23:13:04.603Z`

---

A F1 entregou o comando `marc wait`. A pedido do humano, uma sessão de agente escuta uma thread em segundo plano. Quando o próprio perfil dela é mencionado, o comando termina, e o Claude Code acorda a sessão com uma linha JSON que diz o que fazer em seguida. O núcleo de reconciliação fica reutilizável para a F3. A revisão integrada do principal aprovou o estado final, e o Codex aprovou o freio, a fronteira das fases e a correção de texto. O humano aceitou a entrega e autorizou o encerramento em 03/11/2026. Nenhuma fase seguinte foi autorizada por isso.

**Registros**

- Plano: `plano-f1-nucleo-e-marc-wait.md` (marc://#msg_10efc10371aa484895).
- Entrega: `entrega-f1-marc-wait.md`, por marc://@claude-dev (marc://#msg_20835786ec5b4344b2).
- Revisão integrada: `revisao-integrada-f1.md`, com veredito aprovado (marc://#msg_1008341742c0447a9f). A seção 6 tem a reavaliação depois do parecer do Codex (marc://#msg_641f996a1be646f9b0).
- Pareceres de marc://@codex-software-architect: marc://#msg_862b370d0cb04214bd e marc://#msg_f0153ff4bffb45b6ab.

**O que foi entregue**

- **Reconciliador** puro em `src/core/thread-mentions.ts`. Uma menção é elegível quando:
  - fica depois do cursor;
  - o autor não é desenvolvedor;
  - a referência não está em bloco de código, código inline ou citação.
- **Freio de cadeia:** conta as mensagens de arquiteto desde a última mensagem humana, com limite padrão de 3.
- **Laço de espera** em `src/core/thread-wait.ts`:
  - observador ligado antes da primeira leitura;
  - consulta a cada 2 s;
  - prazo padrão de 120 min;
  - trava por sessão e thread.
- **CLI** em `src/cli-wait-command.ts`: códigos de saída 0, 2, 3, 4, 5, 6, 7 e 130, cada um com instrução `next`. O caminho do comando não carrega memória, daemon nem MCP.
- **Descoberta do comando:** o tópico `listening` do `marc_helper` entrega o comando pronto, montado a partir do processo MCP, sem token.
- **Skill e docs:**
  - a skill ganhou a seção "Listening for Mentions";
  - houve atualização em `docs/agent-workflows.md`, `docs/mcp-tools.md`, README e `docs/development.md`.

**Evidência**

- Prova ao vivo no Claude Code, em workspace temporária:
  - os códigos 0, 2, 6 e 7 acordaram a sessão;
  - mensagens de desenvolvedor, citações, código inline e menções a outro perfil não acordaram a escuta.
- `pnpm test` completo: 1255 de 1255, depois da última correção.
- `pnpm validate` e `pnpm build` limpos.

**Limites**

- O despertar foi verificado só no Claude Code. No Codex ensaiado na F0, nenhum turno novo foi aberto, sem prova de incapacidade geral. Por isso o fluxo fica restrito ao cliente verificado.
- O freio é conservador. Mensagens de arquiteto sem menção também contam, e o código 2 pode chegar cedo numa thread longa sem intervenção humana.
- A interrupção por sinal (130) só tem cobertura em teste de unidade. No Windows, uma parada forçada deixa a trava válida por até 30 s.
- Cada rearme depois do prazo pode custar um despertar frio.

**Continuidade**

- A F2 e as fases seguintes dependem de plano e de autorização humana.
- A seção 5 do plano mantém a frase original sobre o Codex como registro histórico. Prevalece a seção 6 da revisão.
