# Consenso dos julgamentos da E0

## Resumo

Registro da adjudicação conjunta das divergências entre os dois avaliadores independentes da E0:

- avaliador a: marc://@claude-software-architect;
- avaliador b: marc://@codex-software-architect.

O consenso não é uma nova avaliação independente. O kappa da primeira rodada permanece como a medida de concordância da escala e entra no relatório da E0 sem alteração.

## Primeira rodada

| Corpus | Pares | Concordantes | Kappa quadrático | Divergências |
| --- | --- | --- | --- | --- |
| ledgerline-en | 377 | 302 | 0,683 | 75 |
| marc | 1.215 | 733 | 0,395 | 482 |

O kappa do marc ficou abaixo do limite de 0,6 do plano. Em 556 das 557 divergências, o grau de b era maior que o de a. As escalas erravam em sentidos opostos: a julgou pelo trecho da planilha e subestimou fontes secundárias; b atribuiu grau a vocabulário em comum.

## Escala revisada

Proposta em msg_937ed744b5924f9aae e confirmada em msg_f1c1ffab33d74ebbb4.

- **3:** lida sozinha, a thread responde à consulta, porque registra a decisão, a regra ou o resultado pedido. Não é preciso que a consulta seja o tema principal da thread.
- **2:** traz parte substantiva da resposta, como decisão relacionada, versão anterior ou restrição, mas não basta sozinha. Compartilhar ferramenta, tecnologia ou área do produto não basta.
- **1:** trata do mesmo assunto ou o cita, sem nada que entraria na resposta.
- **0:** sem relação, ou só com vocabulário em comum.

O julgamento usa o SUMMARY.md inteiro e recorre ao CHAT.md quando ele não basta.

## Procedimento

1. O avaliador a redigiu um grau e uma justificativa para cada um dos 557 pares divergentes.
2. O avaliador b revisou cada par e contestou 5: L02 e L06 no ledgerline-en; A34 e dois pares de A35 no marc.
3. O avaliador a aceitou as cinco contestações, pela escala revisada.
4. O consenso foi gravado nos datasets com merge-judgments --consensus.

Não se usou média dos graus nem desempenho das variantes para decidir nenhuma nota. Nenhuma métrica das variantes foi calculada antes do fechamento do consenso.

## Resultado

| Corpus | Pares adjudicados | Grau final de a | Grau final de b | Outro grau | Contestados |
| --- | --- | --- | --- | --- | --- |
| ledgerline-en | 75 | 60 | 13 | 2 | 2 |
| marc | 482 | 360 | 57 | 65 | 3 |

**Caso 9I:** as duas threads que trocaram de posição no replay (aa4908aa e c147b8bb) ficaram com grau 1. Com o mesmo grau, a inversão não altera nenhuma métrica. Isso atende à condição de impacto do CA1b.

## Pares adjudicados

Colunas: a thread aparece pelo sufixo de 8 caracteres do id; a e b são os graus da primeira rodada; Final é o grau gravado no dataset. Pares marcados como "(contestado)" tiveram o grau proposto por b aceito.

## Corpus ledgerline-en

### L01

Consulta: linking bank accounts without keeping credentials in the ledger

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| e2a6c590 | 0 | 1 | 0 | Sincroniza contas ligadas; nada sobre credenciais. |

### L02

Consulta: I want to keep a copy of my data on a USB disk without exposing the key

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 41c7f0ae | 1 | 2 | 2 (contestado) | Contestado por b e aceito por a: SUMMARY/Design e Decisions explica que a chave fica no arquivo de settings, protegido apenas por permissões do SO e tratado como sensível. Isso fornece uma restrição substantiva para copiar os dados sem expor a chave, embora não descreva o comando de exportação. É parte da resposta, não mera menção ao tema. |
| e94b1d26 | 0 | 1 | 0 | "Backup" ali é a cópia do JSON na migração; só vocabulário. |

### L03

Consulta: should third parties be able to ship their own bank connectors yet

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0b7d6e31 | 0 | 1 | 0 | Usa conectores; nada sobre conectores de terceiros. |
| 9e1c6b38 | 0 | 1 | 0 | "Third-party script" é cliente da API, não conector; só vocabulário. |
| 4b3a9f20 | 0 | 1 | 0 | Timeouts de conector; nada sobre distribuição externa. |
| e2a6c590 | 0 | 1 | 0 | Agendamento; sem relação com a pergunta. |

### L04

Consulta: SQLite read latency with half a million transactions

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 1d8f2a73 | 0 | 1 | 0 | Memória da importação; nada sobre latência de leitura. |
| 6a0b7f15 | 0 | 1 | 0 | Lista paginada na UI; não trata do SQLite nem de latência. |
| b4e8c293 | 0 | 1 | 0 | Lentidão de navegação na UI, não leitura do armazenamento. |

### L05

Consulta: preview which category a rule would give before running a real import

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0d4f9b13 | 1 | 2 | 1 | Mesmo motor de regras; não trata de prévia. |
| 5c8e1a77 | 1 | 2 | 1 | Mesmo motor de regras; não trata de prévia. |
| 3a1f0c21 | 0 | 1 | 0 | Importação CSV; nada sobre categoria. |
| 7b92e4d0 | 0 | 1 | 0 | Confirmação de mapeamento de colunas; não é prévia de categoria. |

### L06

Consulta: how does the categorizer decide when two patterns match the same purchase

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 6b5c9e04 | 1 | 2 | 2 (contestado) | Contestado por b e aceito por a: SUMMARY/Behavior afirma que o resultado usa a primeira regra que corresponde à transação, e Decisions confirma que é o mesmo categorizador da importação. Isso fornece parte substantiva do critério de escolha, embora não explique a ordenação por prioridade. Não é uma citação incidental do motor. |

### L07

Consulta: regex based categories matched against transaction descriptions

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 6b5c9e04 | 1 | 2 | 1 | Testa regras; não descreve o casamento por regex. |
| f16a2d09 | 0 | 1 | 0 | "Normalized description" é só vocabulário. |
| 6a0b7f15 | 0 | 1 | 0 | Mostra a coluna categoria; sem relação. |
| b4e8c293 | 0 | 1 | 0 | Sem relação. |

### L08

Consulta: what exit status should scripts expect when the daemon cannot be reached

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| a85f3e27 | 0 | 1 | 0 | Sem código de saída nem daemon inacessível. |
| e94b1d26 | 0 | 1 | 0 | Arquivo quebrado impede o início; não trata de status de saída. |

### L09

Consulta: importing semicolon separated bank statements

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| f16a2d09 | 0 | 1 | 0 | Sem relação com separador. |
| 1d8f2a73 | 1 | 2 | 1 | Trata de importação CSV, sem nada sobre separador. |
| 2f5d8a6c | 0 | 1 | 0 | OFX, formato explicitamente fora do CSV. |
| c71e0b94 | 0 | 1 | 0 | OFX; sem relação com separador. |

### L10

Consulta: my bank prints a heading row before the column names and the import breaks

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3a1f0c21 | 1 | 2 | 2 | Versão anterior: colunas fixas e detecção de cabeçalho adiada, o que explica a quebra. |

### L11

Consulta: daemon should refuse to boot if storage is full or the db is held by another process

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| a85f3e27 | 0 | 1 | 0 | "Refuses while a sync holds a lock" é outro lock; só vocabulário. |
| e2a6c590 | 0 | 1 | 0 | Lock por conta, não do banco nem da inicialização. |

### L12

Consulta: the balance chart takes forever to draw for an account opened a decade ago

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 6a0b7f15 | 0 | 1 | 0 | Lista, não gráfico de saldo. |

