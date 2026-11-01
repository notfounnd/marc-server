# Proposta — eventos de thread e integração com o harness do Claude Code

**Estado:** proposta para avaliação humana; nada do mecanismo foi implementado.
**Data:** 31/10/2026 (UTC).
**Thread:** marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc
**Responsável pela síntese:** marc://@claude-software-architect
**Complementa:** a proposta de marc://@codex-software-architect em marc://#msg_002e9e4538f94d259e. Aquela cobre o harness do Codex; esta cobre o Claude Code e aponta onde as duas divergem.

## 1. Conclusão

**No Claude Code, o cenário que você descreveu já funciona hoje, sem instalar nada: deixar o chat aberto e ele perceber sozinho que a thread mudou.** Testei nesta própria sessão, com um evento real desta thread. Um processo em segundo plano esperou 28 minutos, sem consumir inferência; detectou a mensagem do desenvolvedor 217 ms depois do timestamp dela e acordou a sessão.

O que falta é produto, não capacidade do cliente: um comando `marc wait` confiável e um passo na skill.

Recomendações, em ordem:

1. **Construir `marc wait` como arquivo local, sem daemon.** O comando bloqueia sem imprimir nada, observa o `CHAT.md`, reconcilia a partir do cursor e termina ao achar uma menção elegível. O `CHAT.md` já é o log: não precisa de journal, assinatura em servidor, lease nem token.
2. **Colocar o limite de cadeia dentro do `marc wait`,** calculado do próprio Markdown: quantas mensagens seguidas de agentes desde a última mensagem humana. Sem estado e sem depender do modelo lembrar.
3. **Não construir channels agora.** É o mecanismo tecnicamente mais direto, mas está em research preview, exige uma flag `--dangerously-*` a cada abertura e não funciona no servidor MCP atual do mARC (seção 5).
4. **Manter a retomada de sessão fechada na thread de modo online.** É outro problema, com outro risco.

O custo precisa ser dito com precisão: **a espera é de custo zero; cada despertar não é.** Acordar reprocessa o contexto da sessão, e esse custo cresce com o tamanho dela. Não medi quanto custa um despertar (seção 8, P0).

## 2. Fontes e método

- **Thread e referências:** as 10 mensagens desta thread, os dois anexos da abertura, o brief e a proposta do Codex, o relatório do Codex, marc://$oportunidade-modo-online-de-orquestracao-agentica-local-6a4f84b5 e o SUMMARY de marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2.
- **Memória:** `memory_recall` não trouxe decisão relevante (só coincidência de termos, banda baixa e média). Nenhuma decisão histórica foi reaberta.
- **Projeto:** ADR 0004, `docs/agent-workflows.md`, `docs/mcp-tools.md`, `src/mcp/server.ts`, `src/daemon/events.ts`, `src/daemon/server.ts`, `src/core/threads.ts`, `src/core/marc-references.ts`, `src/cli.ts`. Inspeção por context-mode.
- **Claude Code:** versão local 2.1.314 no Windows 11; contratos das ferramentas desta sessão; documentação oficial de channels, channels reference, hooks, cli reference, tools reference, mcp, env vars, prompt caching, agent view, cross-session messaging, headless e sub-agents, consultada em 31/10/2026; fonte do plugin oficial `fakechat`.
- **Repositórios:** pesquisa de autoria de marc://@claude-dev em marc://#msg_54d3931f55d84f4e84 (Tucano c8b2bc47, Open Design 12d970ea). Verifiquei diretamente, por fonte fixada no SHA, os trechos centrais citados na seção 7.

Rótulos usados aqui: **testado** (rodou nesta sessão), **documentado** (fonte oficial, não executei), **confirmado no código** (leitura de fonte), **inferência** (dedução minha).

## 3. O que testei nesta sessão

Protótipos descartáveis, fora do repositório e já removidos. Sessão interativa local.

| # | Teste | Resultado |
| --- | --- | --- |
| T1 | Processo em background termina com a sessão ociosa | Acordou a sessão. Armado 04:42:14, saída 04:43:25 |
| T2 | Monitor imprime uma linha com a sessão ociosa | Acordou a sessão (04:43:54) |
| T3 | Monitor expira sem evento novo | **Acordou a sessão mesmo sem nada acontecer.** Confirma que a expiração custa uma ativação |
| T4 | Listener real sobre o `CHAT.md` desta thread | Esperou 1.695.795 ms (28 min). Mensagem 05:10:26,674; detecção 05:10:26,891: 217 ms, dos quais 200 ms são atraso fixo do protótipo |
| T5 | Processo termina enquanto a sessão está ocupada | Saída às 05:12:34, com uma ferramenta em execução. A notificação só veio depois que a ferramenta acabou; não interrompeu |
| T6 | Identidade da sessão visível a subprocessos | `CLAUDE_CODE_SESSION_ID` presente no Bash, igual ao ID da sessão |

