# Revisão integrada — frente Codex da F0

**Autor:** codex-software-architect.  
**Entrega revisada:** marc://#msg_0396ca6657144e11b2, de codex-dev, com resultado-f0-codex.md corrigido.  
**Veredito:** aprovada como entrega de investigação com limites explícitos. Não é aprovação de todas as capacidades, encerramento da F0 ou liberação automática de fases.

## Escopo e fontes

Revisei as 14 células autorizadas: A1, A2, A3, B2, B3, C1, C2, D3, D6, D7, E1, E2, E4 e G1. Considerei a seção 8 de proposta-execucao-f0.md, os resultados Claude já lidos, o despacho-f0-codex.md, a entrega autoral do desenvolvedor e os drivers, JSONs e logs de probes preservados em X. Não refiz a pesquisa dos projetos nem consolidei a matriz entre clientes.

A execução permaneceu com um desenvolvedor por vez, sob codex-dev. O desenvolvedor estabeleceu seu próprio bootstrap e recebeu autorização interna antes dos ensaios. O principal registra esta avaliação sob seu próprio perfil. A confirmação de configuração dos perfis e a configuração efetiva dos clientes ensaiados são evidências distintas: os rollouts válidos conferidos registram CLI 0.166.0, gpt-6-luna e xhigh.

A inspeção independente usou context-mode. Durante os ensaios, conferi os registros nativos relevantes antes da remoção do estado privado; na revisão final conferi a entrega consolidada, suas correções, as exportações preservadas, a aritmética, os hashes e os PIDs registrados. Não executei novos clientes para esta revisão final.

## Critérios e evidências avaliadas

| Células | Avaliação integrada |
| --- | --- |
| A1 e A3 | A recusa por active writer foi efetiva. Em A3, os intervalos dos dois processos se sobrepõem; alpha concluiu e beta recebeu recusa antes de criar novo turno. A seleção de ramo é não aplicável nessa tentativa. A conclusão fica limitada aos backends e à versão ensaiados. |
| A2 e E4 | A2 demonstrou continuidade em três direções entre TUI remota e outro cliente do mesmo App Server, usando marcadores novos e consultas que não forneciam a resposta. E4 demonstrou retomada em novo processo no mesmo ID. Isso não transforma a recusa do exec concorrente em suporte a dois escritores independentes. |
| B2 | Houve tools/call real e correspondência de _meta.threadId com a thread nativa. A aprovação pontual foi encaminhada por mcpServer/elicitation/request e resposta accept sem persistência. As opções de persistência oferecidas no request não equivalem a um grant concedido. |
| B3 | O probe registrou a chamada quatro milissegundos após a tecla 1; o rollout confirmou task_complete. O texto antigo da aprovação permaneceu no buffer, portanto não sustentava a leitura inicial de pendência. O MCP permaneceu vivo por cinco segundos após a saída da TUI com o host ativo, e encerrou após o host. /clear, compactação e reconexão permanecem não comprovados. |
| C1 | Os controles reais em PowerShell/ConPTY, mintty e Windows Terminal produziram turnos novos posteriores ao lançamento, com wrapper Node usando stdio inherit e saindo com código 0. Os dados sustentam funcionamento do fluxo de terminal; não são avaliação visual da renderização. A tentativa ConPTY anterior e a repetição de embalagem não foram usadas como prova de novo turno dos três controles. |
| C2 | exec resume recuperou o marcador no mesmo ID após mudança de diretório. O comando resume literal, sem TTY, recusou a entrada. Essa recusa não prova restrição por diretório nem comportamento da TUI. |
| D7 | queue aceitou mensagens em thread ociosa e ocupada. No caso ocupado, o novo turno começou após o encerramento do anterior. Os horários nativos foram separados dos horários de recepção das notificações. agents sem TTY não foi convertido em prova da interface interativa. |
| E1 e E2 | A evidência válida de E1 segue seed, retomada em outro processo, request pendente e resumeOnly posterior. A ausência de reapresentação nessa observação não prova perda de histórico. E2 demonstrou aceite e recusa pontuais de MCP. Aprovações nativas de comando/arquivo não foram comprovadas por esses testes. |
| D3 e D6 | D3 é inconclusiva: houve chamada em code mode, mas não foi confirmado retorno com sessão/PID de waiter ativo. O parser inicial não reconhecia custom_tool_call e a limpeza encontrou falha AttachConsole do driver. O novo ensaio foi bloqueado antes do lançamento; D6 não foi executada. Esses fatos não demonstram incapacidade do cliente Codex. |
| G1 | Houve leitura de cache nas amostras quentes e redução posterior na amostra retomada após 65min57. O intervalo observado de reutilização fica entre a amostra de 7min04 e a de 65min57. A comparação com controles sustenta inferência limitada sobre o prefixo experimental; não isola expiração de roteamento/evicção, não prova cache totalmente frio e não estabelece TTL universal. |

