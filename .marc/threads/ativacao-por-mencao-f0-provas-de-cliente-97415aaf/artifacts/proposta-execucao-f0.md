# Proposta de execução da F0

Autor: marc://@claude-software-architect
Data: 02/11/2026
Base: plano-f0-provas-de-cliente.md, que continua valendo. Esta proposta acrescenta protocolo por célula, divisão de frentes e duas células novas.
Autorização: o humano aprovou esta execução em 02/11/2026. Isso não cobre F1, a sessão grande da G1, Git nem o fechamento da thread.

## 1. Resumo

A F0 roda em três frentes, uma por vez: Claude sem humano, Codex e humano. Ao final, cada célula fica testada ou com limite declarado, e o impacto é declarado por fase e por cliente.

Duas células entram na matriz, porque as versões instaladas têm recursos que ela não cobria. O texto do `--help` é pista e não resultado.

## 2. Versões de referência

| Item | Versão |
| --- | --- |
| Claude Code | 2.1.316 |
| Codex CLI | 0.166.0 |
| Node.js | 22.20.0 |
| SDK MCP do mARC | `@modelcontextprotocol/server` 2.3.1 |

Se a versão de um cliente mudar durante a F0, a célula registra a versão real, e a mudança é declarada no resultado.

## 3. Células novas

| ID | Cliente | Pergunta | Humano | Afeta |
| --- | --- | --- | --- | --- |
| A4 | C | `claude --bg --resume <id>` detecta sessão já em execução? Recusa, copia ou avisa? Isso vale contra sessão `-p` e contra sessão interativa? Como aparece em `claude agents`? | Só contra interativa | F2 |
| D7 | X | `codex queue` entrega mensagem a uma sessão existente? Com sessão ociosa, ela acorda sem humano? `codex agents` serve de sinal de presença? | Parcial | F1, F2, F5 |

**Por que A4 importa:** o `--help` diz que, com a sessão em execução, o cliente "starts a copy and says so". Isso pode dar ao mARC um sinal nativo de sessão ativa, mas uma cópia não impede a bifurcação. Até haver teste, vale o achado anterior: a CLI não protege contra retomada dupla em `-p`.

**Por que D7 importa:** o desenho trata o despertar de um chat aberto do Codex como não demonstrado. Se `codex queue` funcionar com sessão ociosa, a F5 muda de escopo. Se a mensagem só entrar no próximo turno, nada muda.

## 4. Frentes

| Frente | Células | Executor |
| --- | --- | --- |
| Claude, sem humano | A3, A4 contra `-p`, B4, B5, C2, D1, E1, E2, E3, G1 par pequeno | marc://@claude-dev |
| Codex | A3, B2, C2, D7, E1, E2, E4, G1 par pequeno | Sessão do Codex, com marc://@codex-dev |
| Humano | A1, A2, B1, B3, C1, D2, D3, D4, D5, D6, A4 contra interativa, D7 parte interativa | Humano, com roteiro de uma ação por passo |

B4 roda uma vez, porque o handler do SDK independe do cliente real. B2 confirma o valor real no Codex.

## 5. Regras comuns

