# Proposta — eventos de thread e integração com o harness do Codex

**Estado:** proposta para avaliação humana; nenhuma implementação do mecanismo.
**Data:** 30/10/2026 no horário de São Paulo; consulta de fontes em 31/10/2026 UTC.
**Thread:** marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc
**Responsável pela síntese:** marc://@codex-software-architect

## 1. Conclusão e recomendação

É viável observar mudanças e filtrar menções em um processo local sem chamar o modelo durante a espera. A capacidade de esse processo acordar uma sessão depende do cliente. O contrato de um processo em segundo plano não comprova que sua conclusão reabra um chat ocioso.

Para o Codex, há duas possibilidades distintas:

- **Sessão atual na IDE:** ainda não demonstramos uma interface pública que permita ao mARC injetar um aviso nesta conversa específica e iniciar processamento depois de encerrado o turno. O listener isolado resolve a observação; não resolve sozinho a entrega ao harness.
- **Sessão administrada por uma integração:** o Codex App Server fornece um caminho documentado para iniciar/retomar conversas e enviar turnos. O mARC ou um adaptador poderia controlar essa sessão, sob autorização. Isso não prova controle sobre uma conversa já aberta em outro processo ou cliente.

Recomendo desenvolver o núcleo de notificações separadamente do executor online. Primeiro, eventos filtrados e recuperáveis; depois, uma prova limitada por cliente; por último, se autorizada, a integração de execução. Não recomendar agora um laço automático de agentes baseado apenas em menções.

O requisito de custo deve ser formulado como **zero chamadas de inferência durante espera sem evento relevante**, e não “custo total zero”. Processos, conexões, autenticação e armazenamento têm custos próprios. Ao entregar um aviso para leitura pelo agente, haverá processamento de contexto e possível inferência. Retomar sessão pode reduzir reconstrução e favorecer cache; não garante gratuidade.

## 2. Fontes, método e alcance

Foram lidos por MCP os seis registros originais da thread e as duas respostas anexadas, além da thread de modo online. A E2 foi investigada pelo SUMMARY.md autoritativo e pelas cinco mensagens finais, incluindo o bloqueio B1 e sua correção. Foram lidas as análises históricas locais de Open Design.

Relatório de pesquisa de autoria do delegado, entregue em marc://#msg_5bf7de53412f455d99: investigação estática dos dois projetos, com permalinks, testes inspecionados e limpeza. O principal leu o relatório completo, verificou sua autoria e confrontou as conclusões centrais com os fontes.

Fontes de contexto:

- marc://$oportunidade-modo-online-de-orquestracao-agentica-local-6a4f84b5
- marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2
- README.md, docs/architecture.md, docs/ui-and-daemon.md, docs/harness-engineering.md, docs/agent-workflows.md e índice de ADRs.
- ADRs 0001, 0003, 0004, 0006, 0007, 0008 e 0009.
- .context/analise/orquestrador_open_design/open-design-agentic-analysis.md e marc-agentic-orchestration-spec.md.

A investigação de repositórios usou árvores e fontes públicas fixadas em SHA, consultadas via GitHub API/raw e context-mode. O download dos archives por PowerShell falhou; portanto não houve execução de checkout, instalação, testes dos projetos ou demonstração funcional. “Código confirmado” neste documento significa inspeção estática, não execução.

| Projeto | Snapshot inspecionado | Papel da fonte |
| --- | --- | --- |
| Tucano | c8b2bc47b9ae65fcbb7f5edac4f594415ae40800 | Implementação atual de engines, contexto e coordenação |
| Open Design | 12d970eacc8971150e3c76470d2a9afe16dc2ed1 | Implementação atual de retomada, App Server e replay |
| Codex local | CLI 0.164.0-alpha.11.1; extensão 26.1021.22027 | Versão e ajuda locais, sem iniciar inferência |

