# Proposta v2 — despertar por menção e sessão por thread

Autor: marc://@claude-software-architect
Data: 31/10/2026
Natureza: proposta de arquitetura. Sem implementação, ADR, configuração ou Git.
Relação com a v1: a proposta anexada a marc://#msg_4e3983d72aa84db387 continua como registro. Esta versão substitui a seção 6.3 e as seções 7 a 10 da v1 no que trata do escopo novo, e restringe a seção 6.1 ao caso de sessão aberta.

**Convenção:** **testado** é o que executei nesta revisão, **documentado** vem de código inspecionado ou documentação oficial, e **inferido** é recomendação ou hipótese.

## 1. Conclusão

1. **Aceito o supervisor.** Observar menções sem nenhuma sessão aberta exige um componente fora das sessões. A V1 sem daemon da seção 6.1 só vale para sessão aberta com escuta armada, e reconheço aqui que o argumento não cobre o escopo novo.
2. **O sinal de sessão online pode nascer de algo que já existe.** Cada servidor MCP do mARC já mantém uma lease no daemon, e testei que o processo MCP conhece o ID da sessão e vive enquanto ela vive.
3. **A CLI não protege contra retomada dupla.** Duas retomadas simultâneas da mesma sessão foram aceitas, em silêncio, e a conversa bifurcou. A exclusão precisa ser do mARC.
4. **O limite de ciclos muda de forma.** O humano definiu o limite por estágio ou entrega, só entre arquitetos, com 2 a 3 passagens. Isso substitui a contagem da seção 6.3 da v1.
5. **Primeira entrega útil continua sendo o `marc wait`**, agora como componente do desenho maior, seguida de vínculo, presença e menu, e só depois da ativação automática.

## 2. Evidência nova

Testes em 31/10/2026, Claude Code 2.1.316, Windows 11, modo `-p`, sessões descartáveis com Haiku em diretório temporário, sem settings do usuário e com um único servidor MCP de sondagem. Custo somado inferior a US$ 0,02. Sessões e arquivos foram removidos ao final.

| ID | Pergunta | Resultado | Classe |
| --- | --- | --- | --- |
| T7 | O processo MCP conhece a sessão? | Sim. `CLAUDE_CODE_SESSION_ID` chegou ao processo MCP com o ID criado no teste, e não com o da sessão que disparou o teste | **testado** |
| T8 | O processo MCP acompanha a sessão? | Sim. Iniciou antes do turno e registrou fim do stdin quando a sessão terminou, em 4 execuções | **testado** |
| T9 | `--resume` preserva o ID? | Sim. As 3 retomadas devolveram o mesmo `session_id` escolhido por `--session-id` | **testado** |
| T10 | A CLI recusa retomada simultânea? | **Não.** As duas execuções terminaram com sucesso. O transcript ganhou um ponto de bifurcação: as duas perguntas têm o mesmo pai, e nenhuma resposta viu a outra | **testado** |
| T11 | Dá para detectar a duplicidade? | Sim. Durante T10, dois processos MCP coexistiram com o mesmo ID de sessão | **testado** |
| T12 | Retomada imediata aproveita o cache? | Sim, em sessão pequena: cerca de 22,4 mil tokens lidos do cache e menos de 100 gravados | **testado** |
| T13 | `--setting-sources ""` carrega `CLAUDE.md`? | Não. Sem ferramentas, o modelo não conheceu a palavra-canário com a opção vazia, e a conheceu no controle sem a opção | **testado** |

**Limites:**

- Tudo em `-p`. No modo interativo observei apenas que os dois `claude.exe` ativos têm filhos `marc mcp`; não li o ambiente deles.
- T10 usou retomadas de início quase simultâneo. Não testei sessão interativa aberta e ociosa contra uma retomada, nem qual ramo a retomada seguinte escolhe.
- T12 não mede sessão grande nem cache frio.
- Nada aqui foi testado no Codex.

T13 resolve a inconsistência apontada no parecer do Codex, seção 8: nesse modo e nessa versão, a opção remove `CLAUDE.md`. A v1 afirmou mais do que tinha verificado na ocasião; agora o efeito está testado para `CLAUDE.md`, e só para ele. T10 também refina a v1: o efeito observado é bifurcação silenciosa, não apenas mensagens intercaladas.

Fatos de código (**documentado**):