- **Local:** tudo em `C:\Users\junior\AppData\Local\Temp\marc-f0\`, com um subdiretório por célula.
- **Modelo das sessões descartáveis:** `claude-haiku-5-5` na frente Claude.
- **Isolamento:** `--setting-sources ""`, `--strict-mcp-config` e `--mcp-config` do kit quando a célula permitir.
- **Permissão:** sem `bypassPermissions`, `--dangerously-skip-permissions` ou equivalente.
- **Gasto:** `--max-budget-usd 0.50` por execução e US$ 5 no total da frente Claude. Ao atingir o total, parar e reportar.
- **Limpeza:** apagar só o que o teste criou, por ID e depois de conferir. Nunca encerrar processo por nome.
- **Sanitização:** sem token, credencial ou conteúdo de configuração do usuário. Linhas de comando do MCP do mARC podem conter token e não devem ser impressas.
- **Classificação:** `testado`, `testado com limite` ou `limite declarado`. Leitura estática nunca conta como teste, e `-p` não vale como prova do modo interativo.

## 6. Kit de sondagem

Fica em `marc-f0/kit/` e é descartável:

- **`probe-mcp.mjs`:** servidor MCP stdio que grava em JSONL início, encerramento, PID, processo pai, `CLAUDE_CODE_SESSION_ID`, `process.cwd()` e, em cada chamada, `_meta`. Importa o SDK do `node_modules` do repositório por caminho absoluto, sem instalar nada.
- **Ferramentas do probe:** `probe_ping`, que devolve PID e identidade, e `probe_permission`, usada na E2 como ferramenta de permissão.
- **`mcp.json`:** configuração usada com `--mcp-config`.
- **Um script por célula:** comandos reproduzíveis, para a evidência apontar para o comando real.

O roteiro humano reaproveita o mesmo kit.

## 7. Protocolos da frente Claude

### A3 — ramo depois da bifurcação

1. Criar sessão com `--session-id` fixo e um marcador inicial.
2. Rodar duas retomadas simultâneas, cada uma pedindo para gravar um marcador diferente.
3. Rodar uma terceira retomada e pedir os marcadores conhecidos.
4. Ler o transcript e identificar `uuid` e `parentUuid` dos dois ramos.

**Resultado:** qual ramo a retomada escolheu, se a escolha é determinística em 3 repetições e se o outro ramo fica no arquivo.

### A4 — retomada em background contra sessão ativa

1. Criar sessão `-p` e mantê-la ocupada com um turno longo.
2. Rodar `claude --bg --resume <id>` com um prompt curto.
3. Registrar saída literal, ID devolvido e estado em `claude agents`.
4. Repetir com a sessão parada, como controle.
5. Usar `claude logs`, `claude stop` e `claude rm` só nos IDs criados.

**Resultado:** recusa, cópia ou aviso; se o ID foi mantido; se o aviso é legível por máquina. A parte contra sessão interativa fica no roteiro.

### B4 — `_meta` no handler

Cliente de teste do SDK 2.3.1 chama `probe_ping` em processo real com `_meta: { threadId: "f0-b4" }`.

**Resultado:** caminho exato em que o handler recebe o valor, ou a ausência dele. Registrar a versão.

### B5 — processos de descoberta

Executar uma sessão `-p` com o probe e sem chamada de ferramenta, e outra com uma chamada. Contar os registros de início e encerramento.

**Resultado:** número de processos por sessão e se algum nasce e morre sem servir chamada.

### C2 — retomada em diretório errado

Criar sessão no diretório A e retomar pelo diretório B, sem `--add-dir`.

**Resultado:** saída literal, código de saída, e se o erro permite distinguir "sessão inexistente" de "outro diretório".

### D1 — compactação com waiter ativo

1. Abrir sessão `-p` com `--input-format stream-json` e `--output-format stream-json`.
2. Pedir um waiter em background que espera por um arquivo-gatilho e imprime o motivo ao sair.
3. Enviar `/compact`.
4. Criar o arquivo-gatilho.
5. Registrar se a sessão reagiu e se ainda sabe por que acordou.

**Limite previsto:** se o despertar não se reproduzir em `-p`, a célula passa para o roteiro humano, com limite declarado.

### E1 — retomada sem supervisão que pede permissão

Retomar uma sessão em `-p` pedindo uma ação que exige permissão, sem `--allowedTools`. Variar `--permission-prompts` entre `none` e o padrão.

**Resultado:** o que acontece com o turno, código de saída, campo da saída JSON que mostra a negação e se a sessão continua retomável.

### E2 — encaminhar aprovação ao humano

Rodar com `--permission-prompt-tool` apontando para `probe_permission`, em dois cenários: negar e permitir. Registrar o conteúdo que o host recebe.

**Resultado:** se o pedido traz dados suficientes para mostrar ao humano. Um host que responde automaticamente aqui é só teste, não política.

### E3 — limite de background em `-p`

Com teto de 10 minutos:

1. Turno que dispara processo em background e termina.
2. Turno com subagente longo.
3. Conferir o que sobrevive ao fim do turno e ao fim do processo `claude`.

**Resultado:** tempo de vida observado, código de saída e sobras de processo.

### G1 — custo, par pequeno

1. Criar sessão pequena e registrar input, cache lido, cache gravado, output, latência e `total_cost_usd`.
2. Retomar em até 30 segundos: medição quente.
3. Retomar aos 6 minutos: medição fria ou intermediária.
4. Se ainda houver leitura de cache, retomar aos 65 minutos e declarar o TTL observado.

A sessão grande, de cerca de 100 mil tokens, fica fora desta frente: depende de estimativa e aval do humano.

## 8. Frente Codex

Executada na sessão do Codex, que decide os comandos dentro destas regras e registra o resultado no mesmo formato.

| Célula | Protocolo mínimo |
| --- | --- |
| A3 | Se a CLI aceitar retomada dupla, repetir o método do Claude. Se recusar, registrar a recusa e marcar não aplicável |
| B2 | Turno real de modelo que chama um probe, conferindo `_meta.threadId` |
| C2 | `codex resume` e `codex exec resume` em outro diretório |
| D7 | `codex queue` contra sessão ociosa e ocupada, sem humano. Conferir `codex agents` |
| E1 | Retomada sem supervisão que pede aprovação |
| E2 | Forma documentada de encaminhar a aprovação, sem política permissiva |
| E4 | Retomada com turno real pelo App Server, com launcher validado |
| G1 | Par quente e frio em sessão pequena, com TTL observado |

## 9. Frente humana

O roteiro será publicado depois da revisão da frente Claude, para reaproveitar o kit e o que ela descobrir. Cada passo terá uma ação, no Git Bash, em sessão descartável.

## 10. Entregáveis

1. `resultado-f0-claude.md`, de autoria de marc://@claude-dev.
2. Resultado da frente Codex, de autoria de marc://@codex-dev.
3. `roteiro-humano-f0.md`.
4. `matriz-f0-consolidada.md`, com impacto por fase e por cliente e revisão integrada.

## 11. Pendências

- **Sessão grande da G1:** estimativa depois do par pequeno; depende do humano.
- **Disponibilidade do humano:** define quando A1, A2, B1, B3 e C1 terminam. Sem elas, a F2 não abre.
- **Fora desta proposta:** F1 e qualquer código de produto.
