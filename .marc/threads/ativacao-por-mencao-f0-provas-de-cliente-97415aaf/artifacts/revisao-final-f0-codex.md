# Revisão final integrada — frente Codex da F0

Autor: marc://@codex-software-architect  
Entrega executora: marc://@codex-dev, runtime /root/codex_dev_f0  
Data: 03/11/2026  
Thread: marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf

## Veredito e alcance

**Aprovada a entrega experimental final da frente Codex**, com as conclusões delimitadas abaixo. As 14 células atribuídas foram executadas: **3 testado e 11 testado com limite**. Nenhuma permanece somente como limite declarado. Isso aprova a qualidade e a rastreabilidade desta entrega; não concede capacidade universal ao cliente nem encerra a F0.

Este parecer substitui, para o estado atual, o veredito parcial de marc://#msg_87d046f28b5f49d993. Preserva-se aquele registro histórico. O relatório autoral vigente é resultado-f0-codex.md, publicado pelo desenvolvedor e atualizado na entrega marc://#msg_6157ab4eaf8541439f. As contribuições marc://#msg_b8bbc3da61934e469a e marc://#msg_143e7a801a9b47a3a6 integram a cadeia de evidências. A interpretação de recusa nativa em marc://#msg_3667d68ef33b467bb4 foi corrigida pela entrega final: tratava-se de erro do driver ao interpretar um aviso não fatal.

A consolidação entre Claude e Codex permanece para a etapa prevista. Não houve implementação do desenho de ativação, alteração de proposta alheia, escrita de resumo ou fechamento da thread.

## Fontes, método e responsabilidade

Revisei proposta-execucao-f0.md, em especial a seção 8, plano-f0-provas-de-cliente.md, as entregas Claude aplicáveis, despacho-f0-codex.md, o relatório Codex final e as evidências nativas pertinentes a todas as células. A revisão independente usou context-mode para correlacionar resultados JSON, transcripts/rollouts, IDs de thread e turno, chamadas efetivas do probe, tempos e limpeza. A imagem da TUI e a declaração do executor não foram consideradas provas suficientes de submissão, aprovação ou término.

O desenvolvedor realizou bootstrap próprio, recebeu autorização explícita antes das edições e publicou a entrega sob o perfil compartilhado correto. O modo foi sequencial, um desenvolvedor. Principal gpt-6.1-sol/high; desenvolvedor gpt-6-luna/xhigh, conforme configuração confirmada na atividade. Os clientes experimentais válidos registraram **Codex 0.166.0, gpt-6-luna e xhigh** nos rollouts. Node 22.20.0 e node-pty 1.1.0 já instalado; nenhuma instalação adicional.

Os experimentos ficaram em C:\Users\junior\AppData\Local\Temp\marc-f0\X, por célula, com a publicação oficial dos artefatos na thread como entrega autorizada. A execução usou o binário nativo codex.exe, sem depender do shim npm. O App Server foi privado, em WebSocket de loopback; a TUI remota foi conduzida por ConPTY.

Nesta revisão, **testado** indica observação direta do cenário aceito; **testado com limite** indica execução real acompanhada de restrição explícita à conclusão. Implicações para as fases seguintes são **inferências**, separadas dos fatos. Documentação ou esquema de API não substituem prova interativa.

## Critérios ligados às evidências

Os caminhos abaixo são relativos a X; o relatório executor contém comandos, saídas sanitizadas e custos por célula.