### L13

Consulta: detecting duplicate transactions across overlapping statements

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| e2a6c590 | 0 | 1 | 0 | Sem relação com duplicatas. |

### L14

Consulta: where was the database encryption key kept in the first design

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| c39e5d62 | 2 | 3 | 3 | Afirma que substitui o design de chave no arquivo de settings; responde sozinha onde ficava. |

### L15

Consulta: if someone copies my laptop files can they open the ledger

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3e0a7d92 | 1 | 2 | 2 | Decisão relacionada: o arquivo exportado não revela a chave sem a passphrase. |
| 41c7f0ae | 2 | 3 | 2 | Versão anterior: a cópia do arquivo de settings abria o banco. |
| a2c8f750 | 0 | 1 | 0 | Logs; não trata de abrir o ledger. |
| e94b1d26 | 0 | 1 | 0 | Sem relação. |

### L16

Consulta: give every script a separate credential limited to what it needs

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| d2f7a041 | 1 | 2 | 2 | Versão anterior: token único e a mudança prevista para permissões menores. |

### L17

Consulta: single shared token for the local api

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 8d4b1f67 | 0 | 1 | 0 | Formato de erro; nada sobre token. |

### L18

Consulta: importing a huge statement freezes the interface and eats all memory

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 7b92e4d0 | 0 | 1 | 0 | Detecção de cabeçalho; nada sobre memória ou travamento. |

### L19

Consulta: how often is the data encryption key replaced and how is it done

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3e0a7d92 | 0 | 1 | 0 | Chave embrulhada no arquivo; nada sobre troca da chave. |
| d2f7a041 | 1 | 0 | 0 | Rotação do token da API, não da chave de dados; só vocabulário. |

### L20

Consulta: consistent json errors from the local api

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| d2f7a041 | 0 | 1 | 0 | Mesma API, sem nada sobre erros. |
| a2c8f750 | 0 | 2 | 0 | Filtro de logs; não trata do formato de erro. |
| 6a0b7f15 | 0 | 1 | 0 | Sem relação. |

### L21

Consulta: a support bundle showed my complete bank account number in the logs

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0b7d6e31 | 0 | 1 | 0 | Sem relação com logs. |

### L22

Consulta: what happens to amounts with more decimals than the currency supports

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3a1f0c21 | 1 | 2 | 2 | Conversão para unidades menores inteiras, parte do tratamento do valor. |
| 7b92e4d0 | 0 | 2 | 1 | Só reafirma o tratamento inteiro de valores da v1. |
| f16a2d09 | 0 | 1 | 0 | "Minor units" no fingerprint; só vocabulário. |

### L23

Consulta: the statement file belongs to a different account than the one I linked

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0b7d6e31 | 1 | 2 | 1 | Trata da conta ligada, sem o caso de divergência. |
| 3a1f0c21 | 0 | 1 | 0 | Sem verificação de conta. |
| 7b92e4d0 | 0 | 1 | 0 | Sem verificação de conta. |
| f16a2d09 | 0 | 1 | 0 | Conta como parte do fingerprint; não trata de divergência. |
| 2f5d8a6c | 0 | 1 | 0 | Moeda; sem relação. |

### L24

Consulta: how many retries before a bank connection is shown as stale

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 88f1d2b4 | 1 | 2 | 1 | Trata de falhas repetidas, mas não do estado stale nem do limite de tentativas. |
| e2a6c590 | 0 | 2 | 1 | Diz que a v1 não refaz tentativas; não responde quando a conexão fica stale. |

### L25

Consulta: switch settings from json to toml

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3e0a7d92 | 0 | 1 | 0 | Inclui o arquivo de settings; nada sobre o formato. |
| 88f1d2b4 | 0 | 1 | 0 | "Settings of the account"; só vocabulário. |
| e2a6c590 | 0 | 1 | 0 | Sem relação. |
| 7f3a0c48 | 0 | 1 | 0 | Grava no arquivo de settings; não trata da migração. |

### L27

Consulta: can two refresh cycles modify one account simultaneously

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0b7d6e31 | 0 | 1 | 0 | Sem relação com concorrência. |
| 5e9c3b84 | 0 | 1 | 0 | Retomada do job; não trata de ciclos concorrentes. |
| f16a2d09 | 0 | 1 | 0 | Syncs repetidos geram duplicatas; não trata de escrita simultânea. |
| 88f1d2b4 | 2 | 3 | 3 | Afirma que dois ciclos nunca escrevem a mesma conta, pelo lock por conta. |

### L28

Consulta: the theme goes back to light every time I restart

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| e94b1d26 | 0 | 1 | 0 | Sem relação com o tema da UI. |
| b4e8c293 | 0 | 1 | 0 | Sem relação. |

### L29

Consulta: transactions list with fifty rows per page

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| e07d5c18 | 0 | 1 | 0 | Consultas de lista no benchmark; não trata de páginas. |

### L30

Consulta: render only visible rows so long histories scroll smoothly

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 5e9c3b84 | 0 | 1 | 0 | Histórico longo do gráfico; outra função. |
| 1d8f2a73 | 0 | 1 | 0 | Sem relação com renderização. |
| 6a0b7f15 | 1 | 2 | 2 | Versão anterior, substituída pela lista contínua. |

### LT01

Consulta: duplicte transaction fingerprint

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| e2a6c590 | 0 | 1 | 0 | Sem relação. |

### LT02

Consulta: exponental backoff for failing banks

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 4b3a9f20 | 1 | 2 | 1 | Política de novas tentativas sem descrever backoff. |
| e2a6c590 | 1 | 2 | 2 | Versão anterior, substituída pelo backoff exponencial. |

### LT03

Consulta: pasphrase derived encryption key

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 3e0a7d92 | 1 | 2 | 1 | Cita a chave embrulhada pela passphrase, sem a derivação. |
| 41c7f0ae | 1 | 2 | 2 | Versão anterior, que encaminha a derivação por passphrase. |
| a85f3e27 | 0 | 1 | 0 | Rotação de chave sem passphrase. |

### LT04

Consulta: redaction of acount numbers in logs

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 8d4b1f67 | 1 | 2 | 2 | Decisão relacionada: a mensagem de erro nunca inclui número de conta. |


## Corpus marc

### 1D

Consulta: separar INSTRUCTIONS.md gerenciado do RULES.md customizavel no bootstrap

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 58458a82 | 1 | 2 | 1 | Corrige o bootstrap repetido; cita INSTRUCTIONS e RULES sem tratar da separação. |
| dd4a5684 | 0 | 1 | 0 | Só alinha Custom Rules; sem relação com a separação. |
| 92413b81 | 0 | 1 | 0 | Fluxo do loop; a parte gerenciada preservada é menção lateral. |
| 094d8894 | 1 | 2 | 1 | Autoridade das regras e bootstrap distinto de recomendações, sem a separação de arquivos. |
| 054fd58b | 0 | 1 | 0 | Validação proporcional; sem relação. |

### 1I

Consulta: onde fica o protocolo operacional estavel e onde ficam as regras comportamentais do workspace?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 58458a82 | 1 | 2 | 1 | Diz que RULES.md é contrato do bootstrap, sem dizer onde fica o protocolo. |
| 094d8894 | 1 | 2 | 1 | Trata de autoridade das regras, não da divisão protocolo e regras. |

### 1P

Consulta: agentes estao editando o arquivo de instrucoes geradas e misturando custom rules, qual decisao historica evita isso?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 9e4e6ab7 | 0 | 1 | 0 | Contrato do agent_register; sem relação. |
| 094d8894 | 1 | 2 | 1 | Mesmo assunto de instruções, sem a decisão que impede editar o gerado. |
| 894072be | 1 | 2 | 1 | Reformata Custom Rules preservando seções gerenciadas; não é a decisão pedida. |