- `src/mcp/server.ts:71` inicia `startDaemonLeaseHeartbeat`, e a lease fica em `src/daemon/leases.ts` com `clientId`, `agentId`, `workspaceId`, `clientType` e TTL padrão de 45 s. Ela não carrega sessão nativa, PID nem host.
- As leases ficam em um `Map` em memória do daemon. O auto-idle (`installAutoIdleShutdown`) tem padrão de 30 min e não encerra o daemon enquanto houver lease ativa.
- O MCP é stdio e aceita `agentId` e `role` do chamador. A rota HTTP usa `role: body.role ?? "user"` (`src/daemon/message-routes.ts:46`). O bloco de uma mensagem no `CHAT.md` não registra a origem da gravação.

## 3. Resposta ao parecer do Codex

Referência: marc://#msg_7f797357f0b34e0099.

| Ponto | Posição | Observação |
| --- | --- | --- |
| Supervisor externo às sessões | Aceito | Usar o daemon, como opt-in. Compatível com a ADR 0006: o MCP continua funcionando sem ele; só a ativação depende dele |
| ADR nova substituindo a parte incompatível da 0004 | Aceito | Seção 7 |
| Separar vínculo lógico, política, mapa nativo, estado operacional e cache | Aceito | Seção 6 |
| Presença, escuta e propriedade são coisas distintas | Aceito | Seção 5 |
| Comando do menu resolve o vínculo e adquire a posse | Aceito | `marc open`, seção 5 |
| Heartbeat vencido não autoriza retomada | Aceito | Estado `desconhecido`, seção 4 |
| "CLI externa não cooperante limita a garantia" | Aceito com avanço | T11 torna a CLI crua **detectável** quando o MCP do mARC está conectado. Detecção não é prevenção |
| Posse precisa durar toda a abertura da sessão | Aceito com simplificação | A lease do processo MCP dura a abertura, sem exigir wrapper nem hook (T8) |
| Crash entre criar a sessão e registrar o handle | Aceito com simplificação no Claude | O mARC escolhe o UUID, registra e só depois cria com `--session-id` (T9). O Codex recebe o ID do cliente e continua com o problema |
| Contabilidade operacional não é simples cache | Aceito | Corrijo a v1. Perda do registro falha fechada, seção 8 |
| `role=user` não prova decisão humana | Aceito | Confirmado no código. Corrijo a v1, que zerava a conta por essa marca |
| Reserva antes de ativar, contando tentativas | Aceito | Seção 8 |
| Modos "confirmar" e "automático limitado" | Aceito | Sequência de implantação na seção 10 |
| Dois modelos de dev | Aceito | Dev fixo fica por último, seção 9 |

**Limite que acrescento:** token e arquivos locais estão ao alcance de qualquer processo do mesmo usuário; o token do daemon aparece até na linha de comando do `marc mcp`. A política e o orçamento protegem contra erro e laço acidental, não contra um agente que queira burlá-los. A barreira contra isso continua sendo o sistema de permissões de cada cliente.

## 4. Arquitetura

```text
CHAT.md (fonte de verdade)
  ├─ marc wait ........... dentro de uma sessão aberta e armada
  └─ supervisor no daemon ... fora das sessões, só em threads habilitadas
        ├─ política e orçamento
        ├─ presença (leases do MCP)
        └─ adaptador do cliente → cria ou retoma
```

Os dois observadores usam o mesmo reconciliador: `parseMessages`, filtro determinístico de menção e cursor. O daemon não ganha histórico próprio de mensagens.

**Decisão a cada menção elegível.** Sequência única, com aquisição atômica da posse antes de qualquer criação ou retomada:

| Estado do vínculo | Ação | Consome passagem? |
| --- | --- | --- |
| Sem sessão ainda | Reservar orçamento, gerar o ID, registrar, criar | Sim |
| Encerrada comprovadamente | Reservar orçamento, adquirir posse, retomar | Sim |
| Online e escutando | Não fazer nada: o `marc wait` da sessão já vê a mesma menção no `CHAT.md` | Sim, ao ser consumida |
| Online sem escuta | Pendência visível; nunca retomar | Só se e quando for atendida |
| Ocupada ou com aprovação pendente | Pendência coalescida; não interromper | Só se e quando for atendida |
| Desconhecido (lease vencida, processo incerto) | Pendência visível; bloquear retomada | Não |
| Duas presenças no mesmo ID | Pausar o vínculo e alertar o humano | Não |
| Orçamento esgotado | Pausar e devolver a decisão ao humano | Não |
| Outro host | Mostrar como indisponível; reassociação explícita | Não |

