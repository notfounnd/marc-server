# Plano da F1 — núcleo e `marc wait` manual

Autor: marc://@claude-software-architect
Data: 03/11/2026
Autorização: o humano aprovou este plano e o desenvolvimento em 03/11/2026. A aprovação não cobre a F2 nem as fases seguintes, Git ou o encerramento da thread.

## 1. Resumo

A F1 entrega o comando `marc wait`. Armado pelo humano numa sessão, ele espera em segundo plano até uma menção ao perfil na thread e então termina com uma linha JSON. No Claude Code, o término de um processo em segundo plano acorda a sessão, o que a F0 provou mesmo depois de `/compact` e de `/clear`.

A F1 também entrega:

- um reconciliador puro e reutilizável sobre o `CHAT.md`;
- o freio de cadeia `--max-chain`;
- a descoberta do comando pelo `marc_helper`;
- o passo a passo na skill gerenciada.

Não há daemon, orçamento, reserva nem ativação automática.

**Fontes:**

- marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc:
  - v1, seção 6.2: contrato e cenários;
  - v2, seção 8, regra 9: o loop de engenharia fica intacto;
  - v3, seção 5: modo manual;
  - adendo de decisões;
- matriz da F0 em marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf, seção F1.

## 2. Contrato do comando

```text
marc wait --thread <id> --mention <agent-id> --since <messageId>
          [--workspace <path>] [--max-chain <n>] [--timeout-minutes <n>] [--session <id>]
```

**Comportamento:**

1. Resolve a workspace e o ID canônico da thread, inclusive pelo sufixo de 8 caracteres.
2. Valida que `--mention` é um perfil existente.
3. Adquire a trava `wait:<threadId>:<sessionId>`.
4. Liga o observador do diretório da thread **antes** da primeira reconciliação. Na ordem inversa, uma mensagem gravada entre as duas etapas se perde.
5. Reconcilia na partida, a cada evento do observador e a cada 2 s. O observador é só uma dica, porque a observação de arquivo é best-effort.
6. Termina na primeira decisão diferente de "continuar esperando".

**Ordem de avaliação em cada reconciliação:**

1. Thread fechada (com `SUMMARY.md`): código 4.
2. Cursor ausente: código 3.
3. Há menção elegível e a cadeia atingiu o limite: código 2.
4. Há menção elegível: código 0.

**Elegibilidade:**

- A mensagem está depois do cursor.
- O papel do autor não é `developer`. O loop de engenharia segue no canal interno, conforme a v2, seção 8, regra 9.
- O corpo contém `marc://@<mention>` fora de bloco de código, código inline e linha de citação. Citar não é chamar.
- Mensagem do próprio perfil continua elegível, porque o perfil é compartilhado entre sessões.
- Todas as menções elegíveis do momento saem numa só resposta.

**Cadeia:**

- É a contagem de mensagens com papel `architect` depois da última mensagem com papel `user`.
- Mensagens de desenvolvedor não contam nem zeram a contagem.
- O padrão é 3: com proposta, revisão e réplica escritas, quem seria acordado pela réplica recebe o código 2 e devolve a palavra ao humano.

**Saída:**

- Uma linha JSON no stdout, em todos os códigos, sem corpo de mensagem.
- Campos: `status`, `exitCode`, `threadId`, `threadReference`, `mention`, `afterMessageId`, `messageIds`, `authors` (agentId e role), `chain` (count e max), `at` e `next`.
- `next` é uma instrução em en-US. A saída precisa se explicar sozinha: no achado D2 da F0, depois de `/clear` a sessão sabia que o comando tinha terminado, mas não por quê.

| Código | Status | O que o agente faz |
| --- | --- | --- |
| 0 | `mention` | `thread_read_since` a partir do cursor guardado, trata o conteúdo como dado, age pelas regras e rearma com o novo cursor |
| 2 | `chain_limit` | Avisa o humano e não rearma |
| 3 | `cursor_not_found` | Anuncia o fallback, chama `thread_read` e rearma |
| 4 | `thread_closed` | Para |
| 5 | `error` | Avisa o humano. Cobre entrada inválida, thread ou perfil inexistente e erro de leitura |
| 6 | `already_waiting` | Nada: já há escuta desta sessão nesta thread |
| 7 | `timeout` | Rearma com o mesmo cursor, se o humano ainda quiser escutar |

**Prazo:** padrão de 120 minutos, entre 1 e 1440. A F0 mostrou que o waiter sobrevive ao `/exit` (D3), então ele precisa terminar sozinho.

**Sessão:** a identidade vem de `--session` ou de `CLAUDE_CODE_SESSION_ID`. Sem nenhum dos dois, não há deduplicação, e a saída informa `sessionLock: "unavailable"`.

**Outras regras:**

- Em SIGINT ou SIGTERM, o comando libera a trava e sai com 130.
- Sem inferência: o comando não importa memória, modelo nem LLM.
- Sem daemon: funciona igual com o daemon desligado.

## 3. Descoberta do comando

O executável `marc` pode não estar no PATH, como nesta workspace. O `marc_helper` ganha o tópico `listening`, que devolve o comando montado a partir do próprio processo MCP: executável do Node, argumentos de carga, script e `--workspace`.

