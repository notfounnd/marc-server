# Análise de coerência do harness do mARC

## Resumo

A revisão do estado integrado do harness identificou sete pontos de desalinhamento nas instruções de entrada, recomendações gerenciadas e helpers MCP. O núcleo do loop está coerente e não precisa ser redesenhado. A oportunidade é eliminar instruções concorrentes, completar a autoridade canônica e tornar explícitas as condições de uso das operações.

Esta análise inclui trechos preexistentes. Os achados não são atribuídos exclusivamente ao desenvolvimento da thread de contexto.

marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7

## Estado e autorização

- O usuário autorizou o registro desta análise em uma nova thread.
- O usuário concluirá o commit da outra thread antes de retomar os ajustes.
- Este registro não autoriza implementação, dispatch de desenvolvedores, alterações nos documentos do harness ou encerramento desta thread.
- Quando o usuário autorizar a continuidade, conferir o estado pós-commit e preparar o plano detalhado antes do desenvolvimento.
- Não há tarefas de implementação iniciadas.

## Escopo da revisão

A análise foi realizada diretamente pelo principal, com context-mode, sem delegação, alterações manuais ou comandos Git.

Fontes centrais:
- `AGENTS.md`.
- `.marc/RULES.md`, incluindo baseline gerenciado e todas as Custom Rules.
- `.marc/INSTRUCTIONS.md`.
- `.agents/skills/marc-ops/SKILL.md`.
- `docs/agent-workflows.md`.
- `docs/harness-engineering.md`.
- `docs/development.md`.
- Perfis persistentes `codex-dev`, `codex-software-architect` e `ui-user`.

Fontes de apoio:
- Fluxo principal do README.
- `docs/mcp-tools.md`, `docs/architecture.md` e as ADRs 0001 a 0009.
- Contrato de configurações em `docs/memory.md`.
- Geradores `src/core/recommendations.ts` e `src/core/marc-ops-skill.ts`.
- Orientação operacional em `src/mcp/helper.ts`.
- Metadados e descrições de leitura em `src/core/threads.ts` e `src/mcp/thread-tools.ts`.

Os perfis representam papéis persistentes e escolhas atuais, não uma restrição geral de fornecedor para o fluxo. A configuração local do cliente foi inspecionada quanto a superfícies de instrução, sem alterações. Skills pessoais externas, como napkin, não são parte do contrato do produto mARC.

## Achados

### 1. P2 — Cursor pode avançar sem consumir as mensagens

**Referência:** `.marc/RULES.md:31`. A orientação também é emitida por `src/core/recommendations.ts:25`.

A regra manda guardar o `lastMessageId` retornado por `thread_read`, `thread_tail` ou `thread_info`. Entretanto, o cursor retornado por uma consulta de metadados identifica a última mensagem existente, não comprova sua leitura pelo agente.

**Cenário:** o agente leu até A. Uma consulta a `thread_info` informa B como última mensagem. Se B substituir o cursor de leitura, `thread_read_since` a partir de B omite as mensagens posteriores a A e até B, inclusive B. Isso pode ocultar decisões, alterações de escopo ou novas instruções humanas.

**Direção de correção:** distinguir o cursor de conteúdo efetivamente consumido do identificador mais recente observado em metadados. Não avançar o cursor de leitura apenas por consultar `thread_info`. Preservar a leitura incremental, o armazenamento do cursor após consumo de conteúdo e o fallback explícito quando o cursor falhar. Esclarecer também os limites de `thread_tail` quando houver mensagens pendentes fora da janela retornada.

### 2. P2 — Orientação gerenciada incentiva registro de agentes

**Referências:** `.marc/RULES.md:9`, `src/core/recommendations.ts:19` e `docs/mcp-tools.md:203`.

O baseline orienta registrar agentes antes de postar. O fluxo local exige que desenvolvedores reutilizem o perfil compartilhado e proíbe que administrem o catálogo ou registrem perfis por spawn. A precedência da Custom Rule resolve formalmente o conflito, mas as instruções concorrentes continuam presentes no onboarding. O helper também apresenta registro como uma ação típica anterior à publicação.

**Risco:** criação de perfis efêmeros ou atualização indevida de perfis existentes quando o agente segue a recomendação genérica sem aplicar a política local.