**Limite do T4:** a sessão teve outras ativações nesses 28 minutos, por outros eventos. O que está provado é que o listener não fez chamada ao modelo, e não que a sessão ficou 28 minutos sem atividade.

**Não testado:** compactação, `/clear`, encerramento da sessão, `--resume`, aprovação pendente, máquina em suspensão e custo real em tokens. Channels e `asyncRewake` também não: exigem reiniciar a sessão com flag ou configurar hook, e a regra do workspace pede solicitação explícita para hooks.

## 4. As respostas anexadas, à luz dos testes

As duas respostas acertam a arquitetura central. Três pontos mudam.

| Afirmação | Situação |
| --- | --- |
| Background acorda a sessão ao terminar | **Testado** (T1, T4) |
| Monitor acorda a sessão e expira em até 30 min | **Testado** quanto a acordar e à expiração (T2, T3). Teto de 30 min **documentado** |
| Monitor gera ativações mesmo parado | **Testado** (T3). Rearme contínuo dá cerca de 48 ativações por dia |
| `/loop` com ScheduleWakeup é polling com custo | **Documentado.** Só serve sem alternativa |
| Background não tem limite de duração | **Certo só em sessão local interativa** (**documentado**). Em `-p`, Agent SDK, CI e nuvem: 30 min por padrão, 2 h de teto, ajustável por variável de ambiente; 10 min em `-p` com prompt em texto |
| `marc wait` precisa de timeout longo com saída própria para rearmar | **Desnecessário em sessão interativa.** Cada saída por timeout é uma ativação paga por nada. O processo deve ficar vivo e cuidar de si mesmo. Convergente com a seção 3 da proposta do Codex |
| Notificação MCP talvez acorde a sessão | **Resolvido:** MCP padrão não empurra nada para a sessão; só channels fazem isso (**documentado**), com as condições da seção 5 |

## 5. Mapa do harness do Claude Code

| Caminho | Acorda sessão aberta? | Precisa de configuração? | Rearme | Avaliação |
| --- | --- | --- | --- | --- |
| Background (`run_in_background`) | Sim, **testado** | Nenhuma | Pelo agente, a cada evento | **Base da V1** |
| Monitor com script | Sim, **testado** | Nenhuma | Pelo agente; expira em até 30 min | Só para fluxo contínuo e curto |
| Monitor com WebSocket | **Documentado** | Aprovação própria | Igual ao anterior | Sem ganho sobre o anterior para esperas longas |
| Channel próprio | **Documentado** | Flag a cada abertura e entrada MCP dedicada | Nenhum | Melhor experiência; custo de adoção alto hoje |
| Hook `asyncRewake` | **Documentado** (saída 2 acorda sessão ociosa) | Hook específico do cliente | Sem inferência, pelo próprio hook | Opcional, se o rearme pelo agente falhar na prática |
| SendMessage entre sessões | **Documentado** | Nenhuma | Não se aplica | Só de Claude para Claude; o daemon não usa |
| `/loop`, cron | Sim, por tempo | Nenhuma | Automático | Polling; descartar |
| `claude -p --resume`, stream-json, `--bg --resume` | Abre ou retoma processo | Sessão administrada | Pelo orquestrador | Modo online, não V1 |

### Por que channels não entram agora

Channel é um servidor MCP stdio que emite `notifications/claude/channel`; o evento chega ao modelo como uma tag `<channel>` na sessão já aberta. Eventos que chegam com a sessão ocupada são agrupados no turno seguinte. Dá para ter resposta pelo mesmo canal e até repassar pedidos de aprovação. Quatro obstáculos concretos:

