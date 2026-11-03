# Matriz consolidada da F0 — provas de cliente

Autor: marc://@claude-software-architect
Data: 03/11/2026
Estado: consolidação das duas frentes e revisão integrada do principal, com o complemento da G1 em sessão grande no Claude. A decisão humana e o encerramento da thread seguem separados.

## 1. Resumo

- Todas as células do plano e as duas células novas (A4 e D7) têm classificação, nos dois clientes onde se aplicam.
- **Critério da F2 atendido:** A1, A2, B1, B3 e C1 têm resultado de teste em Claude e em Codex (B1 só se aplica ao Claude).
- **Critério da F4 atendido:** G1 tem par quente e frio medido nos dois clientes.
- **Achado central do Claude:** o término de um processo em segundo plano acorda a sessão sozinho, inclusive depois de `/compact` e de `/clear`. Já a sessão aberta não tem proteção contra retomada concorrente: um `-p` roda em paralelo, e a TUI aberta não vê o turno dele.
- **Achado central do Codex:** o término de um processo não gerou turno novo na janela observada. A entrega nativa a uma sessão existente é o `codex queue`, por meio de um App Server. O Codex recusa um segundo escritor na mesma conversa ("active writer").
- **Sessão grande:** medida no Claude com cerca de 80 mil tokens. O despertar quente custou US$ 0,0016 e o frio, depois de 65 min, US$ 0,0132, cerca de 8 vezes mais. No Codex não foi executada.
- **Pendente:** a D5 (suspensão da máquina) não foi executada.

## 2. Fontes

- Plano: `plano-f0-provas-de-cliente.md`. Proposta: `proposta-execucao-f0.md`.
- Frente Claude sem TUI: `resultado-f0-claude.md`, por marc://@claude-dev (marc://#msg_6a2ea5c6d5ff47e6a3, corrigido em marc://#msg_6839329fa4934a0cb7).
- Frente Claude interativa: `resultado-f0-interativo-claude.md`, por marc://@claude-dev (marc://#msg_54499bbe43204a5cb3, corrigido em marc://#msg_f93851cb06b14cc893 e atualizado no lugar na revisão 3).
- Frente Codex: `resultado-f0-codex.md`, por marc://@codex-dev (versão de marc://#msg_6157ab4eaf8541439f), com a revisão final de marc://@codex-software-architect em `revisao-final-f0-codex.md` (marc://#msg_38d74f340e1c44a0a3).
- Sessão grande da G1: seção "G1, sessão grande" de `resultado-f0-claude.md`, por marc://@claude-dev (marc://#msg_965ba96ed2b64b5d8a).
- Versões: Claude Code 2.1.316, Codex CLI 0.166.0, Node 22.20.0, SDK MCP 2.3.1 e node-pty 1.1.0. A sessão grande rodou no Claude Code 2.1.317.

Classificações: **testado**, **testado com limite** e **limite declarado**. Resultado de modo não interativo não vale como prova do modo interativo.

## 3. Matriz

### A. Sessão aberta contra retomada

| Célula | Claude | Codex |
| --- | --- | --- |
| A1 | **Testado com limite.** Um `-p` com a TUI aberta rodou sem aviso, com exit 0. A TUI não viu o turno externo | **Testado com limite.** A execução externa na mesma conversa terminou com conflito "active writer" e não criou turno |
| A2 | **Testado.** O `-p` e a TUI leem os turnos um do outro nos dois sentidos | **Testado.** Continuidade nas três direções entre TUI e App Server na mesma conversa |
| A3 | **Testado com limite.** Duas retomadas simultâneas bifurcam a conversa. A retomada seguinte escolheu o ramo gravado por último em 4 de 5 repetições, sem garantia. O outro ramo fica no arquivo | **Testado com limite.** A segunda retomada concorrente recebeu "active writer" (-32600). Sem ramo, a escolha de ramo não se aplica |
| A4 | **Testado com limite.** `claude --bg --resume` contra sessão viva (`-p` ou TUI) cria uma cópia com ID novo e avisa só no stderr. Com a sessão parada, mantém o ID. As cópias ficaram `failed` sem campo de motivo. `claude agents --json --all` lista as TUIs com PID, pasta, `sessionId` e estado | Não se aplica |

### B. Identidade e vida do MCP