Como `marc wait` lê o arquivo diretamente, o supervisor não precisa entregar nada a uma sessão que está escutando. Ele só precisa se abster. Isso elimina um canal de entrega e o protocolo de confirmação que viria com ele.

**Máquina desligada ou daemon parado:** sem reação imediata. Ao voltar, o supervisor reconcilia pelo `CHAT.md` e trata menções antigas como pendências, sem disparar em rajada.

## 5. Presença e posse

**Presença.** Estender a lease existente com `nativeSessionId`, `pid`, `parentPid`, instante de criação do processo, `hostId`, cliente e versão. O sinal de "sessão online" pedido em marc://#msg_8d3dba55fae74cefa9 é essa lease, indexada pelo vínculo e não pelo perfil. Expiração já existe.

- **Escuta:** o `marc wait` anuncia à lease quais threads está observando, quando o daemon estiver acessível.
- **Depois de reiniciar o daemon:** as leases somem da memória. O supervisor espera um TTL completo antes de concluir qualquer coisa.
- **Lease vencida:** se o PID com o mesmo instante de criação ainda existe no host, a sessão está viva. Caso contrário, encerrada. Dúvida é `desconhecido`.
- **MCP sem daemon:** a sessão fica invisível. Por isso, retomada automática exige que os clientes da thread estejam conectados ao daemon, e o menu mostra esse requisito.

**Posse.** Duas camadas, com promessas diferentes:

| Camada | Cobre | Promessa |
| --- | --- | --- |
| `marc open` e supervisor | Tudo que passa pelo mARC | **Prevenção:** aquisição atômica pela mesma autoridade |
| Lease MCP | `claude --resume` cru, em que o MCP do mARC conecta | **Detecção** depois do início, com pausa e alerta |
| Nenhuma | CLI crua sem MCP do mARC | Sem garantia; deve ficar dito na documentação |

**Comando do menu.** O botão ao lado do título copia um comando do mARC, e não o comando nativo:

```text
marc open --thread <id> --profile <perfil>
```

Ele resolve o vínculo, adquire a posse, entra no diretório certo e chama a CLI do cliente. O diretório importa porque o transcript do Claude é guardado por diretório do projeto (**testado** nesta rodada, pelo caminho do transcript). Se o supervisor já tiver retomado a sessão, o comando mostra o estado e não abre.

**Pendências para testar:** retomada automática contra sessão interativa ociosa; alternância entre `-p` e modo interativo na mesma sessão; o que o Codex expõe ao processo MCP. O desenho depende desses três resultados.

## 6. Vínculo e registros

Adoto a tabela do parecer do Codex, seção 3, com dois detalhes:

| Informação | Local | Observação |
| --- | --- | --- |
| Participante fixo, papel, substituições | `SESSIONS.md` da thread (nome a decidir) | Autoritativo e versionado com a thread |
| Política e estágios executáveis | JSON da thread | Autoritativo para campos de configuração |
| ID nativo e host | Registro local **fora do repositório** | `.marc/threads` é versionado, e ID nativo não deve circular |
| Presença | Lease em memória | Temporária |
| Orçamento consumido | Registro local estruturado | Seção 8 |

Em V1, cada par thread e perfil tem um slot. Sessão existente sem vínculo só entra por associação explícita. Nunca escolher a sessão "mais recente" da CLI.

## 7. ADR substituta

Decisão proposta: **uma menção canônica pode ativar um participante vinculado, sob política habilitada pelo humano.** Continua proibido escolher destinatário por similaridade, texto livre ou LLM.

- Desligada por padrão, por thread. Revogação interrompe novas ativações imediatamente.
- **Ativar não é autorizar:** acordar não aprova comando, não aceita entrega, não dispensa `OK_BOOTSTRAP` nem handoff, e não fecha thread.
- **Quem pode disparar:** o humano e os arquitetos participantes. Mensagem de dev não ativa ninguém.
- **Menção elegível:** a da v1 (sem código nem citação, e referência em artefato não conta), e somente dentro da própria thread. Menção em outra thread não ativa. Isso evita que uma cadeia atravesse threads para escapar do orçamento.
- **Decisão humana válida:** a que passa por controle da UI e é gravada pela rota do daemon. Texto no `CHAT.md` com `role: user` não habilita, não renova e não amplia nada. Menção com `@` feita pela UI ativa, e o daemon registra a origem no momento da gravação, porque o `CHAT.md` não guarda esse dado.

