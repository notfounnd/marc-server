# Plano de desenvolvimento - Política de registros e aprovação final integrada do loop

## Situação e limite desta etapa

O plano foi inicialmente registrado a pedido do usuário sem autorização de implementação. Posteriormente, o usuário autorizou executar a thread 004a9983 e confirmou que os caminhos estão livres. A execução agora segue o plano e o registro consolidado, sem interferir em outras atividades.

A autorização humana e a disponibilidade dos arquivos foram confirmadas antes de iniciar a execução. O histórico dessa verificação e do handoff está no artefato consolidado de execução e revisão.

A correção da revisão final deve ocorrer nas regras, no procedimento documentado e nas instruções de entrada do harness. Não criar bloqueio por mensagem, aprovação dentro da thread, estado adicional no produto ou requisito de publicação para habilitar a revisão. A thread registra resultados relevantes; não executa nem controla essa etapa.

## Problema observado

O loop está operando, mas o principal publicou na thread uma mensagem composta por verificação de OK_BOOTSTRAP, identidade do worker, configuração de modelo e reasoning, hashes dos consumidores, autorização de caminhos e divisão dos checks.

Essas informações são evidências de controle da execução. Publicá-las como comentários independentes a cada etapa transforma a thread em um diário de orquestração, reduz a legibilidade e dificulta identificar decisões, resultados e pendências do desenvolvimento.

A correção deve resolver o destino das informações, não somente encurtar ou reformatar a mensagem.

O usuário relatou um segundo desvio do mesmo fluxo: após duas rodadas de desenvolvimento, o principal apresentou a entrega como finalizada sem ter realizado a revisão final de todo o desenvolvimento da thread. A avaliação integrada só começou depois de uma cobrança humana.

Revisar tarefas ou rodadas não substitui revisar o conjunto entregue. A adequação deve impedir que conclusão do desenvolvedor, número de loops, ausência de achados críticos ou checks aprovados sejam usados como aprovação final da thread.

O usuário esclareceu também que a restrição original dizia respeito a subagentes criarem novos perfis no mARC, não a publicarem mensagens. A centralização de publicações no arquiteto foi uma ampliação indevida dessa restrição. Corrigir a autoria: desenvolvedores podem publicar suas próprias contribuições relevantes com o perfil compartilhado existente, enquanto o principal publica suas decisões, revisões e avaliação integrada.

## Fontes e diagnóstico

Inspeção realizada com context-mode, leitura das orientações atuais e consulta à memória do mARC.

- `AGENTS.md`, seção mARC Threads and Records: centraliza a publicação no principal, mas não distingue atualização relevante de controle interno.
- `docs/agent-workflows.md`, seções Working a thread, Bootstrap and authorization, Independent review and human acceptance e Posting style: exige o handshake e permite publicar progresso, sem estabelecer um filtro de relevância.
- `.marc/RULES.md`, Custom Rules, Development Loop, item 4: exige preservar reconhecimento e autorização no registro da tarefa, mas não define o destino dessa evidência.
- A orientação de anexar conteúdo longo resolve tamanho, não relevância. Um controle operacional curto também pode ser inadequado como comentário.
- Os perfis atuais do principal e do desenvolvedor também orientam o principal a registrar resultados delegados. Essas instruções devem ser alinhadas para não reintroduzir a retransmissão obrigatória, preservando os perfis e suas configurações.
- AGENTS.md, Implementation, Review, and Acceptance; docs/agent-workflows.md, Independent review and human acceptance; e Custom Rules, Development Loop, item 5, já exigem revisar a thread e a implementação acumulada. O relato não demonstra ausência dessa obrigação. Demonstra que ela precisa ter momento, evidência e condição de saída explícitos antes da entrega final.

Decisões históricas que permanecem válidas:

marc://$documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81

marc://$correcao-do-fluxo-de-agentes-para-independencia-de-fornecedores--dd4a5684

Preservar o loop, o bootstrap independente, a autorização explícita antes de editar, os papéis persistentes compartilhados, a revisão integral e a independência de ferramentas e fornecedores.