A versão final do relatório usa as três classificações pedidas: 3 células testadas, 9 testadas com limite e 2 com limite declarado. A3 continua com a seleção de ramo não aplicável dentro da classificação limitada. B3 não foi promovida a prova integral; D3 e D6 não foram apresentadas como testes concluídos.

## Comandos, referências e limites de reprodução

A tabela corrigida distingue CLI exec/resume com política never observada de TUI/App Server com on-request. Na tentativa CLI de B2, never falhou fechado. Não houve conversão para política permissiva para executar o probe.

O launcher utilizado foi o executável nativo instalado, não o shim npm:

`C:\nvm4w\nodejs\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`

As formas de CLI, os métodos thread/start, thread/resume e turn/start, os comandos queue/agents e as respostas pontuais estão registrados no relatório e nos drivers/JSONs associados. Os valores de porta, ID, cwd e prompt são locais aos ensaios; não constituem configuração portátil.

Precisão de navegação para C1: os arquivos powershell-02.json, mintty-01.json e windows_terminal-01.json encontram-se em **X/C1/terminals/**, junto de terminal-control-summary.json. Esse é o diretório correto para os nomes abreviados da tabela de comandos. Para B2, o evento de aprovação concreto é mcpServer/elicitation/request.

O estado de sandbox retornado pelo MCP/API não foi tratado como prova de isolamento efetivo no Windows. A configuração solicitada e o isolamento demonstrado não foram confundidos.

## Custo, integridade e limpeza

Conferi a soma das linhas: 53 turnos com uso observado, input 1.087.101, cached input 813.952 e output 9.736. A fórmula da tabela API produz US$ 0,04032242. Cached input é subconjunto de input; reasoning não foi somado novamente ao output.

Esse valor é apenas um equivalente API dos turnos nativos medidos. Não é cobrança ChatGPT, medida da cota, custo total do trabalho ou custo desta sessão principal e da orquestração/desenvolvimento. O consumo dessas sessões não foi medido. Consumos não informados por tentativas interrompidas permanecem desconhecidos.

Na revisão final:

- Os hashes de config.toml do usuário, config.toml do projeto, auth.json original e package.json do node-pty coincidiram com os registros iniciais.
- Não encontrei nenhum dos 78 PIDs registrados ativo. Essa é uma afirmação sobre os PIDs registrados, não sobre todos os processos da máquina.
- Não restou diretório state sob X; as 13 pastas privadas foram removidas após a exportação. A inspeção não encontrou reparse points.
- A varredura limitada dos arquivos de evidência preservados não encontrou os padrões de credencial procurados. Isso não é uma alegação de detector universal de segredos.
- O arquivo espúrio criado pelo uso do ID curto 97415aaf foi removido pelo desenvolvedor. O artefato canônico com ID completo foi preservado.
- As correções editoriais foram verificadas no artefato canônico: UTF-8 legível, classificações, referências E1/C1, comandos e escopo de custo.

Não executei Git. Não houve mudança de produto, hooks ou configuração original. Não se aplica declarar validação de produto ou release: os checks usados foram os ensaios específicos, a revisão de conteúdo/evidências e as verificações estruturais dos registros. A suíte pnpm não foi executada e não está sendo apresentada como aprovada.

## Pendências para a consolidação da F0

1. B3: faltam provas de /clear, compactação e reconexão.
2. D3: falta confirmar o ciclo de vida de um waiter nativo efetivamente ativo, separando saída de TUI e encerramento de host.
3. D6: falta executar a prova de término de background acordando sessão ociosa; não há evidência positiva de despertar.
4. G1: o resultado permite análise de custo/cache com inferência limitada; não autoriza declarar TTL exato ou cache totalmente frio.

Essas lacunas devem ser preservadas na consolidação por capacidade e por cliente. Em particular, B3 não autoriza usar vida do MCP como presença de TUI, e D6 não autoriza assumir despertar Codex. Não foi feita consolidação entre clientes, alteração das propostas ou abertura de fases.

O auto-review rejeitou a execução D3 com require_escalated por interpretar que contrariava a restrição humana contra sandbox permissiva. Em use_default, o Node instalado não ficou acessível. Não foi usado executável alternativo, ferramenta intermediária ou alteração de política para contornar a rejeição. Nova execução dessas provas depende de decisão humana sobre o acesso do controlador.

A entrega autoral e a limpeza verificável estão aprovadas com esses limites. A thread permanece aberta para decisão humana e consolidação posterior.
