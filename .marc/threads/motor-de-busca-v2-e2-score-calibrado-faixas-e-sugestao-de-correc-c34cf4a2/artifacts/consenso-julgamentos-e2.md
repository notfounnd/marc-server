# Consenso dos julgamentos da E2

## Resumo

Registro da adjudicação conjunta das divergências do julgamento incremental da E2, entre os dois avaliadores independentes:

- avaliador a: marc://@claude-software-architect;
- avaliador b: marc://@codex-software-architect.

O consenso não é uma nova avaliação independente. O kappa da primeira rodada continua sendo a medida de concordância e vai ao relatório sem alteração. Os arquivos dos avaliadores (`judgments-a.json` e `judgments-b.json`) ficam preservados nas pastas das capturas.

## Primeira rodada

| Corpus | Captura | Pares | Concordantes | Kappa quadrático | Divergências |
| --- | --- | --- | --- | --- | --- |
| ledgerline-en | 5ae0f660527c | 224 | 222 | 0,000 | 2 |
| marc | 1b68a7e3f4e6 | 865 | 814 | 0,485 | 51 |

**ledgerline-en:** o kappa 0,000 é um caso degenerado. O avaliador a deu 0 a todos os 224 pares. Com uma das distribuições toda em 0, a discordância esperada fica igual à observada, e o kappa zera mesmo com 99,1% de concordância (222 de 224).

**marc:** o kappa ficou abaixo do limite de 0,6. Em 46 das 51 divergências, o grau de b é maior que o de a. É o mesmo sentido da E0: b tende a dar 1 a threads que só compartilham vocabulário ou área com a consulta.

## Escala

