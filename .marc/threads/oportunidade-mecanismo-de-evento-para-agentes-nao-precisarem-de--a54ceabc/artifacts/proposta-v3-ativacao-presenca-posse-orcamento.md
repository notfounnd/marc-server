# Proposta v3 — ativação, presença, posse e orçamento

Autor: marc://@claude-software-architect
Data: 31/10/2026
Natureza: fechamento do desenho para decisão humana. Sem implementação, ADR, configuração ou Git.
Relação com a v2: esta versão substitui as seções 4, 5, 8, 10 e 11 de marc://#msg_ee987db8d43e4d78bd. As seções 2, 3, 6, 7 e 9 da v2 continuam válidas, com os acréscimos abaixo.

**Convenção:** **testado** é o que foi executado, com autor indicado; **documentado** vem de código ou documentação inspecionados; **inferido** é recomendação ou hipótese.

## 1. Conclusão

Aceito os cinco critérios da revisão marc://#msg_ba62c220ffbc45a082. Ela encontrou três falhas reais na v2:

1. **Lease tratada como posse.** Lease mostra que uma instância foi vista, não quem é dono da sessão nem que ela terminou.
2. **Waiter fora do orçamento.** Na v2, a sessão escutando seria ativada antes de reservar a passagem. O caminho mais simples ficava sem controle.
3. **Avanço de estágio como saída do limite.** Um agente poderia esgotar uma cota, avançar e continuar a mesma discussão com as cotas seguintes.

O desenho agora tem quatro autoridades separadas: **presença** observa, **posse** exclui, **reserva** autoriza cada ativação e **orçamento** limita. Nenhuma substitui outra.

**Encerramento deste estágio:** as duas revisões do Codex acharam defeitos concretos, mas o que resta agora são provas de cliente, não questões de desenho. Recomendo uma confirmação objetiva do Codex sobre os cinco critérios, sem escopo novo, e depois a decisão humana.

**Correção:** a primeira publicação desta versão e a mensagem marc://#msg_b57b3747c091448bbd aplicaram o limite de 2 a 3 passagens a esta thread. Isso foi um erro: o humano esclareceu que esta thread exploratória não é parâmetro para esse dado, e o limite vale para o mecanismo proposto.

## 2. Evidência acrescentada

| Fato | Resultado | Classe |
| --- | --- | --- |
| Identidade no Codex | `_meta.threadId` da chamada MCP igual ao ID nativo; sem ID no ambiente; MCP distinto por thread com pai App Server comum; processos transitórios de descoberta | **testado** por marc://@codex-software-architect, versões 0.161.0 e 0.166.0, sem turno de modelo |
| Pai do MCP no Claude | Os processos `marc mcp` ativos são filhos diretos de `claude.exe` | **testado** por mim, por árvore de processos |
| Início sem shell, Claude | `claude` inicia com `shell: false` | **testado** por mim, 2.1.316 |
| Início sem shell, Codex | `codex` falha com `ENOENT`, `codex.cmd` com `EINVAL`; Node absoluto com launcher e `codex.exe` nativo funcionam | **testado** pelos dois |
| Shell das ferramentas no Claude | Sessão iniciada sem variáveis do Git Bash e sem Git no PATH ainda executou comandos no Git Bash | **testado** por mim, em `-p` |
| Lease atual | `clientId` com PID e UUID, renovação a cada 15 s, TTL de 45 s, só com `--daemon-url` configurado | **documentado** (`src/mcp/daemon.ts`) |
| Metadado na chamada | O SDK declara `_meta` em requisições, e `src/mcp/server.ts:144` já lê `params._meta` em outro fluxo. Não confirmei o acesso dentro do handler de ferramenta | **documentado**, parcial |

## 3. Presença: observação, por cliente

A lease estendida é **observação identificada**. A identidade vem de uma estratégia por cliente:

| Cliente | Fonte da identidade | Quando existe |
| --- | --- | --- |
| Claude Code | `CLAUDE_CODE_SESSION_ID` no ambiente | Desde o início do processo MCP (`-p`; interativo a confirmar) |
| Codex | `_meta.threadId` na chamada de ferramenta | A partir da primeira chamada |

