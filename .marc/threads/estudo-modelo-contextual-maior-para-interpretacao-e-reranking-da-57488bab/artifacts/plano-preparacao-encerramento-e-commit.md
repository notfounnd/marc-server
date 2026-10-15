# Plano de preparação para encerramento da thread 57488bab

## Objetivo e decisões

Preparar a workspace para revisão e commit humano desta thread, removendo o aparato descartável de benchmark dos intérpretes e validando a atualização de Transformers.js 4.3.1 que o humano decidiu manter.

Não implementar a nova proposta arquitetural. Manter E5, mMARCO e LFM atuais. O Qwen foi descartado pelo humano nesta etapa devido ao tamanho. Não alterar ranking, corpus, profundidade, interpretação ou parâmetros produtivos da busca.

O humano autorizou somente git status e git diff para leitura. Não fazer stage, commit, reset, checkout ou qualquer outra escrita Git. Não encerrar a thread nesta atividade.

## Estado verificado pelo principal

O diff mostra alteração de @huggingface/transformers de ^4.2.0 para ^4.3.1, a atualização correspondente do lockfile, MEMORY_MODEL_VERSION para transformers-js-4.3.1 e um guard de compatibilidade em reconcileMemory antes de materializar fontes ou preservar vetores. O teste de regressão novo verifica metadados, incompatibilidade com runtime antigo e reconstrução com o novo.

Os quatro scripts de intérpretes e seus três testes são arquivos experimentais não rastreados. Os cinco scripts de qualidade e benchmark de modelos já existentes têm referências ativas em package.json, documentação ou testes e permanecem.

Os modelos e capturas temporários já foram sanitizados. Não executar novamente benchmarks, downloads, prepare, purge ou rebuild da base produtiva. O índice ativo da memória não deve ser removido por não ser destinado ao commit.

## Execução delegada

Reutilizar Beauvoir sob o perfil compartilhado codex-dev, modelo gpt-6-luna e reasoning xhigh confirmados pelo humano. Principal codex-software-architect, gpt-6.1-sol/high. Limite atual: um desenvolvedor, sem paralelismo ou novas delegações.

O desenvolvedor deve recarregar marc-ops, fazer bootstrap independente, verificar workspace marc-dd422176e1 em C:/Projetos/marc e ler INSTRUCTIONS, RULES/Custom Rules, AGENTS, README, docs/development.md, docs/agent-workflows.md e este plano. Ler os sete arquivos antes de removê-los, o diff pertinente fornecido pelo principal e os arquivos retidos para reconhecer os limites.

Retornar OK_BOOTSTRAP com identidade, fontes, regras críticas, configuração e fonte da confirmação, escopo de escrita e situação dos alvos. Aguardar autorização explícita do principal antes de editar.

## Escopo exato de remoção

- scripts/memory-interpreter-benchmark.ts
- scripts/memory-interpreter-benchmark-cases.ts
- scripts/memory-interpreter-benchmark-support.ts
- scripts/memory-interpreter-benchmark-worker.ts
- test/memory-interpreter-benchmark.test.ts
- test/memory-interpreter-benchmark-contract.test.ts
- test/memory-interpreter-benchmark-storage.test.ts

Usar apply_patch nativo para as remoções. Não apagar testes de produção ou o teste de versão do runtime.

## Arquivos retidos e revisados, sem novas alterações previstas

- package.json
- pnpm-lock.yaml
- src/core/memory/model-config.ts
- src/core/memory/rebuild-operations.ts
- test/core-memory-runtime-version.test.ts

Preservar todos os outros caminhos e o stage existente. Não modificar napkin, perfis, .gitignore, manifeste/vetores da memória, propostas de outra sessão ou documentos históricos.

Se surgirem referências fora dos sete arquivos, informar o local e pedir autorização de escopo ao principal antes de editar. Alteração necessária além do escopo ou falha de validação não autoriza refatoração ampla.

## Critérios de aceite

1. Os sete arquivos experimentais foram removidos.
2. Não há import ou comando ativo apontando para os arquivos removidos em src, test, scripts, package.json ou docs. Referências históricas nos relatórios da thread não são código quebrado nem devem ser apagadas.
3. Os cinco scripts permanentes continuam presentes, com seus comandos e testes.
4. A dependência instalada/declarada, a identidade dos três providers e o teste de runtime continuam coerentes com 4.3.1.
5. O incremental rejeita provider incompatível antes de trabalho de índice ou inferência, sem relaxar a exigência de full rebuild.
6. O motor e os modelos produtivos não mudam.
7. A suíte completa, build e validate passam no estado final. Toda falha ou limitação deve ser relatada, não escondida.
8. O índice Git e os arquivos fora do escopo permanecem preservados.
9. Entrega própria do desenvolvedor e revisão integrada independente do principal registradas de forma consolidada, sem diário de execução.

## Validação por impacto

Esta é preparação de uma entrega executável, incluindo dependência e guard produtivo retidos. Não declarar release-ready com checks apenas focados.

Antes de rodar pnpm validate, verificar seus efeitos de escrita. O .prettierignore limita a formatação a arquivos de código da raiz, src e test; os scripts experimentais serão removidos antes dos checks. Se o comando alterar arquivos não autorizados, informar conflito sem revertê-los automaticamente.

Executar pnpm validate, pnpm build e pnpm test, além de varredura das referências e do teste focal de runtime. Não carregar modelos reais para esses checks. Usar context-mode e comandos compatíveis com Bash; não usar PowerShell.

O principal confere os resultados, repete os checks independentes pertinentes no estado final e realiza revisão de toda a integração: atualização do pacote, lockfile, metadados, guard de compatibilidade, teste de runtime e remoções. Comparar o estado Git somente com os comandos de leitura autorizados.

Documentação: verificar necessidade real de ajuste. Se não houver referência ativa aos scripts removidos nem contrato público novo, justificar a ausência de mudança, em vez de alterar docs como ritual.

## Entrega e revisão

O desenvolvedor devolve relatório interno com caminhos, referências de linha para os arquivos retidos, checks efetivos, resultados, limites, documentação e riscos. Publica sua própria entrega consolidada na thread via MCP, sob codex-dev, e retorna o ID da mensagem. Não administrar perfis nem publicar cada iteração.

O principal registra um relatório consolidado com revisão integrada substantiva, evidências dos critérios, achados resolvidos, limites e veredito explícito. Qualquer correção de implementação posterior exige nova revisão do estado afetado.

Ao final, apresentar ao humano o que manter no commit e o que ficou fora dele. Aprovação técnica não é aceite humano nem autorização para stage, commit ou encerramento.