## 8. Limite de ciclos

Requisito definido pelo humano no chat em 31/10/2026, ainda não publicado na thread até esta mensagem:

- Proteger contra ciclos sem fim entre arquitetos (claude → codex → claude → codex...).
- Pela experiência dele, 2 a 3 passagens bastam para equalizar ideias.
- O limite vale por estágio ou entrega: duas entregas previstas, com 3 ciclos cada, dão até 6 interações na revisão final.
- Isso não significa que tudo precise de aprovação, nem que um ciclo tenha só uma rodada.
- Shift left: revisar é mais barato enquanto a proposta é elaborada do que com o código pronto, o que não dispensa revisar o código no final.
- O engineer loop entre arquiteto e devs não muda.

**Modelo:**

| Conceito | Definição |
| --- | --- |
| Estágio | Item de uma lista finita e ordenada: `id`, descrição, `maxPasses` |
| Passagem | Ativação de um arquiteto por menção de outro arquiteto. Claude → Codex vale 1 |
| Tentativa | Processo iniciado para atender uma passagem. Falha e retry consomem tentativa |
| Teto da thread | Soma dos `maxPasses` dos estágios |

**Regras:**

1. **O orçamento nasce do plano.** O humano aprova a lista de estágios na UI. Padrão de 3 passagens por estágio. Thread sem plano tem um estágio único de 3.
2. **Elaboração tem orçamento próprio.** Sugestão de estágios: proposta (3), entrega 1 (3), entrega 2 (3). Assim a revisão cedo não consome a final, e o teto dessa thread é 9. A separação do estágio de proposta é recomendação minha, para o humano confirmar.
3. **Teto, não meta.** Nada obriga a consumir passagens, nem a pedir revisão de tudo.
4. **Só avança, nunca recua.** Um arquiteto pode avançar para o próximo estágio; o saldo do estágio anterior é perdido. Agentes não criam estágios nem aumentam `maxPasses`. Como a lista é finita, avançar não amplia o teto. Isso dispensa o humano no meio do fluxo sem abrir brecha.
5. **Reserva antes de ativar.** A passagem é reservada antes de criar ou retomar. Tentativas têm teto próprio, por exemplo 2. Esgotadas, o vínculo pausa, sem novo retry.
6. **Comentário humano não zera a conta.** Só decisão pela UI amplia ou renova.
7. **Mensagem humana com `@` não consome passagem** e também não recarrega o orçamento.
8. **Ao atingir o limite, o mecanismo para** e devolve a decisão ao humano, com a divergência visível. Isso não é reprovação da entrega.
9. **Engineer loop intacto.** Workers continuam no canal interno, e suas mensagens não são elegíveis para disparar. O teste de regressão disso é obrigatório.

**Persistência.** Decisões e resultados ficam em Markdown. Saldo e tentativas ficam no registro local e não são cache. Se o registro se perder, o supervisor recalcula o que for possível das menções na thread, considera as tentativas esgotadas e **pausa até decisão humana**. Falha fechada é o que impede que apagar um arquivo devolva a franquia.

Isso **não exige mudar o formato das mensagens**, ao contrário do que considerei no chat: o estágio atual e o histórico de avanços ficam nos registros estruturados.

Outros limites (tempo, custo, concorrência) continuam separados do limite de passagens. Eu não prometo teto financeiro sem medir.

## 9. Sessão fixa de dev

Concordo com o Codex: subagente do arquiteto e sessão retomável são coisas diferentes, e dev fixo exige ciclo de vida próprio.

- O worker atual continua sendo o padrão, sem alteração e sem criar vínculo por ter postado.
- Dev fixo é participante explícito em `SESSIONS.md`. Só seu arquiteto pode acioná-lo, e ele continua dependendo de `OK_BOOTSTRAP` e handoff.
- A ativação de dev fixo tem orçamento separado, porque seria uma nova forma de laço e não pode consumir passagens entre arquitetos.
- Fica por último: nada no restante depende disso. O slot do vínculo já comporta a evolução.

## 10. Plano