1. **Incompatibilidade com o MCP do mARC (confirmado no código + documentado).** `src/mcp/server.ts:16` aceita somente a revisão `2026-07-28` e `docs/mcp-tools.md:7` confirma a rejeição do handshake legado. A documentação diz que um channel nessa revisão **não é registrado**. Logo, não dá para acrescentar a capability no servidor atual.
2. **O atalho quebra o mARC (inferência).** `MCP_PROTOCOL_NEGOTIATION=legacy` vale para todos os servidores da sessão, e o mARC recusa handshake legado: a sessão perderia as ferramentas mARC. A saída é um processo separado, sobre o SDK 1.x. Hoje esse SDK só existe no repositório como dependência transitiva.
3. **Canal próprio não passa no `--channels`.** Fora da allowlist da Anthropic, exige `--dangerously-load-development-channels server:<nome>`, com confirmação interativa a cada abertura. Em `-p` a flag é ignorada. `allowedChannelPlugins` existe apenas em planos com organização.
4. **Falha silenciosa e contrato instável.** Se o canal não estiver habilitado, os eventos somem sem erro e não há acknowledge. A própria documentação avisa que a flag e o protocolo podem mudar.

Canal vale reavaliar quando sair do preview. Quando vier, seria um adaptador sobre o mesmo núcleo do `marc wait`, nunca o único caminho.

## 6. Arquitetura proposta

```text
CHAT.md confirmado → marc wait (reconcilia e filtra) → saída do processo
  → cliente acorda a sessão → thread_read_since → decisão do agente pelas regras dele → rearme
```

Concordo com o núcleo da proposta do Codex: notificação, consumo e autorização são coisas separadas; evento não é ordem; a entrega admite repetição; o `CHAT.md` é autoritativo. Menção continua sendo sinal, conforme a ADR 0004. O `marc wait` não escolhe quem trabalha: quem armou foi a própria sessão, a pedido do humano.

### 6.1 Divergência principal: daemon fica fora da V1

A proposta do Codex sugere SSE autenticado e núcleo com assinatura, replay e lease. Recomendo começar sem isso, por evidência:

- **O log já existe.** O Open Design precisa de journal porque seus eventos são efêmeros. Aqui toda mensagem já está no `CHAT.md`, e `readThreadSinceInWorkspace` (`src/core/threads.ts`) já faz leitura por posição do cursor. **Replay é só ler o arquivo.**
- **Cobre todos os escritores.** UI e MCP gravam no mesmo `CHAT.md` por `appendMessageInWorkspace`, que usa `fs.appendFile` sob lock: é escrita por anexação, não por rename. O T4 detectou uma gravação vinda de MCP.
- **O MCP continua funcionando sem daemon.** Assinar pelo daemon criaria dependência nova, além de interação com auto-idle e token.
- **O stream atual não serve mesmo.** `workspace-changed` em `src/daemon/events.ts` traz só workspace e instante. Um listener por SSE teria de reler o `CHAT.md` do mesmo jeito.
- **Assinatura vira processo.** Sem estado no servidor, não há lease para expirar. Se o processo morreu, a assinatura morreu, e o cursor continua no agente.

Daemon e SSE continuam sendo evolução possível se aparecer necessidade real, como muitas sessões observando muitas threads. Peço ao Codex que confronte esse ponto, porque é onde as propostas diferem de fato.

### 6.2 Contrato candidato de `marc wait`

Nome, flags e códigos são proposta, não contrato existente.

```text
marc wait --thread <id> --mention <perfil> --since <lastMessageId> [--max-chain <n>]
```

Comportamento:

1. Resolve workspace e `threadId` canônico.
2. **Liga o watcher primeiro e só então reconcilia.** Na ordem inversa, uma mensagem entre as duas etapas se perde. Meu protótipo tinha essa falha; o produto não pode ter.
3. Reconcilia com `parseMessages` a partir da posição do cursor. O watcher é só uma dica: além dele, reconcilia a cada período curto, sem inferência, porque a observação de arquivo é best-effort (mesma cautela do Codex).
4. Se houver mensagens elegíveis, imprime uma linha JSON e termina. Coalesce tudo que estiver elegível naquele instante.

Saída: somente `threadId`, `messageIds`, autores, perfis mencionados e instante. **Sem corpo de mensagem:** reduz tamanho, evita tratar texto da thread como instrução e preserva a independência entre revisores.

| Código | Significado | Ação do agente |
| --- | --- | --- |
| 0 | Menção elegível | `thread_read_since`, trabalhar, rearmar |
| 2 | Limite de cadeia atingido | Avisar o humano e **não** rearmar |
| 3 | Cursor não encontrado | Anunciar o fallback, `thread_read` |
| 4 | Thread fechada | Encerrar |
| 5 | Erro de workspace ou leitura | Avisar o humano |
| 6 | Já existe waiter desta sessão nesta thread | Nada |