A escala é a revisada na E0 (marc://$motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b), sem mudança:

- **3:** lida sozinha, a thread responde à consulta.
- **2:** traz parte substantiva da resposta, mas não basta sozinha. Compartilhar ferramenta, tecnologia ou área do produto não basta.
- **1:** trata do mesmo assunto ou o cita, sem nada que entraria na resposta.
- **0:** sem relação, ou só com vocabulário em comum.

Como o kappa do marc ficou abaixo de 0,6, o plano da E0 pede revisão da escala com exemplos antes da adjudicação. Esta proposta não muda a escala. Ela só fixa três exemplos tirados das divergências:

- **Termo da consulta usado como dado de teste é vocabulário (0).** O estudo 57488bab cita brutal, brutalism e brutalismp como consultas de teste da interpretação. Para as consultas Q01, Q02, Q03 e C5, que procuram a UI neo-brutalism, isso é vocabulário em comum.
- **Citar o assunto pedido é 1, mesmo de passagem.** Para o caso 9I, relatar a auditoria de regras, artefatos e mensagens no encerramento é citar a ferramenta pedida. Isso mantém o grau 1 que o dataset já dá a outras threads nesse caso.
- **Notas anteriores conferem coerência, mas não determinam o grau.** Conteúdos equivalentes no mesmo caso devem ter o mesmo grau. Exemplo: 184fd8bb recebe 2 no A14, como a 58458a82. Outra thread já ter 3 não impede que esta também responda sozinha. Este exemplo foi qualificado pelo avaliador b na revisão, e o avaliador a aceitou a qualificação.

## Procedimento

1. O avaliador a redigiu um grau final e uma justificativa para cada um dos 53 pares divergentes. A base foi o SUMMARY.md, e o CHAT.md quando o resumo não bastava.
2. O avaliador b revisou cada par na msg_6cc24524d63e4ea28d. Aceitou o ledgerline-en inteiro e contestou 4 pares no marc: 5P/024e05b1, 7P/0e4dbaac, 9I/1d4c0daa e 10P/ce47939a.
3. O avaliador a conferiu as quatro contestações nas fontes e aceitou todas. As justificativas originais desses pares estavam erradas: o trecho citado pelo avaliador b existe no SUMMARY.md ou no CHAT.md.
4. O consenso é gravado nos datasets com `merge-judgments --consensus`, nos arquivos `consensus.json` de cada pasta de captura.

Nenhuma nota usa média dos graus nem desempenho de variante. A planilha é cega: não mostra variante nem score.

**Declaração:** antes do julgamento, o avaliador a teve acesso a métricas agregadas interinas da Fase B, vindas do relatório do desenvolvedor. Elas não identificam pares nem threads e não foram usadas em nenhuma nota. A declaração também entra no artifact da decisão.

## Resultado

| Corpus | Pares adjudicados | Grau final de a | Grau final de b | Outro grau | Contestados |
| --- | --- | --- | --- | --- | --- |
| ledgerline-en | 2 | 1 | 1 | 0 | 0 |
| marc | 51 | 26 | 18 | 7 | 4 |

**Limitação registrada:** no 10D, que vem de rodadas anteriores, o dataset dá 1 à ce47939a. No 10P, a mesma thread fica com 2 neste consenso. O merge não sobrescreve graus existentes. Por isso, o 10D fica como está, e a diferença fica registrada aqui, sem reabrir o dataset.

## Segunda rodada (ampliação)

Depois do merge da primeira rodada, o refit gerou uma nova planilha cega. Os avaliadores julgaram de forma independente, nos arquivos `judgments-a-r2.json` e `judgments-b-r2.json`.

| Corpus | Pares | Concordantes | Kappa quadrático | Divergências |
| --- | --- | --- | --- | --- |
| ledgerline-en | 3 | 3 | n/a (os dois avaliadores deram 0 a todos) | 0 |
| marc | 27 | 26 | 0,780 | 1 |

A divergência única fica com o grau de b, sem contestação, e está no `consensus-r2.json` do marc:

| Caso | Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- | --- |
| 9P | 6143a9b5 | 1 | 0 | 0 | Atualiza a orientação de estilo e a rotina de manutenção. Não trata do suporte local para aplicar regras nem para anexar artefatos. Coerente com 9P/004a9983 e C2/d34b7486, que têm 0 na primeira rodada. |

## Terceira rodada (ampliação)

A segunda ampliação deixou 3 pares pendentes, todos no marc. O ledgerline-en chegou a 0. Os arquivos da rodada são `judgments-a-r3.json` e `judgments-b-r3.json`: 3 pares, 2 concordantes e 1 divergência.

| Caso | Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- | --- |
| A13 | 3e422682 | 1 | 0 | 0 | (contestado) Trata da manutenção dos embeddings e da RAM do rebuild, não da recuperação do histórico com vetores comprimidos. Só compartilha a área, o que a escala diz que não basta. A b64903bd, com 1 no mesmo caso, cita explicitamente o banco de embeddings quantizado como infraestrutura da busca. |

O avaliador a propôs 1. O avaliador b contestou com a justificativa acima, e o avaliador a aceitou. O grau final está no `consensus-r3.json` do marc.

## Pares adjudicados na primeira rodada

Colunas: a thread aparece pelo sufixo de 8 caracteres do id; a e b são os graus da primeira rodada; Final é o grau de consenso. Os pares marcados como "(contestado)" ficaram com o grau proposto pelo avaliador b na revisão.

## Corpus ledgerline-en

### L27

Consulta: can two refresh cycles modify one account simultaneously

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| a85f3e27 | 0 | 1 | 1 | Cita de passagem a trava do sync: o comando recusa rodar enquanto um job de sync segura o lock. Não responde sobre dois refreshes simultâneos. |

### LT01

Consulta: duplicte transaction fingerprint

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| c71e0b94 | 0 | 1 | 0 | Trata só do cabeçalho do extrato OFX. Não cita duplicata nem fingerprint. |

## Corpus marc

### 1I

Consulta: onde fica o protocolo operacional estavel e onde ficam as regras comportamentais do workspace?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 1 | Ajusta as regras do fluxo e os documentos de orientação, sem dizer onde fica cada contrato. Recebe o mesmo grau da 92413b81 neste caso. |
| 2f441fa7 | 1 | 0 | 0 | Fala da fonte única de composição de mensagens, não do protocolo nem das regras do workspace. Só vocabulário em comum. |
| 6143a9b5 | 1 | 0 | 1 | Cita de passagem a Custom Rules em RULES.md e a Workspace Maintenance em RULES.md e INSTRUCTIONS.md, sem a separação pedida. |

### 1P

Consulta: agentes estao editando o arquivo de instrucoes geradas e misturando custom rules, qual decisao historica evita isso?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 58458a82 | 0 | 1 | 1 | Atualiza INSTRUCTIONS.md e RULES.md com a orientação de bootstrap. Trata dos mesmos arquivos, sem a decisão sobre o arquivo gerado. |
| 92413b81 | 0 | 1 | 1 | Cita que a parte gerenciada das regras foi preservada e que as obrigações ficam nas Custom Rules. É menção, não a decisão. |

### 3P

Consulta: preciso enxergar no card se a base de conhecimento esta saudavel sem abrir as configuracoes

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| aa4908aa | 1 | 0 | 1 | Introduz os estados preparing, rebuilding e degraded da memory na UI. É o mesmo assunto, mas o indicador no card é outra thread. |

### 4I

Consulta: como funcionam os modos exclusivos e a rolagem propria nas tres colunas?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| c147b8bb | 0 | 1 | 0 | Só diz que uma consulta apontou threads de colunas. Não fala de modos nem de rolagem. |

### 5P

Consulta: quero copiar um endereco canonico que abra agente, thread, mensagem ou anexo dentro da UI

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 024e05b1 | 1 | 2 | 2 | (contestado) O SUMMARY registra que a cópia da referência da thread passou a operar pelo próprio texto exibido. É uma decisão relacionada à cópia de endereços internos, mas não cobre todos os alvos. |

### 6D

Consulta: remover aliases legados do MCP e manter nomes canonicos como thread_create

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| ce47939a | 1 | 0 | 1 | A validação cita as 12 tools MCP canônicas. É menção, sem a remoção de aliases. |

### 7P

Consulta: a busca acha a decisao correta, mas coloca resultados genericos de UI antes dela

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0e4dbaac | 0 | 1 | 2 | (contestado, com outro grau) Na observação da validação, o CHAT registra que a ordenação semântica pura pode trazer hits de UI antes do hit de token. Também sugere reranking ou híbrido lexical. Descreve o problema e uma direção de correção. |

### 8I

Consulta: como a UI serve um snapshot stale enquanto o indice reconstrói?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3d40719f | 0 | 1 | 1 | Cita a serialização do rebuild do índice para evitar snapshots fora de ordem. É o mesmo assunto, sem o snapshot stale servido à UI. |

### 8P

Consulta: a listagem nao pode travar durante uma reconstrucao pesada e ainda precisa indicar degradacao

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 174c48b6 | 0 | 1 | 1 | Cita o ícone de estado degradado e o rebuild em andamento da memory. É menção ao assunto, mas a listagem da consulta é a do índice de threads. |

### 9I

Consulta: qual ferramenta verifica referencias, artifacts, mensagens e regras antes de fechar uma thread?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 1 | 2 | 1 | Relata as auditorias de regras, artefatos e mensagens no encerramento. Recebe o mesmo grau das outras threads que só citam a auditoria neste caso. |
| 1d4c0daa | 0 | 1 | 1 | (contestado) O CHAT relata as auditorias estruturais de artefatos, referências e mensagens. É menção, pelo segundo exemplo da escala. |
| 054fd58b | 1 | 2 | 1 | Relata as auditorias estruturais sem achados. É menção. |
| 674632b3 | 1 | 2 | 1 | Cita o workspace_audit com escopo preflight. É menção. |

### 9P

Consulta: agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Trata dos registros do loop. Não cita skill nem suporte local para aplicar regras e anexar artefatos. |

### 10D

Consulta: ordenar threads mais novas no topo por closedAt e createdAt

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3c4dda95 | 0 | 1 | 1 | Cita a data Closed e o fallback por mtime que o mARC usa. É o mesmo assunto, sem a ordenação. |

### 10P

Consulta: trabalhos recentes aparecem enterrados e a UI nao deveria reordenar no cliente

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| ce47939a | 0 | 3 | 2 | (contestado, com outro grau) O CHAT define as fechadas por closedAt desc e a ordenação no listThreads. É parte substantiva da resposta, mas não diz que o cliente deve preservar a ordem sem reordenar. Ver a limitação sobre o 10D. |
| 3c4dda95 | 0 | 1 | 1 | Mesmo motivo do 10D. |

### Q01

Consulta: brutal

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 1 | 0 | brutal aparece só como consulta de teste do estudo. É vocabulário em comum, sem a UI neo-brutalism. |
| c147b8bb | 0 | 1 | 1 | Cita que a pesquisa sobre UI apontou a thread de neobrutalism. É menção. |

### Q02

Consulta: brutalismp

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 1 | 0 | brutalismp aparece só como consulta de teste. É vocabulário em comum. |

### Q03

Consulta: brutalism

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 1 | 0 | brutalism aparece só como consulta de teste. É vocabulário em comum. |

### Q08

Consulta: interface token rotation security

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 1 | 0 | Não trata de rotação de token. As ocorrências de token se referem ao tokenizer. |

### C2

Consulta: agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 734062bc | 0 | 1 | 0 | Trata do inventário de agentes em RULES.md. Não fala do suporte local criado. |
| d34b7486 | 0 | 1 | 0 | Reestrutura INSTRUCTIONS e RULES para o bootstrap. Não é o suporte local nem cita artefatos. Recebe o mesmo grau do 9P, que tem a mesma consulta. |

### C5

Consulta: brutalismp

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 1 | 0 | brutalismp aparece só como consulta de teste. É vocabulário em comum. |

### A01

Consulta: o chat da thread virou um diário de cada passo do agente, como separar a coordenação interna do que vale registrar?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 6143a9b5 | 0 | 2 | 1 | Trata do valor informacional das mensagens, não da separação entre coordenação interna e registro. Recebe o mesmo grau da 92413b81 neste caso. |

### A05

Consulta: comentei pela interface e o arquivo de regras ganhou uma entrada que ninguém pediu

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 6143a9b5 | 0 | 2 | 1 | A correção de ensureSectionLines trata de outro mecanismo que acrescenta linhas ao arquivo de regras. É menção a um sintoma parecido, sem a causa pedida. As fontes, 274b7c9a e 734062bc, já têm 3. |

### A07

Consulta: tirar a dependência de fornecedor de modelo e de ids fixos de perfis no fluxo de agentes

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 734062bc | 0 | 1 | 1 | Cita o agent_list para descobrir ids válidos. É menção, sem a remoção de ids fixos. |

### A12

Consulta: ao digitar arroba no campo de mensagem eu queria sugestões de agentes e threads

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 9e4e6ab7 | 0 | 1 | 0 | Trata do contrato do agent_register. Não fala de autocomplete por arroba. |

### A13

Consulta: vetores comprimidos para recuperar o histórico documentado gastando menos tokens

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| b64903bd | 0 | 2 | 1 | Cita embeddings e índice estruturado como infraestrutura possível. É menção, sem vetores comprimidos. Corrige também o grau de a. |

### A14

Consulta: agente novo chamava as ferramentas sem ter lido as instruções do workspace antes

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 2 | 1 | Cita que o bootstrap independente antes da edição foi preservado. É menção, sem o gate das ferramentas. |
| 184fd8bb | 1 | 2 | 2 | A skill marc-ops guia os agentes pelo bootstrap e pelas regras. É parte substantiva, mas o gate é a d14fb686. Recebe o mesmo grau da 58458a82. |

### A16

Consulta: a pesquisa por um termo que existe nos resumos voltava vazia com a configuração padrão

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| b64903bd | 0 | 1 | 1 | É a busca da UI onde o problema aparece, com o estado sem resultados. É menção ao assunto, sem a causa. |

### A22

Consulta: o que faz uma thread aparecer como fechada e como ela volta a ficar aberta

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| b64903bd | 0 | 1 | 1 | Cita a semântica visual de thread encerrada no resultado da busca. É menção, sem o mecanismo de fechar e reabrir. |

### A25

Consulta: consultar decisões antigas do projeto por pergunta em vez de abrir thread por thread

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 1 | 2 | 1 | É um estudo de modelos da busca, sem nada sobre consultar decisões por pergunta. |
| 834716ba | 1 | 3 | 2 | A evolução da busca contextual por summaries é parte substantiva da resposta. As threads que respondem, 0e4dbaac e b64903bd, já têm 3. |
| f04c7cae | 1 | 2 | 2 | Define o uso de memory_recall seguido de aprofundamento com escopo. É parte substantiva, não a fonte principal. |

### A26

Consulta: preciso achar o trecho exato de uma discussão dentro do chat de uma thread já encerrada

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 4f477d9f | 1 | 2 | 2 | A camada 2 acrescenta CHAT.md ao corpus da busca. É parte substantiva; a fonte principal é a f04c7cae. |

### A27

Consulta: converter o topo dos resumos antigos para o formato novo mostrando o resultado antes de aplicar

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| ce47939a | 0 | 1 | 0 | Cria o encerramento por SUMMARY. Não trata da migração dos cabeçalhos. |

### A31

Consulta: transformar texto longo em anexo markdown direto pelo painel da interface

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 604ad99b | 0 | 1 | 0 | Só cita o alinhamento das modais de artifact. É vocabulário em comum. |
| 024e05b1 | 1 | 2 | 1 | Cita que a criação de artifacts abre em sheet. É menção. |

### A35

Consulta: avaliar fronteiras entre core, daemon, MCP e interface e arquivos grandes demais

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| e54fb794 | 0 | 1 | 0 | Cria guias de documentação, sem avaliação de fronteiras ou de arquivos grandes. |

### A38

Consulta: o agente não tinha como gravar o resumo final e fechar a conversa pelo MCP

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 94409c8c | 1 | 2 | 1 | Cita de passagem a escrita dos sumários executivos. Não dá ao agente um meio de gravar o resumo. |

### A39

Consulta: mensagens das threads amontoadas em parágrafo, preferir itens curtos por categoria

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Trata de quando registrar, não do formato em itens curtos. |

### A40

Consulta: os avisos flutuantes da interface destoam do resto do visual

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3c4261b4 | 1 | 0 | 1 | Cita o toast transitório de feedback de cópia. É menção ao componente, sem o problema visual. |

### T01

Consulta: bootstarp obrigatorio antes das ferramentas

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3b4a8787 | 0 | 1 | 1 | Cita que o bootstrap foi preservado. É menção. |

### T04

Consulta: leitura incremental por curosr

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 2 | 3 | 2 | Registra a semântica do cursor como decisão. É parte substantiva; a fonte principal é a 3c45fa83, já com 3. |

### O03

Consulta: mensagem longa vira artifact pela ui

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 604ad99b | 0 | 1 | 0 | Mesmo motivo do A31. |