**Regra comum:** uma instância só conta como presente para entrega depois de uma chamada identificada. Como `workspace_bootstrap` é a primeira chamada obrigatória, ele é o ponto natural de registro. Isso resolve também os processos de descoberta do Codex, que não fazem chamadas de trabalho.

**Sinal mais fraco:** qualquer instância com identidade conhecida, mesmo sem bootstrap, bloqueia retomada. Na dúvida, o estado é `desconhecido`.

| Sinal | Permite concluir | Não permite concluir |
| --- | --- | --- |
| Lease recente | Instância vista há pouco | Escuta, exclusividade, modelo disponível |
| MCP morto | Aquela instância terminou | Que a sessão terminou |
| Lease vencida | Falta confirmação | Offline |
| Daemon reiniciado | Nada sobre o passado | Um TTL é janela de coleta, não prova negativa |
| Duas instâncias com mesmo ID | Indício de conflito | Dois escritores, antes de excluir reconexão e substituição |

## 4. Posse: registro separado

A posse é um registro local do daemon, gravado por aquisição atômica com **geração**, e só o daemon escreve nele.

- **Quem adquire:** `marc open`, supervisor e adoção. **Adoção** é o registro, na primeira chamada identificada, de uma sessão aberta sem o mARC, desde que não exista dono ativo. Havendo dono diferente, é conflito.
- **Duração:** a abertura inteira, inclusive ociosa e sem waiter.
- **Encerramento comprovado:** vem do adaptador, nunca da morte do MCP.
  - Claude: o processo dono é o pai `claude.exe`, conferido por PID, instante de criação e host. **Inferido**, a validar na F0.
  - Codex: PID do App Server não basta, porque é comum a várias threads. Sessão administrada informa o ciclo de vida pelo protocolo. Sem isso, o estado fica `desconhecido`.
- **`marc open` e supervisor** previnem; a lease só detecta o que passou por fora, e detectar não desfaz a bifurcação.

## 5. Ativação: reserva única, com precedência

**Regra central:** supervisor e waiter disputam a mesma reserva atômica no daemon. A chave é mensagem, menção, destinatário, autorização e estágio. O waiter só libera o trabalho depois de obter a reserva. Assim, um caminho nunca debita duas vezes nem fica fora do orçamento.

O supervisor continua sem entregar conteúdo a quem escuta. O que ele mantém é a pendência, até a ativação ser tratada ou reconciliada. Anunciar escuta não prova consumo: o waiter pode morrer ou não ser rearmado.

Adoto a tabela de precedência do Codex, avaliada de cima para baixo:

| Ordem | Condição | Ação |
| --- | --- | --- |
| 1 | Thread fechada, função revogada, origem inelegível, autorização ou registro inválido, cota indisponível | Não ativar, nem pelo waiter |
| 2 | Host errado, identidade não verificada, conflito de posse, encerramento incerto | Pausa e pendência; não criar nem retomar |
| 3 | Menção já atendida, ou tentativa reservada ou iniciando | Deduplicar e reconciliar a existente |
| 4 | Dono ocupado, com aprovação pendente ou em transferência | Enfileirar; não interromper |
| 5 | Dono online com escuta pronta | Reserva comum, waiter libera, acompanhar tratamento |
| 6 | Dono online sem escuta utilizável | Pendência visível |
| 7 | Sem dono, encerramento comprovado ou primeira criação elegível | Adquirir posse e reserva; adaptador inicia |

Acrescento um estado único de **recuperação** para handle inválido, autenticação ou configuração, cliente incompatível, crash depois da reserva e cancelamento. Todos respeitam o teto de tentativas, sem retry cego. Antes de iniciar a geração, a revisão da autorização e a posse são conferidas de novo, porque a revogação pode ter ocorrido depois da reserva.

**Modo manual e modo automático:**

| | Manual (F1) | Automático (F3 em diante) |
| --- | --- | --- |
| Quem arma | Humano, por sessão | Política da thread |
| Daemon | Não exige | Exige |
| Orçamento | Não participa; freio secundário `--max-chain` por mensagens consecutivas de arquitetos | Reserva obrigatória |
| Daemon inacessível | Continua, porque é função local pedida pelo humano | Falha fechada; novo código de saída de `marc wait` |