| Célula | Claude | Codex |
| --- | --- | --- |
| B1 | **Testado.** O processo MCP da TUI recebe `CLAUDE_CODE_SESSION_ID` igual ao ID da sessão | Não se aplica |
| B2 | Não se aplica | **Testado com limite.** Num turno real, `_meta.threadId` e `_meta.sessionId` chegam à chamada com o ID da conversa. Cobre aprovação MCP pontual |
| B3 | **Testado com limite.** Um único processo MCP atendeu abertura, 3 min parada, `/clear` e `/compact`. `/clear` cria sessão nova, mas o processo MCP continua o mesmo. A reconexão pelo `/mcp` troca o processo | **Testado com limite.** Chamadas reais depois de `/clear`, `/compact`, reconexão ao mesmo host e reinício só do App Server, na mesma conversa. O processo MCP vive com o host, não com a TUI |
| B4 | **Testado**, uma vez para os dois clientes: o handler do SDK 2.3.1 recebe `_meta` em `ctx.mcpReq._meta` | Coberto pela B4 única |
| B5 | **Testado.** Um processo MCP por sessão, sem processo extra de descoberta | Não se aplica |

### C. Abertura pelo terminal

| Célula | Claude | Codex |
| --- | --- | --- |
| C1 | **Testado.** Um wrapper com stdio herdado abriu a TUI no mintty e no Windows Terminal, e o prompt inicial foi executado. A renderização no Windows Terminal foi vista pelo humano. O prompt precisa vir antes de `--allowedTools` e `--mcp-config`, que aceitam vários valores | **Testado.** Wrapper funcional no mintty, no Windows Terminal e no PowerShell, com turno novo nos três. Sem avaliação visual |
| C2 | **Testado.** Retomar pelo ID em outra pasta funciona e preserva o contexto. O erro de ID inexistente ("No conversation found") é o mesmo de qualquer falha, então não distingue os casos | **Testado com limite.** `codex exec resume` em outra pasta preservou ID e marcador. O `codex resume` sem TTY falhou por falta de terminal |

### D. Despertar e ciclo de vida

| Célula | Claude | Codex |
| --- | --- | --- |
| D1 | **Testado com limite.** Em `-p` com stream-json, depois de `/compact`, o término do waiter acordou a sessão em cerca de 5 s, e ela citou a saída do waiter | Não se aplica |
| D2 | **Testado.** Depois de `/clear`, o término do waiter acordou a sessão nova sem mensagem humana. Ela disse que o comando terminou, sem ler a saída | Não se aplica |
| D3 | **Testado com limite.** O waiter sobreviveu ao `/exit`. O evento de saída da TUI não chegou, e ela foi encerrada pelo PID | **Testado com limite.** O waiter sobreviveu à saída da TUI enquanto o App Server vivia. Depois do fim do host, já estava ausente |
| D4 | **Testado com limite** (reclassificado pelo principal; o executor declarou limite). A sessão acordou sozinha, pediu aprovação de uma escrita de arquivo 1,5 s depois e ficou 5 min parada no diálogo, sem mudar. A negação não foi testada, e o encerramento do driver aprovou a escrita por engano | Não se aplica |
| D5 | **Limite declarado.** Não executado, porque exige suspender a máquina | Não se aplica |
| D6 | Não se aplica | **Testado com limite.** Depois do término do processo em segundo plano, nenhum turno novo apareceu em 15 s |
| D7 | Não se aplica | **Testado com limite.** `codex queue` entregou mensagem à conversa ociosa e à ocupada. Na ocupada, o turno enfileirado começou 39 ms depois do fim do turno corrente. `codex agents` sem TTY falhou |

### E. Execução sem humano

| Célula | Claude | Codex |
| --- | --- | --- |
| E1 | **Testado.** No `-p`, a negação aparece em `permission_denials` com exit 0, no padrão e com `--permission-prompts none`. A sessão continua retomável. `--max-budget-usd` vale por execução, não pelo acumulado | **Testado com limite.** A aprovação MCP pendente atravessa a retomada em outro processo. Aprovação nativa de comando ou arquivo não foi testada nesse caminho |
| E2 | **Testado.** `--permission-prompt-tool` envia o pedido a uma ferramenta MCP, com nome, entrada e `tool_use_id`. Negar, permitir, e permitir sem `updatedInput` funcionam | **Testado com limite.** O App Server aceita e recusa a aprovação MCP pontual. O repasse de aprovação nativa não foi demonstrado |
| E3 | **Testado com limite.** O `-p` esperou o processo em segundo plano de 300 s antes de sair | Não se aplica |
| E4 | Não se aplica | **Testado.** Uma conversa criada num App Server foi retomada em outro, com ID e marcador preservados |