## Objetivo

Definir um contrato claro para separar comunicação entre agentes, evidência persistente da execução e mensagens relevantes da thread, e tornar a revisão final integrada uma etapa obrigatória do fluxo antes da aprovação técnica do desenvolvimento.

A thread continuará sendo a memória do desenvolvimento, com decisões, justificativas, resultados, riscos, bloqueios e entrega. O controle do loop continuará rastreável sem exigir comentários para cada movimento do agente.

O principal deve avaliar e aprovar o resultado integrado por iniciativa própria, sem depender de o usuário perguntar se a revisão final foi feita. Desenvolvedores mantêm a autoria de suas contribuições e não precisam que o principal publique seus relatos em nome deles.

RULES estabelece a obrigação, docs descrevem sua execução e AGENTS.md a reforça como instrução direta para o harness. A conclusão depende da avaliação efetiva do principal, não de uma mensagem, de um campo preenchido ou da existência de um artefato.

## Escopo autorizado

Uma tarefa documental atômica e integrada nos três arquivos de contrato:

- `AGENTS.md`.
- `docs/agent-workflows.md`.
- Somente a seção Custom Rules de `.marc/RULES.md`.

Complementar com o alinhamento das responsabilidades descritas nos perfis existentes do principal e do desenvolvedor compartilhado quando contradizem a publicação direta. Essa manutenção permanece a cargo do principal, pelas ferramentas oficiais do mARC, após autorização da execução. Os perfis observados nesta atividade são codex-software-architect e codex-dev; esses IDs são alvos atuais de manutenção, não uma lista normativa para ferramentas futuras.

A parte gerenciada de RULES deve permanecer intacta. As obrigações existentes não relacionadas à publicação devem ser preservadas.

Não alterar código do produto, API, MCP, UI, mecanismo de busca, modelos, limites de concorrência ou configuração de clientes. Não criar, renomear ou excluir perfis de agentes; manter os metadados, modelos e configurações dos perfis existentes. A única manutenção de perfis prevista é alinhar responsabilidades e limites de publicação. Não criar hooks específicos de terceiros. Não reescrever threads históricas nem editar a atividade que motivou o relato sem autorização específica.

Não modificar a skill gerenciada marc-ops nem INSTRUCTIONS.md. A skill já orienta aplicar RULES e Custom Rules; esta atividade ajusta o contrato local.

## Política de destinos

### 1. Comunicação interna entre principal e desenvolvedor

Usar os canais de comunicação de agentes oferecidos pelo cliente, sem pressupor uma API ou ferramenta específica.

Permanecem nesse canal:

- Handoff da atividade e instruções de execução.
- Resposta OK_BOOTSTRAP.
- Solicitação e comunicação da autorização para editar.
- Pedidos de esclarecimento, retomada ou ajuste.
- Retorno do desenvolvedor e achados devolvidos pelo principal.
- Informações operacionais necessárias para coordenar a atividade.

Não replicar automaticamente esses eventos como comentários na thread. Desenvolvedores continuam sem administrar perfis ou despachar outros desenvolvedores, mas podem publicar diretamente suas contribuições relevantes na thread autorizada, sob o perfil compartilhado existente.

Informações necessárias à rastreabilidade também devem ser preservadas no artefato consolidado. O canal interno não substitui o registro durável.

### 2. Artefato consolidado de execução e revisão

Usar um artefato associado à atividade para preservar a evidência do loop. Reutilizar um artefato adequado existente quando houver, sem gerar um arquivo por handshake ou rodada.

O artefato deve ser anexado por metadados em uma mensagem substantiva, como a apresentação do plano de execução. A atualização posterior do arquivo já associado não exige um novo comentário operacional nem depende de existir uma tool para editar mensagens.

Desenvolvedores podem criar e anexar relatórios substantivos de suas tarefas pelas ferramentas oficiais do mARC, dentro do escopo autorizado. Não criar um anexo por handshake ou ajuste. Definir a propriedade dos arquivos no handoff para evitar edições concorrentes; a revisão final integrada e o registro de autorização permanecem sob responsabilidade do principal.