Em thread com política habilitada, o waiter nunca opera em modo manual. Registro: um processo em background que expira pode gerar ativação informativa do cliente; a cota limita ativações pelo protocolo mARC, não toda inferência.

## 6. Orçamento de ciclos

Mantenho o requisito do humano como na v2, seção 8: limite por estágio ou entrega, só entre arquitetos, 2 a 3 passagens, teto e não meta, shift left, engineer loop intacto.

**Unidade:** uma passagem é uma ativação de arquiteto por outro arquiteto. Claude → Codex vale 1 e a volta vale outra. A UI mostra sempre unidade e saldo.

**Correção do avanço.** Fica em uma regra simples:

- **Com saldo:** o arquiteto pode avançar, citando a entrega ou o artefato que o plano aprovado definiu como condição de saída do estágio.
- **Sem saldo:** só decisão humana pela UI tira a thread do estágio. Limite atingido é parada real.

**Custo disso:** se a terceira passagem convergir, seguir adiante pede um clique humano. Isso corrige o que a v2 afirmou sobre dispensar o humano. Considero o custo aceitável: convergir em 2 passagens segue sem intervenção, e a terceira funciona como reserva.

**Limite da garantia:** o mecanismo garante o teto total, a parada no limite e a referência declarada. Ele **não verifica se a etapa foi realmente concluída**: isso continua sendo juízo dos arquitetos e do humano.

**Invariantes** (adotadas da revisão do Codex):

1. Lista, IDs e `maxPasses` pertencem a uma revisão de autorização humana. Agentes não trocam a revisão, não criam aliases e não reativam estágio encerrado.
2. Avanço compara estágio e revisão esperados de forma atômica.
3. Menção e reserva conservam o estágio de origem. Pendência não migra para a cota seguinte.
4. Orçamento pertence a thread, autorização e estágio, nunca a PID ou sessão. Reiniciar, recriar sessão ou trocar de host não devolve saldo.
5. Tentativas têm teto por passagem. Reserva incerta depois de crash fica debitada até reconciliar, sem estorno por falta de resposta.
6. Todos os caminhos passam pela reserva.
7. Isenção de passagem para menção humana exige origem verificável pela rota da UI.
8. O padrão de 3 só vale no ato da autorização humana, quando é gravado. Ausência de registro nunca é primeiro uso.

**Perda, corrupção e restauração.** O registro é um arquivo único, com geração, gravado só pelo daemon por substituição atômica.

| Situação | Tratamento |
| --- | --- |
| Registro ausente em thread já autorizada | Pausa |
| Gravação parcial ou conteúdo inválido | Pausa |
| Geração incompatível com a autorização | Pausa |
| Cópia antiga restaurada | Comparar com o piso calculado das menções na thread; contagem menor que o piso pausa |
| Renovação pelo humano | Nova revisão de autorização, com a perda registrada |

As menções servem só de diagnóstico e piso: não reconstroem tentativas nem devolvem saldo. Uma restauração coerente com o piso pode passar despercebida e devolver saldo ou tentativas já consumidos. Esse limite fica para decisão humana antes da F4, e checksum não ajudaria, porque quem reescreve o arquivo reescreve o checksum. A proteção cobre as interfaces cooperantes, conforme a v2, seção 3.

## 7. Início no Windows

- **Daemon inicia sem shell:** argv em array, `shell: false`, `windowsHide: true`, cwd e ambiente explícitos. O texto da thread nunca entra em linha de comando.
- **Claude:** `claude.exe` nativo. O Git Bash das ferramentas é encontrado pelo próprio cliente.
- **Codex:** adaptador resolve e valida o caminho absoluto de Node mais launcher oficial, ou `codex.exe` configurado. Registra versão e revalida depois de atualização. Sem depender de alias, perfil de shell ou `PATHEXT`, e sem tratar o layout interno do pacote como universal. App Server muda o controle, não a necessidade de um lançamento válido.
- **`marc open`:** gera comando sem sintaxe de shell, funcional nos terminais usuais. Sem instalação global, o menu usa o caminho real com barras normais. Com instalação global, usa `marc`. Abrir TUI exige terminal real: fica no terminal em que o humano colou o comando.
- **Ambiente do daemon:** herda de onde foi iniciado. O adaptador registra e valida o que precisa, em vez de presumir.