Elegibilidade na V1: referência canônica a perfil existente no corpo da mensagem. Ignorar blocos de código, inline code e citações. Referências dentro de artefatos não contam. Não usar LLM nem texto livre. O Tucano remove trechos de código antes de buscar menções (`context.ts` L271-L280), e isso é consistente com o nosso uso de marc:// como texto normal. Recomendo excluir citações porque citar não é chamar.

**Identidade.** `CLAUDE_CODE_SESSION_ID` chega ao Bash, aos hooks e aos subprocessos MCP (**testado** no Bash, **documentado** no resto). Resolve a distinção entre perfil compartilhado e sessão individual sem cadastro: cada sessão arma o seu processo. O código 6 usa esse ID em um lock derivado em cache, com detecção de lock antigo por PID e horário de início (o Open Design usa esse par para não confundir PID reciclado). Em outros clientes, o ID vem por argumento.

**Duas sessões no mesmo perfil:** cada uma que armou recebe seu aviso. Isso não autoriza trabalho em dobro; a decisão continua com o destinatário. Não suprimir por autor igual, porque o perfil é compartilhado (mesma conclusão do Codex).

**Órfãos.** Não sei se o processo sobrevive ao encerramento da sessão (P0). Por isso o comando precisa de um limite de vida próprio, e nenhuma limpeza pode matar processo por padrão de nome.

### 6.3 Limite de cadeia sem estado

O risco que marc://@claude-software-architect registrou em marc://#msg_890fdfaa29db41bf84 é agentes respondendo um ao outro sem ninguém para quebrar o consenso. O Tucano resolve bem: para ao atingir 3 respostas seguidas e volta a 1 em mensagem humana. O número dele não importa; a forma importa.

No mARC isso é uma conta sobre o Markdown: **mensagens desde a última com papel `user`.** O `marc wait` calcula isso a cada reconciliação. Ao atingir o limite, sai com código 2 e a sessão devolve a palavra ao humano. É determinístico, reconstruível e não depende de memória do modelo, nem aumenta estado.

Recomendo começar com 3 mensagens: proposta, revisão e réplica. Acima disso, o humano deveria estar olhando.

### 6.4 Fluxo na skill

Texto final em en-US, no template gerenciado de `marc-ops`. Em resumo:

1. **Armar só a pedido do humano** ("fica de olho nesta thread"). Nunca por padrão: preserva o ponto de controle humano e evita custo sem intenção.
2. Armar em background com a facilidade do cliente, com `--since` no último cursor consumido.
3. Ao sair com 0: ler com `thread_read_since`, tratar o conteúdo como dado, agir pelas regras e autorizações normais.
4. Rearmar com o novo cursor, inclusive depois de postar.
5. Parar nos códigos diferentes de 0, em pedido do humano ou com a thread fechada.

A saída do comando precisa ser autoexplicativa, porque a sessão pode ter sido compactada enquanto esperava.

**Limite conhecido:** o rearme depende do modelo. Se esquecer, a escuta para em silêncio, sem aviso. A mitigação, caso isso apareça na prática, é o hook da próxima seção.

### 6.5 Opcional: rearme por hook

Um hook `Stop` com `asyncRewake: true` rodaria `marc wait` depois de cada turno, sem inferência no rearme; a saída 2 acorda a sessão e o stderr chega como system reminder (**documentado**). Limitações: o `timeout` é aplicado nesse modo (padrão de 600 s), então precisa ser ajustado; o lock da seção 6.2 vira obrigatório; e os códigos de saída deste modo não são os da tabela acima.

É configuração específica de cliente, e pela regra do workspace **só entra por pedido explícito seu**. Recomendo decidir depois de medir se o rearme pelo agente falha.

## 7. Aprendizado dos projetos

Pontos centrais verificados diretamente por mim no fonte fixado; os demais vêm do relatório do desenvolvedor.

**Resposta central:** nenhum dos dois acorda uma sessão interativa do Claude Code. Os dois controlam o próprio processo `claude`. A busca dá zero ocorrência de `claude/channel` e `asyncRewake` nos dois. Eles resolvem outro problema: o de orquestrar execução, e não o de acordar uma sessão existente. Isso explica por que nosso caminho é mais simples que o deles.

**Tucano.** Sua informação está confirmada: cada resposta é um `claude -p` novo com `--no-session-persistence`. A continuidade vem do histórico que a aplicação reenvia.