Conteúdo previsto:

- Identificação da tarefa, escopo e critérios de aceite.
- Perfil do principal e perfil compartilhado do desenvolvedor, quando pertinente.
- Configuração da atividade, origem da confirmação e limites realmente conhecidos.
- Reconhecimento de bootstrap, fontes consultadas e verificação feita pelo principal.
- Decisão explícita de autorização, escopo concedido e eventuais restrições.
- Entregas, verificações, achados, ajustes solicitados e resultado de cada rodada.
- Avaliação final integrada do principal, distinta das revisões de tarefas, com cobertura do escopo, critérios de aceite, evidências, achados e veredito.
- Aprovação técnica, riscos e pendências apresentados ao usuário.

Registrar fatos observados, sem inventar introspecção, execução ou autorização. Distinguir configuração confirmada por humano de configuração verificada por runtime.

Preservar a sequência e os resultados das rodadas. Consolidar não significa apagar uma reprovação anterior ou substituir evidências por um estado final sem histórico.

Não exigir logs integrais, fingerprints ou campos adicionais por padrão. Conservar somente a evidência necessária às regras e aos critérios da tarefa.

Antes de liberar a edição, o principal verifica o reconhecimento, registra a verificação e a decisão de autorização no artefato e comunica explicitamente a autorização ao desenvolvedor. O desenvolvedor continua aguardando essa comunicação antes de editar.

A criação inicial e a associação do artefato devem usar as ferramentas oficiais do mARC. Alterações manuais posteriores de arquivos existentes devem usar apply_patch nativo e preservar os metadados da associação.

Se não for possível persistir ou associar a evidência obrigatória, não dispensar o requisito. Tratar a falha como impedimento e solicitar orientação humana quando necessário.

### 3. Mensagens de desenvolvimento da thread

Publicar somente conteúdo que altere a compreensão do problema, da solução, dos riscos ou do estado relevante da entrega.

O filtro se aplica a todos os autores. O desenvolvedor publica suas descobertas, impedimentos, resultados e entrega da tarefa com o perfil compartilhado existente; o principal publica decisões arquiteturais, avaliação independente e entrega integrada. Não exigir retransmissão pelo arquiteto nem aprovação prévia de cada mensagem relevante do desenvolvedor.

Cada desenvolvedor usa o perfil e a thread definidos no handoff. Não executar agent_register para cada spawn ou mensagem. Se o perfil não existir ou o mapeamento estiver incerto, consultar o principal antes de publicar; não criar ou atualizar o cadastro por conta própria. Manutenção de perfis continua exclusiva do principal e depende de autorização humana.

O relato de uma tarefa concluída deve explicitar seu alcance e as validações realizadas. Não representa aprovação técnica da thread, que depende da revisão final do principal. Não duplicar o relato do desenvolvedor em uma postagem do arquiteto sem acrescentar avaliação, decisão ou síntese integrada relevante.

São publicações adequadas:

- Proposta ou plano detalhado, acompanhado do anexo correspondente.
- Decisão técnica e sua justificativa.
- Descoberta que altere a solução ou os critérios de aceite.
- Mudança de escopo que exija alinhamento.
- Bloqueio ou risco com impacto real, especialmente quando exige ação humana.
- Resultado significativo de uma iteração ou validação.
- Aprovação técnica integrada e entrega para avaliação do usuário.
- Aceite e encerramento quando explicitamente autorizados pelo humano.

Não publicar como comentários independentes:

- Worker criado, retomado ou aguardando.
- OK_BOOTSTRAP recebido ou conferido.
- Autorização de edição ou repetição do handoff.
- Identidade runtime, caminhos, hashes ou configuração usados apenas como controle operacional.
- Início de um comando ou de uma bateria de testes.
- Confirmação de leitura de arquivos ou de execução de tools.
- Auditoria sem achados como evento isolado.
- Cada devolutiva de revisão, ajuste pequeno ou passagem de estado do loop.