### 2D

Consulta: rebuild incremental da memory com batches limitados

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 774d1e99 | 1 | 2 | 1 | Lock global de rebuild; não trata de incremental nem de batches. |
| 834716ba | 1 | 2 | 1 | Cita batches e caminhos incremental/full de passagem. |
| 174c48b6 | 0 | 1 | 0 | Indicador visual; sem relação. |
| d540c6b4 | 0 | 1 | 0 | Ciclo de vida do provider de recall; sem relação. |
| 2f441fa7 | 1 | 2 | 1 | Cita o rebuild incremental elegível após gravar summary. |

### 2I

Consulta: como evitar reprocessar summaries inalterados e o pico de RAM do ONNX?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 94409c8c | 1 | 2 | 1 | Bug do rebuild incremental; não explica como evitar reprocesso nem o pico. |
| 0e4dbaac | 0 | 1 | 0 | Memory v1; sem relação. |
| 774d1e99 | 0 | 2 | 1 | Evita rebuild concorrente; não trata de summaries inalterados nem de RAM. |
| 834716ba | 1 | 2 | 1 | Cita batches limitados de passagem. |
| d540c6b4 | 1 | 2 | 1 | Cita retenção de memória nativa do ONNX no recall, não no rebuild. |
| 2f441fa7 | 0 | 2 | 1 | Cita rebuild incremental elegível, sem o mecanismo. |

### 2P

Consulta: a reconstrucao tentou alocar 2,67 GiB; qual solucao foi adotada mantendo o full explicito?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 1 | 0 | Estudo de modelos; sem relação. |
| 774d1e99 | 0 | 1 | 0 | Coordenação de processos; não trata da alocação. |
| 834716ba | 1 | 2 | 1 | Cita batches e full de passagem. |
| 3c4dda95 | 0 | 1 | 0 | Reconciliação incremental citada só como passo operacional. |

### 3D

Consulta: indicador visual de memory no card da workspace

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0e4dbaac | 0 | 1 | 1 | Cita a abertura da oportunidade do indicador. |
| 774d1e99 | 1 | 2 | 2 | Decisão relacionada: estado rebuilding exibido com DatabaseZap na UI. |

### 3I

Consulta: qual icone mostra indice pronto, stale, erro ou rebuild?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 94409c8c | 0 | 1 | 0 | Sem ícones. |
| 774d1e99 | 1 | 2 | 2 | Responde a parte do rebuild: DatabaseZap para rebuilding. |
| 3e422682 | 0 | 1 | 0 | Só cita estado visual no backlog. |
| 6340b186 | 1 | 2 | 1 | Badges de índice de threads, não ícones da memory. |

### 3P

Consulta: preciso enxergar no card se a base de conhecimento esta saudavel sem abrir as configuracoes

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0e4dbaac | 0 | 1 | 1 | Cita a oportunidade do indicador. |
| e4478bac | 0 | 1 | 0 | Busca; sem relação. |
| 774d1e99 | 0 | 2 | 2 | Decisão relacionada: o estado rebuilding chega ao card. |
| b64903bd | 1 | 2 | 1 | Busca disponível conforme o estado da memory; não é o card. |
| d540c6b4 | 0 | 1 | 0 | Sem relação. |

### 4D

Consulta: esquemas de visualizacao das colunas da UI para Threads, Marckers e arquivo

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2341bc9f | 0 | 2 | 1 | Só registra a abertura da oportunidade 604ad99b. |
| 0845d0bb | 0 | 1 | 0 | Criação de threads; sem relação. |
| ce47939a | 1 | 2 | 1 | Seção Closed na lista; não trata dos modos das colunas. |
| 024e05b1 | 1 | 2 | 1 | Estilo visual; menção à UI. |
| b64903bd | 1 | 2 | 1 | Modo search na coluna central, outro modo; não responde. |
| 3c4261b4 | 0 | 2 | 0 | Referências; sem relação com colunas. |
| c14150b8 | 0 | 1 | 0 | Sem relação. |
| c147b8bb | 1 | 2 | 1 | Cita threads de colunas na experiência de uso. |

### 4I

Consulta: como funcionam os modos exclusivos e a rolagem propria nas tres colunas?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2341bc9f | 0 | 2 | 1 | Footer da terceira coluna; não trata de modos nem rolagem. |
| b64903bd | 1 | 2 | 1 | Modo search na coluna central; não explica os modos exclusivos. |
| c04986bd | 0 | 1 | 0 | Modal; sem relação. |
| 594973bb | 0 | 1 | 0 | Sem relação. |

### 4P

Consulta: ao abrir agentes ou arquivo, somente o conteudo ativo e o botao de fechar devem permanecer na coluna central

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2341bc9f | 0 | 1 | 0 | Sem relação. |
| c04986bd | 0 | 1 | 0 | Sem relação. |

### 5D

Consulta: gramatica marc:// para referencias internas de artifacts e mensagens

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 2 | 0 | Sem gramática de referências. |
| 2341bc9f | 2 | 3 | 2 | Descreve gatilhos e inserção canônica marc://, sem a gramática completa de artifacts. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 024e05b1 | 0 | 2 | 0 | Só "cópia de referência"; sem gramática. |
| 184fd8bb | 1 | 2 | 1 | Orienta usar referências canônicas, sem definir a gramática. |
| 3c4dda95 | 0 | 2 | 0 | Só usa links marc:// no próprio texto. |
| c04986bd | 0 | 2 | 1 | Artifact ligado à mensagem, sem a gramática. |
| aa4908aa | 0 | 3 | 1 | Exemplo de referência: copia marc:// de thread e agente, sem definir a gramática. |
| 2f441fa7 | 0 | 2 | 0 | Só usa links marc:// no próprio texto. |
| 594973bb | 0 | 1 | 0 | Sem relação. |

### 5I

Consulta: como navegar para um artifact vinculado a uma mensagem de outra thread?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 2341bc9f | 2 | 3 | 2 | Referência cross-thread a mensagens e artifacts no autocomplete, não navegação. |
| f04c7cae | 0 | 1 | 0 | Sem relação. |
| c04986bd | 1 | 2 | 1 | Anexar artifact à mensagem; não trata de navegação. |
| 2f441fa7 | 0 | 1 | 0 | Só usa links de artifact no próprio texto. |
| c147b8bb | 0 | 2 | 1 | Cita "Artifact vinculado à Message" na síntese de uso. |

### 5P

Consulta: quero copiar um endereco canonico que abra agente, thread, mensagem ou anexo dentro da UI

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 2341bc9f | 2 | 3 | 2 | Insere referências canônicas; não trata de copiar. |
| ce47939a | 0 | 1 | 0 | Sem relação. |
| 604ad99b | 0 | 1 | 0 | Sem relação. |
| c04986bd | 0 | 1 | 0 | Sem relação. |
| aa4908aa | 0 | 2 | 2 | Parte substantiva: a linha do header copia marc://$threadId e marc://@agentId. |

### 6D

Consulta: remover aliases legados do MCP e manter nomes canonicos como thread_create

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 1 | 0 | Sem relação com aliases. |
| 184fd8bb | 0 | 1 | 0 | Sem relação. |
| 6340b186 | 0 | 1 | 0 | Sem relação. |

### 6I

Consulta: por que create_thread e read_thread deixaram de ser expostos?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 0 | 1 | 0 | Só a contagem de ferramentas. |

### 6P

