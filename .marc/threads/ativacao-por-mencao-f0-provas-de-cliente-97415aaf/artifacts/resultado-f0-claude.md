# Resultado da F0, frente Claude (versão 2, com correções)

Autor: claude-dev (perfil compartilhado de desenvolvedor, papel developer)
Principal: claude-software-architect
Estado: entrega de autoria do executor, com as correções 1 a 7 da revisão do principal. A revisão integrada do principal está pendente. Isto não é aprovação técnica.
Evidência bruta: pasta temporária marc-f0 (kit, uma subpasta por célula, probe-logs, gasto-bruto.jsonl e gasto.jsonl). Não faz parte do repositório.

## Correções desta versão

1. Custo: `total_cost_usd` retornado em retomada é o acumulado da sessão. A tabela, o total e gasto.jsonl passam a usar o custo por chamada (delta). Os valores crus estão em gasto-bruto.jsonl. Achado registrado na seção G1 e na tabela de gasto.
2. Teto de `--max-budget-usd` em retomada: testado. O teto vale por execução, não pelo acumulado da sessão (seção E1, teste de budget).
3. A3: conclusão refeita pelas respostas finais de cada ramo, com timestamps. A escolha seguiu a última resposta gravada em 4 de 5 repetições. Corrijo a conclusão anterior, que comparava a ordem das mensagens de usuário.
4. A4: registrada a listagem de `claude agents --json --all`, com IDs sanitizados. Estados failed não trazem campo de motivo.
5. C2: repetição com marcador secreto. O contexto atravessou o diretório. Local dos arquivos e tamanhos registrados.
6. E2: a afirmação "allow exige updatedInput" estava errada. Testado: allow sem updatedInput funcionou. Afirmação removida.
7. G1 de 65 minutos: executada com nova sessão. Resultado e interpretação na seção G1.

## Resumo

- Escopo: A3, A4 (contra -p), B4, B5, C2, D1, E1, E2, E3 e G1 (par pequeno e espera de 65 minutos).
- Classificação, comandos e saídas literais estão em cada seção.
- Gasto real corrigido (soma dos deltas por chamada): US$ 0,067922, abaixo do teto de US$ 5. A soma ingênua dos valores reportados (US$ 0,141561) estava errada, porque conta o acumulado de cada retomada.
- Não executados: sessão grande da G1 (~100 mil tokens) e células interativas (ficam no roteiro humano).

## Ambiente e configuração

- Claude Code 2.1.316, verificado por `claude --version` no início e usado em todas as células.
- Node.js v22.20.0.
- SDK MCP 2.3.1 (@modelcontextprotocol/server e @modelcontextprotocol/client), importado por caminho absoluto. Nada foi instalado. O zod 4.6.5 é a dependência do servidor.
- Modelo das sessões descartáveis: claude-haiku-5-5. As sessões -p não recebem flag de reasoning.
- Configuração do executor: claude-haiku-5-5 com reasoning xhigh, definida pelo principal. Registrada como configurada, não verificada por introspecção. Nota: o transcript das sessões -p registra o campo `effort` nas mensagens do assistente, mas isso se refere às sessões descartáveis, não ao reasoning do executor.
- Kit: probe-mcp.mjs, mcp.json (decisão deny), mcp-allow.json (decisão allow), mcp-allow-noupdated.json (allow sem updatedInput, teste de E2), b4-client.mjs, ledger.mjs, cost-series.mjs, a3-final-answers.mjs, ancestor-check.mjs, probe-summary.mjs, transcript.mjs, agents-sanitize.mjs e record-cost.mjs (versão anterior, substituída por ledger.mjs).
- Ferramentas do probe: probe_ping, probe_permission e probe_wait. A probe_wait não estava no brief e foi acrescentada para manter um turno ocupado (A4 e E3). Na correção 6, a probe_permission ganhou uma opção de teste (PROBE_PERMISSION_OMIT_UPDATED=1), usada só no novo caso de E2.

## Classificação por célula

| Célula | Classificação | Achado principal |
| --- | --- | --- |
| A3 | testado com limite | A terceira retomada seguiu a última resposta gravada em 4 de 5 repetições. Exceção na rep 3, com 38 ms de intervalo. Sem garantia. |
| A4 | testado com limite | Retomada em background contra sessão -p ativa cria cópia com ID novo e avisa em stderr. Turno em background não executado. |
| B4 | testado | O handler recebe `_meta.threadId` em `ctx.mcpReq._meta`. |
| B5 | testado | Sessão sem chamada iniciou um processo probe que morreu sem servir chamada. Sem processo extra de descoberta. |
| C2 | testado | Retomada pelo diretório errado não falhou. O contexto atravessou o diretório (teste com marcador). ID inexistente falha com "No conversation found". |
| D1 | testado com limite | Despertar espontâneo após /compact com waiter em background, em -p stream-json. |
| E1 | testado | Sem permissão, a negação aparece em permission_denials com exit 0. Teste de budget: teto por execução. |
| E2 | testado | Negar e permitir funcionaram. Allow sem updatedInput também funcionou (correção 6). |
| E3 | testado com limite | O -p esperou o processo em background de 300 s antes de sair. Background mais longo não testado. |
| G1 | testado com limite | Par quente e frio, mais par de 65 minutos. Leitura de cache aos 65 min é de prefixo compartilhado; o bloco da própria sessão não foi relido. |

## Custo: achado de acumulado por sessão