Esses detalhes podem aparecer em um relatório técnico quando explicam uma decisão, um risco, uma falha ou um resultado. A exclusão é baseada na finalidade da publicação, não em uma lista proibida de palavras.

O resultado agregado de validação pode mencionar auditoria e evidências do loop quando isso ajuda avaliar a entrega. Não criar uma mensagem por check.

Atualizações de andamento na conversa com o usuário continuam possíveis conforme as orientações do cliente. Não devem ser automaticamente copiadas para a thread.

## Revisão final integrada como etapa obrigatória do fluxo

### Momento e responsabilidade

Após concluir as tarefas planejadas e integrar a última correção, o principal deve realizar uma avaliação final independente de todo o desenvolvimento autorizado da thread antes de apresentar a entrega como concluída ou tecnicamente aprovada.

Essa avaliação não é um novo desenvolvimento nem precisa gerar um comentário operacional anunciando seu início. Sua evidência permanece no artefato consolidado; o resultado aparece na mensagem substantiva de entrega.

O principal é responsável pela avaliação e pelo veredito. Pode usar relatórios dos desenvolvedores como fontes, mas não substituir seu crivo por uma autoavaliação do executor, contagem de rodadas, ausência de achados críticos, auditoria estrutural ou sucesso dos testes.

O principal deve executar essa etapa a partir das instruções do contrato e do harness, mesmo quando não houver mensagem a publicar. Escrever que revisou, anexar um relatório ou receber uma confirmação na thread não substitui realizar a avaliação.

### Cobertura da avaliação

Revisar o conjunto acumulado da atividade, não apenas a última tarefa ou diff:

1. Objetivo, plano aprovado, decisões posteriores e critérios de aceite da thread.
2. Implementação final e todas as tarefas ou correções que a compõem, incluindo a integração entre elas.
3. Correção funcional e comportamentos esperados, casos de falha e regressões pertinentes ao escopo.
4. Arquitetura, contratos, qualidade do código, manutenibilidade e aderência às regras aplicáveis.
5. Cobertura de testes, resultados das validações realmente executadas e limitações da evidência disponível.
6. Documentação, textos e contratos afetados, observando diferenças entre entrega técnica e registros conversacionais.
7. Preservação de alterações do usuário, fronteiras de escopo e ausência de mudanças não autorizadas.
8. Riscos, achados pendentes e condições para apresentar a entrega ao humano.

Todo o desenvolvimento da thread significa o escopo autorizado e seu estado final integrado. Não autoriza revisar ou refatorar indiscriminadamente o repositório, retomar trabalho de outras threads ou modificar uma atividade concorrente.

### Evidência e veredito

Registrar uma seção identificável de revisão final no artefato consolidado, contendo:

- Escopo integrado efetivamente revisado e fontes usadas.
- Relação entre critérios de aceite, implementação e evidências verificadas pelo principal.
- Avaliação das dimensões pertinentes e justificativa para dimensões não aplicáveis.
- Achados, correções solicitadas, validações e resultados, distinguindo observação direta de relato do executor.
- Limitações, exceções explicitamente autorizadas pelo humano e riscos restantes.
- Veredito do principal: aprovado, reprovado ou pendente, com justificativa.

Não considerar uma lista marcada, a frase revisão realizada ou um resumo do relatório do desenvolvedor como evidência suficiente. O registro precisa demonstrar a avaliação do resultado integrado.

O veredito aprovado depende de atender aos critérios de aceite e de qualidade, respeitando apenas exceções explicitamente autorizadas pelo humano. Falta de evidência necessária ou achado corretivo em aberto mantém a aprovação pendente ou reprovada. Limitações conhecidas devem ser explicitadas, nunca ocultadas como sucesso.

### Retorno ao loop e condição de aprovação técnica

Se a avaliação final encontrar problemas, devolver achados concretos ao desenvolvedor responsável e continuar o loop. Após os ajustes, reavaliar o conjunto integrado, atualizar as evidências afetadas e emitir novo veredito antes de apresentar a entrega.