Consulta: a lista de ferramentas esta duplicada e gasta contexto com comandos equivalentes

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2f441fa7 | 0 | 1 | 0 | Só a contagem de ferramentas. |

### 7D

Consulta: tuning de recall e ranking da memory para token da interface

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 1 | 2 | 1 | Estudo de reranking, sem o caso do token. |
| 0e4dbaac | 1 | 2 | 2 | Origem do caso guia "rotação de token da interface" e da oportunidade de tuning. |
| 834716ba | 1 | 2 | 2 | Evolução posterior do recall e do ranking da memory. |
| 174c48b6 | 1 | 0 | 1 | Cita que o tuning segue em thread separada. |
| b64903bd | 0 | 1 | 1 | Cita que a calibragem pode ser revisitada. |
| d540c6b4 | 0 | 1 | 0 | Custo do recall, não ranking. |

### 7I

Consulta: como fazer uma decisao historica especifica superar threads genericas semanticamente proximas?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 1 | 2 | 1 | Separa alvos descartados de alvos mal ordenados, sem a solução. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 0e4dbaac | 0 | 2 | 0 | "Decisão histórica" é só vocabulário. |
| 2f441fa7 | 0 | 1 | 0 | Sem relação. |

### 7P

Consulta: a busca acha a decisao correta, mas coloca resultados genericos de UI antes dela

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 1 | 2 | 1 | Estudos de ordenação, sem a solução do caso. |
| 4f477d9f | 0 | 2 | 1 | Lista ordenação como controle, sem a solução. |
| e4478bac | 1 | 2 | 1 | Recall lexical; não trata da ordem. |

### 8D

Consulta: status health e rebuild do thread-index em background

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0e4dbaac | 0 | 1 | 1 | Cita health da memory no workspace_status. |
| 0845d0bb | 0 | 2 | 1 | Cita recuperação agendada do índice derivado. |
| 3e422682 | 0 | 1 | 0 | Rebuild da memory, não do thread-index. |
| 2f441fa7 | 0 | 2 | 1 | Cita reconciliação de projeções após o lock. |

### 8I

Consulta: como a UI serve um snapshot stale enquanto o indice reconstrói?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0e4dbaac | 0 | 1 | 0 | Sem relação. |
| 0845d0bb | 1 | 2 | 2 | Decisão relacionada: a UI retém a entrada enquanto o índice está defasado. |
| 834716ba | 0 | 1 | 0 | Snapshots de busca, não do índice. |
| ce47939a | 1 | 2 | 1 | Cria o índice, sem servir snapshot stale. |
| 174c48b6 | 0 | 1 | 0 | Sem relação. |
| b64903bd | 0 | 1 | 0 | Sem relação. |
| 3e422682 | 0 | 1 | 0 | Sem relação. |

### 8P

Consulta: a listagem nao pode travar durante uma reconstrucao pesada e ainda precisa indicar degradacao

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 9e4e6ab7 | 0 | 1 | 0 | Sem relação. |
| 0845d0bb | 0 | 2 | 1 | Falha do índice preserva o sucesso; não trata de travar a listagem. |
| ce47939a | 1 | 2 | 1 | Cria o índice, sem degradação. |
| 3e422682 | 0 | 1 | 0 | Estado degraded da memory, não da listagem. |
| 934c4896 | 0 | 1 | 0 | Sem relação. |

### 9D

Consulta: workspace_audit para Custom Rules com Trigger, Do instead, Evidence e Severity

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 274b7c9a | 0 | 1 | 0 | Fronteira de Custom Rules, sem a auditoria. |
| 72461180 | 1 | 2 | 1 | Mesma ferramenta, outra checagem. |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 2 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 054fd58b | 0 | 1 | 0 | Sem relação. |
| 894072be | 2 | 3 | 2 | Aplica o formato Trigger/Do instead/Evidence/Severity e roda a auditoria de rules. |

### 9I

Consulta: qual ferramenta verifica referencias, artifacts, mensagens e regras antes de fechar uma thread?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 92413b81 | 0 | 1 | 1 | Cita auditorias de mensagens no encerramento. |
| 094d8894 | 0 | 1 | 1 | Cita auditoria estrutural de mensagens. |
| 5845b8a1 | 0 | 1 | 1 | Cita auditorias artifacts/messages no encerramento. |
| 0e4dbaac | 0 | 1 | 1 | Cita workspace_audit preflight. |
| 0845d0bb | 0 | 1 | 1 | Cita auditorias de artifacts, messages e references no encerramento. |
| aa4908aa | 0 | 1 | 1 | Cita workspace_audit nos checkpoints. |
| 3c4261b4 | 0 | 1 | 0 | Não cita auditoria. |
| 3b4a8787 | 0 | 1 | 1 | Cita auditorias estruturais de artifacts e messages. |
| 2f441fa7 | 0 | 1 | 1 | Cita a auditoria de encerramento messages, artifacts e references. |
| c147b8bb | 0 | 1 | 1 | Cita workspace_audit preflight antes do encerramento. |
| 594973bb | 0 | 1 | 1 | Cita auditoria de mensagens antes do resumo. |

### 9P

Consulta: agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 9e4e6ab7 | 0 | 1 | 0 | Sem relação. |
| 58458a82 | 1 | 2 | 1 | Ajusta a skill para bootstrap, não para regras e artifacts. |
| 274b7c9a | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 1 | 2 | 1 | Alinhamento do harness, sem o suporte criado. |
| 054fd58b | 0 | 1 | 0 | Sem relação. |
| d34b7486 | 0 | 2 | 1 | Reestrutura INSTRUCTIONS e RULES; não é o suporte pedido. |
| 894072be | 1 | 2 | 1 | Continuação da auditoria, sem criar suporte. |

### 10D

Consulta: ordenar threads mais novas no topo por closedAt e createdAt

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2341bc9f | 1 | 3 | 3 | Registra a regra exata: abertas por createdAt e fechadas por closedAt. |
| 0845d0bb | 0 | 1 | 0 | Sem relação. |
| 604ad99b | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 0 | 1 | 0 | Sem relação. |

### 10I

Consulta: qual regra ordena threads abertas e encerradas na listagem?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2341bc9f | 1 | 3 | 3 | Exemplo de referência confirmado: registra a regra exata. |
| ce47939a | 1 | 2 | 2 | Parte da regra: abertas na lista principal e fechadas na seção Closed. |
| 2f441fa7 | 0 | 1 | 0 | Sem relação. |

### 10P

Consulta: trabalhos recentes aparecem enterrados e a UI nao deveria reordenar no cliente

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0845d0bb | 0 | 1 | 0 | Sem relação. |

### Q01

Consulta: brutal

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 5845b8a1 | 0 | 1 | 0 | Sem relação com brutalism. |
| 834716ba | 0 | 1 | 1 | Cita a família brutalism na avaliação. |

### Q02

Consulta: brutalismp

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| aa4908aa | 0 | 2 | 1 | Exemplo de referência confirmado: Switch Neobrutalism incidental. |

### Q03

Consulta: brutalism

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| aa4908aa | 0 | 2 | 1 | Switch Neobrutalism incidental. |

### Q04

Consulta: interface com brutalism

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| aa4908aa | 0 | 2 | 1 | Switch Neobrutalism incidental. |

### Q05

Consulta: interace com brutalism

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| aa4908aa | 0 | 2 | 1 | Switch Neobrutalism incidental. |

### Q06

Consulta: toggle

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 1 | 0 | Sem toggle. |

### Q08

Consulta: interface token rotation security

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0845d0bb | 0 | 1 | 0 | Token exigido na criação; só vocabulário. |
| 834716ba | 0 | 1 | 0 | "Security/settings" é família de benchmark; só vocabulário. |

