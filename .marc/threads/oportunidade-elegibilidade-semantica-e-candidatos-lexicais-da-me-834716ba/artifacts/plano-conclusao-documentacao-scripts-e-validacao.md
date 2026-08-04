# Plano de conclusão da thread 834716ba

## Objetivo e estado confirmado

Concluir a revisão documental, remover o script obsoleto e validar a entrega existente antes da revisão final do usuário. Preservar o comportamento atual da busca e os dados do workspace.

A thread permanece aberta. A última mensagem anterior ao plano é msg_55d2c11a33e4497e88. A avaliação histórica de 4 de agosto de 2026 registrou 27/30 consultas no Top-1 (90%) e 28/30 no Top-10 (93,3%). Essas métricas não são uma nova validação nem garantem perfeição.

Os estudos de profundidade adaptativa e de modelos contextuais maiores permanecem nas threads 4f477d9f e 57488bab. Não serão implementados nesta conclusão.

## Fontes e regras

- Skill marc-ops e bootstrap atual de C:/Projetos/marc.
- RULES.md integral, README, docs de memory, arquitetura, MCP, UI/daemon e ADRs aplicáveis.
- Thread 834716ba, plano da recuperação híbrida e avaliação aleatória de 30 consultas.
- Implementação atual de memory, scripts, package.json e testes dos relatórios de benchmark.

Checklist operacional:

- Inspeção e comandos com context-mode e sintaxe Bash.
- Nenhum comando git ou PowerShell.
- Edições manuais com apply_patch.
- Conteúdo técnico e produto em en-US. Comunicação, plano e relatórios mARC em pt-BR.
- Não alterar busca, modelos, contratos públicos, persistência, índices ou configurações do usuário.
- Preservar Markdown como autoridade e os índices como projeções derivadas.
- Quando houver condicionais modificadas, usar guards e early returns sem else ou if aninhado.
- Registrar artefatos nos metadados e auditar somente depois das mensagens e anexos completos.

Não será executado memory_recall para reabrir decisões nesta conclusão, pois não há proposta de mudança comportamental e as fontes históricas específicas já foram lidas. A inspeção cobre a documentação da implementação existente.

## Orquestração e protocolo de confirmação

O agente principal atua como arquiteto, distribui as tarefas, revisa e aprova tecnicamente. Desenvolvimento por subagentes configurados explicitamente com model gpt-6-luna e reasoning_effort xhigh. Nenhuma substituição silenciosa do modelo.

Limite autorizado de dois desenvolvedores. Nesta primeira rodada, somente um desenvolvedor ativo por vez, em tarefas sequenciais.

Cada tarefa recebe objetivo, fontes, arquivos permitidos, restrições, verificações e critérios de aceite. Antes das alterações, o subagente deve:

1. Ler marc-ops e realizar seu próprio workspace_bootstrap.
2. Ler RULES.md integralmente e os documentos necessários à tarefa.
3. Ler este plano e o contexto da thread.
4. Confirmar as ferramentas necessárias e a raiz correta.
5. Retornar OK_BOOTSTRAP ao principal, com confirmação real do bootstrap, workspace, checklist de regras, escopo e impedimentos.
6. Aguardar a liberação do principal pelo canal do subagente antes de editar.

O principal confere a resposta e libera a execução. O subagente entrega arquivos alterados, justificativa, evidências de verificação e pendências. Problemas encontrados voltam ao mesmo desenvolvedor para correção e nova revisão. O loop continua até o aceite técnico.

Aguardar aprovação na TUI não caracteriza travamento. Não interromper, encerrar ou recriar o subagente por silêncio ou espera prolongada. Se houver dúvida, consultar seu estado e pedir informação sem interromper a tarefa.

Depois de recompactação ou perda do contrato, restabelecer o bootstrap antes de retomar. Não criar hooks proprietários, modificar configuração global ou introduzir ferramentas para CLIs de terceiros.

## Tarefa 1: sanitização dos scripts