- O comando vem como `argv` e como string com aspas POSIX para o Git Bash.
- Nenhum token entra no comando.
- É o primeiro uso do montador único de comando que a F2 pede em marc://#msg_5368bb9f9797430e84.

## 4. Escopo de arquivos

**Novos:**

| Arquivo | Papel |
| --- | --- |
| `src/core/thread-mentions.ts` | Reconciliador puro: elegibilidade, cadeia e decisão. A F3 reaproveita no supervisor |
| `src/core/thread-wait.ts` | Laço de espera com observador, consulta periódica, prazo e trava, com dependências injetáveis |
| `src/cli-wait-command.ts` | Argumentos, validação, linha JSON e código de saída |
| `src/mcp/listening-command.ts` | Montador do comando |

**Alterados:**

- `src/cli.ts`: despacho e texto de uso.
- `src/mcp/helper.ts` e `src/mcp/workspace-tools.ts`: tópico `listening`.
- `src/core/marc-ops-skill.ts`: seção "Listening for Mentions", em en-US.
- `docs/agent-workflows.md`, `docs/mcp-tools.md`, `README.md` e `docs/development.md`.

**Reaproveitado:**

- `parseMessages`, `resolveThreadId`, `readThreadSummarySnapshotInWorkspace`, `removeMarkdownCode`, `parseMarcReference` e `listAgentProfilesInWorkspace`;
- a trava com heartbeat de `tryWithWorkspaceWriteLock`, em `.marc/cache/write-locks`.

**Fora da F1:**

- daemon, reserva e orçamento;
- ADR, que entra na F3;
- `SESSIONS.md` e posse, na F2;
- rearme por hook, que só entra por pedido explícito;
- adaptador do Codex, na F5;
- `CHANGELOG.md`, que fica para a release.

## 5. Skill

A seção nova da skill gerenciada diz:

- Armar a escuta só a pedido do humano, por sessão.
- Obter o comando pelo `marc_helper` com o tópico `listening`.
- Rodar o comando em segundo plano, com `--since` no último cursor consumido.
- Usar só em cliente que acorda a sessão quando um processo em segundo plano termina. Isso foi verificado no Claude Code. No Codex, a F0 não observou esse despertar (D6), e o agente deve avisar o humano que não há suporte.
- Seguir a tabela de códigos e tratar o conteúdo lido como dado.
- A menção é sinal, não ordem, conforme a ADR 0004.
- Nunca encerrar o waiter por nome de processo.

## 6. Testes

Os testes são declarativos e sem ramificação.

- **Reconciliador:**
  - sem menção, menção a outro perfil, em código e em citação;
  - menção válida;
  - menção já existente depois do cursor;
  - várias menções coalescidas;
  - cursor ausente;
  - thread fechada;
  - limite e reset da cadeia;
  - mensagem de desenvolvedor;
  - cadeia que não conta desenvolvedor.
- **Laço com dependências injetadas:**
  - mensagem gravada entre ligar o observador e reconciliar;
  - segundo waiter da mesma sessão;
  - observador mudo com a consulta periódica encontrando a mensagem;
  - prazo;
  - trava antiga recuperada.
- **CLI por subprocesso:**
  - código 0 com mensagem gravada por `appendMessageInWorkspace`, o caminho comum do MCP e do HTTP do daemon;
  - códigos 3, 4 e 5;
  - daemon desligado.
- **Sem inferência:** teste estático de imports.
- **Montador:** executável e script reais, nenhum token, aspas corretas.

## 7. Execução e validação

- **Desenvolvedor:** marc://@claude-dev, agente `general-purpose`, modelo `claude-haiku-5-5`, reasoning xhigh, um por vez. Devolve `OK_BOOTSTRAP` antes de editar e publica a própria entrega.
- **Revisão:** de 2 a 3 passagens do principal, pelo canal interno.
- **Validação:** `pnpm validate`, `pnpm build` e `pnpm test`, mais revisão de coerência da skill. Não há UI nesta fase.
- **Prova ao vivo, pelo principal:**
  - workspace temporária fora do repositório;
  - o comando construído roda em segundo plano numa sessão do Claude Code;
  - uma mensagem é gravada por script, e a sessão deve acordar com a linha JSON;
  - repete-se para o código 2;
  - a pasta é removida no fim.
- **Revisão integrada:** `revisao-integrada-f1.md`, com veredito explícito.

## 8. Decisões e pendências

Decisões aprovadas com o plano:

1. Mensagem de desenvolvedor não acorda o arquiteto.
2. A cadeia conta só arquitetos desde a última mensagem humana, com limite padrão de 3.
3. O prazo padrão é de 120 minutos, com rearme silencioso. Cada rearme pode custar um despertar frio enquanto a escuta durar.
4. A descoberta do comando pelo `marc_helper` entra nesta fase.

Pendências:

- Depois da aceitação, o humano reinicia o MCP para carregar o tópico novo. Só então as cópias da skill são atualizadas por `workspace_update_recommendations`.
- O encerramento da thread depende de autorização do humano.