### Q09

Consulta: structured workspace settings json

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 2 | 1 | Cita JSON preservado como formato estruturado, sem settings. |
| e4478bac | 0 | 1 | 1 | Setting de workspace persistido, sem o JSON. |
| 834716ba | 0 | 1 | 0 | Sem relação. |

### Q10

Consulta: seguranca da rotacao de token da interface

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0845d0bb | 0 | 1 | 0 | Só vocabulário de token. |

### Q11

Consulta: seguranca da rotacao de toke da interface

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0845d0bb | 0 | 1 | 0 | Só vocabulário de token. |

### Q12

Consulta: structured worksapce settings json

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 2 | 1 | Cita JSON preservado como formato estruturado, sem settings. |
| e4478bac | 0 | 1 | 1 | Setting de workspace persistido, sem o JSON. |
| 834716ba | 0 | 1 | 0 | Sem relação. |

### C1

Consulta: como evitar reprocessar summaries inalterados e o pico de RAM do ONNX?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 94409c8c | 1 | 2 | 1 | Bug do rebuild incremental; não explica como evitar reprocesso nem o pico. |
| 0e4dbaac | 0 | 1 | 0 | Memory v1; sem relação. |
| 774d1e99 | 0 | 2 | 1 | Evita rebuild concorrente; não trata de summaries inalterados nem de RAM. |
| 834716ba | 1 | 2 | 1 | Cita batches limitados de passagem. |
| d540c6b4 | 1 | 2 | 1 | Cita retenção de memória nativa do ONNX no recall, não no rebuild. |
| 2f441fa7 | 0 | 2 | 1 | Cita rebuild incremental elegível, sem o mecanismo. |

### C2

Consulta: agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 9e4e6ab7 | 0 | 1 | 0 | Sem relação. |
| 58458a82 | 1 | 2 | 1 | Ajusta a skill para bootstrap, não para regras e artifacts. |
| 274b7c9a | 0 | 1 | 0 | Sem relação. |
| 72461180 | 1 | 2 | 2 | Ajusta a orientação de artifacts por metadata na skill e no RULES. |
| 094d8894 | 1 | 2 | 1 | Alinhamento do harness, sem o suporte criado. |
| 054fd58b | 0 | 1 | 0 | Sem relação. |
| 894072be | 1 | 2 | 1 | Continuação da auditoria, sem criar suporte. |

### C5

Consulta: brutalismp

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| aa4908aa | 0 | 2 | 1 | Switch Neobrutalism incidental. |

### C6

Consulta: interface com brutalism

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| aa4908aa | 0 | 2 | 1 | Switch Neobrutalism incidental. |

### A01

Consulta: o chat da thread virou um diário de cada passo do agente, como separar a coordenação interna do que vale registrar?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| dd4a5684 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 2 | 3 | 3 | Registra a regra: publicar decisões e resultados, sem threads ou artefatos como diário. |
| c04986bd | 0 | 2 | 1 | Mantém o CHAT.md limpo com artifacts; não trata de diário. |
| 3c4261b4 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 0 | 1 | 0 | Sem relação. |

### A02

Consulta: rebuild incremental quebrou com erro de tipo em campo nulo no lancedb

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0e4dbaac | 0 | 1 | 0 | Sem relação. |
| 774d1e99 | 0 | 1 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |
| aa4908aa | 0 | 1 | 0 | Sem relação. |
| 3e422682 | 1 | 2 | 1 | Cria o rebuild incremental, sem a falha de schema. |

### A03

Consulta: registrei um agente que já existia e a ferramenta respondeu como se fosse um cadastro novo

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 2 | 0 | Perfis no loop; sem o agent_register. |
| 274b7c9a | 0 | 2 | 0 | Inventário legado em RULES; não é a resposta do registro. |
| dd4a5684 | 0 | 2 | 0 | Responsabilidade de cadastro; sem a resposta da ferramenta. |
| 92413b81 | 0 | 2 | 1 | Cita agent_register retornando unchanged. |
| 094d8894 | 0 | 2 | 1 | Política de reutilização de perfis, sem a resposta da ferramenta. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 184fd8bb | 0 | 1 | 0 | Sem relação. |
| 734062bc | 1 | 2 | 1 | Mudança anterior do agent_register, sem a sinalização. |
| 034ad1bf | 0 | 1 | 0 | Sem relação. |

### A04

Consulta: agente refaz o bootstrap e uma investigação ampla mesmo já tendo contexto válido

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Bootstrap independente citado de passagem. |
| 9e4e6ab7 | 0 | 1 | 0 | Sem relação. |
| dd4a5684 | 0 | 1 | 0 | Sem relação. |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 2 | 3 | 2 | Decisão relacionada: não repetir bootstrap como ritual. |
| d14fb686 | 1 | 2 | 1 | Cria o bootstrap obrigatório, sem a repetição. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| d34b7486 | 1 | 2 | 1 | Prepara o bootstrap, sem a repetição. |

### A05

Consulta: comentei pela interface e o arquivo de regras ganhou uma entrada que ninguém pediu

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 9e4e6ab7 | 0 | 2 | 2 | Decisão relacionada: comentários da UI registram o perfil ui-user. |
| 094d8894 | 0 | 2 | 0 | Sem relação. |
| e54fb794 | 0 | 1 | 0 | Sem relação. |
| 054fd58b | 0 | 1 | 0 | Sem relação. |
| 734062bc | 2 | 3 | 3 | Remove o append de agentes no RULES.md pelo agent_register; responde sozinha. |
| d34b7486 | 0 | 1 | 0 | Sem relação. |

### A06

Consulta: a auditoria não acusa link marc escrito entre crases

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 2 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 184fd8bb | 1 | 2 | 1 | Cria a auditoria de referências, sem o caso de inline code. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |
| 894072be | 0 | 1 | 0 | Sem relação. |
| fe4a1cb2 | 1 | 2 | 1 | Cita a abertura da thread do bug, sem a correção. |

### A07

Consulta: tirar a dependência de fornecedor de modelo e de ids fixos de perfis no fluxo de agentes

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 2 | 1 | Cita o contrato agnóstico de fornecedor. |
| 9e4e6ab7 | 0 | 2 | 0 | Sem relação. |
| 58458a82 | 0 | 1 | 0 | Sem relação. |
| 274b7c9a | 0 | 2 | 0 | Sem relação. |
| 92413b81 | 1 | 2 | 2 | Versão anterior: a política com perfis e modelos fixos que a correção substitui. |
| 094d8894 | 1 | 3 | 2 | Parte da resposta: descoberta e reutilização de perfis sem catálogo fechado. |
| 0e4dbaac | 0 | 1 | 0 | Lock-in do provider de embeddings; só vocabulário. |
| 054fd58b | 0 | 2 | 0 | Sem relação. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |

### A08

Consulta: teste do daemon falha às vezes porque ele se desliga antes de responder à primeira requisição

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 39436d9c | 0 | 2 | 1 | Cria o auto-idle, sem a corrida. |
| d540c6b4 | 0 | 1 | 0 | Sem relação. |
| 594973bb | 2 | 3 | 3 | Diagnostica o timer de 20 ms que fecha o servidor antes da primeira conexão. |

### A09

Consulta: onde ficou documentado qual reasoning usar para principal e desenvolvedor e o limite de agentes em paralelo

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Sem relação. |
| 9e4e6ab7 | 0 | 1 | 0 | Sem relação. |
| dd4a5684 | 2 | 3 | 3 | Registra o reasoning mínimo e recomendado por papel e o teto de concorrência nos documentos. |
| 094d8894 | 0 | 2 | 0 | Sem relação. |
| 2f441fa7 | 0 | 1 | 0 | Sem relação. |

