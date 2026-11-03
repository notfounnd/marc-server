# Revisão integrada da F1

Autor: marc://@claude-software-architect
Data: 03/11/2026
Objeto: estado integrado da F1 depois da revisão 1, entregue por marc://@claude-dev em marc://#msg_20835786ec5b4344b2.

## 1. Escopo e método

Revisei por leitura o estado final de todos os módulos novos e alterados:

- `src/core/thread-mentions.ts`, `src/core/thread-wait.ts` e `src/core/thread-wait-runtime.ts`;
- `src/cli-wait-command.ts` e `src/cli.ts`;
- `src/mcp/listening-command.ts`, `src/mcp/helper.ts` e `src/mcp/workspace-tools.ts`;
- `src/core/marc-ops-skill.ts` e as quatro docs;
- os nove arquivos de teste novos e o ajuste em `test/cli-memory-command.test.ts`.

Depois rodei as checagens e uma prova ao vivo, por conta própria.

**Execução:**

- O desenvolvedor devolveu `OK_BOOTSTRAP` antes de editar e levantou dois bloqueios reais, que decidi antes da autorização:
  - reaproveitar `getWorkspaceInfo` e o leitor de resumo puxaria 60 módulos de memória;
  - o ponto de entrada da CLI carregava memória, daemon e MCP para qualquer comando.
- Houve uma rodada de revisão, com dois achados, ambos corrigidos.
- Antes da autorização, o desenvolvedor rodou um `git status`. Foi só leitura, ele mesmo declarou, e não houve outro comando Git.

## 2. Critérios e evidência

| Critério do plano | Implementação | Evidência verificada |
| --- | --- | --- |
| Observador ligado antes da primeira reconciliação | `WaitLoop.start` liga o watcher antes de `requestReconcile` | Leitura do código e teste dedicado |
| Consulta periódica como garantia | Poll de 2 s, reconciliações serializadas | Teste com observador mudo |
| Elegibilidade sem código, inline e citação; developer excluído | `mentionsProfile` e o filtro em `reconcileMentions` | Prova ao vivo: mensagem de developer, citação, inline code e menção a outro perfil não acordaram a escuta |
| Cadeia de arquitetos desde a última mensagem humana | `architectChainLength` | Ao vivo: código 2 com 3 de 3. Uma mensagem humana zerou a cadeia, e a menção seguinte deu código 0 com 1 de 3 |
| Ordem fechada, cursor, limite, menção | `reconcileMentions` | Testes em tabela |
| Uma linha JSON sem corpo, com `next` | `toOutputLine` e as tabelas `EXIT_CODES` e `NEXT_STEP` | Saídas reais dos códigos 0, 2, 6 e 7 |
| Trava por sessão e thread, código 6 | `tryWithWorkspaceWriteLock` com recurso `wait:<thread>:<session>` | Ao vivo: segunda escuta saiu na hora com 6 e `sessionLock: busy` |
| Prazo | Timer de `timeoutMs`, padrão 120 min | Ao vivo: código 7 com prazo de 1 min |
| Sem inferência, sem daemon | Imports dinâmicos em `src/cli.ts`; módulos novos sem memória | `test/cli-wait-static.test.ts` percorre o fecho de imports. Todas as provas rodaram sem daemon |
| Comando descoberto pelo MCP, sem token | `buildWaitCommand` usa só execPath, execArgv e `argv[1]` | Teste com `--token` fora do fecho; aspas POSIX e barras normais |
| Skill e docs | Seção "Listening for Mentions" e docs | Revisão de coerência abaixo |

**Prova ao vivo:**

- **Montagem:** workspace temporária no scratchpad da sessão, CLI construído (`dist/cli.js`) e escuta rodando em segundo plano pela ferramenta Bash desta sessão do Claude Code.
- **Despertar:** a sessão acordou sozinha em cada término. Na menção, a linha saiu menos de um segundo depois da gravação.
- **Limpeza:** a pasta foi removida, sem nenhum processo restante.

**Checagens:**

- `pnpm typecheck` e `pnpm run code:check`: limpos.
- `pnpm test`, completo e independente: 1255 testes, 1255 passaram.
- Os 77 testes da F1 e do ajuste também rodaram isolados, todos verdes.
- O desenvolvedor rodou `pnpm validate` e `pnpm build` depois da última correção. O build ficou atual: a saída ao vivo do código 6 já tinha o texto corrigido.

**Escopo:** os arquivos modificados depois do plano, conferidos por data de modificação sem Git, são exatamente os autorizados. As cópias da skill, `CHANGELOG.md`, `package.json` e a configuração não foram tocados.

## 3. Achados

**Corrigidos na revisão 1:**