Responsabilidade: scripts e dependências diretas estritamente necessárias.

- Reconfirmar a ausência de consumidores ativos de scripts/memory-quality.ts.
- Remover somente esse script obsoleto, que importa MEMORY_RELEVANCE_THRESHOLD removido da implementação.
- Manter scripts/memory-quality-v4.ts e scripts/memory-model-benchmark.ts, scripts/memory-model-benchmark-support.ts e scripts/memory-model-benchmark-runner.ts.
- Preservar os comandos memory:quality e memory:benchmark, argumentos existentes, estratégias e perfis experimentais.
- Não renomear os arquivos mantidos nem modificar runtime da busca.
- Preservar referências em artefatos históricos como evidência da evolução.

Critérios de aceite:

- Nenhuma referência ativa quebrada.
- Entrypoints e dependências mantidos.
- Teste do processamento dos relatórios de benchmark aprovado.
- Relatório de remoção e motivo verificável.
- Sem downloads, rebuild ou execução de matriz extensa de modelos.

O principal revisa e aprova esta tarefa antes de liberar a tarefa 2.

## Tarefa 2: revisão documental

Responsabilidade: README e docs pertinentes à funcionalidade entregue. Não editar código de runtime.

- Confrontar README, docs/memory.md, arquitetura, MCP, UI/daemon e ADRs com o código e corrigir divergências identificadas.
- Documentar schema v6 e field-aware-hybrid-v2.
- Explicar identidades e passagens, recuperação densa e lexical por campos, prefixos de título somente para consultas de um termo, reranking, consolidação e elegibilidade semântica.
- Explicar que Deep amplia candidatos e não relaxa a elegibilidade; registrar limites reais e reset de cada nova busca.
- Conferir modelos, variantes, readiness, TTL por função, prepare, rebuild incremental/full, batches, locks e purge.
- Documentar sugestões como links, mesma tipografia auxiliar e somente o termo alternativo clicável.
- Atualizar instruções dos scripts preservados, estratégias e opções, distinguindo busca de produção de experimentos de modelos.
- Remover afirmações sobre verificações que o script atual não executa.
- Manter prosa contínua sem quebra manual no meio das frases.
- Acrescentar ou revisar ADR somente quando necessário para documentar uma decisão real existente, sem criar decisões novas.

Critérios de aceite:

- Texto técnico em en-US.
- Valores, contratos e comandos sustentados pelo código.
- Referências documentais válidas.
- Métricas históricas identificadas como históricas.
- Nenhuma alegação não comprovada de precisão ou desempenho.
- APIs públicas e comportamento da busca preservados.
- Relatório do que mudou e do que foi revisado sem necessidade de alteração.

## Validação e revisão final

O principal revisa os arquivos e o escopo de cada tarefa e solicita ajustes ao desenvolvedor quando necessário.

Depois de todas as alterações:

1. Executar pnpm run validate.
2. Executar pnpm test.
3. Executar pnpm build.
4. Conferir referências e exemplos dos documentos, entrypoints dos scripts e ausência de alteração funcional.
5. Distinguir avisos conhecidos de falhas. Registrar os resultados atuais, sem reutilizar a contagem histórica de testes como evidência nova.

A conclusão não exige downloads, rebuild, alteração de configuração ou repetição da matriz extensa de modelos. Caso seja encontrado problema funcional fora desse escopo, registrar o achado e comunicar ao usuário sem ampliar silenciosamente a atividade.

## Entrega e fechamento humano

- Anexar relatório final de conclusão com execução, revisão, decisões sobre scripts, docs revisados, validação e limitações conhecidas.
- Publicar comentário legível em pt-BR com artefato associado aos metadados.
- Executar workspace_audit depois de concluir anexos e mensagens.
- Avisar o usuário e aguardar revisão/crítica.
- Não criar SUMMARY.md nem encerrar a thread nesta entrega.
- Quando houver autorização explícita para fechar, verificar o backlog Playwright exigido nas regras e então registrar o resumo de encerramento.