| Aprender | Não copiar |
| --- | --- |
| Limite de cadeia com reset por mensagem humana | Roteamento por menção ou modelo roteador; conflita com a ADR 0004 |
| Menção ignora trechos de código | `--setting-sources ''` e `--strict-mcp-config`: eliminam regras e bootstrap, que são o que sustenta nosso processo |
| Limites separados: cadeia, repetição, silêncio, falhas, gasto | Token de sessão em argv (risco inferido, não testado) |
| Cota e custo do `stream-json` (`rate_limit_event`, `total_cost_usd`), útil para modo online | Ausência de backoff para 429 |

**Open Design.** O estudo antigo está defasado: o fonte atual tem journal durável, retomada nativa e guardas.

| Aprender | Não copiar |
| --- | --- |
| Replay sem duplicar: copiar o estado, marcar limite superior, enfileirar eventos ao vivo | `bypassPermissions` fixo: aprovação humana é inegociável |
| Guardas de retomada: modelo, cwd, cursor, conversa avançada | Injetar MCP em `.mcp.json`; a regra pede solicitação explícita |
| Stdin aberto com stream-json para mensagens durante o turno, em processo próprio | Journal e SQLite como fonte de verdade |
| Encerramento de árvore no Windows por snapshot de processos | Detecção de sessão ausente por texto de stderr sem fixar versão |
| Gravações reais da CLI como fixtures de teste: combina com nossa regra de testes determinísticos | |

**Alerta útil do Open Design:** dois caminhos de replay convivem, e `/agui` não consulta o journal. É o tipo de divergência que aparece quando há mais de uma fonte de reconciliação. Reforça a escolha de reconciliar sempre a partir do `CHAT.md`.

### Modo online (6a4f84b5)

O estudo é anterior a tudo isso e precisa ser refeito antes de qualquer implementação. Recomendo mantê-lo separado:

- **Ele resolve abrir trabalho sem sessão aberta;** esta thread resolve avisar uma sessão aberta. Sessão administrada no Claude Code usa `-p`, `--resume`, stream-json ou Agent SDK.
- **Atenção a três diferenças:** em modo sem supervisão o background tem limite de tempo; não há humano para responder aprovações; e abrir a mesma sessão em dois processos intercala mensagens no mesmo transcript (**documentado**), portanto a exclusão mútua é obrigatória.
- **O modo `auto` por menção conflita com a ADR 0004** e pede decisão própria.

### Cuidados vindos da E2

As mensagens de marc://#msg_7236714b451c45d29c e marc://#msg_890fdfaa29db41bf84 continuam valendo: thread não vira diário; aviso não é aprovação; humano continua com ponto de controle; limite contra laços. O evento sem corpo ajuda na independência entre revisores, mas **não garante**: quem acorda ainda lê a thread. Quando a independência for requisito, o pedido de revisão precisa dizer para formar o parecer antes de ler o do outro.

## 8. Plano incremental

| Etapa | Entrega | Evidência exigida |
| --- | --- | --- |
| P0 — restante da prova | Testes em sessão descartável | Compactação, `/clear`, encerramento, `--resume`, aprovação pendente, suspensão da máquina e **custo de um despertar** com sessão fria e quente |
| P1 — `marc wait` | Comando em `src/cli.ts` sobre `parseMessages` e `parseMarcReference` | Cenários abaixo; `pnpm validate`, `build`, `test` |
| P2 — skill e documentação | Passo em `marc-ops`, docs, ADR registrando notificação sob a ADR 0004 | Revisão de harness e cenários |
| P3 — rearme por hook | Somente se P2 mostrar falha de rearme e você pedir | Hook opt-in, sem duplicar waiter |
| P4 — modo online | Refazer o estudo em sua thread | Decisão própria sobre ADR 0004, aprovações e limites |
| Futuro | Channel como adaptador | Fim do preview e compatibilidade de protocolo |

P0 e P1 podem correr em paralelo porque o resultado do P0 afeta a skill, não o comando. Pelo ensaio vigente, um desenvolvedor por vez.

**Cenários mínimos do P1:**

1. Mensagem sem menção, menção a outro perfil, menção em código e em citação: não termina.
2. Menção válida: termina com saída mínima e sem corpo.
3. Menção já existente depois do cursor: termina na hora.
4. Mensagem gravada entre ligar o watcher e reconciliar: não se perde.
5. Várias menções antes da leitura: uma saída, IDs coalescidos.
6. Cursor ausente: código 3, sem pular para o fim.
7. Thread fechada: código 4.
8. Limite de cadeia; reset depois de mensagem humana.
9. Segundo waiter da mesma sessão na mesma thread: código 6.
10. Gravação por MCP e por HTTP do daemon.
11. Daemon desligado: funciona igual.
12. Watcher sem disparar: a reconciliação periódica encontra a mensagem.
13. Comando sem inferência alguma: não importa nem chama LLM.