### A10

Consulta: as instruções de entrada e os helpers do MCP diziam coisas diferentes das regras do workspace

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 58458a82 | 1 | 3 | 2 | Decisão relacionada: alinha skill, recomendações, INSTRUCTIONS, RULES e helper. |
| 274b7c9a | 0 | 1 | 0 | Sem relação. |
| d14fb686 | 1 | 2 | 1 | Atualiza o helper para o bootstrap, sem a divergência. |
| 184fd8bb | 1 | 2 | 1 | Mesmo assunto de orientação, sem a divergência. |
| 734062bc | 0 | 1 | 0 | Sem relação. |
| d34b7486 | 1 | 3 | 2 | Decisão relacionada: separa INSTRUCTIONS e RULES, e o helper explica a separação. |
| 6143a9b5 | 1 | 2 | 1 | Ajusta o helper ao padrão de mensagens, sem a divergência. |
| 034ad1bf | 1 | 2 | 1 | Corrige orientação antiga de nome de ferramenta, sem a divergência geral. |

### A11

Consulta: mostrar a lista de atalhos num painel deslizante igual ao das configurações

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2341bc9f | 0 | 2 | 2 | Versão anterior: cria o modal central de atalhos. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 604ad99b | 0 | 2 | 1 | Só reafirma o modal central. |
| aa4908aa | 1 | 2 | 2 | Parte da resposta: o Sheet lateral das configurações a imitar. |
| fe4a1cb2 | 0 | 1 | 0 | Sem relação. |
| 594973bb | 0 | 1 | 0 | Integração com Sheet citada, sem atalhos. |

### A12

Consulta: ao digitar arroba no campo de mensagem eu queria sugestões de agentes e threads

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 604ad99b | 0 | 1 | 0 | Sem relação. |
| 734062bc | 1 | 2 | 1 | agent_list para IDs de menções, sem sugestão no composer. |
| 3c4261b4 | 1 | 2 | 2 | Decisão relacionada: a gramática de menções a agentes e threads. |

### A13

Consulta: vetores comprimidos para recuperar o histórico documentado gastando menos tokens

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 94409c8c | 0 | 1 | 0 | Schema de vetor; só vocabulário. |
| 57488bab | 0 | 2 | 1 | Modelos da memory, sem o índice comprimido. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| e4478bac | 0 | 1 | 0 | Profundidade da busca; sem relação. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 0 | 2 | 0 | Sem relação. |
| c147b8bb | 0 | 2 | 1 | Ranking da memory, sem o índice comprimido. |

### A14

Consulta: agente novo chamava as ferramentas sem ter lido as instruções do workspace antes

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 9e4e6ab7 | 0 | 1 | 0 | Inventário no bootstrap; sem relação. |
| 58458a82 | 1 | 3 | 2 | Decisão relacionada: bootstrap forte no início da sessão. |
| 72461180 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 3 | 1 | Bootstrap distinto de recomendações, sem o bloqueio das ferramentas. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| d34b7486 | 1 | 3 | 2 | Versão anterior: prepara workspace_bootstrap e bootstrapConfirmed. |
| 6143a9b5 | 0 | 2 | 1 | Orientação anterior de manutenção antes do trabalho, sem bloqueio. |
| 034ad1bf | 0 | 1 | 0 | Sem relação. |

### A15

Consulta: consultar uma thread informando só os oito caracteres finais do identificador

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| e54fb794 | 0 | 1 | 0 | Sem relação. |
| ce47939a | 0 | 1 | 0 | Sem relação. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 0 | 1 | 0 | Só cita a thread 1d4c0daa por outro motivo. |

### A16

Consulta: a pesquisa por um termo que existe nos resumos voltava vazia com a configuração padrão

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 94409c8c | 0 | 1 | 0 | Sem relação. |
| 57488bab | 0 | 3 | 1 | Cita alvos descartados pela elegibilidade, sem a configuração padrão. |
| 0e4dbaac | 0 | 2 | 0 | Sem relação. |
| 834716ba | 2 | 3 | 2 | Evolução posterior: candidatos lexicais consolidados. |
| f04c7cae | 0 | 1 | 0 | Sem relação. |
| df4229a9 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 0 | 1 | 0 | Sem relação. |

### A17

Consulta: impedir dois rebuilds da memória ao mesmo tempo vindos da UI, do MCP e da CLI

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 0e4dbaac | 0 | 1 | 0 | Sem relação. |
| 834716ba | 1 | 2 | 1 | Cita o lock compartilhado de manutenção. |
| 174c48b6 | 0 | 1 | 0 | Sem relação. |
| d540c6b4 | 1 | 2 | 1 | Serializa operações do provider, não rebuilds. |
| 3e422682 | 0 | 3 | 3 | Registra que rebuild manual e automático compartilham o lock global por workspace. |
| 3b4a8787 | 0 | 1 | 0 | Sem relação. |
| 6340b186 | 0 | 1 | 0 | Índice de threads; sem relação. |

### A18

Consulta: queria abrir uma conversa nova direto pelo navegador sem pedir para o agente

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 274b7c9a | 0 | 1 | 0 | Sem relação. |
| 2341bc9f | 0 | 1 | 0 | Sem relação. |

### A19

Consulta: rodar o daemon em segundo plano depois de instalar o pacote globalmente

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 504e1898 | 0 | 2 | 1 | Testa o auto-idle do modo detached, sem a instalação. |
| 674632b3 | 0 | 1 | 0 | Sem relação. |
| d540c6b4 | 0 | 2 | 0 | Sem relação. |
| 594973bb | 0 | 1 | 0 | Sem relação. |

### A20

Consulta: quem chega ao projeto pela primeira vez acha a página inicial do repositório confusa

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 58458a82 | 0 | 1 | 0 | Sem relação. |
| dd4a5684 | 0 | 1 | 0 | Sem relação. |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 674632b3 | 0 | 1 | 0 | Sem relação. |
| fe4a1cb2 | 0 | 1 | 0 | Atualização do README citada de passagem. |
| 3b4a8787 | 0 | 2 | 1 | Cita a atualização do README e do guia. |
| c14150b8 | 0 | 2 | 0 | Sem relação. |

### A21

Consulta: palavra literal pode trazer candidato mas sozinha não deveria virar resultado

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 3 | 2 | Decisão relacionada: regra do acerto literal mantida e restrição na admissão. |
| e4478bac | 2 | 3 | 3 | Registra que o match lexical só amplia candidatos e não vira resultado sozinho. |
| b64903bd | 0 | 1 | 0 | Sem relação. |
| c147b8bb | 1 | 2 | 2 | Versão anterior: boost por termos exatos no ranking híbrido. |

### A22

Consulta: o que faz uma thread aparecer como fechada e como ela volta a ficar aberta

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2341bc9f | 0 | 1 | 0 | Sem relação. |
| 1d4c0daa | 0 | 1 | 0 | Sem relação. |
| 0845d0bb | 0 | 1 | 0 | Sem relação. |
| 604ad99b | 0 | 1 | 0 | Sem relação. |
| f04c7cae | 0 | 1 | 0 | Sem relação. |
| 394a14b9 | 0 | 1 | 0 | Ordenação; sem relação. |
| 2f441fa7 | 1 | 2 | 2 | Parte da resposta: SUMMARY.md determina o fechamento. |

### A23

Consulta: mudança só no changelog disparou a bateria inteira de testes e build

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| dd4a5684 | 0 | 1 | 0 | Sem relação. |
| 3b4a8787 | 0 | 1 | 0 | Sem relação. |

### A24

