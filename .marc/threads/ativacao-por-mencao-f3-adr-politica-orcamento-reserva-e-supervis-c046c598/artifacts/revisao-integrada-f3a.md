# Revisão integrada da F3a: base de política, sem ativação

Autor: marc://@claude-software-architect
Data: 05/11/2026
Escopo: o estado integrado das tarefas A0, A e B da F3a, conforme o plano `plano-f3-politica-orcamento-reserva-supervisor.md` (revisão 2, com os critérios do Codex de marc://#msg_a7b14739bd7f4f7d93 e as decisões de UI do humano).

## 1. Escopo e método

**Entregas de marc://@claude-dev:**

- tarefas A0 e A: marc://#msg_8adcdafe4bca47e29e;
- tarefa B: marc://#msg_91800fb455114d8cb7.

Cada tarefa passou por duas rodadas de revisão no canal entre agentes. Os achados estão consolidados na seção 3.

**Método:**

- leitura pelo context-mode do código, da ADR e da documentação;
- typecheck, lint e testes rodados por mim pelo context-mode;
- inspeção dos prints do navegador da tarefa B;
- os testes ao vivo foram feitos pelo dev, em daemons temporários.

Nenhum comando Git foi executado.

**Configuração:**

- Principal: Claude Opus 5.5.
- Devs: claude-haiku-5-5, com effort xhigh pedido. É a configuração confirmada pelo humano para `claude-dev`.
- Execução: um dev por vez. A tarefa B teve um dev novo.

## 2. Critérios e evidência

| Critério | Implementação | Evidência |
| --- | --- | --- |
| ADR que substitui só o roteamento da 0004 | `docs/adrs/0014-policy-gated-mention-activation.md`; nota na 0004; índice | Lida: desligada por padrão, ativar não é autorizar, origem UI, menção na própria thread, hash do conteúdo, código 8, limite das interfaces cooperantes |
| Política por thread, gravada só pela UI | `src/core/activation-policy*.ts`, `activation-policy-store.ts`; rota `PUT .../activation/policy` | Testes de validação e de rota; nenhuma ferramenta MCP nova |
| Conteúdo autorizado preso (Codex) | `activation-policy-hash.ts`; razão com `authorizedHash` | Testes: participantes e `maxPasses` editados à mão, mesma revisão, `policy_tampered`; o save limpo reconcilia |
| Pausa por workspace e por máquina | `workspace-store.ts`; rotas de pausa, retomada e leitura; histórico limitado | Testes do histórico (201 ciclos, histórico truncado); faixa e botão vistos no navegador |
| Arquivo por thread e migração da F2 | `thread-store.ts`, `legacy-sessions.ts`, `registry-file.ts`, `marked-file.ts` | Testes da F2 verdes depois da troca de layout; migração idempotente; arquivo `.migrated-*` nunca lido |
| Protocolo de encerramento (Codex) | Retrato antes de apagar; recusa de escrita dentro da fila; `thread-cleanup.ts` | Testes de escrita atrasada (acquire, heartbeat, release, observe, conflito); limpeza do dado e do marcador; subida idempotente |
| Seção Activity no resumo | `thread-activity-markdown.ts`, `thread-summary*.ts`, `fetchThreadActivity` com prazo de 2 s | Testes: sem daemon configurado, sem seção; daemon sem resposta, linha explícita; update preserva; lista branca sem ID nativo, PID ou host |
| Waiter na transição (Codex) | `thread-wait*.ts`; código 8 `policy_active` | Testes: habilitada no início, habilitada durante a espera, desabilitada, sem política, ilegível conta como habilitada; código na skill e no tópico de escuta |
| Campo `stage`/`pass` | `markdown.ts`, `types.ts` | Ida e volta com e sem o campo, inclusive depois de anexar artefato; o `message_post` ignora o campo |
| Avisos de saldo | `activation-budget.ts`: `budget_last_pass` (resta uma passagem, máximo ≥ 2) e `budget_exhausted` | Linhas 2/3, 4/5, 3/5, 1/1, 0/1 e 1/2; o daemon recusa máximo abaixo do já usado |
| UI na variante A | `thread-activation-*.tsx`, `workspace-pause-control.tsx`, `activation.css`, `checkbox.tsx` (Base UI) | Prints: painel com rodapé fixo, "Add stage" discreto, X discretos, confirmação de recuperação, dica do Pause; o CLI do checkbox não mudou nenhum outro arquivo |
| Dica das linhas de dev | `thread-sessions-row.tsx` | Texto neutro, que cobre subagente e dev fixo |
| Nada ativa | Sem supervisor, sem reserva, sem lançamento | Nenhum caminho novo inicia cliente; o waiter só deixa de liberar menção |

**Checagens que rodei:**

- typecheck e lint limpos;
- 578 testes da área de A0 e A;
- 159 testes da UI de B.

**Suíte completa:** o dev registrou 1760 de 1760 no estado final. A minha execução está registrada na seção 6.

## 3. Achados resolvidos nas revisões

- **Tarefas A0 e A:**
  - código 8 na skill gerada e no tópico de escuta;
  - linha "Activity not recorded" só com daemon configurado;
  - pausa por thread, a partir do histórico de intervalos;
  - teste instável: a causa era a reconstrução do índice em segundo plano não esperada no encerramento, e agora o daemon a drena;
  - limpeza conjunta do arquivo de dados e do marcador.
- **Tarefa B:**
  - rodapé sempre visível;
  - "Add stage" e botões de remover discretos;
  - Cancel secundário;
  - mensagem duplicada;
  - aviso de saldo inútil com o padrão de 3 passagens, trocado por "última passagem";
  - limite de `maxPasses` também no daemon;
  - dica do Pause indisponível.
- **Lacunas de API liberadas pelo principal:**
  - leitura da pausa da workspace;
  - passagens por estágio na view;
  - `apiPut`;
  - descrição do estágio novo igual ao id;
  - política ilegível substituível com confirmação.

## 4. Limites e riscos

- **Índice de threads no Windows:** houve um `EPERM` ao renomear `.marc/cache/thread-index.json` uma vez, durante a validação da tarefa B, e o índice ficou `degraded` até o daemon parar. É cache derivado, fora do escopo da F3a. Não reproduzido isoladamente. Fica registrado para investigação própria.
- **Geração:** passa a ser por thread. Comparações entre threads diferentes mudariam, mas nenhum consumidor faz isso.
- **Migração:** roda uma vez. Um `sessions.json` gravado depois por um build antigo não é lido.
- **Recuperação:** a recuperação da workspace só é oferecida no painel de uma thread. O botão Pause indisponível explica isso.
- **Incidente:** o dev da tarefa A imprimiu na saída de uma ferramenta o token de um daemon temporário. O daemon foi encerrado e os dados apagados. O daemon e o token do humano não foram tocados.
- **Desvio:** a minha revisão do plano e a primeira rodada da tarefa A usaram Bash direto, antes da reconexão do context-mode. Corrigido; desde então tudo passou pelo context-mode.

## 5. Veredito

**Aprovado tecnicamente** para o estado integrado da F3a, com a suíte completa confirmada na seção 6. Falta a revisão do Codex sobre os três critérios já no código, e a revisão e o aceite do humano na UI. A F3b só começa com plano detalhado e autorização.

## 6. Suíte completa independente

Rodei `pnpm test` pelo context-mode sobre o estado final: 1760 de 1760, 0 falhas, 0 ignorados. O resultado bate com o do dev.

## 7. Reavaliação depois da revisão 3 e da tarefa C

**Entradas:**

- **Revisão 3 do plano** (marc://#msg_ab7ef7eaea38467681), decidida pelo humano depois de usar a UI: etapas fixas, ciclos de ida e volta, padrão na workspace e decisão humana no limite.
- **Parecer do Codex** sobre a F3a (marc://#msg_33304c8d70de4b96a4): os três critérios atendidos, com a pendência da migração durável.
- **Parecer do Codex** sobre a revisão 3 (marc://#msg_63b84e1afc97401b8b): favorável, com critérios para a tarefa C.

Entrega de marc://@claude-dev: marc://#msg_01a6ed30632a448b9f, com o adendo de escopo marc://#msg_b0ad80ab4d20413787.

**O que mudou:**

- **Etapas fixas e ciclos:** `planning`, `execution` e `review` são uma constante do núcleo. Cada etapa guarda `cyclesUsed` e as extensões. Os contadores antigos ficam em `legacyStages`, só como histórico, sem virar ciclos.
- **Política v2:** guarda só o interruptor, o modo, a revisão e o hash.
  - Os participantes são calculados na hora: todos os perfis de arquiteto.
  - Uma política v1 é lida sem quebrar e fica `policy_outdated` quando habilitada.
  - O save pela UI faz o mapeamento explícito da etapa: o PUT exige `stageMapping` quando a etapa antiga não é fixa, e responde 409 `stage_mapping_required` sem gravar.
- **Ciclos por etapa:**
  - ficam no `.marc/marc.config.json`, com uma autorização local no armazenamento da workspace (revisão e hash do conteúdo efetivo);
  - uma edição manual com valor diferente vira `settings_tampered` nas threads ligadas;
  - o save pela UI reautoriza sem apagar consumo, extensões ou pausas;
  - o save da memória preserva o bloco.
- **Ações humanas:**
  - `extend` e `advance` comparam a etapa esperada dentro da fila da thread e exigem a thread pronta;
  - `advance` na revisão final responde `last_stage`, e a UI desativa o botão.
- **Avisos:** `budget_last_cycle`, `budget_exhausted`, `settings_tampered` e `policy_outdated`.
- **Migração durável:** o marcador `sessions.migration.json` é gravado depois dos arquivos por thread e do rename. Um `sessions.json` que reaparecer é ignorado. A migração interrompida é retomada, e um marcador inválido falha fechado.
- **Rename atômico no Windows:** o `writeFileAtomically` tenta de novo com EPERM, EACCES e EBUSY, por cerca de 0,9 s, e no fim relança o erro original sem deixar o temporário. Era a causa da falha do teste do waiter e do `EPERM` no índice de threads. O `marc wait` lê o `policy.json` a cada ciclo, então um save pela UI concorrente falharia sem essa correção.
- **UI:**
  - indicador de três etapas com a atual em teal;
  - "N of M cycles" com barra;
  - "More N cycles" e "Advance stage" no limite;
  - participantes só para leitura;
  - `Zap` à esquerda de sessões;
  - seção "Activation" nas configurações da workspace, no padrão das linhas da memória, salvando ao sair do campo ou com Enter;
  - o checkbox ficou sem uso e foi removido.
- **Docs:** ADR 0014, `docs/ui-and-daemon.md` e `docs/agent-workflows.md`, com a regra de delegar ao dev só depois do consenso, quando o interruptor está ligado.

**Revisões no canal entre agentes:**

- **Rodada 1:** a causa do `EPERM`, e indicador, botões e participantes sem estilo.
- **Rodada 2:** o campo da workspace fora do padrão.
- Os prints finais conferidos por mim: painel em 0 de 5, 4 de 5, 5 de 5, revisão final com avanço desativado e o modal de configurações.

**Desvios declarados pelo dev:** um `git status` só de leitura na primeira rodada, sem autorização, e a remoção do `checkbox.tsx` por `rm`, porque a ferramenta de edição não apaga arquivos.

**Limites:**

- os ciclos ainda não são contados, porque isso é da F3b, e os estados 4/5 e 5/5 foram montados por arquivo de teste;
- o painel não tem teste de UI automatizado, e a validação visual foi feita por prints e consulta ao DOM.

**Veredito reavaliado:** ver a seção 8.

## 8. Veredito final da F3a

Rodei pelo context-mode, sobre o estado final:

- typecheck e lint limpos;
- `pnpm test` com 1747 de 1747, 0 falhas e 0 ignorados.

O total caiu de 1760 porque os testes do modelo de estágios configuráveis foram substituídos pelos do modelo v2.

**Aprovado tecnicamente.** Faltam:

- a confirmação do Codex sobre a tarefa C e a migração durável;
- a prova de aceite do humano na UI, com o daemon reiniciado.

A F3b só começa com plano detalhado e autorização. A contagem de ciclos por ida e volta deve correlacionar os destinatários, e a ferramenta de etapa deve identificar o condutor verificado, como pediu o Codex em marc://#msg_63b84e1afc97401b8b.

## 9. Confirmação do Codex e correção da migração

**Parecer do Codex** (marc://#msg_825be794f3414aa097):

- tarefa C atendida, com provas próprias em memória;
- rename atômico com novas tentativas atendido;
- migração atendida só em parte.

**Lacuna da migração, confirmada por mim no código:**

- Hoje a ordem é: arquivos por thread, depois rename do legado, depois o marcador de conclusão.
- Se a gravação do marcador falhar ou o processo cair depois do rename, o próximo início não vê nem o marcador nem o legado e responde `ready` sem concluir.
- Um `sessions.json` original que reapareça depois volta a ser lido como autoridade.

**Correção** (entrega de marc://@claude-dev em marc://#msg_e5c7c98685cd43c2b1; escopo `src/daemon/legacy-sessions.ts` e `test/daemon-session-migration-marker.test.ts`):

- **Nova ordem:** arquivos por thread, depois o marcador, depois o arquivamento. A transferência de autoridade é a gravação dos arquivos por thread. O marcador registra que ela terminou, e o rename só arruma o diretório.
- **Marcador completo com o legado ainda presente** (queda entre o marcador e o rename): o legado é arquivado sem leitura, e a função responde `ready`.
- **Arquivamento em melhor esforço:** é o único ponto que engole erro, e só depois do marcador. Uma falha persistente deixa o original no disco, ignorado, e o próximo início tenta de novo.
- **Arquivos `.migrated-*`:** nunca são lidos.
- **Instalação nova e marcador inválido:** o comportamento não mudou.
- **Costura nova:** um parâmetro opcional `writeMarker`, com `writeFileAtomically` como padrão, usado só para injetar falha nos testes.

**Testes novos, sem ramificação:**

- falha ENOSPC no marcador depois dos arquivos por thread, seguida de retomada com `generation`, slots e `createdAt` idênticos, e de um original inválido que reaparece e é ignorado;
- queda depois do marcador: o legado é arquivado e não é lido;
- falha do arquivamento com o destino ocupado: o daemon sobe duas vezes, e um legado reaparecido não é lido.

Os quatro testes anteriores ficaram intactos.

**Revisão:** uma rodada, sem achados.

**Limites:**

- O teste do destino ocupado depende de o rename de um arquivo sobre um diretório falhar. Foi verificado só no Windows.
- A colisão de nome de arquivamento no mesmo milissegundo já existia e não foi tratada.
- A falha persistente do arquivamento não gera aviso.

**Checagens que rodei pelo context-mode, sobre o estado final:**

- typecheck, `lint:check` e `format:check` limpos;
- `pnpm test` com 1750 de 1750, 0 falhas e 0 ignorados. São os 1747 anteriores mais os 3 testes novos.

Nenhum comando Git foi executado.

**Veredito: aprovado tecnicamente** para o estado integrado da F3a, com a correção da migração. O aceite de UI do humano foi dado antes desta correção, que não toca na UI. Falta a confirmação do Codex sobre esta seção. O stage, o encerramento e a F3b dependem de autorização do humano.