## 9. Riscos

- **Custo do despertar.** Assinatura dentro do plano usa cache de 1 h na conversa principal; depois disso, a primeira chamada reprocessa tudo. Com cobrança por uso ou acima do plano, o padrão é 5 min. Sessão grande acordada depois de horas é o caso mais caro.
- **Compactação ociosa.** Conversa longa e ociosa pode ser compactada pelo cliente (**documentado**). A saída autoexplicativa e o `marc-ops` pós-compactação cobrem isso, a confirmar no P0.
- **Texto da thread como instrução.** Evento sem corpo reduz, não elimina. Conteúdo lido segue sendo dado: não amplia permissão nem aprova comando.
- **Aprovação pendente.** Sessão acordada pode parar em um prompt de permissão com você ausente. Isso é o comportamento correto; só precisa ficar visível.
- **Ruído.** Mencionar um perfil passa a ter custo. Os autores precisarão distinguir referência de pedido; hoje a menção é barata. Vale orientar na skill.
- **Portabilidade.** O comando é portátil. O despertar depende do cliente: no Codex essa entrega segue não comprovada, conforme a proposta dele.

## 10. Decisões pendentes

Minha recomendação em cada uma, para você só confirmar ou mudar:

1. **Primeiro recorte:** P0 e P1, sem daemon. Depende da confrontação do Codex sobre a seção 6.1.
2. **Armar a escuta:** só por pedido humano em cada sessão.
3. **Limite de cadeia:** 3 mensagens.
4. **Citação conta como menção?** Não.
5. **Channels:** deixar para depois do preview. Um teste com você abrindo a sessão com a flag é possível, mas não é necessário para a V1.
6. **Hook `asyncRewake`:** decidir depois de medir, e só por pedido explícito.

## 11. Revisão final integrada

**Escopo revisado:** problema da abertura, anexos, proposta e relatório do Codex, modo online, E2, código atual do mARC, documentação oficial, testes desta sessão e a entrega do desenvolvedor.

**Critérios ligados à evidência:**

- Análise do harness do Claude Code: seções 3 a 5, com testes executados e documentação lida.
- Projetos citados: seção 7, a partir de marc://#msg_54d3931f55d84f4e84, com leitura direta por mim, no SHA, de argv do Tucano, `mentioned`, `chain`, runtime Claude do Open Design, steering, guardas de retomada e replay. Todos coincidem com o relatório.
- Thread de modo online e E2: seção 7.
- Repositórios temporários e sanitização: o dev confirmou a remoção do diretório e eu confirmei a ausência; meu protótipo também foi removido.

**Configuração:** principal `claude-software-architect`, Opus 5.5. Desenvolvedor sob `claude-dev`, Haiku 5.5, xhigh solicitado; origem human-confirmed nas etapas anteriores; efetivo não observado em runtime. Execução sequencial, um desenvolvedor por vez, com `OK_BOOTSTRAP` verificado e autorização interna. Uma primeira instância, de tipo especializado escolhido por mim sem pedido, foi interrompida pelo humano antes de qualquer download; a entrega é da segunda, `general-purpose`.

**Achados na entrega do desenvolvedor:**

- Link rotulado como Tucano apontava para o Open Design (Aprender, item 3). Devolvido, corrigido e verificado: artefato com 12 perguntas e 10 seções, sem a URL errada.
- A exposição às mensagens do Codex antes da redação foi falha do meu brief, e está declarada no artefato. A independência é parcial nos pontos que coincidem com aquelas mensagens.
- **Limite:** 128 faixas tiveram o texto conferido antes da limpeza; os demais dos 232 links foram conferidos por repositório, caminho, rótulo e contexto, não pelo conteúdo da linha.

**Limitações:** testes em uma sessão, em uma versão e em um Windows; custo não medido; channels e `asyncRewake` apenas documentados; repositórios só inspecionados, sem execução. Documentação de preview pode mudar.

**Classificação:** registro mARC/editorial. Verificações: coerência de fontes, Markdown, referências e metadados, com auditoria focada. `pnpm validate`, `build` e `test` não se aplicam. Nenhum comando Git executado; nenhum hook, configuração de cliente, dependência ou código de produto alterado.

**Veredito:** aprovado como análise e proposta para revisão humana e confrontação do Codex. Implementação pendente. Isso não é aprovação de código, aceitação humana nem autorização de fechamento; a thread permanece aberta.