- Em retomada, `total_cost_usd` é o acumulado da sessão. A evidência está nos registros `cost-state` dos transcripts, em que `totalCostUSD` cresce a cada chamada e o campo `startTime` é o da sessão inteira.
- Pela mesma regra, `duration_api_ms` é acumulado em retomada: o `totalAPIDuration` do cost-state cresce a cada chamada. A latência de API por chamada é o delta entre o acumulado atual e o anterior. Vale para o par pequeno e para a sessão grande.
- Exemplo da G1 (sessão do par pequeno): cost-state 0,00158647 → 0,00261093 → 0,00285556. O custo da chamada quente é 0,00261093 − 0,00158647 = 0,00102446. O da fria é 0,00285556 − 0,00261093 = 0,00024463.
- Exemplo da A3: base 0,00158697; cada ramo reporta 0,00261134 (base + próprio ramo); a terceira retomada reporta 0,0028627 (ramo escolhido + própria chamada). Custo real por repetição: 0,00158697 + 0,00102437 + 0,00102437 + 0,00025136 = 0,00388707.
- Sem a correção, a soma dos valores reportados dava US$ 0,141561. O total real é US$ 0,067922.

## A3: ramo depois da bifurcação

- Versão: 2.1.316.
- Comandos reais (cwd A3/rep-N, stdin de /dev/null):
  - Base: `claude -p --model claude-haiku-5-5 --setting-sources "" --strict-mcp-config --mcp-config kit/mcp.json --max-budget-usd 0.50 --output-format json --session-id <uuid> "Responda somente com: BASE-OK"`.
  - Duas retomadas simultâneas com `--resume <uuid>`: "Responda somente com: MARK-A" e "Responda somente com: MARK-B".
  - Terceira retomada: "Qual marcador, MARK-A ou MARK-B, aparece por ultimo no historico desta conversa? Responda somente com a palavra exata."
  - Scripts: A3/run-a3.sh (reps 1 a 3, ordem A antes de B) e A3/run-a3-swapped.sh (reps 4 e 5, ordem B antes de A).
- Escolha da terceira retomada: pelo `parentUuid` dos ancestrais (kit/ancestor-check.mjs), o turno da terceira retomada descende da resposta MARK-A nas reps 1 a 4 e da resposta MARK-B na rep 5. Respostas: "MARK-A" em 4 e "MARK-B" em 1.
- Análise pelas respostas finais (kit/a3-final-answers.mjs, saída em A3/analysis-final-answers.txt). Compara o timestamp da resposta final de cada ramo:

| Rep | Intervalo entre respostas finais | Última gravada | Escolhida pela terceira retomada | Coincide |
| --- | --- | --- | --- | --- |
| 1 | 42 ms | MARK-A | MARK-A | sim |
| 2 | 73 ms | MARK-A | MARK-A | sim |
| 3 | 38 ms | MARK-B | MARK-A | não |
| 4 | 159 ms | MARK-A | MARK-A | sim |
| 5 | 223 ms | MARK-B | MARK-B | sim |

- Conclusão: tendência ao último gravado, em 4 de 5 repetições. Não há garantia: a rep 3 escolheu a primeira resposta gravada, com 38 ms de intervalo. O intervalo entre as respostas é de dezenas a centenas de milissegundos, o que torna a diferença sensível a qualquer variação de escrita.
- Correção da análise anterior: eu havia comparado a ordem das mensagens de usuário, não das respostas finais. Esse critério estava errado, e a conclusão anterior de que a ordem de gravação não explicava a escolha está retirada.
- Ramo não escolhido: em todas as repetições, o turno e a resposta do ramo não escolhido permanecem no arquivo.
- Limite: cinco repetições, com intervalo curto entre respostas. A tendência não é garantia.
- Transcripts: A3/evidence/rep1-session.jsonl a rep5-session.jsonl.
- Custo real: US$ 0,019435 (5 repetições de 0,00388707).

## A4: retomada em background contra sessão ativa (contra -p)

- Versão: 2.1.316.
- Parte 1 (A4/run-a4-part1.sh):
  - Sessão ocupada: `claude -p ... --allowedTools mcp__probe__probe_wait --max-budget-usd 0.50 --output-format json --session-id <uuid> "Chame a ferramenta mcp__probe__probe_wait com seconds igual a 150. ..."`, cwd A4/busy. O probe registrou wait-start antes da retomada.
  - Retomada em background contra a sessão ativa: `claude --bg --resume <uuid> --model claude-haiku-5-5 --setting-sources "" --strict-mcp-config --mcp-config kit/mcp.json "Responda somente com: BG-PING"`.
  - Stdout literal: `backgrounded · 454c502d (idle — send a prompt to start)`, seguido de sugestões de `claude agents`, `attach`, `logs` e `stop`.
  - Stderr literal: `Starting background service…` e `note: session a3a8e92d is open in another Claude Code process, so this started a copy as 454c502d. The original conversation is unchanged.`
  - Saída do turno ocupado: `BUSY-DONE`, exit 0, sem permission_denials.
  - `claude agents` sem --json: falha fora de TTY. Mensagem literal: `'claude agents' requires an interactive terminal (stdout is not a TTY) — use 'claude agents --json' for a machine-readable listing.`
- Parte 2, controle com sessão parada (A4/run-a4-part2.sh):
  - Stdout literal: `backgrounded · a3a8e92d (idle — send a prompt to start)`. Mesmo ID da sessão original.
  - Stderr: apenas `Starting background service…`. Sem aviso de cópia.
- Listagem `claude agents --json --all` (A4/agents-json-all-recheck.sanitized.json), com IDs substituídos por marcadores e nomes omitidos. Capturada depois da limpeza das cópias:

| Entrada | Chaves | kind | Estado | pid | Cwd |
| --- | --- | --- | --- | --- | --- |
| <id-1> (sessão de background de outro contexto) | cwd, id, kind, name, sessionId, startedAt, state | background | done | — | Projetos/marc |
| <id-3> (sessão interativa em execução) | cwd, kind, name, pid, sessionId, startedAt, status | interactive | busy | 37692 | Projetos/marc |