Uma alteração de implementação após a aprovação final invalida o veredito anterior para o novo estado. O principal deve reavaliar o resultado integrado e atualizar sua aprovação, repetindo as validações afetadas conforme os riscos e as regras do projeto. Não reutilizar a aprovação de uma versão anterior como se cobrisse alterações posteriores.

O fluxo mantém a aprovação técnica pendente até o principal concluir sua revisão final independente e aprovar o estado integrado entregue. Essa é uma obrigação de execução estabelecida nas instruções, não um bloqueio de message_post ou uma autorização emitida pela thread.

Comunicar entrega de uma tarefa individual como progresso é permitido quando seu alcance fica explícito. Não confundir tarefa pronta, implementação concluída, revisão final aprovada, aceite humano e encerramento da thread.

A comunicação da entrega ocorre depois da avaliação e apenas apresenta seu resultado, mudanças, validações, riscos e pendências, com o artefato associado. Não é a mensagem que concede a aprovação. O aceite humano e a autorização de fechamento continuam sendo etapas posteriores e independentes.

## Alterações por arquivo

### AGENTS.md

Reforçar a instrução de entrada do harness nos pontos adequados de registro e de revisão:

- Thread é memória do desenvolvimento, não diário de execução de agentes.
- Handshake e controle interno não geram comentários por etapa.
- Evidência do loop permanece em artefato consolidado.
- Mensagens passam pelo filtro de relevância.
- Desenvolvedores publicam suas próprias contribuições relevantes com o perfil compartilhado existente; o principal não é um intermediário obrigatório de suas mensagens.
- Administração de perfis e publicação são responsabilidades distintas. Proibir novos perfis por spawn não proíbe autoria direta do desenvolvedor.
- Procedimento completo continua em docs e obrigações em RULES.
- Instruir diretamente o principal a realizar a avaliação final de todo o desenvolvimento, após a integração da última correção, além das revisões por tarefa.
- Distinguir trabalho do desenvolvedor concluído de aprovação técnica da atividade, sem inferir aprovação pelo retorno do executor ou pela quantidade de rodadas.
- Estabelecer a ordem executar, revisar o conjunto, resolver achados, aprovar tecnicamente e então apresentar ao humano.
- Ao retomar após perda de contexto, reconstruir o estado da revisão final a partir do plano, da implementação e das evidências. Não presumir revisão final a partir de tarefas concluídas.
- Não exigir mensagem de liberação na thread nem configuração específica de um cliente. AGENTS.md é a entrada de instruções existente; RULES e docs permanecem as fontes complementares do contrato.

Evitar duplicar templates, listas extensas ou regras de configuração já existentes.

### docs/agent-workflows.md

- Refinar Working a thread para vincular progresso publicado a marcos substantivos.
- Explicitar o destino do OK_BOOTSTRAP e da autorização na seção de bootstrap.
- Explicitar que os templates de reconhecimento e retorno são comunicação entre agentes, não modelos de postagem na thread.
- Descrever criação, associação e atualização do artefato consolidado sem exigir comentários de controle.
- Integrar o registro das rodadas à revisão independente.
- Distinguir revisão por tarefa, avaliação final integrada, aprovação técnica, aceite humano e encerramento.
- Definir momento, cobertura, evidência e veredito da revisão final, incluindo retorno ao loop e reavaliação após alterações posteriores.
- Acrescentar um template de avaliação final que demonstre critérios verificados e limites, sem ser um checklist vazio.
- Expandir Posting style com filtro de relevância e exemplos adequados e inadequados.
- Diferenciar conversa com usuário, canal de agentes, artefato e thread sem fixar ferramentas ou fornecedores.
- Corrigir a centralização das publicações e descrever autoria por responsabilidade, reutilização do perfil existente e uso direto das ferramentas oficiais para mensagens e anexos relevantes.
- Preservar o requisito de apresentar a entrega e aguardar aceite humano.

### Custom Rules de RULES.md