**Direção de correção:** tornar explícita a descoberta e reutilização de perfis existentes. Condicionar criação ou atualização à necessidade real e à autorização prevista no contrato do workspace. O produto não deve impor a todos os consumidores a divisão de papéis específica deste repositório. Aqui, manter a administração pelo principal e a publicação própria do desenvolvedor sob o perfil compartilhado autorizado.

### 3. P2 — Skill e helper estimulam registros operacionais

**Referências:** `.agents/skills/marc-ops/SKILL.md:87`, `src/core/marc-ops-skill.ts:88` e `src/mcp/helper.ts:140`.

A skill recomenda comentários incrementais sobre mudanças, validação e pendências. O helper sugere postar apenas para reconhecer a leitura da thread e anunciar a próxima ação. Essas recomendações podem incentivar registros sem contribuição material, contrariando o filtro de relevância e a proibição de diários de execução.

**Direção de correção:** orientar contribuições substantivas, entregas consolidadas e transferências reais de responsabilidade. Não recomendar publicação por cadência ou por uma operação ter ocorrido. Manter bootstrap, autorizações, comandos, correções e coordenação rotineira no canal interno. Preservar mensagens úteis durante a execução quando uma decisão, descoberta, risco ou bloqueio realmente mudar o entendimento do trabalho.

Não substituir excesso de registros por silêncio obrigatório. O desenvolvedor continua responsável por sua entrega autoral consolidada e pode publicar outras contribuições relevantes.

### 4. P2 — Contrato canônico não contém todas as restrições obrigatórias

**Referências:** `AGENTS.md:7`, `AGENTS.md:18` e `AGENTS.md:75` a `AGENTS.md:79`.

AGENTS estabelece RULES como fonte canônica, mas algumas restrições obrigatórias estão somente no entrypoint: Git exige autorização explícita, Playwright deve ser usado pela CLI e não pelo MCP, alterações manuais exigem apply_patch nativo, e hooks específicos de cliente ou fornecedor não devem ser adicionados por padrão. RULES já contém orientações de context-mode e Bash, mas não reúne essas demais exigências.

**Risco:** um cliente que receba somente o contrato do bootstrap não recebe todas as restrições do projeto. Não se pode presumir carregamento automático de AGENTS em todos os clientes.

**Direção de correção:** colocar as exigências locais na seção canônica de Custom Rules e manter em AGENTS resumos operacionais e referências. Não mover essas restrições específicas do projeto para o baseline genérico de todos os consumidores mARC. Preservar a responsabilidade do principal de fornecer as fontes aplicáveis ao desenvolvedor.

### 5. P2 — Refresh aparece como alternativa ao bootstrap

**Referência:** `docs/development.md:149` a `docs/development.md:159`.

O documento apresenta `workspace_bootstrap` ou `workspace_update_recommendations` como alternativas antes de agir numa thread. Atualizar recomendações não equivale a obter, ler e confirmar o contrato de bootstrap.

**Direção de correção:** separar o bootstrap inicial da manutenção de recomendações numa sessão já estabelecida. Reutilizar um contrato conhecido e válido quando aplicável, sem repetir bootstrap como ritual. O refresh não deve ser apresentado como substituto da confirmação inicial.

### 6. P2 — Regra de persistência amplia demais o papel do Markdown

**Referências:** `.marc/RULES.md:53` a `.marc/RULES.md:56`, `AGENTS.md:13` e `docs/memory.md:127`.

A Custom Rule é acionada por mudanças amplas de persistência e manda preservar Markdown como estado autoritativo, sem delimitar os dados aos quais isso se aplica. Configurações de máquina persistem em `.marc/marc.config.json`, conforme o contrato atual.

**Risco:** induzir conversões desnecessárias de configurações ou tratar formatos legítimos como violações da arquitetura.

**Direção de correção:** delimitar os registros de conhecimento e coordenação cujo estado autoritativo é Markdown. Preservar configurações estruturadas e demais formatos estabelecidos. Continuar distinguindo registros autoritativos de caches, índices e projeções reconstruíveis. Não alterar formatos de persistência nesta adequação do harness.

### 7. P2 — Helper geral aponta para caminho específico deste repositório

**Referência:** `src/mcp/helper.ts:127`.

O helper MCP aponta diretamente para `docs/agent-workflows.md#closing-threads` como guia canônico de composição. Esse caminho pode não existir no workspace consumidor onde o mARC está instalado.