- A sessão -p ocupada (a3a8e92d) não aparece na listagem. As cópias 454c502d e a3a8e92d apareceram antes da remoção, com kind background e state failed, cwd A4/busy. Entradas failed têm as chaves id, cwd, kind, startedAt, sessionId e state. Não há campo de motivo. A causa do failed não foi investigada, por decisão do principal.
- Diferença de campos: sessão interativa usa `status`, e entradas de background usam `state`.
- `claude logs <id>` falhou nos dois IDs com exit 1. Mensagem literal: `Couldn't read logs for 454c502d — connect ENOENT \\.\pipe\cc-daemon-*-control`.
- Transcript da sessão ocupada (A4/evidence/busy-session.jsonl): nenhuma ocorrência de BG-PING nem de BG-IDLE. O turno em background não entrou no transcript original.
- Limpeza: `claude stop` e `claude rm` só nos IDs 454c502d e a3a8e92d, com exit 0. O `claude rm` não apagou o transcript da sessão -p.
- Respostas à pergunta: recusa, não ocorreu. Cópia, ocorreu com a sessão em execução, com ID novo. Aviso, em texto livre no stderr, não em JSON. Com a sessão parada, o ID é mantido e não há aviso.
- Limite: execução do turno em background não observada (estado failed, logs inacessíveis). Não usei `claude respawn`, fora do protocolo.
- Custo: busy, US$ 0,002223. As chamadas --bg não geraram turno e não têm custo reportado. Não recebem --max-budget-usd, porque a flag vale só com -p.

## B4: _meta no handler (SDK 2.3.1)