- Precisar o item de evidência de bootstrap e autorização para indicar artefato consolidado da atividade.
- Precisar o destino dos checks, achados e aprovação técnica quando pertencem à evidência de execução.
- Introduzir regra operacional de relevância de publicação, com Trigger, Do instead, Evidence e Severity.
- Exigir que cada autor aplique o filtro antes de message_post e que nenhum agente espelhe automaticamente o canal interno de orquestração.
- Corrigir a regra de perfis para permitir publicação direta dos desenvolvedores sob o perfil compartilhado existente, mantendo a proibição de criação ou atualização de perfis por subagentes.
- Preservar a administração do catálogo pelo principal, sem tornar essa responsabilidade uma exclusividade de autoria ou publicação.
- Manter exceção para informação operacional que se torna risco, decisão ou impedimento relevante.
- Tornar explícita a aprovação final integrada como condição anterior à apresentação do desenvolvimento como concluído, com veredito e evidência da avaliação pelo principal.
- Precisar que aprovação de tarefas, número de rodadas, ausência de achados críticos, auditoria estrutural, checks aprovados e registros publicados não substituem a avaliação final.
- Exigir retorno ao loop quando houver pendências e reavaliação do estado integrado após mudanças de implementação.
- Preservar os demais requisitos do loop e o trecho gerenciado.

Textos normativos dos três arquivos devem permanecer em en-US. Plano, comentários, avaliações e registros conversacionais ficam em pt-BR com acentuação normal.

### Perfis persistentes existentes

- Alinhar somente as responsabilidades que obrigam o principal a retransmitir resultados do desenvolvedor.
- Explicitar que o desenvolvedor pode publicar mensagens e anexos relevantes com seu perfil compartilhado existente, sem criar cadastro por spawn.
- Preservar autoria do principal para sua revisão e aprovação integrada, sem atribuir a ele relatos produzidos pelo executor.
- Manter IDs, papéis, modelos, configurações e demais instruções pertinentes. Não tocar no perfil humano nem administrar perfis por iniciativa dos subagentes.
- Realizar a manutenção pelo principal via MCP, fora dos caminhos de escrita delegados ao desenvolvedor.

## Exemplos de comportamento esperado

| Situação | Destino e comportamento |
| --- | --- |
| Desenvolvedor retorna OK_BOOTSTRAP | Canal de agentes; principal verifica e preserva evidência no artefato. Sem comentário de handshake. |
| Principal autoriza três arquivos | Artefato e comunicação explícita ao desenvolvedor. Sem comentário separado na thread. |
| Um arquivo tem hash diferente do baseline | Artefato quando é controle normal. Thread se evidencia mudança concorrente ou risco que exige alinhamento. |
| Desenvolvedor inicia pnpm validate | Controle interno ou andamento na conversa. Sem postagem apenas anunciando o comando. |
| Validação detecta regressão com impacto | Registro no artefato e mensagem relevante quando altera o estado da entrega ou requer decisão. |
| Principal devolve um ajuste de redação | Canal de agentes e registro da rodada. Sem comentário por ajuste. |
| Revisão encontra incompatibilidade arquitetural | Artefato detalhado e publicação da descoberta e do impacto quando necessário. |
| Auditoria termina sem achados | Evidência no artefato e eventual resultado agregado. Sem mensagem isolada por audit. |
| Entrega atende aos critérios | Mensagem com mudanças, validação, riscos e solicitação de avaliação humana. |
| Sessão é recompactada | Refazer bootstrap exigido e consultar o registro consolidado. Não postar apenas a retomada. |
| Aprovação de comando está pendente | Não encerrar o desenvolvedor por aparente inatividade. Publicar somente se há impedimento relevante para o usuário. |
| Usuário pede o histórico da execução | Apresentar ou referenciar o artefato existente, preservando sua evidência. |
| Desenvolvedor conclui uma tarefa e valida seu resultado | Publicar seu próprio relato relevante com o perfil compartilhado, identificando alcance, evidências e revisão do principal ainda pendente. |
| Principal recebe um relato já publicado pelo desenvolvedor | Revisar e registrar sua própria avaliação quando relevante, sem repostar automaticamente o relato como se fosse seu. |
| Novo subagente é iniciado para o mesmo papel | Reutilizar o perfil compartilhado existente. Não registrar novo agente nem atualizar o perfil por spawn. |
| Duas rodadas terminaram e os desenvolvedores reportaram sucesso | Realizar revisão final integrada antes de declarar a thread concluída. Não há número de rodadas que dispense essa avaliação. |
| Última tarefa passou nos checks, mas a integração não foi revisada | Aprovação final pendente. Checks e aprovação da tarefa não aprovam automaticamente o conjunto. |
| Revisão final encontra quebra de contrato ou documentação incorreta | Devolver ao desenvolvedor, corrigir e reavaliar o estado integrado antes da entrega. |
| Principal aprovou e a implementação foi alterada em seguida | Reavaliar o novo estado e atualizar evidências e veredito; a aprovação anterior não cobre a alteração. |
| Usuário pergunta se toda a thread foi revisada | Referenciar a revisão final já realizada e sua evidência. Não depender dessa pergunta para começar a avaliação obrigatória. |