Consulta: ler a conversa inteira de novo só para ver as mensagens novas gasta muito token

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 2 | 0 | Sem relação. |
| 57488bab | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 1 | 3 | 2 | Decisão relacionada: semântica do cursor e janela do thread_tail. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| c04986bd | 0 | 1 | 0 | Sem relação. |
| 034ad1bf | 0 | 1 | 0 | Sem relação. |

### A25

Consulta: consultar decisões antigas do projeto por pergunta em vez de abrir thread por thread

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 2341bc9f | 0 | 1 | 0 | Sem relação. |
| 0e4dbaac | 2 | 3 | 3 | Cria a memory consultável por agentes para decisões históricas. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |
| c147b8bb | 1 | 3 | 2 | Melhora o ranking da consulta e registra o uso como pesquisa. |

### A26

Consulta: preciso achar o trecho exato de uma discussão dentro do chat de uma thread já encerrada

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 2 | 2 | Decisão relacionada: o estudo de indexar CHAT.md junto com os summaries. |
| 2341bc9f | 0 | 2 | 0 | Sem relação. |
| 1d4c0daa | 0 | 1 | 0 | Sem relação. |
| ce47939a | 0 | 1 | 0 | Sem relação. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |
| 3c4261b4 | 0 | 2 | 0 | Navegação por referência, não busca de trecho. |
| 2f441fa7 | 0 | 1 | 0 | Sem relação. |

### A27

Consulta: converter o topo dos resumos antigos para o formato novo mostrando o resultado antes de aplicar

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 94409c8c | 0 | 1 | 0 | Sem relação. |
| 394a14b9 | 0 | 1 | 0 | Sem relação. |
| 3d40719f | 0 | 1 | 0 | Sem relação. |
| c14150b8 | 0 | 1 | 0 | Sem relação. |
| c147b8bb | 0 | 1 | 0 | Sem relação. |

### A28

Consulta: registrar agente estava jogando links no meio das regras customizadas

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Sem relação. |
| 9e4e6ab7 | 1 | 2 | 1 | Contrato do agent_register, sem RULES. |
| 274b7c9a | 2 | 3 | 3 | Registra que o inventário de agentes deixou de ser mantido no RULES.md. |
| dd4a5684 | 0 | 2 | 0 | Sem relação. |
| 094d8894 | 0 | 2 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 054fd58b | 0 | 1 | 0 | Sem relação. |
| 894072be | 0 | 1 | 0 | Sem relação. |

### A29

Consulta: dividir a folha de estilos da interface por área funcional

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 5845b8a1 | 0 | 1 | 0 | Sem relação. |
| 604ad99b | 0 | 1 | 0 | Sem relação. |
| 024e05b1 | 0 | 1 | 1 | Cita a oportunidade de organizar o CSS por domínio. |
| fe4a1cb2 | 0 | 1 | 0 | Reorganização de módulos de código, não de CSS. |

### A30

Consulta: daemon e servidor MCP gravando no mesmo arquivo de conversa ao mesmo tempo podem corromper o conteúdo?

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 274b7c9a | 0 | 1 | 0 | Sem relação. |
| 774d1e99 | 1 | 2 | 1 | Lock entre processos para rebuild, não para escrita em Markdown. |
| 39436d9c | 0 | 1 | 0 | Sem relação. |
| 674632b3 | 1 | 2 | 1 | Descreve os dois escritores, sem a coordenação. |
| 3b4a8787 | 0 | 1 | 0 | Sem relação. |
| 6340b186 | 0 | 2 | 0 | Sem relação. |
| 2f441fa7 | 1 | 2 | 2 | Parte da resposta: lock de thread e escrita atômica. |

### A31

Consulta: transformar texto longo em anexo markdown direto pelo painel da interface

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 5845b8a1 | 0 | 2 | 1 | Cita o sheet de criação de anexo. |
| 2341bc9f | 0 | 1 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| aa4908aa | 0 | 2 | 0 | "Padrão de artifacts" é só vocabulário. |
| 3c4261b4 | 1 | 2 | 1 | Visualização de artifact, não criação. |
| 034ad1bf | 0 | 1 | 0 | Sem relação. |

### A32

Consulta: cada busca seguida recarrega o modelo de embedding do zero

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 94409c8c | 0 | 1 | 0 | Sem relação. |
| 57488bab | 0 | 1 | 0 | Sem relação. |
| 0e4dbaac | 0 | 1 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 3e422682 | 0 | 1 | 0 | Descarte do provider no rebuild; sem relação. |
| b64903bd | 1 | 2 | 1 | Cita a investigação do provider aquecido. |

### A33

Consulta: melhorar a descrição da skill para ela ser acionada nos momentos certos

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 2 | 1 | Cita description e when_to_use preservados. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 6143a9b5 | 0 | 1 | 0 | Sem relação. |
| 184fd8bb | 1 | 3 | 2 | Versão anterior: cria a skill com ativação em toda sessão e when_to_use. |

### A34

Consulta: a auditoria reclama que as regras livres não seguem o formato com gatilho e evidência

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Sem relação. |
| 274b7c9a | 0 | 1 | 0 | Sem relação. |
| dd4a5684 | 0 | 1 | 0 | Sem relação. |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 054fd58b | 0 | 1 | 0 | Sem relação. |
| 184fd8bb | 2 | 3 | 3 (contestado) | Contestado por b e aceito por a: SUMMARY/Completed e Notes responde ao aviso descrito na consulta. Explica o formato Trigger, Do instead, Evidence e Severity, a compatibilidade das regras livres e por que os avisos continuam esperados até a reformatação. Lida isoladamente, a fonte esclarece a reclamação da auditoria, sem depender da thread de reformatação. |

### A35

Consulta: avaliar fronteiras entre core, daemon, MCP e interface e arquivos grandes demais

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 274b7c9a | 0 | 1 | 0 | Sem relação. |
| 504e1898 | 0 | 1 | 0 | Sem relação. |
| 774d1e99 | 0 | 2 | 0 | Sem relação. |
| 39436d9c | 0 | 2 | 0 | Sem relação. |
| 674632b3 | 0 | 2 | 2 (contestado) | Contestado por b e aceito por a: SUMMARY/Arquitetura verificada registra uma divisão concreta de responsabilidades. As operações de domínio do MCP acessam .marc diretamente, enquanto o daemon serve a UI, mantém o registro de workspaces e expõe a API HTTP. Essa separação é conteúdo substantivo para avaliar as fronteiras pedidas, não apenas vocabulário comum. Falta a revisão geral e dos arquivos grandes, portanto não é grau 3. |
| 3e422682 | 0 | 2 | 0 | Sem relação. |
| c14150b8 | 0 | 2 | 2 (contestado) | Contestado por b e aceito por a: SUMMARY/Resultado e Decisões estabelece uma fronteira arquitetural concreta para a revisão solicitada. Localização e suas dependências pertencem apenas à UI, enquanto core, daemon, MCP, CLI e contratos permanecem com strings literais em en-US. É uma restrição substantiva sobre a distribuição de responsabilidades, embora não cubra toda a arquitetura nem os arquivos grandes. |
| 6340b186 | 0 | 2 | 0 | Sem relação. |
| 2f441fa7 | 0 | 2 | 0 | Sem relação. |

### A36

Consulta: o SDK instalado não suporta a revisão mais nova do protocolo

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 0 | 1 | 0 | Só cita o protocolo preservado. |

### A37

Consulta: achar textos em português espalhados pelo código e pelas mensagens de erro

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| e54fb794 | 1 | 2 | 1 | Cita documentação pública em en-US. |
| 3c4dda95 | 0 | 1 | 0 | "Não houve tradução" é só vocabulário. |
| c04986bd | 0 | 1 | 0 | Sem relação. |
| 3b4a8787 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 0 | 1 | 0 | "Não traduz" é só vocabulário. |