- Versão: @modelcontextprotocol/client 2.3.1 e @modelcontextprotocol/server 2.3.1, Node v22.20.0.
- Comando real (cwd B4): `node kit/b4-client.mjs`. O cliente usa StdioClientTransport para executar probe-mcp.mjs e chama `callTool({ name: "probe_ping", arguments: {}, _meta: { threadId: "f0-b4" } })`.
- Stdout literal, trecho: `"serverVersion": {"name": "f0-probe", "version": "0.1.0"}`, e em result.content o texto `{"pid":21444,"ppid":30568,"cwd":"...\\B4","meta":{"threadId":"f0-b4"}}`. Stderr vazio. Exit 0.
- Registro do probe (B4/probe.jsonl, evento call): method "tools/call"; meta {"threadId":"f0-b4"}; envelope null; mcpReqKeys incluem "_meta" e "method".
- Caminho exato: o handler registrado com `server.registerTool` recebe o `_meta` da requisição em `ctx.mcpReq._meta`. As chaves do envelope io.modelcontextprotocol/* são retiradas desse objeto e expostas em `ctx.mcpReq.envelope`, que ficou nulo porque o cliente não as enviou.
- Primeira rodada: B4/run-1-inherited-env. Registrou o ID do shell herdado em claudeCodeSessionIdEnv. Substituída pela rodada limpa, sem a variável.
- Classificação: testado. Limite: cliente SDK sem Claude Code e sem turno de modelo. Cobre apenas o caminho tools/call.
- Custo: nenhum (sem modelo).

## B5: processos de descoberta

- Versão: 2.1.316.
- Comandos reais, com o mesmo conjunto de flags -p e kit/mcp.json:
  - cwd B5/run-noTool: `claude -p ... --session-id <uuid> "Responda somente com a palavra: NO-TOOL. Nao use ferramentas."`
  - cwd B5/run-tool: `claude -p ... --allowedTools mcp__probe__probe_ping --session-id <uuid> "Chame a ferramenta mcp__probe__probe_ping uma vez e depois responda somente com o campo pid retornado."`
  - Script: B5/run-b5.sh.
- run-noTool: resposta "NO-TOOL", exit 0. Probe: 1 processo (pid 33832, ppid 15520), start 05:57:16.389Z, stop 05:57:17.472Z, motivo stdin-end, 0 chamadas. Nasceu e morreu sem servir chamada.
- run-tool: resposta "11048" (pid do probe), exit 0. Probe: 1 processo (pid 11048), 1 chamada probe_ping, stop stdin-end.
- Um processo por sessão nas duas condições. Sem processo de descoberta extra.
- Evidência: B5/evidence (transcripts e JSONL por processo).
- Classificação: testado. Limite: uma sessão por condição, somente -p.
- Custo: US$ 0,003794 (2 sessões de uma chamada cada).

## C2: retomada em diretório errado

- Versão: 2.1.316.
- Primeira rodada (C2/run-c2.sh), comandos reais:
  - Criação em C2/dir-a: `claude -p ... --session-id <uuid> "Responda somente com a palavra: C2-OK"`.
  - Retomada em C2/dir-b, sem --add-dir: `claude -p ... --resume <uuid> "Responda somente com a palavra: C2-B"`.
  - Controle no mesmo diretório: `--resume <uuid>` em dir-a, com "C2-A2".
  - Controle de ID inexistente: `--resume <uuid inexistente>` em dir-b.
- Resultados: criação "C2-OK", exit 0. Retomada em dir-b "C2-B", exit 0, sem erro. Controle em dir-a "C2-A2", exit 0. ID inexistente: exit 1, stdout vazio, stderr literal `No conversation found with session ID: b166a3af-0ad3-4070-a57c-f95e1c28eb72`.
- Onde ficaram os arquivos: o transcript ficou só na pasta de projeto do dir-a (`C--Users-junior-AppData-Local-Temp-marc-f0-C2-dir-a`). A retomada em dir-b anexou registros nesse mesmo arquivo, com `cwd` = dir-b e um registro de atualização de ambiente informando o diretório de trabalho dir-b. A pasta de projeto do dir-b continha só `memory/`, vazia. Esse conteúdo foi observado antes da limpeza desta rodada. Não há tamanho registrado da primeira rodada.
- Repetição com marcador (C2/run-c2-secret.sh, C2/secret/):
  - Criação em C2/secret/dir-a: "Guarde este marcador secreto para perguntar depois: ZAFIRO-4417-PALMEIRA. Responda somente com: GUARDADO". Resultado "GUARDADO", exit 0.
  - Retomada em C2/secret/dir-b: "Qual marcador secreto eu pedi para voce guardar? Responda somente com o marcador." Resultado "ZAFIRO-4417-PALMEIRA", exit 0. O contexto atravessou o diretório.
  - Listagem das pastas de projeto antes da última retomada (C2/secret/project-folders-listing.txt): dir-a com 1 transcript de 192392 bytes e `memory/`. dir-b só com `memory/`.
  - Retomada em C2/secret/dir-a: "Antes desta conversa eu te fiz outra pergunta em outro diretorio. Cite a pergunta literal e a resposta que voce deu a ela." O modelo disse não encontrar pergunta em outro diretório, mas citou a troca do marcador (pergunta sobre o marcador e resposta ZAFIRO-4417-PALMEIRA). O conteúdo veio da mesma sessão, com a atribuição de diretório recusada pelo modelo.
  - Estado final das pastas, antes da limpeza (C2/secret/final-tree-before-cleanup.txt): dir-a com transcript de 204962 bytes e `memory/`. dir-b só com `memory/`.
  - Transcript: C2/secret/evidence/secret-session-dir-a.jsonl.
- Resposta à pergunta: o diretório errado não impediu a retomada em 2.1.316, e o contexto da sessão atravessou o diretório. Como a retomada não falha, o erro não distingue "outro diretório" de "sessão inexistente". Só o ID inexistente gera erro.
- Limite: uma tentativa por caso. As execuções da C2 foram feitas sem `</dev/null`, por isso o stderr traz `Warning: no stdin data received in 3s, proceeding without it`. Não afetou o resultado.
- Classificação: testado.
- Custo real corrigido: primeira rodada US$ 0,00295935 (criação mais duas retomadas, por delta; a chamada sem ID não tem custo); repetição com marcador US$ 0,00319437 (criação mais duas retomadas, por delta). Total da C2: US$ 0,00615372.

## D1: compactação com waiter ativo

- Versão: 2.1.316.
- Comando real: `node D1/run-d1-driver.mjs`, que inicia `claude -p --input-format stream-json --output-format stream-json --verbose --model claude-haiku-5-5 --setting-sources "" --strict-mcp-config --mcp-config kit/mcp.json --allowedTools "Bash(node:*)" --max-budget-usd 0.50 --session-id <uuid>` com stdin aberto. O waiter é D1/waiter.mjs, que espera o arquivo trigger.flag por até 10 minutos.
- Linha do tempo (UTC, 2026-11-02): 06:00:17 início, com pedido de waiter em background. 06:00:28 resposta "WAITER-STARTED". 06:00:36 /compact concluído (system:compact_boundary). 06:00:36 trigger.flag criado. 06:00:41 nova resposta sem entrada do driver, 5 s após o gatilho. stdin fechado, exit 0, stderr vazio.
- Eventos do stream após o gatilho: system:task_notification, nova system:init, turno do assistente e result.
- Texto literal da reação: "O processo `waiter.mjs` terminou com código de saída 0. A saída registrada foi: `WAITER-REASON trigger-file-seen 2026-11-02T06:00:36.157Z`, ou seja, ele encerrou porque detectou o arquivo de gatilho."
- Motivo do despertar: a sessão citou a saída do waiter, que veio na notificação da tarefa. Não há prova de que a sessão lembre do lançamento do waiter depois da compactação. A pergunta explícita não foi enviada, porque a sessão já tinha reagido.
- Custo real por turno (cada result é acumulado do processo): 0,00197397; 0,00117421 (0,00314818 − 0,00197397); 0,00196742 (0,00511560 − 0,00314818). Total: 0,0051156.
- Limite: somente -p com stream-json, sem sessão interativa.
- Classificação: testado com limite.

## E1: retomada sem supervisão que pede permissão

- Versão: 2.1.316.
- Comandos reais (E1/run-e1.sh), sem --allowedTools: criação com "Responda somente com: E1-BASE"; retomada que pede escrita com "Use a ferramenta Write para criar o arquivo e1-out.txt com o conteudo E1-WRITE. Depois responda somente com: E1-DONE."; na variante b, com `--permission-prompts none`; retomada seguinte com "Responda somente com: E1-RESUME".
- Variante a (prompts padrão): exit 0, subtype success, stop_reason end_turn. permission_denials com Write (tool_use_id toolu_01L8CXPD9oAc3UEc17i3Bp1D). Texto: "Não consegui criar o arquivo. A ferramenta Write pediu permissão para gravar em ... e a permissão ainda não foi concedida." Arquivo ausente. Retomada seguinte: "E1-RESUME", exit 0, sem negação.
- Variante b (--permission-prompts none): exit 0, subtype success, end_turn. permission_denials com Write. Texto: "The Write call to ... was denied because this session has no way to approve permission prompts." Arquivo ausente. Retomada seguinte: "E1-RESUME", exit 0.
- Como a negação é detectada: exit code 0 nos dois casos. O campo permission_denials é o sinal.
- Custo real: variante a, 0,00158637 + 0,00152669 + 0,00030727 = 0,00342033. Variante b, 0,00158637 + 0,00143699 + 0,00026131 = 0,00328467.
- Achado de custo (mesmo padrão da G1 e da A3): a soma bruta de E1 contava o acumulado de cada retomada.

### Teste de budget em retomada (correção 2)

- Sessão de teste: E1/budget-resume (run-budget-resume.sh). Criação e cinco retomadas curtas, todas com exit 0 e subtype success. Acumulado após a quinta: 0,00335368.
- Retomada com teto: `claude -p ... --max-budget-usd 0.001 --output-format json --resume <uuid> "Responda somente com: BUDGET-TEST"`.
- Resultado literal: subtype success, is_error false, total_cost_usd 0,00360284, result "BUDGET-TEST", exit 0. Stderr vazio.
- Interpretação: o teto de 0,001 é menor que o acumulado da sessão (0,00335368), e a retomada rodou normalmente. O teto vale por execução. O custo da própria chamada foi 0,00360284 − 0,00335368 = 0,00024916, abaixo do teto.
- Teste de valor inválido: `--max-budget-usd 0.000000` foi recusado antes da chamada. Exit 1, stdout vazio. Stderr literal: `error: option '--max-budget-usd <amount>' argument '0.000000' is invalid. --max-budget-usd must be a positive number greater than 0`. Arquivos em E1/budget-resume/budget-test-cap-zero-invalid.*. Esse primeiro cálculo de teto saiu de um erro de script (expansão de caminho), e foi refeito com 0,001.
- Limite: o caminho de falha por teto não foi observado, porque nenhuma chamada passou do teto. Testar teto abaixo do custo de uma chamada única ficou fora desta rodada.
- Classificação: testado.

## E2: encaminhar aprovação ao humano

- Versão: 2.1.316.
- Comandos reais (E2/run-e2.sh): negar, com `--mcp-config kit/mcp.json`; permitir, com `--mcp-config kit/mcp-allow.json`; ambos com `--permission-prompt-tool mcp__probe__probe_permission --max-budget-usd 0.50 --output-format json --session-id <uuid>`.
- Flag: aceita sem erro nos três cenários (stderr vazio, exit 0).
- Payload recebido pelo host (probe, evento permission-request), idêntico nos cenários:
  - `{"tool_name":"Write","input":{"file_path":"C:\\...\\e2-out.txt","content":"E2-WRITE"},"tool_use_id":"toolu_..."}`.
  - Metadados do tools/call: `progressToken` e `claudecode/toolUseId`.
- Negar. Resposta do host: `{"behavior":"deny","message":"F0 probe denied the request (test decision)."}`. Resultado: texto do modelo informando a negação, arquivo ausente, permission_denials com Write.
- Permitir, com updatedInput. Resposta do host: `{"behavior":"allow","updatedInput":{"file_path":"...","content":"E2-WRITE"}}`. Resultado: "E2-DONE", exit 0, arquivo com "E2-WRITE".
- Correção 6 — permitir sem updatedInput. Resposta do host: `{"behavior":"allow"}` (probe com PROBE_PERMISSION_OMIT_UPDATED=1, mcp-allow-noupdated.json). Resultado: subtype success, is_error false, result "E2-DONE", exit 0, sem permission_denials, arquivo criado com "E2-WRITE". Logo, updatedInput não é obrigatório no allow nesta versão, em -p. A afirmação anterior estava errada e foi removida.
- Formato de resposta: não consta no --help. Foi confirmado pelo comportamento, em texto JSON com behavior. Não testei outras formas de resposta.
- Limite: probe de teste, não política. Somente -p.
- Evidência: E2/evidence (negar e permitir) e E2/run-allow-noupdated/evidence (allow sem updatedInput). Probe: logs por PID em E2/evidence.
- Classificação: testado.
- Custo real: negar 0,0051583; permitir 0,00195075; permitir sem updatedInput 0,0019584. Total: 0,00906745.

## E3: limite de background em -p (teto de 10 minutos)

- Versão: 2.1.316.
- Comandos reais (E3/run-e3.sh, cwd E3):
  - Turno 1: `claude -p ... --allowedTools "Bash(node:*)" --session-id <uuid> "Use a ferramenta Bash com run_in_background igual a true para executar: node heartbeat.mjs 300 ..."`.
  - Turno 2: `claude -p ... --resume <uuid> "Use a ferramenta de subagente (Agent) para criar um subagente que execute, em primeiro plano e sem background, o comando: node heartbeat.mjs 90 ..."`.
- Linha do tempo (UTC): 05:59:30 início. 05:59:40 heartbeat em background iniciado. 05:59:41 resposta "BG-STARTED", fim do turno de texto. 06:04:40.590 heartbeat terminou (done, 300 s). 06:04:40.695 notificação de tarefa concluída entrou como novo turno. 06:04:42.920 resposta "O processo em segundo plano `node heartbeat.mjs 300` terminou com código de saída 0.". 06:04:43 processo claude -p encerrou, exit 0.
- Interpretação do turno 1: o claude -p não saiu quando o texto terminou (05:59:41). Ficou vivo até o processo em background terminar, cerca de 5 minutos depois. O duration_ms do JSON (2246 ms) cobre só o trecho de modelo.
- Turno 2: subagente rodou o heartbeat de 90 s em primeiro plano, de 06:06:58 a 06:08:28. "SUB-DONE" às 06:08:33. Exit 0, duration_ms 105051, num_turns 2.
- Sobras: nenhum heartbeat vivo ao final.
- Limite: sem corte em 300 s. Background mais longo que 5 minutos não foi testado, por causa do teto de 10 minutos. Execução total: 9 min 04 s.
- Evidência: E3/evidence/e3-session.jsonl, E3/heartbeat-*.log, E3/monitor.txt, E3/timeline.txt.
- Classificação: testado com limite.
- Custo real: turno 1 US$ 0,00237811; turno 2 0,00339793 (delta de 0,00577604 − 0,00237811). Total: 0,00577604.

## G1: custo, par pequeno e espera de 65 minutos

- Versão: 2.1.316.
- Comandos reais (G1/run-g1.sh e G1/run-g1-65min.sh, cwd G1/dir e G1/dir-65min, flags -p com kit/mcp.json):
  - Par pequeno: criação "Responda somente com: G1-CREATE"; quente "Responda somente com: G1-HOT", iniciada 35 ms depois do fim da criação; fria "Responda somente com: G1-COLD", iniciada 360,1 s depois do fim da quente.
  - Espera de 65 minutos: nova sessão, criação "Responda somente com: G1-65-CREATE", depois `sleep 3900` em background e retomada "Responda somente com: G1-65-RESUME", iniciada 65 min 0,33 s depois do fim da criação.

### Tabela por chamada (delta de custo; usage do JSON)

| Chamada | Início | Custo reportado (acumulado) | Custo da chamada (delta) | Input | Cache lido | Cache gravado (1 h) | Output | duration_api_ms (acumulado) | API da chamada (delta) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Criação | — | 0,00158647 | 0,00158647 | 2 | 14517 | 7183 | 9 | 1592 | 1592 |
| Quente | 35 ms após criação | 0,00261093 | 0,00102446 | 2 | 17546 | 4224 | 8 | 3081 | 1489 |
| Fria | 360,1 s após quente | 0,00285556 | 0,00024463 | 2 | 21723 | 116 | 8 | 4624 | 1543 |
| Criação (65 min) | — | 0,00158967 | 0,00158967 | 2 | 14517 | 7194 | 11 | 926 | 926 |
| Retomada (65 min) | 65 min 0,33 s após criação | 0,00319434 | 0,00160467 | 2 | 14517 | 7269 | 11 | 1958 | 1032 |

- Cache de 5 minutos gravado: zero em todas as chamadas. Toda gravação foi no balde de 1 hora.
- Cache de 6 minutos: a leitura de 21723 tokens inclui o bloco de 7183 tokens gravado na criação (14517 + 7183 = 21700, com 23 tokens a mais). Então o bloco da própria sessão foi relido aos 6 minutos.
- Cache de 65 minutos: a retomada leu 14517 tokens, o mesmo prefixo lido pela criação, e gravou 7269 tokens novos. O bloco de 7194 tokens que a própria sessão gravou na criação não foi relido.
- Contexto da leitura de 14517: chamadas recentes com as mesmas flags leram prefixo maior. O teste de budget leu 21946 tokens e o teste de marcador leu 22032, ambos na última hora, antes da retomada. Isso indica que o prefixo compartilhado foi mantido vivo por chamadas recentes, e não pelo bloco da própria sessão.

### Declaração do TTL (correção 7)

- Regra combinada: se a retomada aos 65 minutos não tiver leitura de cache, o TTL observado fica entre 6 e 65 minutos. Se tiver, excede 65.
- A retomada teve leitura de cache, de 14517 tokens. A regra literal diria "excede 65". Mas essa leitura é do prefixo compartilhado, e o bloco da própria sessão não foi relido.
- Declaração adotada: TTL observado do conteúdo da própria sessão, entre 6 e 65 minutos (relido aos 6 minutos, não relido aos 65). A leitura aos 65 minutos é de prefixo compartilhado mantido por outras chamadas. Esta é uma interpretação, e não a regra literal. Pendente de decisão sua se a regra literal deve prevalecer.
- Limite: o TTL de 1 hora é compatível com a observação, mas não foi provado. O teste não isolou o prefixo compartilhado.

### Achado de custo

- Em retomada, total_cost_usd é o acumulado da sessão (ver seção Custo). O custo da chamada é o delta.
- Na espera de 65 minutos, o custo da retomada (0,00160467) é alto porque grava 7269 tokens novos no balde de 1 hora. Nas chamadas quentes e frias do par pequeno, a gravação era menor.

- Evidência: G1/cost-series-65min.txt, G1/dir-65min/evidence/g1-65-session.jsonl, G1/timing.txt, G1/timing-65min.txt.
- Classificação: testado com limite.
- Custo real do par pequeno: 0,00285556. Custo real da cadeia de 65 minutos: 0,00319434. Total G1: 0,0060499.
- Sessão grande (~100 mil tokens): executada depois, com 2.1.317. Ver "G1, sessão grande".

## G1, sessão grande (Claude Code 2.1.317)

- Versão: Claude Code 2.1.317, declarada. O par pequeno desta seção anterior foi medido com 2.1.316. A diferença de versão é limite da comparação.
- Flags: --model claude-haiku-5-5, --setting-sources "", --strict-mcp-config, --mcp-config=kit/mcp.json (mesmo MCP do par pequeno; a forma com = evita que a flag variádica consuma a instrução), --output-format json, --max-budget-usd 0.50, --session-id fixo, cwd G1L. O seed entra por stdin; as chamadas de retomada usam a instrução como último argumento.
- Checagem do stdin (antes do seed): um pré-teste de 40.146 bytes com a sentinela `FIM-DO-TEXTO-PRECHECK-G1L` no fim respondeu exatamente a sentinela. O stdin chega inteiro até a cauda.

### Seed determinístico e desvio de calibração

- Gerador: G1L/make-seed.mjs. PRNG mulberry32 com semente 20261103. Vocabulário fixo de 200 entradas, linhas numeradas, sem aleatoriedade fora da semente.
- Seed usado: 151.010 bytes, sha256 `eca0c1afde9a4c252837c00acca147478410e7085ed2afdcbb8257e16e80911c` (G1L/evidence/seed-sha256.txt).
- Desvio: o protocolo previa 380 a 420 KB para cerca de 100 mil tokens. Pelo pré-teste (1,77 bytes por token), 380 a 420 KB daria cerca de 226 mil tokens. Calibrei para 151 KB com essa razão. A razão real do seed foi de 2,32 bytes por token (151.010 bytes para 65.107 tokens de conteúdo). O motivo da diferença entre as duas razões não foi determinado. Por isso o total de input ficou cerca de 20% abaixo do alvo de 100 mil.
- O seed de 400 KB foi gerado para calibração e não foi usado: G1L/evidence/seed-400k-calibration-not-used.txt.

### Tabela por chamada (sessão 78fcf865, exceto o pré-teste)

Todas as gravações de cache foram no balde de 1 hora. Gravação de 5 minutos: zero em todas.

| Chamada | Início | Input | Cache criado (1 h) | Cache lido | Output | Input total (soma) | Custo da chamada (delta) | duration_ms | duration_api_ms (acumulado) | API da chamada (delta) | Wall (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pré-teste (sessão 7170b142, separada) | — | 2 | 22.655 | 14.519 | 101 | 37.176 | 0,00472689 | 1.729 | 1.621 | 1.621 | — |
| Seed (`G1L-SEED`) | — | 2 | 65.105 | 14.517 | 9 | 79.624 | 0,01317087 | 2.519 | 2.429 | 2.429 | 4.452 |
| Quente (`G1L-WARM`) | até 1 s após o seed | 2 | 4.221 | 75.472 | 9 | 79.695 | 0,00160362 | 3.212 | 5.548 | 3.119 | 7.680 |
| 6 min (`G1L-6M`) | 360 s após a quente | 2 | 117 | 79.646 | 8 | 79.765 | 0,00082406 | 3.347 | 8.798 | 3.250 | 4.927 |
| 65 min (`G1L-65M`) | 3.900 s após a 6 min | 2 | 65.315 | 14.517 | 8 | 79.834 | 0,01321237 | 3.805 | 12.471 | 3.673 | 5.412 |

- duration_api_ms é acumulado em retomada, como total_cost_usd. O campo totalAPIDuration do cost-state cresce 2.429, 5.548, 8.798 e 12.471 (G1L/evidence/cost-state-main-session.txt). A latência de API por chamada é o delta, na coluna "API da chamada (delta)". O duration_ms do JSON é o valor reportado por chamada e não foi usado para comparar a latência de API. Na 6 min, duration_api_ms acumulado (8.798) supera o wall do processo (4.927), o que confirma que não é por chamada.
- Os deltas batem com o cost-state de cada sessão (G1L/evidence/cost-state-main-session.txt): 0,01317087; 0,01477449 (acumulado da quente); 0,01559855 (acumulado da 6 min); 0,02881092 (acumulado da 65 min).
- Teto: a soma da sessão grande é 0,02881092. Com o pré-teste, o total da G1L é 0,03353781, abaixo de US$ 0,50. O portão de US$ 0,30 foi aplicado antes da medição de 65 min: acumulado de 0,01559855, portanto ok.
- O input total das quatro chamadas da sessão grande ficou entre 79.624 e 79.834 tokens, perto da soma esperada no protocolo (cerca de 100 mil). A diferença de cerca de 20% é o desvio de calibração descrito acima.

### Comparação com o par pequeno (2.1.316)

| Medida | Par pequeno (2.1.316) | Sessão grande (2.1.317) |
| --- | --- | --- |
| Quente: cache lido / delta | 17.546 / 0,00102446 | 75.472 / 0,00160362 |
| Quente: API da chamada (delta) | 1.489 ms | 3.119 ms |
| 6 min: cache lido / delta | 21.723 / 0,00024463 | 79.646 / 0,00082406 |
| 6 min: API da chamada (delta) | 1.543 ms | 3.250 ms |
| 65 min: cache lido / criado / delta | 14.517 / 7.269 / 0,00160467 | 14.517 / 65.315 / 0,01321237 |
| 65 min: API da chamada (delta) | 1.032 ms | 3.673 ms |

- Latência de API por chamada (delta): a sessão grande ficou entre 3,1 e 3,7 s (3.119, 3.250 e 3.673 ms), contra 1,0 a 1,5 s no par pequeno (1.489, 1.543 e 1.032 ms), cerca de 2 a 3,5 vezes. A diferença de versão (2.1.316 contra 2.1.317) segue como limite desta comparação.
- Custo por token regravado, derivado dos valores reportados pelo CLI: cerca de 2,0 × 10⁻⁷ US$ por token nas gravações de 1 hora, tanto na sessão grande (0,01321237 / 65.315) quanto na retomada aos 65 min do par pequeno (0,00160467 / 7.269, cerca de 2,2 × 10⁻⁷). Leitura de cache da sessão grande aos 6 min: cerca de 1,0 × 10⁻⁸ US$ por token.

### Custo estimado de um despertar frio com 100 mil tokens de conteúdo

- Despertar frio (conteúdo regravado no balde de 1 hora): cerca de US$ 0,020 por 100 mil tokens de conteúdo, derivado de 0,01321237 / 65.315 tokens.
- Despertar quente (conteúdo lido do cache): cerca de US$ 0,001 por 100 mil tokens, derivado de 1,0 × 10⁻⁸ por token lido.
- Os valores são derivados dos números que o CLI reportou. Não consultei tabela de preço publicada do Haiku 5.5, e os valores não foram validados contra ela.

### Leitura do TTL nesta escala

- Aos 6 minutos o conteúdo foi relido: cache lido de 79.646 de 79.765 tokens de input total, e só 117 tokens regravados. O TTL do conteúdo é maior que 6 minutos.
- Aos 65 minutos o conteúdo não foi relido: o cache lido foi de 14.517 tokens, só o prefixo compartilhado. Os 65.315 tokens do conteúdo foram regravados no balde de 1 hora.
- Declaração: conteúdo da sessão: TTL entre 6 e 65 minutos. Mesma declaração da G1 pequena. A leitura de 14.517 tokens aos 65 minutos é o prefixo, e a regra literal da correção 7 não se aplica ao conteúdo. A decisão do principal sobre a regra literal segue pendente.
- Limite: o balde de 1 hora é compatível com a observação (a última leitura foi 65 minutos antes), mas não foi isolado. O teste não mede o TTL exato.

### Limites explícitos

- Os valores de tokens e custo são os reportados pelo CLI para o Haiku 5.5. Não há verificação independente contra tabela de preço.
- Versão 2.1.317 na sessão grande e 2.1.316 no par pequeno. A diferença é limite da comparação.
- Seed de 151 KB, e não 380 a 420 KB, por calibração com a razão medida no pré-teste. O input total ficou cerca de 20% abaixo de 100 mil.
- Uma execução por chamada, sem repetição.
- O pré-teste está em sessão própria e não entra no input total da sessão grande.

### Evidência e limpeza

- Evidência em G1L/evidence: seed-generation.json, seed-sha256.txt, calibration.json, precheck.json, seed.json, warm.json, 6m.json, 65m.json, *.timing, cost-state-main-session.txt, cost-state-precheck-session.txt e transcripts/ (dois transcripts, copiados antes da limpeza).
- Pasta de projeto G1L em ~/.claude/projects removida pelo caminho literal. Nenhuma pasta marc-f0 restante. Nenhum processo vivo com marc-f0. Nenhum agente de marc-f0.
- Classificação: testado com limite.

## Gasto real corrigido por célula (delta por chamada)

| Célula | Chamadas com custo | Custo real (US$) | Observação |
| --- | --- | --- | --- |
| A3 | 20 | 0,01943535 | 5 repetições de 0,00388707. Pelo modelo base + ramos + terceira. |
| A4 | 1 | 0,00222277 | Sessão busy. As chamadas --bg não têm turno nem custo reportado. |
| B4 | 0 | 0,00000000 | Cliente SDK sem modelo. |
| B5 | 2 | 0,00379370 | Duas sessões de uma chamada. |
| C2 | 6 | 0,00615372 | Primeira rodada 0,00295935 mais repetição com marcador 0,00319437. |
| D1 | 3 | 0,00511560 | Acumulado do processo. |
| E1 | 12 | 0,01030784 | Variantes a e b (0,00670500) mais teste de budget (0,00360284). |
| E2 | 3 | 0,00906745 | Negar, permitir e permitir sem updatedInput. |
| E3 | 2 | 0,00577604 | Turno 1 e turno 2. |
| G1 | 5 | 0,00604990 | Par pequeno (0,00285556) mais espera de 65 min (0,00319434). |
| Total | 54 | 0,06792237 | Teto de US$ 5 não atingido. |

- Ledger: marc-f0/gasto.jsonl (corrigido, 58 linhas com delta_usd e cumulative_real_usd). Valores crus: marc-f0/gasto-bruto.jsonl, com o campo predecessor. Backup anterior à correção: marc-f0/gasto-legacy-backup-before-correction.jsonl.
- O total anterior de US$ 0,110168 e a soma ingênua de US$ 0,141561 estavam errados.

## Desvios do brief

1. A probe_wait foi acrescentada ao probe (A4 e E3). A opção PROBE_PERMISSION_OMIT_UPDATED foi acrescentada na correção 6.
2. A3 teve duas repetições extras com ordem invertida, para separar ordem de lançamento de ramo.
3. A4: `claude agents` sem --json não funciona fora de TTY. Usei --json.
4. C2: as execuções da primeira rodada foram sem `</dev/null`, com aviso de stdin no stderr.
5. E2: os scripts foram escritos depois da execução, reproduzindo os mesmos comandos.
6. D1: a pergunta explícita pós-despertar não foi enviada.
7. Chamadas --bg não recebem --max-budget-usd.
8. B4: a primeira rodada herdou a variável de sessão e foi mantida à parte.
9. Teste de budget: a primeira tentativa usou teto 0,000000, por erro de script, e foi recusada pelo CLI. Refeita com 0,001.

## Sobras e limpeza

- Processos: nenhum processo vivo com caminho marc-f0 ao final da rodada.
- Agentes de background: 454c502d e a3a8e92d foram encerrados e removidos com claude stop e claude rm, exit 0. Na listagem final não aparecem entradas de marc-f0.
- Pastas de sessão em ~/.claude/projects: removidas as pastas de marc-f0 criadas nas duas rodadas, depois de copiar os transcripts para a evidência de cada célula. Nesta rodada, removidas: C2-secret-dir-a, C2-secret-dir-b, E1-budget-resume, E2-run-allow-noupdated e G1-dir-65min. Antes, na primeira rodada, removidas 17 pastas. Nenhuma pasta marc-f0 restante.
- ~/.claude.json: sem menção a marc-f0.
- claude purge: não usado.
- Mantidos: marc-f0/kit, marc-f0/probe-logs, a pasta evidence de cada célula, gasto-bruto.jsonl, gasto.jsonl e os scripts de cada célula.
- Não tocados: a sessão interativa desta execução e a sessão de background de outro contexto, que aparece na listagem da A4.

## Pendências

- TTL da G1: decidir se a leitura de 14517 tokens aos 65 minutos deve prevalecer como "excede 65" pela regra literal, ou se vale a interpretação de prefixo compartilhado adotada aqui.
- Sessão grande da G1: executada (ver "G1, sessão grande"). Input total de cerca de 80 mil tokens, 20% abaixo do alvo por calibração; TTL do conteúdo declarado entre 6 e 65 minutos.
- Células interativas: ficam no roteiro humano.