## 8. Plano

| Fase | Entrega | Critério de saída |
| --- | --- | --- |
| F0 — provas | Por cliente: sessão interativa contra retomada; `-p` e interativo na mesma sessão; identidade e MCP em modo interativo; acesso a `_meta` no handler; `marc open` no mintty; compactação; aprovação pendente; cache frio; limite de background | Célula testada ou limite declarado |
| F1 — núcleo e `marc wait` manual | Reconciliador reutilizável, comando manual | Cenários da v1, sem daemon, com `--max-chain` secundário |
| F2 — vínculo, presença, posse, menu | `SESSIONS.md`, lease estendida, registro de posse, adoção, `marc open`, menu | Conflito detectado; nenhuma ativação automática |
| F3 — ADR, política, orçamento, reserva, supervisor | Modo **confirmar**, adaptador Claude, waiter com reserva | Humano aprova cada criação ou retomada |
| F4 — automático limitado | Sem confirmação dentro do orçamento | Dados de custo e ausência de laço na F3 |
| F5 — adaptador Codex | Identidade por `_meta`, início validado, ciclo de vida | Limites declarados; App Server segue experimental; sem rótulo de paridade |
| F6 — dev fixo | v2, seção 9 | Decisão humana própria |

**Cenários a acrescentar aos da v2:**

1. Waiter e supervisor disputam a mesma menção: uma reserva, uma ativação.
2. Waiter encontra daemon inacessível com política ativa: falha fechada.
3. Waiter morre depois de reservar: pendência reconciliada, sem novo débito.
4. MCP reinicia com a sessão viva: nada de retomada.
5. Processo de descoberta sem chamada identificada: não vira presença.
6. Revogação entre reserva e início: geração não começa.
7. Estágio esgotado com pedido de avanço por agente: recusado.
8. Avanço sem referência à condição do plano: recusado.
9. Dois avanços concorrentes: um vence.
10. Registro restaurado com contagem abaixo do piso: pausa.
11. Menção pendente depois de avanço: continua no estágio de origem.
12. Início do Codex com caminho inválido ou versão alterada: recuperação visível, sem shell.

## 9. Decisões para o humano

1. **Supervisor:** dentro do daemon, opt-in por thread, sem inicialização no login.
2. **Implantação:** F1 e F2 primeiro; ativação começa em modo confirmar.
3. **Orçamento:** 3 passagens por estágio, com a proposta como estágio próprio.
4. **Avanço de estágio:** agente avança só com saldo e referência; estágio esgotado exige decisão humana. **Mudou em relação à v2.**
5. **Sessão sem daemon:** bloqueia automação naquela thread.
6. **Dev fixo:** por último.
7. **Thread 6a4f84b5:** reconciliar depois desta decisão.
8. **Confirmação do Codex:** restrita aos cinco critérios e às decisões próprias desta versão.

## 10. Revisão

**Fontes:** v2, duas revisões e evidências do Codex, comentários do humano, requisito do chat, `src/mcp/daemon.ts`, `src/mcp/server.ts`, tipos do SDK 2.3.1 e testes desta sessão.

| Critério do Codex | Onde | Situação |
| --- | --- | --- |
| Lease como observação, posse separada, encerramento pelo adaptador | Seções 3 e 4 | Coberto |
| Reserva e deduplicação no waiter, precedência e recuperação | Seção 5 | Coberto |
| Estágios com revisão fixa, condições de avanço, recuperação sem devolver saldo | Seção 6 | Coberto para perdas detectadas; restauração antiga com detecção parcial |
| Associação Codex pelo metadado, lacunas por cliente | Seções 3 e 4 | Coberto; TUI e turno de modelo pendentes |
| Lançamento Windows explícito, host distinto da CLI npm | Seção 7 | Coberto; mintty pendente |

**Limites:** nenhum teste em sessão interativa, nenhuma medição de cache frio, nenhum turno de modelo no Codex. Sem protótipo de lease, posse ou reserva. Acesso a `_meta` no handler não confirmado.

**Veredito:** desenho fechado para decisão humana, condicionado à F0. Não é aprovação de implementação; a thread segue aberta.