### A38

Consulta: o agente não tinha como gravar o resumo final e fechar a conversa pelo MCP

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 3c4dda95 | 0 | 2 | 1 | Cita a origem na thread de tools de summary. |
| 3b4a8787 | 0 | 2 | 1 | Cita a oportunidade separada de tools de summary. |
| 034ad1bf | 0 | 1 | 0 | Sem relação. |

### A39

Consulta: mensagens das threads amontoadas em parágrafo, preferir itens curtos por categoria

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| c04986bd | 0 | 2 | 1 | Mensagem longa vira artifact; não trata de bullets. |
| 3c4261b4 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 1 | 3 | 2 | Decisão relacionada: formato compartilhado de mensagens, artefatos e sumários. |
| 034ad1bf | 1 | 2 | 1 | Cita o desdobramento para a thread 6143a9b5. |

### A40

Consulta: os avisos flutuantes da interface destoam do resto do visual

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Sem relação. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 604ad99b | 0 | 1 | 0 | Sem relação. |
| 174c48b6 | 0 | 1 | 0 | Sem relação. |

### T01

Consulta: bootstarp obrigatorio antes das ferramentas

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 2 | 1 | Cita bootstrap independente preservado. |
| 58458a82 | 1 | 3 | 2 | Decisão relacionada: bootstrap forte no início da sessão. |
| 274b7c9a | 0 | 2 | 0 | Chamada de bootstrap citada como incidente; sem relação. |
| dd4a5684 | 0 | 2 | 1 | Cita bootstrap independente preservado. |
| 92413b81 | 0 | 2 | 1 | Cita bootstrap independente com OK_BOOTSTRAP. |
| 094d8894 | 0 | 3 | 1 | Bootstrap distinto de recomendações, sem o bloqueio das ferramentas. |
| d34b7486 | 1 | 3 | 2 | Versão anterior: prepara workspace_bootstrap e bootstrapConfirmed. |

### T02

Consulta: autocomplet de referencias

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 024e05b1 | 0 | 1 | 1 | Cita o autocomplete migrado ao estilo. |
| 3c4261b4 | 1 | 2 | 2 | Decisão relacionada: a gramática das referências inseridas. |
| c147b8bb | 0 | 1 | 1 | Cita autocomplete na experiência de uso. |

### T03

Consulta: concorrencia de escrita no markdwon

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 0 | Sem relação. |
| 9e4e6ab7 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| e54fb794 | 0 | 2 | 1 | Cita a oportunidade derivada de concorrência. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |
| c04986bd | 0 | 2 | 0 | Sem relação. |
| 3c4261b4 | 0 | 1 | 0 | Sem relação. |
| 2f441fa7 | 1 | 3 | 2 | Parte da resposta: lock de thread e escrita atômica. |
| 6143a9b5 | 0 | 1 | 0 | Sem relação. |

### T04

Consulta: leitura incremental por curosr

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 1d4c0daa | 1 | 2 | 1 | Cita o fallback de cursor, sem a leitura incremental. |
| ce47939a | 0 | 1 | 0 | Sem relação. |

### T05

Consulta: daemon detahced em segundo plano

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 504e1898 | 1 | 2 | 1 | Testa o auto-idle do modo detached. |
| 774d1e99 | 0 | 1 | 0 | Sem relação. |
| 674632b3 | 0 | 1 | 0 | Sem relação. |
| d540c6b4 | 0 | 2 | 0 | Sem relação. |
| 6340b186 | 0 | 1 | 0 | Sem relação. |
| 594973bb | 0 | 1 | 0 | Sem relação. |

### T06

Consulta: elegibilidade semantcia dos candidatos

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 1 | 3 | 2 | Decisão relacionada: estudos de descarte pela elegibilidade. |
| 4f477d9f | 0 | 2 | 1 | Lista elegibilidade como controle, sem a decisão. |
| 0e4dbaac | 0 | 1 | 0 | Sem relação. |
| e4478bac | 2 | 3 | 3 | Registra que a elegibilidade final depende do contexto semântico. |
| b64903bd | 0 | 2 | 0 | Sem relação. |
| c147b8bb | 1 | 2 | 1 | Ranking híbrido, sem elegibilidade. |

### T07

Consulta: atalhos de tecaldo no painel lateral

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 2341bc9f | 0 | 2 | 2 | Versão anterior: cria o modal central de atalhos. |
| 0845d0bb | 0 | 1 | 0 | Sheet de criação; sem atalhos. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 604ad99b | 0 | 2 | 1 | Só reafirma o modal central. |
| 024e05b1 | 1 | 2 | 1 | Só reafirma o dialog central. |
| c14150b8 | 0 | 1 | 0 | Sem relação. |
| 594973bb | 0 | 1 | 0 | Sem relação. |

### T08

Consulta: rebuild incremetnal falhou no schema

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 57488bab | 0 | 2 | 0 | Sem relação. |
| 774d1e99 | 0 | 1 | 0 | Sem relação. |
| 834716ba | 0 | 2 | 0 | Sem relação. |
| 3c4dda95 | 0 | 1 | 0 | Sem relação. |
| aa4908aa | 0 | 1 | 0 | Sem relação. |
| 3e422682 | 1 | 2 | 1 | Cria o rebuild incremental, sem a falha de schema. |
| 2f441fa7 | 0 | 1 | 0 | Sem relação. |

### O01

Consulta: agente nao avisa que o perfil ja existia

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 2 | 0 | Sem relação. |
| 58458a82 | 0 | 1 | 0 | Sem relação. |
| 72461180 | 0 | 1 | 0 | Sem relação. |
| dd4a5684 | 0 | 2 | 0 | Sem relação. |
| 92413b81 | 0 | 3 | 1 | Cita agent_register retornando unchanged. |
| 094d8894 | 0 | 2 | 1 | Política de reutilização de perfis, sem a resposta da ferramenta. |
| 834716ba | 0 | 1 | 0 | Sem relação. |
| 734062bc | 1 | 2 | 1 | Mudança anterior do agent_register, sem a sinalização. |

### O02

Consulta: por que o daemon cai as vezes no teste quando fica ocioso

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 39436d9c | 0 | 2 | 1 | Cria o auto-idle, sem a corrida. |
| d540c6b4 | 0 | 1 | 0 | Sem relação. |
| 594973bb | 2 | 3 | 3 | Diagnostica o timer de 20 ms que fecha o servidor antes da primeira conexão. |

### O03

Consulta: mensagem longa vira artifact pela ui

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 92413b81 | 0 | 1 | 0 | Sem relação. |
| 094d8894 | 0 | 1 | 0 | Sem relação. |
| 5845b8a1 | 0 | 2 | 1 | Cita o sheet de criação de anexo. |
| 0845d0bb | 0 | 1 | 0 | Sem relação. |
| 3c4261b4 | 1 | 2 | 1 | Visualização de artifact, não criação. |
| c14150b8 | 0 | 1 | 0 | Sem relação. |
| c147b8bb | 0 | 1 | 0 | Sem relação. |

### O04

Consulta: trocar sonner pelo toast neobrutalism

| Thread | a | b | Final | Justificativa |
| --- | --- | --- | --- | --- |
| 004a9983 | 0 | 1 | 1 | Cita o desenvolvimento do Toast. |
| 504e1898 | 0 | 1 | 1 | Cita a origem no trabalho do Toast. |
| 834716ba | 0 | 1 | 0 | Sem relação. |