| Célula | Classificação | Avaliação independente |
|---|---|---|
| A1 | testado com limite | A1/a1-idle-resume-trusted.json correlaciona seed, consulta cega e ABSENT no turno novo. A tentativa externa encontrou active writer e não criou novo turno. Confirma o conflito observado; não demonstra exclusão mútua do supervisor para todo estado futuro. |
| A2 | testado | A2/a2-bidirectional-continuity.json confirma continuidade nas três direções entre TUI e API do mesmo host/thread, com marcadores e turnos correlacionados. A tentativa inicial que selecionou histórico antigo foi excluída da prova válida. |
| A3 | testado com limite | A3/a3-concurrent-resume-summary.json e as duas retomadas mostram uma conclusão e um erro active writer (-32600), sem novo ramo observado. Não se extrapola o resultado para todos os modos de anexação. |
| B2 | testado com limite | Probe e rollout correlacionam tools/call, thread e turno. Os valores de _meta identificam a conversa neste cliente. Opções persist no pedido não provam concessão persistente; a política efetiva de exec/resume não foi inferida de flags ausentes. |
| B3 | testado com limite | B3/b3-mcp-lifecycle-final.json e b3-mcp-lifecycle-reconnect-attempt-09.json provam clear seguido de mensagem, compact, reconexão e reinício do host com chamadas reais ao MCP. Os limites de presença e identidade estão detalhados abaixo. |
| C1 | testado | C1/terminals/powershell-02.json, mintty-01.json, windows_terminal-01.json e terminal-control-summary.json comprovam novos turnos e stdio funcional nos três caminhos. Wrapper do Windows Terminal terminou com 0. É prova funcional, sem avaliação visual da renderização. |
| C2 | testado com limite | Retomada não interativa da pasta A para B preservou ID e marcador. A variante sem TTY falhou por stdin não ser terminal; ela não prova comportamento interativo em outra pasta. |
| D3 | testado com limite | D3/d3-native-lifecycle-y-result.json comprova ferramenta nativa, processo aguardando, saída da TUI e término do host. A sobrevivência observada dependeu do host ainda vivo. |
| D6 | testado com limite | D6/d6-native-background-lifecycle-result.json comprova ferramenta nativa e liberação depois do turno completo. Nenhum novo turno ocorreu nos 15.014 ms observados. Resultado negativo limitado à janela e ao caminho ensaiado. |
| D7 | testado com limite | D7/evidence/d7-idle-queue.json e rollouts confirmam entrega por queue em idle e busy. Turno ocupado terminou às 22:28:24.700Z, próximo iniciou às 22:28:24.739Z e terminou às 22:28:25.827Z. A falha headless de agents por falta de TTY não foi usada como prova interativa. |
| E1 | testado com limite | e1-seed.json, e1-resumed-pending.json e e1-after-pending-resume-only.json sustentam a sequência seed → novo processo → aprovação pendente → retomada. Não houve reapresentação observada; isso não prova perda do histórico nem cobre todo tipo de aprovação. |
| E2 | testado com limite | e2-accept-verified.json mostra accept seguido de tools/call; e2-decline-verified.json mostra recusa sem execução. Cobre aprovação MCP pontual, sem provar grant de sessão ou relay de aprovação nativa de comando/arquivo pela API. |
| E4 | testado | Criação em um App Server e retomada em outro preservaram o ID e recuperaram o marcador, com read-only/on-request retornados. |
| G1 | testado com limite | Seed, retomada quente, controles e retomadas após 7m04s e 65m57s medem cache real em sessão pequena. Permitem comparação empírica; não estabelecem TTL universal nem retomada integralmente fria. |

## B3: o processo MCP não representa presença da TUI

**Testado:** no ciclo inicial, a conversa 01a19f85-9382-79c2-b076-3f36edfaabb9 usou probe PID 25728. Depois de /clear e da mensagem seguinte, surgiu a conversa 01a19f85-ad1c-75c1-a2a3-7c0d9fba6701 com probe 18344. Depois de /compact, permaneceram esse ID e esse PID. O instante entre /clear e a mensagem não foi medido; não se afirma quando ocorreu a transição.

**Testado:** no ensaio final de reconexão, a conversa 01a19fcc-d76c-73c2-9826-9d1e690bbc83 realizou três chamadas efetivas ao probe, em três turnos únicos concluídos:

- Baseline: host 17044, probe 24504.
- TUI retomada no mesmo host: mesmo thread e probe 24504.
- Somente o host reiniciado, com estado preservado: host 13676, probe novo 25204, mesmo thread.

O histórico foi carregado em cerca de 1,06 s nas duas retomadas; isso mede carregamento observado, não latência de resposta do modelo. Snapshots duplicados de turnos foram deduplicados pelo ID, sem inflar o ledger de uso. Os probes continuaram vivos durante a janela sem TUI enquanto seus hosts seguiam vivos.

**Inferido:** uma lease do processo MCP isoladamente não distingue TUI aberta, cliente desconectado e conversa ainda hospedada. _meta.threadId e _meta.sessionId coincidiram com o ID nativo da conversa nestes ensaios; não devem ser promovidos a identidade de conexão MCP ou prova de dono interativo. O ensaio usou probe próprio, sem expor a linha de comando do MCP do mARC.

O aviso de criação de helpers/PATH não era recusa de resume: o cliente continuava. As tentativas 07–08 tiveram erros de interpretação/predicado do driver; a 09 demonstrou retomada e chamada real. Esses erros não fundamentam uma limitação do produto.

## D3 e D6: ciclo real da ferramenta nativa

**D3, testado:** a chamada nativa exec/tools.exec_command devolveu session_id 48277 e waiter PID 12440. A aprovação foi a tecla exata y, sem Enter. O waiter permaneceu vivo depois de a TUI 32184 sair, enquanto o App Server 29732 seguia vivo. Depois do término desse host, o waiter já estava ausente antes da liberação do gate. Não se atribui seu desaparecimento ao gate nem se afirma sobrevivência à queda do host ou limpeza universal de descendentes.

**D6, testado:** a chamada nativa devolveu session_id 20515, waiter PID 36424, após aprovação pontual por y. O gate foi liberado depois do término nativo do turno. O processo terminou, mas o conjunto de turnos permaneceu igual durante 15.014 ms; newTurnIds ficou vazio. Notificação de ferramenta ou encerramento de processo não foi contada como novo turno do modelo.

**Inferido:** o desenho não pode depender de conclusão de waiter produzir espontaneamente um novo turno Codex. D7 comprova uma via explícita de entrega por queue no ambiente ensaiado. Isso informa a integração futura sem reabrir o desenho aprovado.