Não implementar classificação automática de mensagens, filtros por palavras ou bloqueios em ferramentas do produto. Os exemplos são critérios de revisão do contrato e do comportamento do agente.

## Sequência de desenvolvimento

1. Revalidar autorização humana e ausência de conflito com a sessão ativa.
2. Reler os três arquivos e o plano, identificando alterações concorrentes desde o planejamento.
3. Preparar um handoff único, completo e autocontido para as três alterações documentais, incluindo publicação direta e propriedade dos artefatos. Manter a administração dos perfis fora do escopo delegado.
4. Confirmar a configuração do desenvolvedor pelos critérios vigentes, sem fixar fornecedor na política.
5. Aplicar bootstrap independente, registro de evidência e autorização explícita usando os destinos planejados.
6. Desenvolvedor altera somente os arquivos autorizados com apply_patch nativo e reporta ao principal.
7. Principal alinha as responsabilidades dos perfis existentes pelas ferramentas oficiais e revisa o contrato integrado, os exemplos e as obrigações preservadas.
8. Devolver inconsistências ao mesmo desenvolvedor até obter qualidade aceitável.
9. Executar a validação aplicável e realizar a revisão final integrada de todo o desenvolvimento da thread, com evidência e veredito do principal.
10. Se o veredito não for aprovado, retornar ao loop, corrigir e reavaliar o conjunto final.
11. Verificar que a aprovação corresponde ao estado efetivamente entregue e publicar a entrega relevante, com artefatos vinculados.
12. Aguardar avaliação humana, tratar críticas e manter o fechamento dependente de autorização explícita.

Uma única atividade delegada é suficiente: os arquivos compartilham o mesmo contrato e devem ser revisados juntos. Nesta execução, a delegação ocorreu somente após autorização humana, bootstrap independente e autorização explícita do principal.

## Validação e critérios de aceite

### Validação documental

- Não há instrução exigindo comentário de thread para bootstrap, autorização ou cada transição do loop.
- O reconhecimento e a autorização continuam obrigatórios antes de editar.
- A evidência continua persistente e recuperável após perda de contexto.
- Mensagens relevantes não são suprimidas por conter informação operacional.
- Há um único entendimento de destinos nos três arquivos.
- A parte gerenciada de RULES permanece intacta.
- A solução continua independente de ferramentas, modelos e fornecedores.
- Não há nova configuração fixa nem alteração dos limites de concorrência.
- Desenvolvedores podem publicar diretamente contribuições relevantes sob o perfil compartilhado existente, sem criar ou atualizar perfis.
- Os documentos e os perfis existentes não obrigam o principal a retransmitir mensagens de autoria do desenvolvedor.
- Relatos de tarefas não são apresentados como aprovação final da thread; decisões e avaliação do principal preservam sua própria autoria.
- Exemplos distinguem controle interno, evidência e publicação substantiva.
- Os textos normativos permanecem em en-US; os registros conversacionais usam pt-BR com acentuação.
- Metadados de anexos e referências do mARC são válidos.
- Revisões por tarefa e aprovação final integrada são etapas distintas, com momento e responsabilidades explícitos.
- Nenhuma orientação permite declarar a thread concluída antes da aprovação final do principal.
- A avaliação final cobre o desenvolvimento acumulado, não apenas a última alteração, e possui evidência além de uma declaração de cumprimento.
- Quantidade de loops, checks aprovados e auditoria estrutural não substituem o crivo integrado.
- Achados da avaliação final voltam ao loop e alterações posteriores exigem reavaliar o estado entregue.
- Aprovação técnica final continua distinta de aceite humano e encerramento.
- O comportamento esperado está instruído em AGENTS.md, detalhado em docs e exigido nas Custom Rules, sem depender de uma mensagem ou aprovação emitida na thread.
- Não há bloqueio em tools, novo estado de thread, hook de terceiros ou declaração publicada usada como substituto da revisão efetiva.