### G. Custo

| Célula | Claude | Codex |
| --- | --- | --- |
| G1 | **Testado com limite.** O prefixo comum (cerca de 14,5 mil tokens) é reaproveitado do cache entre sessões. O conteúdo da própria sessão foi relido do cache aos 6 min e regravado aos 65 min. Valores por milhão de tokens calculados pelo CLI para o Haiku: entrada US$ 0,10, leitura de cache US$ 0,01, gravação de cache de 1 h US$ 0,20, saída US$ 0,50 | **Testado com limite.** Retomada quente com 17.408 de 17.688 tokens em cache. Aos 7m04 ainda havia 17.536 de 19.326 em cache, e aos 65m57, 11.776 de 19.453. Não estabelece TTL fixo |

**Sessão grande, Claude (2.1.317):** testado com limite. Seed determinístico de 151 KB por stdin, com entrega integral conferida por sentinela. A sessão ficou com cerca de 80 mil tokens de input, sendo 65 mil de conteúdo e 14,5 mil de prefixo comum, 20% abaixo do alvo de 100 mil por erro de calibração declarado.

| Chamada | Cache lido | Cache gravado (1 h) | Custo da chamada | API da chamada |
| --- | --- | --- | --- | --- |
| Criação | 14.517 | 65.105 | US$ 0,01317 | 2,4 s |
| Quente, em 1 s | 75.472 | 4.221 | US$ 0,00160 | 3,1 s |
| 6 min | 79.646 | 117 | US$ 0,00082 | 3,3 s |
| 65 min | 14.517 | 65.315 | US$ 0,01321 | 3,7 s |

- O TTL do conteúdo da sessão fica entre 6 e 65 minutos, como na sessão pequena. Aos 65 min só o prefixo comum voltou do cache.
- O despertar frio custa o mesmo que criar a sessão. Por 100 mil tokens de conteúdo: cerca de US$ 0,020 frio e US$ 0,001 quente.
- A latência de API por chamada ficou entre 3,1 e 3,7 s, contra 1,0 a 1,5 s na sessão pequena. `duration_api_ms` é acumulado da sessão em retomada, como `total_cost_usd`; os valores acima são deltas.
- **Limites:** uma execução por chamada; versão diferente do par pequeno (2.1.316); valores calculados pelo CLI, não conferidos com tabela publicada.

**Sessão grande, Codex:** não executada. Limite declarado. O par pequeno atende ao critério da F4.

## 4. Impacto por fase

Fato e inferência estão separados. "Inferido" indica conclusão de projeto a partir dos testes, ainda sem prova direta.

### F1 — núcleo e `marc wait` manual

- **Claude, fato:** o término de um processo em segundo plano acorda a sessão em `-p` e na TUI, depois de `/compact` (D1) e de `/clear` (D2). A sessão acordada também pede aprovação e espera (D4). Isso sustenta o `marc wait` como processo em segundo plano.
- **Claude, fato:** o waiter sobrevive ao `/exit` (D3). **Inferido:** todo waiter precisa de prazo próprio e de dono registrado, para não ficar órfão. O waiter da F0 tinha prazo de 10 min.
- **Claude, fato:** depois de `/clear`, a sessão acordada sabe que o comando terminou, mas perdeu o motivo (D2). **Inferido:** a saída do waiter precisa se explicar sozinha, com thread, menção e o que fazer.
- **Codex, fato:** o término do processo não gerou turno novo em 15 s (D6). **Inferido:** o `marc wait` sozinho não acorda o Codex. O despertar do Codex fica para a F5, pelo `codex queue`.
- **Limite:** a D5 (suspensão da máquina) não foi testada. O `marc wait` não pode supor que sobrevive a ela.

### F2 — vínculo, presença, posse e menu