**Direção de correção:** remeter a orientação operacional ao contrato do workspace atual. Se houver uma referência à documentação do produto, identificá-la como documentação do mARC, sem presumir um arquivo local no projeto consumidor. Não exportar o loop particular deste repositório como obrigação geral dos usuários do produto.

## Observação de manutenção

`AGENTS.md:34` ainda repete parte das instruções de composição e menciona somente mensagens, enquanto a Custom Rule e o guia compartilhado abrangem mensagens, artefatos e summaries.

Isso não bloqueia a aplicação da regra atual, mas merece alinhamento para reduzir divergências futuras. Manter o guia compartilhado como fonte comum, sem criar outra política, template rígido, checklist publicado ou gate de ferramenta.

## O que deve ser preservado

- Tarefas atômicas, autocontidas, completas e com paths autorizados explícitos.
- Bootstrap independente do desenvolvedor e autorização do principal antes das edições.
- Entrega própria do desenvolvedor, sob perfil compartilhado, sem retransmissão pelo principal.
- Revisão final integrada e independente do principal, iniciada sem depender de cobrança humana.
- Correções e coordenação rotineira no canal interno, não em comentários ou artefatos por iteração.
- Separação entre conclusão da implementação, aprovação técnica, aceite humano e autorização de encerramento.
- Escolha de modelos por capacidade e reasoning confirmados, sem fornecedor obrigatório e sem inventar equivalências.
- Limites e overrides de concorrência. O ensaio atual continua sequencial, com um desenvolvedor por vez.
- Validação proporcional ao impacto e evidências reais, sem apresentar comandos não aplicáveis como passes.
- pt-BR com acentuação para a comunicação do workspace e en-US para conteúdo técnico do projeto.
- Descrição e campo when_to_use da skill já acordados. Não reescrevê-los incidentalmente.
- Arquivos gerenciados atualizados por seus geradores e ferramentas oficiais, não por correções manuais descartadas no próximo refresh.
- Agnosticismo do mARC quanto a cliente, fornecedor, roteamento e configuração de runtime.

## Verificações realizadas e limites

- Inspeção das fontes por context-mode.
- Checagem com parser Markdown de 81 links locais e 13 âncoras, em 20 arquivos, sem erros encontrados.
- Comparação da skill, INSTRUCTIONS e baseline gerenciado de RULES com os geradores compilados em dist: os três correspondem.
- Conferência de estabilidade dos hashes das fontes centrais entre o início e o fim da revisão, sem mudanças nesses alvos.

Não foram executados validate, build ou testes do produto. A atividade foi uma revisão documental e operacional, não uma declaração de release pronta nem uma avaliação completa da implementação de summaries. Não foram verificados links externos ou demonstrados todos os comportamentos em uma sessão de agente real. Os cenários descritos identificam riscos das instruções, não provam que cada risco causou um incidente anterior.

## Orientação para o planejamento futuro

Depois da autorização de continuidade:
1. Revalidar os achados contra o estado pós-commit e separar alterações editoriais de alterações nos geradores e helpers.
2. Preparar e anexar o plano detalhado, com escopo, exclusões, critérios de aceite e validação por impacto, antes da implementação.
3. Corrigir as fontes autoritativas e os geradores correspondentes, sem adicionar hooks específicos ou mecanismos de bloqueio fora do escopo.
4. Validar cenários de leitura incremental, perfil já existente, entrega consolidada, bootstrap inicial e recuperação, configurações JSON e workspace consumidor sem os docs deste repositório.
5. Se houver mudanças em código, tooling ou contratos executáveis, realizar validate, build e testes, com cuidado para os efeitos de escrita de validate.
6. Executar o loop vigente e a revisão final integrada. Manter a thread aberta até autorização humana de encerramento.

Esses passos são orientação para o próximo planejamento, não um plano de desenvolvimento aprovado.

## Parecer

O desenho central do loop é coerente. O principal problema é a concorrência entre instruções de entrada e a distribuição incompleta das exigências canônicas. A adequação precisa alcançar as fontes dos textos gerenciados e do helper MCP; alterar apenas AGENTS não resolve o conjunto.

**Estado:** análise registrada, implementação não iniciada, aguardando continuidade autorizada pelo usuário.