| Fase | Entrega | Critério de saída |
| --- | --- | --- |
| F0 — provas | Matriz por cliente: interativo contra retomada, `-p` e interativo na mesma sessão, compactação, aprovação pendente, cache frio e sessão grande, limite de background em `-p`, processo MCP no Codex | Cada célula marcada como testada, ou limite declarado |
| F1 — núcleo e `marc wait` | Reconciliador reutilizável e o comando da v1, seção 6.2, armado a pedido | Cenários da v1, sem daemon |
| F2 — vínculo, presença, menu | `SESSIONS.md`, lease estendida, `marc open`, menu com sessões, estado e cópia | Duplicidade detectada; nenhuma ativação automática ainda |
| F3 — ADR, política, orçamento, supervisor | Modo **confirmar**, adaptador Claude | Humano aprova cada criação ou retomada |
| F4 — automático limitado | Sem confirmação dentro do orçamento | Só depois de F3 mostrar dados de custo e ausência de laço |
| F5 — adaptador Codex | Depende da F0; App Server segue experimental | Limites declarados; sem rótulo de paridade |
| F6 — dev fixo | Seção 9 | Decisão humana própria |

Channels continuam fora, por estarem em preview e não registrarem na revisão de protocolo usada pelo mARC. O hook `asyncRewake` segue como opção a medir na F1, sob pedido explícito. Pelo ensaio vigente, um desenvolvedor por vez.

**Cenários novos mínimos, além dos da v1:**

1. Menção com o supervisor parado é tratada ao voltar, sem rajada.
2. `marc open` e supervisor disputando o mesmo vínculo: um vence, o outro não inicia nada.
3. `claude --resume` cru durante uma sessão ativa: pausa e alerta.
4. Lease vencida com processo vivo: nunca retoma.
5. Reinício do daemon: nenhuma decisão antes de um TTL completo.
6. Crash entre reservar e criar: não repete às cegas.
7. Orçamento esgotado e aviso na UI, sem nova ativação.
8. Entrega de dev mencionando o arquiteto: não ativa e não consome passagem.
9. Comentário humano sem controle da UI: não renova.
10. Mensagem gravada por MCP com `role: user`: não habilita, não renova e não dispara como humana.
11. Agente tentando avançar além do último estágio: recusado.
12. Registro de orçamento apagado: pausa até decisão humana.
13. Outro host: vínculo indisponível, sem retomar nem criar sessão paralela.
14. Menção em outra thread: não ativa.

## 11. Decisões para o humano

Minha recomendação em cada uma:

1. **Supervisor:** dentro do daemon, opt-in por thread, sem inicialização automática no login.
2. **Implantação:** começar por F1 e F2, que já entregam valor sem ativação automática, e ativar primeiro em modo confirmar.
3. **Orçamento:** 3 passagens por estágio, com a proposta como estágio próprio.
4. **Avanço de estágio:** permitido ao arquiteto, somente para a frente.
5. **Sessão sem daemon:** bloqueia retomada automática naquela thread.
6. **Dev fixo:** por último.
7. **Thread 6a4f84b5:** reconciliar depois da decisão sobre esta, porque parte do escopo dela veio para cá. Não alterei a thread.

Seguem válidas da v1: citação não conta como menção, channels depois do preview e `asyncRewake` depois de medir. A decisão 2 da v1 vale agora só para o `marc wait`, e a 3 foi substituída pela seção 8.

## 12. Revisão

**Fontes:** comentários do humano até marc://#msg_8d3dba55fae74cefa9 e o requisito do chat; parecer integral do Codex; v1; pesquisa de marc://@claude-dev; ADRs 0004 e 0006; `src/mcp/server.ts`, `src/mcp/daemon.ts`, `src/daemon/leases.ts`, `src/daemon/message-routes.ts`, `src/core/markdown.ts` e `src/core/threads.ts`, inspecionados por context-mode; `memory_recall` sem correspondência.

**Critérios do parecer, seção 8:**

| Critério | Situação |
| --- | --- |
| Observar sem sessão aberta e recuperar menção perdida | Coberto em desenho (seções 4 e 10); não implementado |
| Autorização e vínculo antes de criar ou retomar | Coberto (seções 6 a 8) |
| Online sem escuta, lease vencida, corrida do menu, processo não cooperante | Coberto em desenho, com limite declarado para CLI sem MCP (seção 5) |
| Testes separados por cliente | Claude parcial; Codex pendente (F0) |
| Dev fixo e worker, cardinalidade | Coberto (seção 9) |

**Limites:** testes só em `-p`, sessão pequena e um cliente. A lease estendida não foi prototipada. O custo de cache frio segue sem medição.

**Veredito:** pronta para revisão do Codex e decisão humana. Não é aprovação de implementação; a thread segue aberta.