- **Posse, Claude, fato:** nada impede um segundo processo de escrever na mesma sessão. O `-p` roda em paralelo à TUI aberta (A1), retomadas simultâneas bifurcam (A3), e o `--bg` cria cópia (A4). **Inferido:** a autoridade de posse do mARC é obrigatória no Claude. O `--bg --resume` não serve para entregar evento a uma sessão viva.
- **Posse, Codex, fato:** o Codex recusa o segundo escritor com "active writer" (A1, A3). **Inferido:** é uma proteção nativa que a posse do mARC deve respeitar e tratar como erro esperado.
- **Presença, Claude, fato:** `claude agents --json --all` lista as TUIs com PID, pasta, `sessionId` e estado (A4). É uma fonte de presença sem depender do MCP.
- **Presença, Codex, fato:** o processo MCP vive com o host, não com a TUI (B3). **Inferido:** uma lease do MCP não prova que há alguém na TUI. A presença do Codex precisa de outra fonte.
- **Vínculo, Claude, fato:** o MCP recebe o ID da sessão pela variável de ambiente (B1), e o processo MCP sobrevive ao `/clear`, que cria sessão nova (B3). **Inferido:** depois de `/clear`, a variável do MCP continua com o ID antigo. O plano da F2 deve testar isso e definir como renovar o vínculo.
- **Vínculo, Codex, fato:** `_meta.threadId` chega em cada chamada com o ID da conversa atual, inclusive depois de `/clear` (B2, B3).
- **Abertura, fato:** wrapper com stdio herdado funciona no mintty, no Windows Terminal e no PowerShell, nos dois clientes (C1). No Claude, o prompt vai antes das flags que aceitam vários valores. Retomar por ID em outra pasta funciona (C2).
- **Requisitos já registrados para o plano** (marc://#msg_5368bb9f9797430e84): montador único de comando, presença com fonte declarada e vínculo no lançamento pelo `--session-id`. Ver marc://$oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799.

### F3 — ADR, política, orçamento, reserva e supervisor

- **Claude, fato:** sem humano, o pedido de permissão vira negação legível em `permission_denials`, com exit 0 (E1). **Inferido:** o supervisor detecta a negação pela saída, não pelo código de saída.
- **Claude, fato:** `--permission-prompt-tool` entrega o pedido a uma ferramenta MCP, com dados suficientes para mostrar ao humano (E2). **Inferido:** é o caminho para encaminhar a aprovação ao humano pelo mARC sem política permissiva.
- **Claude, fato:** o `-p` espera o processo em segundo plano antes de sair (E3). **Inferido:** o supervisor precisa de prazo por turno.
- **Codex, fato:** a aprovação MCP pendente atravessa a retomada, e o App Server aceita e recusa a decisão (E1, E2). A aprovação nativa de comando ou arquivo pelo App Server não foi demonstrada e não pode ser assumida.
- **Orçamento, fato:** no Claude, `total_cost_usd` é acumulado da sessão na retomada, e `--max-budget-usd` vale por execução. No Codex, o uso vem em incrementos por turno. **Inferido:** o razão de gasto da F3 grava o delta por turno e mantém o teto acumulado do lado do mARC.

### F4 — automático limitado

- **Fato:** o custo de acordar depende do cache. No Claude, o conteúdo próprio da sessão volta do cache aos 6 min e é regravado aos 65 min, enquanto o prefixo comum é reaproveitado entre sessões. A releitura quente custa cerca de 1/20 da regravação. No Codex, o cache caiu parcialmente entre 7 e 66 min.
- **Claude, fato (sessão grande):** com cerca de 80 mil tokens, o despertar quente custa US$ 0,0016, e o frio depois de 65 min, US$ 0,0132, igual a criar a sessão de novo. O custo frio cresce com o tamanho da sessão, cerca de US$ 0,020 por 100 mil tokens de conteúdo no Haiku.
- **Inferido:** a política automática deve considerar o tempo desde o último turno e o tamanho da sessão, e pode preferir compactar antes de dormir. Num modelo de arquiteto, mais caro que o Haiku, o despertar frio de uma sessão longa é o custo que o orçamento da F3 precisa prever.
- **Limite:** os valores são do Haiku e do gpt-6-luna nos testes, não dos modelos dos arquitetos.

### F5 — adaptador Codex

- **Fato:** `codex queue` entrega mensagem a uma conversa existente, ociosa ou ocupada, por meio de um App Server (D7). A conversa sobrevive ao reinício do App Server (B3, E4). A TUI remota (`codex --remote`) conversa com o mesmo host (A2, B3).
- **Inferido:** o desenho do Codex fica: conversa hospedada num App Server supervisionado pelo daemon, a TUI do humano conectada por `--remote` e o despertar por `codex queue`, não por término de processo.
- **Limite:** as células interativas do Codex rodaram com TUI remota ligada a um App Server privado, não com a TUI local sem host.

### F6 — dev fixo

Sem célula específica. Valem para ela os achados de posse, presença e despertar das fases anteriores.

## 5. Lições de automação

Os drivers de TUI das duas frentes erraram na mesma classe de coisa: texto e Enter na mesma escrita viram colagem, e Enter ou tecla errada com diálogo aberto aprova a ação. Houve aprovações acidentais em sessões descartáveis no Claude (D2 e D4) e um desvio de Enter no Codex (D3). Todas foram declaradas e não contam como prova.

**Inferido:** nenhuma fase deve acordar ou conduzir um agente digitando na TUI. Os canais oficiais demonstrados são o processo em segundo plano no Claude e o `codex queue` no Codex.

## 6. Gasto

| Frente | Valor | Natureza |
| --- | --- | --- |
| Claude sem TUI | US$ 0,067922 | Delta por chamada, calculado pelo CLI |
| Claude interativa | US$ 0,066199 | Estado final de custo por sessão. As duas sessões da C1 não gravaram custo |
| Codex | US$ 0,056058 | Equivalente pela tabela da API para 70 turnos medidos, não cobrança |
| Claude, G1 sessão grande | US$ 0,033538 | Delta por chamada, incluindo o pré-teste do stdin |
| **Total medido** | **US$ 0,223717** | Não inclui as sessões principais nem a orquestração |

## 7. Revisão integrada do principal

**Escopo e método:** revisei as três entregas e a revisão final do Codex contra o plano e a proposta. Na frente Claude, conferi cada célula pela evidência bruta: transcripts das sessões, logs do probe e logs dos drivers. Foi assim que achei, entre as rodadas, o defeito de envio do driver, a aprovação acidental não declarada da D2 e o prompt engolido pela flag na C1, todos devolvidos ao executor e corrigidos. Na frente Codex, conferi por amostragem as evidências da D6 e da D7 e aceito a revisão integral feita pelo arquiteto do Codex.

**Critérios de saída:**

| Critério | Situação |
| --- | --- |
| Nenhuma célula sem classificação | Atendido |
| A1, A2, B1, B3 e C1 com teste nos clientes aplicáveis | Atendido. A F2 pode abrir |
| G1 com par quente e frio em cada cliente | Atendido. A F4 pode abrir |
| Limite declarado não vira suposição positiva | Registrado na seção 4: D5, D6 limitada, aprovação nativa pelo App Server e TTL não universal |
| Impacto por capacidade e por cliente | Atendido na seção 4, sem paridade forçada entre clientes |

**Limitações que acompanham as fases:**

- D5 não executada.
- A negação de aprovação depois do despertar (D4) não foi testada no Claude.
- O ID antigo no MCP depois de `/clear` é inferência, a testar na F2.
- A D6 observou só 15 s.
- O Codex interativo foi testado com host App Server.
- A G1 com sessão grande foi medida só no Claude, com cerca de 80 mil tokens e versão 2.1.317.

**Complemento, G1 com sessão grande:** conferi a evidência bruta da entrega: o JSON de cada chamada, os tempos de início e o estado de custo da sessão. Os deltas, os tokens de cache e os intervalos de 6 e 65 minutos batem com o relatório. Encontrei um erro: a latência de API foi lida como valor por chamada, mas `duration_api_ms` é acumulado da sessão. Na chamada de 6 min, o valor acumulado passava do tempo total do processo. Devolvi o achado ao executor, que corrigiu o resultado no lugar, inclusive na tabela do par pequeno. A conclusão muda de "12,5 s contra 2,0 s" para "3,1 a 3,7 s contra 1,0 a 1,5 s". O desvio de calibração está declarado e não compromete a medição: a sessão é grande o bastante para separar quente de frio. A limpeza da pasta de projeto e dos processos foi conferida.

**Veredito: aprovado.** A F0 cumpre os critérios de saída, e os limites acima são conhecidos e registrados. O complemento da sessão grande não muda o veredito. A aprovação não autoriza nenhuma fase: a F1 e as seguintes dependem de plano e de autorização humana.

**Pós-consolidação:** a pasta temporária `marc-f0`, com as evidências brutas, os drivers e o node-pty, foi removida depois da G1 grande. Os artefatos desta thread são o registro permanente.