1. O comando do helper vinha com placeholders, sem dizer que precisavam ser trocados nem que `--mention` é o próprio perfil de quem escuta. Isso agora está explícito no helper, na skill e nas docs.
2. Depois de uma parada forçada sem sinal, a trava fica válida por até 30 s, e um rearme nesse intervalo recebia "Do nothing". O `next` do código 6 e os textos agora orientam a rearmar depois de 30 s.

**Observações aceitas:**

- **Cadeia conservadora:** o freio conta toda mensagem de arquiteto desde a última humana, inclusive as que não mencionam ninguém. Na prova, duas mensagens de arquiteto sem menção válida já somaram para o limite. É o contrato aprovado, e o freio é secundário, mas numa thread longa sem intervenção humana o código 2 pode chegar cedo. A mensagem humana zera a contagem.
- **Menção em negrito:** `**marc://@perfil**` não conta como menção, porque o fim em `**` não vira referência válida. É o mesmo critério da auditoria de referências, que já marca essa forma como inválida.
- **Contagem na entrega:** a entrega do desenvolvedor fala em "6 módulos novos" e lista cinco, que são os cinco existentes. Nenhum impacto.
- **Sinal real no Windows:** a interrupção por sinal (130) tem cobertura só em teste de unidade. No Windows, uma parada forçada não dispara o handler, e é justamente o caso coberto pela correção do achado 2.

## 4. Limites

- O tópico `listening` só aparece depois que o MCP reinicia.
- As cópias da skill em `.agents/skills/marc-ops/SKILL.md` serão regeneradas depois da aceitação.
- O despertar pelo término do processo foi verificado só no Claude Code. No Codex ensaiado na F0, nenhum turno novo foi aberto, o que não prova incapacidade geral. O fluxo fica restrito ao cliente verificado, e a skill e as docs mandam avisar o humano (texto corrigido na seção 6).
- Cada rearme depois do prazo pode custar um despertar frio.

## 5. Veredito

**Aprovado.** Os critérios do plano estão implementados e verificados no código, nos testes e na prova ao vivo nesta sessão do Claude Code. Os dois achados foram corrigidos, e as observações restantes são consequência do contrato aprovado ou não têm impacto.

A aprovação técnica não é aceitação do humano. O encerramento da thread depende de autorização explícita dele.

## 6. Complemento: parecer do Codex e reavaliação

A pedido do humano, marc://@codex-software-architect revisou três pontos em marc://#msg_862b370d0cb04214bd.

**Parecer:**

- **Freio de cadeia:** conforme o plano aprovado. É conservador e não equivale ao orçamento por estágio da F3.
- **Adendo:** nenhuma ideia posterior à aprovação dele entrou na F1.
- **Texto de suporte:** precisava de correção. Skill, helper e docs diziam que a escuta "não tem suporte" fora do Claude Code. A F0 (D6) só observou que o Codex 0.166.0 não abriu turno novo em 15 s, sem provar incapacidade geral.

**Correção:** feita por marc://@claude-dev, num novo spawn, porque o anterior não sobreviveu ao reinício do cliente. Passou por `OK_BOOTSTRAP` e autorização, e mudou só três pontos:

- `src/core/marc-ops-skill.ts:110`;
- `src/mcp/helper.ts:248`;
- `docs/agent-workflows.md:332-335`.

O texto novo diz quatro coisas:

- o despertar foi verificado no Claude Code;
- não foi observado no Codex ensaiado;
- os outros clientes não foram verificados;
- o fluxo fica restrito ao cliente verificado.

Ele preserva a distinção pedida: o comando detecta a menção em qualquer cliente, e só a entrega ao modelo depende do cliente. O texto de produto não cita fases internas.

**Evidência verificada por mim:**

- Leitura das três linhas finais.
- Busca sem resto dos textos antigos em `src`, `docs` e README.
- O texto novo está no `dist` gerado.
- `pnpm typecheck` limpo.
- Os 26 testes de `mcp-listening` e de recomendações passaram.
- O dev rodou `pnpm validate`, sem alterar arquivos, e `pnpm build`. Conferi o log da suíte completa: 1255 de 1255.
- Não houve Git nem arquivo fora do escopo.

**Fora da correção:**

- A seção 5 (Skill) do plano mantém a frase original sobre o Codex. O plano é o registro do contrato aprovado, e a decisão de restringir o fluxo ao Claude Code não mudou. Esta seção prevalece sobre aquela formulação.
- A cópia gerenciada `.agents/skills/marc-ops/SKILL.md` (`.claude/skills` é uma junction para ela) ainda tem o texto antigo. Ela é regenerada pelo MCP depois de um novo reinício.

**Veredito reavaliado:** **Aprovado** para o estado integrado depois da correção. A mudança é só de texto e não altera comportamento. As checagens afetadas foram repetidas.
