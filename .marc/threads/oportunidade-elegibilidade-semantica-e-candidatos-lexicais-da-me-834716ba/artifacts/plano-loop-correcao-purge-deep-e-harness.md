# Plano de correção e aceite no loop

## Objetivo e limites

Resolver os três achados da revisão integral da thread 834716ba e concluir o aceite técnico pelo arquiteto. Preservar a versão atual do motor, modelos, calibragem, canais de retrieval, pesos, elegibilidade e schema. As tarefas corrigem concorrência de manutenção, progressão da UI e confiabilidade da verificação.

A aprovação do usuário para seguir o loop inclui devolver achados aos desenvolvedores até o aceite técnico. Não será solicitada nova aprovação entre as tarefas. O fechamento efetivo da thread continua dependendo do feedback do usuário.

## Forma de execução

- Agente principal responsável por planejamento, revisão independente, integração e aceite.
- Desenvolvedores gpt-6-luna com reasoning xhigh.
- Um desenvolvedor ativo por vez, sem paralelismo nesta rodada.
- Cada desenvolvedor lê marc-ops, faz workspace_bootstrap, lê integralmente RULES.md, docs pertinentes, thread e artefatos desta iteração.
- Antes de editar, retorna OK_BOOTSTRAP com workspace confirmado, regras compreendidas, fontes lidas e escopo de escrita.
- O arquiteto confere a evidência e autoriza a edição. Esperas por aprovação na TUI não provocam encerramento do agente.
- Edições de código e testes via apply_patch. Investigação e verificação via context-mode, comandos Bash, sem git ou PowerShell.
- Registros de plano, relatórios e mensagens na thread por ferramentas MCP do mARC, com newlines reais e artefatos nos metadados.
- Cada tarefa termina com testes focados, lista dos arquivos alterados e evidência. O arquiteto revisa o código e o comportamento, devolvendo problemas ao mesmo agente.
- Nenhum agente encerra a thread nem cria SUMMARY.md.

## Tarefa 1. Snapshot do purge sob o lock

Escopo inicial de escrita: src/core/memory/operations.ts e teste de regressão em test/core-memory-maintenance.test.ts, ou arquivo de teste dedicado se a separação for mais adequada.

Ler o manifesto dentro da callback de memory-operation e usar a geração obtida sob exclusão mútua. Não mudar a implementação lexical, os modelos, o contrato público do purge ou as regras de remoção de arquivos.

Aceite:

1. Reprodução determinística falha antes da correção.
2. Se rebuild publicar B entre início do purge e aquisição do lock, purge preserva B, não A.
3. Busy continua sem entrar na callback nem fazer remoções.
4. Ausência de manifesto mantém o comportamento documentado.
5. O teste usa workspace temporário e não faz purge na base real.
6. Testes focados de manutenção e coordenação passam.

## Tarefa 2. Profundidade executada separada da configurada

Escopo inicial: src/ui/use-memory-search.ts, src/ui/memory-search-depth.ts, src/ui/memory-search.ts, tipos pertinentes e testes UI de busca. Alterar somente dependências diretamente necessárias.

Registrar o último depth realmente executado na busca ativa. A configuração define o limite da retentativa automática, não a profundidade atingida. O próximo Deep manual deve ser o nível seguinte ao último efetivamente executado. O loop automático continua parando ao obter resultados.

Aceite:

1. Configuração 3 com sucesso em 0 mantém Deep disponível e próxima chamada em 1.
2. Configuração 1 com sucesso em 0 não pula diretamente para 2.
3. Esgotamento automático até 3 desabilita Deep.
4. Resultado e consulta efetiva permanecem vinculados a busca ativa; nova consulta reinicia em 0.
5. Busca alternativa reinicia em 0 e mantém seleção literal explícita.
6. Estado persistido é isolado por workspace e preserva último depth.
7. Dados legados sem último depth recebem tratamento conservador e testado, sem atribuir arbitrariamente um nível não observado.
8. Requisições obsoletas não substituem resultado de outra busca ou workspace.
9. Ranks, pools de candidatos e contrato do backend não mudam.

## Tarefa 3. Seleção vazia não aprova o harness

Escopo inicial: scripts/memory-quality-v4.ts e teste focado do comando ou extração mínima de um helper testável, se indispensável.

Rejeitar filtro sem casos antes de preparar modelos ou inferir. Informar claramente filtro inválido ou ausência de casos. Preservar os casos de qualidade, métricas e lógica de ranking existentes.

Aceite:

1. Família desconhecida e consulta sem correspondência retornam código não zero e erro explícito.
2. Famílias e consultas válidas selecionam casos.
3. Execução padrão não perde casos.
4. Interpret-only também rejeita seleção vazia.
5. Nenhum modelo é carregado por uma seleção rejeitada.
6. Teste de regressão reproduz código zero antes da correção e passa depois.
7. Evitar abstrair apenas para satisfazer tamanho de arquivo.

## Revisão e verificação integrada

Depois de cada tarefa, conferir diferenças e testes do agente por context-mode. Aceite não se limita a auditoria de registros. Avaliar requisitos, comportamento, isolamento, manutenção, compatibilidade, testes e escopo.

Depois das três tarefas aprovadas:

- Revisar docs pertinentes e delegar adequação diretamente ligada as correções se necessário.
- Executar pnpm run validate, pnpm test e pnpm build.
- Reexecutar os cenários do purge, progressão e filtros vazios.
- Acompanhar a bateria existente com modelos reais em unidades sequenciais delimitadas por família e depth, preservando os resultados entre chamadas para evitar timeout RPC. Não usar duração como gate.
- Distinguir falhas atuais do motor aceito de defeitos introduzidos nas correções. Limitações preexistentes do motor não autorizam recalibragem.
- Não baixar modelos, refazer índice, executar purge real ou promover modelo experimental.
- Verificar que manifesto e artefatos ativos de modelos permanecem preservados.
- Registrar relatório final pelo MCP, depois comentário com metadados, e executar auditoria após os registros completos.
- Informar se é necessário restart para carregar mudanças de UI e operações no daemon/CLI.
- Dar aceite técnico somente com evidências suficientes. Então avisar o usuário e aguardar revisão para fechamento.