O site [Tucano](https://tucano.sh/) foi consultado como apresentação do produto. A tentativa de acessar [DeepWiki](https://deepwiki.com/eduwxyz/tucano) retornou HTTP 429; nenhuma conclusão técnica depende dessa página. Documentação oficial e fonte primária prevaleceram sobre descrições comerciais e estudos antigos.

O principal usa o perfil existente codex-software-architect; o pesquisador reutiliza codex-dev. Modelo delegado herdado: gpt-6.1-sol. O arquivo local declara reasoning high, sem comprovar o valor efetivo de cada execução. Este limite não autoriza iniciar implementação. A pesquisa seguiu o ensaio sequencial de um desenvolvedor, com bootstrap independente e autorização interna antes do acesso temporário com escrita. Evidências operacionais e limpeza constam do relatório delegado.

## 3. As duas respostas anexadas: acordo, divergência e correção

As respostas não propõem arquiteturas opostas. Ambas separam espera fora do modelo, filtragem no servidor e leitura incremental quando há evento. A segunda traz detalhes adicionais e qualificações ausentes na primeira.

| Afirmação nos anexos | Avaliação para esta proposta |
| --- | --- |
| Um processo bloqueante pode esperar sem inferência | Correto como desenho de software; não comprova despertar automático em todos os clientes |
| A conclusão de background acorda a sessão | Depende do harness; o relato sobre Claude não deve ser transferido ao Codex |
| Monitor não gasta tokens enquanto aguarda | Compatível com espera externa; o segundo texto acrescenta expiração com notificações que podem gerar novas ativações |
| Monitor expira em até 30 minutos | Afirmação específica do anexo, não revalidada nesta investigação do Codex; não usar como contrato universal |
| Background não tem limite de duração encontrado | Ausência de limite encontrado não estabelece execução ilimitada; verificar fechamento do cliente, timeout e descarte |
| CLI bloqueante é contrato portátil | Portável como programa de espera, condicionada a integração do cliente para entrega ao modelo |
| Timeout retorna ao agente para rearmar | Pode gerar consumo sem evento; reconexões e renovação devem preferencialmente ocorrer fora do modelo |
| Notificação MCP poderia acordar o agente | Hipótese não comprovada; evento de protocolo e início de inferência são capacidades diferentes |

A frase “basta executar em background” precisa, portanto, de uma condição explícita: o cliente deve comprovar que entrega a conclusão à sessão certa, no estado necessário. A etapa de prova deve incluir agente ocupado, ocioso, fechado e reiniciado.

## 4. O que sabemos deste harness do Codex

### 4.1 Ferramentas desta conversa

O contrato disponível de exec_command retorna session_id quando um processo continua. write_stdin permite obter saída posterior. functions.exec também pode retornar uma célula em andamento e functions.wait precisa ser chamado para retomá-la. Isso comprova execução continuada e espera durante uma chamada; não comprova que encerrar um processo externo inicie um novo turno depois da resposta final.

As ferramentas de colaboração recebem mensagens entre agentes desta árvore. Elas não expõem ao daemon do mARC um endereço público para entregar uma menção de thread a este chat. clock.sleep permite espera interrompida por entrada do turno, mas não cria uma assinatura de eventos mARC. Nenhuma dessas capacidades deve ser apresentada como integração já existente.

Uma ferramenta bloqueante solicitada pelo próprio agente poderia devolver uma menção durante um turno ainda aberto. Esse experimento tem valor, mas precisa medir limites da chamada, cancelamento e rearmamento. Manter o modelo chamando waits curtos e avaliando timeouts seria polling com consumo de contexto.

### 4.2 Interfaces documentadas e verificação local

A [documentação oficial do App Server](https://developers.openai.com/codex/app-server) descreve initialize, thread/start, thread/resume e turn/start. turn/steer se aplica a turno ativo e exige expectedTurnId. A integração deve distinguir essas operações de notificações de saída. A documentação consultada qualifica App Server/transporte WebSocket como experimentais e sem suporte para uso produtivo; a versão local também apresenta app-server como experimental.

A ajuda da CLI instalada confirma app-server e exec resume com identificador de sessão. Foram executados apenas --version e comandos --help. Nenhum turno foi iniciado, retomado ou alterado. A presença de comando proxy ou socket de controle não comprova acesso autorizado à sessão desta IDE.

A [configuração avançada oficial](https://developers.openai.com/codex/config-advanced#notifications) define notify como execução de programa externo em evento de conclusão do Codex. É uma saída do Codex para outro programa; não constitui entrada de eventos mARC para o agente. Não foi instalado hook ou alterada configuração.

### 4.3 Matriz prática de possibilidades

| Caminho | Estado da evidência | Uso proposto |
| --- | --- | --- |
| Processo/SSE/long-poll fora do modelo | Viável por construção; ainda sem implementação mARC | Espera e reconexão silenciosas |
| Tool bloqueante no turno atual | Contratos locais permitem espera, mas os limites precisam de prova | Spike curto e controlado |
| Aviso externo ao usuário | Conceitualmente independente de inferência | MVP com retomada manual |
| App Server com sessão criada/gerida pelo adaptador | Documentado; ajuda local e Open Design corroboram o caminho | Spike próprio, com autorização para gerar turno |
| Retomar sessão nativa por ID em novo processo | Disponível na CLI e demonstrado estaticamente em Open Design | Continuidade, com exclusão mútua e identidade verificada |
| Acordar este chat da IDE depois do turno final | Não demonstrado | Não prometer no MVP |
| MCP notification iniciar turno automaticamente | Não demonstrado | Pesquisa opcional de capacidade do cliente |

Para o objetivo “eu deixo este chat aberto e ele percebe a menção sozinho”, a conclusão atual é **plausível com integração de cliente, mas não comprovada nesta superfície**. O caminho mais verificável é uma sessão administrada por adaptador. Ela pode ser outro chat, e essa diferença precisa ficar visível ao usuário.

## 5. Aprendizados dos projetos citados

### 5.1 Tucano: continuidade reconstruída e controle próprio

A informação do humano sobre ausência de reuso nativo foi confirmada nos adaptadores examinados. A engine Codex usa execução efêmera e ignora configuração e regras do usuário; a engine Claude desativa persistência de sessão. O contexto da aplicação é reconstruído a partir de transcript. Isso não significa ausência de memória na aplicação; significa que memória da aplicação e sessão nativa da CLI são camadas distintas.

Evidências verificadas também pelo principal:

- [Engine Codex, isolamento e argumentos](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/codex.ts#L80-L104): --ephemeral, --ignore-user-config, --ignore-rules e sandbox read-only.
- [Engine Claude](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/claude.ts#L31-L54): isolamento e --no-session-persistence.
- [Reconstrução de contexto](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/context.ts#L239-L267).
- [Gestão de runs](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/runs.ts): limites e política de encadeamento; detalhes no relatório delegado.

**O que aprender:** separação de identidade lógica e execução; adaptadores por engine; limites de encadeamento; controle de ferramentas e ações pelo host. O [router do Tucano](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/router.ts#L99-L117) também pode chamar um modelo para escolher quem responde: esse custo não deve entrar no listener de espera do mARC.

**O que não transplantar:** flags que eliminam regras/skills/configuração do cliente; atribuição automática por menção; identidade de aplicação tratada como sessão nativa. No mARC, copiar esse isolamento sem redesenho faria desaparecer justamente o bootstrap e as regras que sustentam nosso processo.

### 5.2 Open Design: retomada nativa e tratamento de replay

O estudo histórico continua útil para a separação frontend → daemon → agente → eventos. Porém sua recomendação de Map/ring/TTL como desenho “sem DB” não descreve integralmente o snapshot atual. Há persistência de sessões e journal de eventos.

A versão inspecionada implementa:

- [Captura e reuso do ID Codex](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/runtimes/defs/codex.ts#L341-L434), incluindo exec resume.
- [Transporte Codex App Server](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L1-L17): um processo por turno, com retomada de thread. Processo novo não implica sessão nova.
- [thread/resume e thread/start](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L290-L336).
- [Invalidação da retomada](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-session-resume.ts#L183-L205): mudança de modelo, diretório, cursor ausente ou conversa avançada.
- [Persistência do handle e identidade](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-session-resume.ts#L307-L329).
- [Reconexão SSE com cursor e journal](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/runtimes/runs.ts#L1954-L1975): janela em memória, limite superior capturado antes de replay e recurso ao journal quando necessário.

**O que aprender:** handle nativo explícito, validação de continuidade, separação de run e conversa, replay que não depende apenas de ring buffer e reconciliação entre histórico e sessão.

**O que adaptar com cuidado:** a [política desse transporte](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L103-L106) e as linhas 275–276 usam approvalPolicy never; as linhas 363–365 explicam a recusa de solicitações de aprovação nesse desenho. Isso não deve substituir a política de permissões deste Codex. O adaptador do mARC precisaria encaminhar aprovações ao humano e tratar estados pendentes.

Os testes identificados no repositório são evidência de cenários pretendidos, não resultados executados nesta pesquisa. Ambos os projetos declaram Apache-2.0; a proposta usa aprendizado arquitetural, sem copiar código ou incluir dependências.

## 6. Relação com as threads de modo online e E2

### Modo online — 6a4f84b5

A oportunidade histórica propõe daemon que cria runs, chama CLIs e oferece modo automático ou semiautomático. Seus conceitos de habilitação explícita, confirmação e limites são úteis. Entretanto, o automático por menção exige uma nova decisão compatível com a ADR 0004: hoje uma menção é sinal de coordenação, não despacho.

Esta proposta não reabre automaticamente o escopo inteiro do modo online. Eventos podem existir para uma sessão previamente assinante sem criar executores. O modo online pode futuramente consumir os mesmos eventos, mediante autorização e política separadas.

Não copiar argumentos históricos como contratos atuais de CLI. Validar cada adaptador contra sua versão. Também não tratar diretório fixado como sandbox completo: cwd limita o contexto de trabalho, enquanto as permissões efetivas dependem do cliente/host.

### E2 — c34cf4a2

O aprendizado útil é processual. A revisão independente identificou B1, apesar da aprovação técnica anterior. A correção preservou ranking e mudou a decisão de abstenção antes do truncamento. As mensagens finais distinguem verificação, limitações, coaprovação e autorização humana.

Isso reforça quatro requisitos para uma futura automação:

1. Entregas e revisões continuam autorais e sustentadas por evidências.
2. Um aviso não representa aprovação, aceitação ou encerramento.
3. Revisores devem formar o parecer antes de consumir a conclusão de outro revisor, quando a independência for requisito.
4. O sistema precisa saber parar e devolver controle ao humano, inclusive quando agentes concordam.

A pesquisa não estabelece ganho quantitativo de eficácia, custo ou independência entre modelos. O feedback da thread é observação empírica.

## 7. Base existente no mARC e lacuna real

O mARC já tem infraestrutura aproveitável:

| Fonte local | Evidência e consequência |
| --- | --- |
| src/daemon/server.ts:116–123 | Autentica a rota /api/events e conecta o stream |
| src/daemon/events.ts:48–78 | Mantém conexões SSE, ping a cada 25 s e mensagens event/data; não publica id de replay nesse método |
| src/daemon/events.ts:81–110 | Observa alterações do filesystem; observação é best-effort |
| src/daemon/events.ts:219–223 | workspace-changed contém workspaceId e instante, não uma menção de mensagem |
| src/daemon/message-routes.ts:48–58 | Append via HTTP também emite invalidação do workspace |
| src/core/threads.ts:120–148 | Leitura incremental por posição do messageId canônico; cursor ausente exige leitura integral |
| src/core/marc-references.ts:15–18 | Parser de referência canônica de perfil; referência não atribui tarefa |
| src/daemon/leases.ts:65–78 | Auto-idle considera leases e conexões ativas |

O stream atual é adequado à invalidação da UI. Não é uma fila confiável de menções nem um serviço de assinatura por sessão. Também não há garantia de replay de menções perdidas durante desconexão apenas por manter essa conexão.

MCPs e daemon podem escrever em processos distintos. O evento precisa corresponder ao Markdown confirmado, independentemente de o escritor ser UI ou MCP. Observar arquivo é um sinal para reconciliar o conteúdo, não prova de uma mensagem nova: renames, ruído e alterações em artefatos podem gerar múltiplos sinais.

## 8. Arquitetura proposta

### 8.1 Camadas e autoridade

Fluxo recomendado:

Mensagem Markdown confirmada → reconciliador por thread → filtro de menção → assinatura de sessão → aviso ao cliente → leitura incremental → decisão autorizada do destinatário.

O núcleo não escolhe qual agente trabalha. A assinatura é explícita e identifica sessão e thread. A camada de transporte fica separada do adaptador Codex, e este fica separado de um futuro executor online.

CHAT.md, SUMMARY.md e artefatos permanecem autoritativos. Índices, cursores de entrega, deduplicação e registros temporários de assinatura são estado operacional derivado. Configurações continuam no formato estruturado aplicável; não converter tudo sob .marc em Markdown.

### 8.2 Identidades mínimas

| Campo | Significado |
| --- | --- |
| workspaceId + caminho verificado | Impede confusão entre workspaces |
| threadId canônico completo | Conversa mARC acompanhada |
| profileId | Papel compartilhado mencionado |
| subscriptionId / sessionInstanceId | Assinatura e instância local que recebem o aviso |
| clientKind / adapterVersion | Capacidades e compatibilidade do cliente |
| nativeThreadId, quando disponível | Conversa nativa Codex; não é threadId do mARC |
| generation / leaseExpiresAt | Rejeição de ouvintes antigos e renovação |
| consumedMessageId | Última mensagem lida e processada pelo agente |
| delivery/scan position | Controle de transporte; não avança o cursor de consumo |

O perfil não recebe um novo cadastro a cada sessão. Duas sessões podem usar o mesmo profileId. No MVP de notificações, ambas podem receber o aviso se assinaram explicitamente. Isso não autoriza duas execuções da tarefa. Uma futura execução automática precisaria de propriedade exclusiva e lease por vínculo de trabalho.

Não suprimir mensagens por authorProfileId igual ao perfil assinante: outro agente pode usar o mesmo perfil compartilhado. Quando houver origem de sessão verificável, pode-se suprimir o próprio evento; na ausência dela, preferir deduplicação por messageId e entrega conservadora.

### 8.3 Evento mínimo e semântica de menção

Contrato candidato, ainda não implementado: versão do envelope, workspaceId, threadId, messageId, autor, perfis mencionados, instante, chave de deduplicação e origem de sessão opcional verificável.

O evento deve conter identificadores e metadados mínimos. O corpo da mensagem vem depois por thread_read_since; não repetir transcrições inteiras no evento. Não usar um LLM para descobrir destinatários.

Para V1, reconhecer referências explícitas a perfis existentes em texto de mensagem. A extração deve respeitar o parser canônico e contexto Markdown, sem converter exemplos em blocos de código, citações ou menções dentro de artefatos em disparos. A regra exata de citação precisa ser documentada e testada. Não inferir identidade por nomes semelhantes ou texto livre.

Mesmo uma referência válida pode ser mera visibilidade. O evento significa “há uma mensagem que referencia este perfil”, e não “execute a tarefa”.

### 8.4 Replay, cursores e corrida de rearme

Entrega deve admitir repetição. O consumidor deduplica por workspace/thread/message/subscription; não prometer exactly-once entre gravação de mensagem, stream e início de inferência.

Regras necessárias:

- Registrar a observação e capturar um limite superior coerente antes de concluir replay; conciliar o intervalo entre consulta inicial e assinatura.
- Reconciliar mensagens canônicas posteriores ao cursor, em ordem do transcript. Não comparar IDs aleatórios lexicograficamente nem timestamps como ordem autoritativa.
- Conservar eventos recebidos durante replay para entrega após o limite capturado, eliminando duplicatas.
- Evento entregue não avança consumedMessageId. Só a leitura e processamento pelo agente fazem isso.
- Se o cursor sumiu, responder com recuperação necessária; o agente anuncia o fallback e chama thread_read. Não pular silenciosamente para o fim.
- Alteração/remoção de mensagem, truncamento ou fechamento da thread exigem estado explícito de ressincronização ou fim de assinatura.
- Se nenhum messageId existir ainda, definir início da observação com política explícita; não interpretar cursor vazio como autorização para ignorar histórico relevante.

O histórico pode ser reconstruído do Markdown. Um journal operacional é opção futura para desempenho; não deve se tornar uma fonte concorrente de mensagens ou decisões.

### 8.5 Transporte e CLI de espera

Escolher inicialmente um transporte: SSE autenticado, aproveitando a infraestrutura local. Um comando candidato marc wait pode consumir esse transporte e encerrar no primeiro evento relevante. O nome, argumentos e códigos de saída ainda são proposta, não comandos disponíveis.

Contrato sugerido: thread canônica, perfil, vínculo de sessão, cursor e sinal de cancelamento. Saída única estruturada para evento; estados distintos para cancelamento, expiração de assinatura, cursor inválido e falha de autenticação. Sem imprimir ping ou reconexões como avisos ao agente.

Reconexão, backoff, jitter, renovação e heartbeat ficam no processo local. Não reinvocar o modelo periodicamente para renovar listener. Falha persistente deve aparecer ao usuário; nunca uma espera silenciosa que perdeu a assinatura.

O daemon continua opcional para o MCP. Assinar eventos pode requerer daemon no modo escolhido; sua ausência precisa de erro claro ou início explicitamente autorizado. A leitura/escrita MCP offline permanece funcional.

Assinaturas ativas precisam participar conscientemente do ciclo de vida do daemon: não permitir auto-idle que encerre um listener válido nem manter processo eterno por uma sessão abandonada. Lease e cancelamento resolvem o vínculo; ping de transporte não representa atividade de trabalho.

### 8.6 Adaptador Codex e autorização

Preferir stdio sob processo controlado no primeiro spike. Evitar descobrir ou controlar sockets privados da IDE como atalho. Não escrever em histórico interno, banco local, auth, perfis ou configuração do Codex para simular entrada.

Para uma sessão administrada: verificar workspace, permissões, modelo e handle; inicializar o cliente; criar/retomar a conversa; enviar somente o aviso aprovado e a instrução restrita de recuperar contexto. Se a sessão estiver ocupada ou aguardando aprovação, enfileirar o aviso. Não usar turn/steer como interrupção padrão de trabalho em andamento.

Garantir um proprietário de geração por sessão nativa. Não retomar o mesmo ID simultaneamente pela IDE e por outro processo sem capacidade compartilhada comprovada. Handle inválido ou divergência de continuidade requerem recuperação visível e autorização; não criar sessão nova silenciosamente.

No MVP, o evento apenas notifica. Um clique ou comando humano explícito autoriza a retomada quando for necessário começar um turno novo. Se o agente já abriu uma chamada de espera, o retorno é continuação dessa chamada autorizada; ainda assim, ação posterior segue o contrato da tarefa.

Automação de novos turnos ou novos runs fica fora da V1. Um desenho posterior deve declarar o que foi previamente autorizado, preservar o ponto humano e revisar a decisão arquitetural aplicável. Opt-in técnico não substitui autorização para trabalho indefinido.

### 8.7 Limites e proteção do processo

Sem copiar os limites numéricos de outros projetos. O ensaio deste workspace continua com um desenvolvedor por vez.

Prever por assinatura: deduplicação, coalescência de várias menções antes de leitura, tamanho máximo de envelope, fila limitada, duração de lease e parada explícita. Um executor futuro acrescenta limites de turnos, tempo, orçamento e cadeia, pausa/cancelamento e retorno ao humano.

Eventos são dados não confiáveis para instruções. Receber uma referência não pode ampliar permissões, alterar configuração ou aprovar comandos. Autenticação local e escopo por workspace são obrigatórios; usar cabeçalhos para segredos e não registrar tokens em avisos, argv ou relatórios.

## 9. Plano incremental e critérios de aceite

| Etapa | Entrega delimitada | Evidência exigida |
| --- | --- | --- |
| P0 — prova do cliente | Matriz real de espera e retomada em sessão de teste, sem alterar a conversa atual | Estados ativo/ocioso/fechado, ID antes/depois, limites, contagem de inferências e aprovações |
| P1 — núcleo de eventos | Reconciliação Markdown, menção explícita, assinatura, replay e cancelamento | UI e MCP cobertos; ruído não vira evento; corrida de assinatura e reconnect sem perda silenciosa |
| P2 — consumidor de espera | CLI/cliente bloqueante com reconexão fora do modelo | Saída somente no evento, códigos distintos, consumo ocioso sem inferência, cleanup e cancelamento |
| P3 — adaptador Codex experimental | Sessão administrada e retomada por autorização humana | Handle preservado, cursor separado, permissões encaminhadas, fila em busy/approval, exclusão mútua |
| P4 — decisão de modo online | Proposta separada de dispatch/automação | Política humana, ADR aplicável, limites, revisão independente e aceitação explícita |

P0 deve ser um experimento descartável. Sucesso com sessão criada para teste não prova funcionamento no chat atual da IDE. O resultado pode recomendar manter apenas a notificação até existir uma capacidade de cliente adequada.

Antes de cada implementação: plano detalhado anexado, preflight, configuração de papéis verificada e despacho limitado com bootstrap independente. Não há autorização de implementação neste documento.

### Cenários mínimos de verificação futura

1. Período ocioso acordado com o humano, sem menções: nenhuma chamada ao modelo; heartbeat/reconnect apenas locais.
2. Mensagens sem referência, referência a outro perfil, exemplos em código e citações: nenhuma ativação indevida.
3. Uma menção válida: aviso mínimo; leitura incremental a partir do cursor efetivamente consumido.
4. Menção durante desconexão, replay e rearme: entrega recuperável e sem execução duplicada.
5. Dois escritores UI/MCP e renames atômicos: reconciliação do transcript confirmado.
6. Duas sessões no mesmo perfil; duas threads no mesmo workspace; dois workspaces: isolamento correto.
7. Cursor ausente, transcript alterado e thread fechada: recuperação ou encerramento explícitos.
8. Sessão busy, aprovação pendente, cancelamento e reinício do daemon: nenhum turno concorrente ou comando aprovado por implicação.
9. Retomada inválida por modelo/cwd/handle ou conversa avançada: recuperação visível.
10. Limite de fila, orçamento e cadeia atingido: parada com devolução de controle ao humano.
11. Cliente encerrado: lease expira e processo próprio é limpo, sem matar processos por padrões amplos.
12. MCP sem daemon: comportamento offline preservado.

Implementação futura de código, testes, tooling ou configuração executável exige pnpm validate, pnpm build e pnpm test, além dos cenários específicos. Validar efeitos de escrita do validate no escopo. Alterações de UI exigem Playwright CLI. Não foram executadas essas suítes para esta entrega editorial.

## 10. Decisões pendentes e recomendação de recorte

As seguintes decisões permanecem para a avaliação da proposta, sem impedir esta entrega:

- O primeiro objetivo é notificar este chat da IDE ou aceitar uma sessão Codex administrada pelo adaptador?
- O primeiro aviso deve apenas chamar atenção do humano ou há autorização prévia para uma leitura restrita pelo agente?
- Qual política explícita para duas sessões assinantes do mesmo papel na mesma thread?
- Qual duração de assinatura e qual comportamento quando cliente/daemon ficam indisponíveis?
- Qual definição exata de menção elegível em citação?
- Em uma fase online posterior, quais decisões a ADR 0004 precisaria preservar ou alterar?

**Recorte recomendado:** P0 e P1 como próximas atividades de estudo/engenharia, após aprovação; P2 se o transporte se confirmar; P3 como experimento separado. Não começar pelo router automático. A necessidade inicial é uma entrega confiável à sessão, e não escolher automaticamente quem trabalha.

## 11. Revisão final integrada da pesquisa

**Escopo revisado:** problema original, respostas anexadas, modo online, E2, contratos desta conversa, CLI local, documentação oficial e fontes fixadas dos projetos externos. O principal verificou independentemente os trechos centrais de isolamento Tucano, retomada/invalidação Open Design e replay, além do stream/cursor do mARC.

**Critérios ligados à evidência:** a ausência de reuso nativo no Tucano está sustentada pelas flags e reconstrução de contexto; a evolução de Open Design está sustentada por thread/resume, captura de handles, invalidação e journal; a lacuna de entrega nesta IDE permanece explícita porque help e ferramentas de espera não a demonstram. O desenho separa notificação, consumo de conteúdo e autorização de trabalho, preservando a ADR 0004 e o formato autoritativo dos registros.

**Limitações:** investigação estática; nenhum teste externo rodado; download de archives falhou; DeepWiki indisponível por 429; nenhum ensaio de notificação ou retomada real; reasoning efetivo não introspectado. Fontes em main podem evoluir, razão pela qual as referências técnicas estão fixadas em SHA. O relatório delegado complementa detalhes, testes apenas inspecionados e limpeza.

**Veredito:** aprovado como análise e proposta para revisão humana, com viabilidade condicional por cliente. Implementação e compatibilidade ponta a ponta permanecem pendentes. A aprovação deste documento não é aprovação de código, aceitação humana nem autorização de fechamento da thread.

**Evidência consolidada da entrega:** pesquisa própria de codex-dev publicada em msg_5bf7de53412f455d99; diretório temporário exclusivo ausente, confirmado também pelo principal. O vínculo do brief foi corrigido para a thread canônica completa antes da publicação final; a cópia acidental sob o sufixo foi removida. As auditorias focadas e a checagem de conteúdo/links são registradas no resumo de publicação.

**Classificação da entrega:** registro mARC/editorial. Verificação aplicável: coerência das fontes e limites, Markdown, links, metadados de artefatos e auditorias focadas. Nenhum Git foi executado; nenhum hook, configuração do cliente, dependência ou código de produto foi alterado. A rejeição automática da tentativa redundante de refresh do delegado não impediu a pesquisa: o principal já havia executado o refresh exigido, sem alterações.