### Validação do projeto

Para validar esta alteração dos documentos técnicos, executar nesta ordem:

1. `pnpm validate`.
2. `pnpm build`.
3. `pnpm test`.

Revisar Markdown, links locais e a coerência entre os três documentos. Registrar os comandos realmente executados, resultados e limitações. Os checks do projeto não demonstram, por si só, que um agente obedecerá à política.

### Validação comportamental

Em sessão nova, com uma tarefa pequena e real autorizada pelo usuário:

- Verificar bootstrap independente e autorização efetiva antes de editar.
- Verificar que o principal possui a evidência no artefato sem postar o handshake.
- Verificar que o desenvolvedor publica uma contribuição relevante com o perfil compartilhado, sem chamar agent_register ou alterar o cadastro.
- Verificar que o principal avalia a contribuição em vez de simplesmente retransmiti-la como autor.
- Exercitar pelo menos uma devolutiva de revisão e verificar que o loop não gera comentário por ajuste.
- Verificar que, mesmo após mais de uma rodada bem-sucedida, o principal avalia todo o desenvolvimento antes de apresentar conclusão.
- Verificar que o artefato contém evidência e veredito da revisão final integrada, e não somente revisões das tarefas.
- Verificar que a revisão final começa por iniciativa do principal, a partir das instruções, sem cobrança humana ou mensagem de liberação na thread.
- Quando houver achado final ou alteração posterior, verificar retorno ao loop e reavaliação antes da apresentação da entrega.
- Verificar que decisão, bloqueio real e resultado significativo continuam sendo publicados quando aplicáveis.
- Confirmar que a entrega final informa mudanças, validações e pendências.
- Confirmar que a thread permanece aberta até autorização humana de fechamento.

Não provocar falhas artificiais nem ampliar uma tarefa real apenas para completar a matriz. Casos não observados podem ser avaliados documentalmente, com essa limitação registrada. Não alegar teste comportamental quando houve somente leitura de textos.

Esta adequação orienta comportamento por contrato. Não garante obediência de qualquer cliente ou modelo e não introduz enforcement via hooks.

## Estado do planejamento

- [x] Problema observado e fontes atuais analisadas.
- [x] Histórico relevante consultado no mARC.
- [x] Proposta detalhada estruturada.
- [x] Implementação autorizada pelo usuário.
- [x] Handoff e evidência de execução preparados.
- [x] Alterações dos três documentos desenvolvidas.
- [x] Responsabilidades dos perfis existentes alinhadas pelo principal, sem novos cadastros ou alteração de configuração.
- [x] Revisão integrada e validações concluídas.
- [x] Aprovação final do principal registrada para todo o desenvolvimento e para o estado efetivamente entregue.
- [x] Validação comportamental realizada ou limitações registradas; observações desta execução e limite de sessão nova explicitados no artefato de revisão.
- [x] Entrega avaliada pelo usuário, após confirmação do escopo documental.
- [x] Encerramento explicitamente autorizado.

Após registrar este plano, o usuário autorizou executar a thread 004a9983. A execução, correções, validações e revisão final integrada foram concluídas e registradas no artefato consolidado. O usuário confirmou o escopo documental e autorizou o encerramento. A summary consolida o resultado e preserva os limites de validação comportamental, sem novas alterações de implementação.