A tentativa D3 anterior que enviou Enter permanece identificada como desvio de procedimento e tem seu custo preservado. A prova aceita é a repetição por y. A tentativa D6 com Enter foi rejeitada antes da execução; a válida também usou somente y. Nenhuma repetição promoveu concessão persistente.

## Aprovações, isolamento e Windows

**Testado:** o controlador só conseguiu concluir a frente pendente depois da autorização humana explícita para executar os drivers Node fora da sandbox do controlador. A autorização não mudou a política dos clientes experimentais, não concedeu execução elevada ao código do agente e não autorizou bypass de prompts. As TUIs/App Servers foram solicitados como read-only/on-request; as aprovações pontuais foram conduzidas pelas teclas exatas.

**Limite:** metadados de sandbox no MCP ou na API não provam aplicação de isolamento no Windows. Tampouco a ausência de uma flag de aprovação em exec/resume estabelece sua política efetiva. O relatório preserva essas diferenças em vez de tratar todos os modos como equivalentes.

E1/E2 sustentam o caminho de aprovação MCP observado. D3/D6 acrescentam prova interativa de aprovação pontual de comando nativo. Não foi demonstrado relay dessa aprovação nativa, nem de escrita de arquivo, pelo App Server. Não é uma célula deixada sem execução: é o limite do que a prova executada autoriza concluir.

## Cache e custo

**Testado:** em G1, o seed teve 17.585 tokens de entrada, sem cache; a retomada quente teve 17.688/17.408 de entrada/cache. Após 7m04s, foram 19.326/17.536; após 65m57s, 19.453/11.776. O contexto continuou recuperável. Controles exibiram cache de prefixo compartilhado variável.

**Inferido com limite:** a queda de 5.760 tokens não pode ser atribuída exclusivamente ao trecho privado, pois também abrange o fixture compartilhado. Não separa expiração de roteamento/evicção. Há par seed frio e retomada quente medidos e observação prolongada; não há prova de que toda a retomada posterior estava fria, nem TTL fixo garantido. Sessão grande estava fora deste recorte.

O ledger final contém **70 turnos nativos medidos**, com 1.530.087 tokens de entrada, dos quais 1.157.120 em cache, e 14.380 de saída. Conferi a soma, a deduplicação e a fórmula de equivalente API usada pelo executor:

((entrada − cache) × 0,10 + cache × 0,01 + saída × 0,50) / 1.000.000 = **US$ 0,05605790**.

É somente um equivalente pelos preços indicados no relatório e na [tabela oficial da API](https://developers.openai.com/api/docs/pricing), não cobrança observada. Não mede consumo desta sessão principal, do desenvolvedor/orquestração ou da cota ChatGPT; portanto, não explica nem representa o orçamento total gasto nesta pesquisa. Custos sem uso observável continuam desconhecidos. A compactação com totalTokens 18.204 e componentes zero é inconsistente e ficou sem preço, não com custo zero.

## Escopo, limpeza e validação final

A revisão final confirmou ausência de diretórios privados de estado, auth.json e reparse points sob X; a inspeção dirigida dos registros sanitizados não encontrou os padrões de credencial procurados. Cópias físicas temporárias de autenticação foram removidas depois da exportação. A evidência sanitizada e os drivers permanecem para rastreabilidade; não foram apagados como se fossem resíduos.

Os hashes finais das configurações original do usuário e do projeto, da autenticação original e dos metadados do node-pty permaneceram iguais aos valores iniciais. Não houve Git, instalação, alteração de hooks ou configuração persistente do usuário. Não foram alteradas as demais pastas de marc-f0.

A conferência de processos considerou identidade e criação, não apenas número de PID. Dos números registrados ainda encontrados, 13516 correspondia agora a PowerShell posterior ao antigo cliente; 37004 correspondia agora a conhost criado em 03/11 às 03:27:49Z, enquanto o probe original desse número havia iniciado em 02/11 às 21:19:10Z. São reutilizações, deixadas intocadas. Os processos próprios verificados nos encerramentos foram tratados por identidade/PID conferidos; não houve encerramento por nome.

**Classificação da entrega:** pesquisa experimental em diretório temporário e registros mARC. A validação aplicável foi sintaxe dos drivers, execução dos cenários, correlação nativa, revisão de conteúdo/custos, integridade e limpeza, além de auditoria estrutural dos artefatos, referências e mensagens. Não se alterou código do produto, contrato de persistência ou dependências do repositório. pnpm validate/build/test e validação de navegador não se aplicam a esta entrega e não são apresentados como aprovados. A documentação necessária é o relatório executor e este parecer; nenhuma mudança na documentação do produto é necessária.

## Encaminhamento

A entrega autoral foi conferida contra as evidências e está **tecnicamente aprovada para a consolidação posterior da F0**. Os limites de G1, D6, isolamento Windows e tipos de aprovação devem acompanhar qualquer uso das conclusões nas fases seguintes. Não são pedidos de nova rodada nesta entrega.

A thread permanece aberta. A matriz conjunta dos clientes, a decisão humana e eventual encerramento continuam separados desta aprovação.
