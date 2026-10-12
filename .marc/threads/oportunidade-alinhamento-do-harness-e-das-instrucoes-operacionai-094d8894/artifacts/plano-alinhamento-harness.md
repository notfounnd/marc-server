# Plano de desenvolvimento — alinhamento do harness do mARC

## Resumo

Resolver os sete achados e a observação de manutenção registrados na análise, preservando o loop vigente. A adequação alcança o contrato local, os documentos e as fontes das recomendações gerenciadas e do helper MCP. Não será uma correção apenas do arquivo de skill gerado.

O usuário autorizou a execução da thread. Antes da implementação, o principal releu a thread e a análise, restabeleceu o bootstrap do workspace marc-dd422176e1 em C:/Projetos/marc e conferiu os alvos atuais por context-mode. O refresh não alterou arquivos. memory_recall foi consultado com o propósito do desenvolvimento e retornou memória ready, sem correspondências fortes para aprofundar.

## Objetivo e critérios de aceite

1. **Cursor consumido:** recomendações, skill, helper e documentos distinguem a última mensagem existente do cursor de mensagens efetivamente lidas. thread_info não avança o cursor consumido. thread_tail não comprova consumo de mensagens anteriores fora de sua janela. O cenário A/B tem cobertura que confirma a leitura de B a partir do cursor A após uma consulta de metadados.
2. **Perfis:** a orientação genérica privilegia descoberta e reutilização e condiciona registro ou atualização à necessidade e à autorização do workspace. Não impõe o catálogo ou os papéis deste repositório a consumidores. O contrato local mantém administração pelo principal, perfil compartilhado e entrega autoral do desenvolvedor.
3. **Publicação relevante:** skill e helper deixam de recomendar comentários incrementais por cadência ou reconhecimento rotineiro de leitura. Orientam resultados e decisões materiais, entregas consolidadas e transferências reais, sem impor silêncio ao desenvolvedor ou diário em artifacts.
4. **Autoridade canônica:** as restrições locais hoje exclusivas do AGENTS passam a estar nas Custom Rules, incluindo Git apenas com autorização, Playwright CLI em vez de MCP, edição manual com apply_patch nativo e ausência de hooks específicos por padrão. Preservar context-mode e Bash, com a condição de override humano aplicável. AGENTS mantém resumos e referências, não uma fonte concorrente.
5. **Bootstrap:** documentação distingue confirmação inicial do contrato de refresh de recomendações. Refresh não substitui bootstrap. Reutilização de contrato válido, recuperação e ativação da skill permanecem intactas.
6. **Persistência:** a regra canônica delimita Markdown aos registros de conhecimento e coordenação aplicáveis, preservando configurações estruturadas como marc.config.json e o caráter derivado de caches e índices. Não alterar formatos nem dados.
7. **Consumidores:** helper em runtime remete à composição e encerramento definidos no contrato do workspace, sem presumir docs/agent-workflows.md no projeto consumidor. O guia específico do loop deste repositório continua local.
8. **Composição:** AGENTS referencia o guia comum para mensagens, artifacts e summaries sem repetir política editorial ou introduzir template, checklist publicado ou gate.
9. **Durabilidade:** atualização oficial de recomendações a partir da versão nova em dist emite a skill e o baseline novos, preserva as Custom Rules e é idempotente.
10. **Preservação:** nenhuma mudança em ferramentas públicas, esquemas MCP, comportamento de leitura/persistência, busca, UI, perfis reais ou configuração de clientes. Os textos de description e when_to_use da skill já acordados permanecem iguais.

Os critérios acima tratam instruções e observabilidade dos contratos existentes. Não introduzem estado de cursor por agente, roteamento, hooks ou fiscalização semântica no runtime.

## Escopo autorizado

Código:
- src/core/recommendations.ts
- src/core/marc-ops-skill.ts
- src/mcp/helper.ts

Testes existentes:
- test/core-recommendations.test.ts
- test/core-recommendations-bootstrap.test.ts
- test/mcp.test.ts
- test/mcp-threads.test.ts

Contrato e documentação:
- .marc/RULES.md, somente Custom Rules por edição manual.
- AGENTS.md
- docs/agent-workflows.md
- docs/development.md
- docs/mcp-tools.md
- README.md, somente as orientações de fluxo, perfis e cursor afetadas pelos achados.

Registros:
- Artifacts de entrega e revisão nesta thread.
- Mensagens relevantes nesta thread, pelos autores responsáveis, através das ferramentas oficiais.

Saídas geradas:
- dist é saída do build, não edição manual.
- .agents/skills/marc-ops/SKILL.md e baseline gerenciado de RULES são atualizados oficialmente a partir do código novo, sem edição manual.
- .marc/INSTRUCTIONS.md não deve mudar nesta adequação.

Não ampliar esse escopo silenciosamente. Se um alvo necessário não estiver listado, apresentar a justificativa ao principal antes de editar.

## Exclusões

Não editar agentes registrados, outras threads, summaries históricos, configuração do usuário, arquivos de cliente ou hooks, dependências, lockfiles, memória real, modelos, UI, código de leitura ou persistência de threads. Não criar arquivos de teste redundantes que apenas repitam snapshots de strings. Não usar Git, PowerShell, Playwright MCP ou comandos de escrita de arquivos no shell. Não alterar description ou when_to_use por conveniência editorial.

Testes usam workspaces temporários isolados. Perfis de fixture nesses workspaces não são administração do catálogo real.

## Organização do loop e handoff

Uma única tarefa de desenvolvimento coesa, atômica e delimitada: alinhar as fontes e documentos dos oito critérios editoriais, adicionar regressões e entregar o conjunto validado. O principal cuida de planejamento, autorização, inspeção independente, publicação da revisão integrada e refresh oficial do workspace real.

- Principal: perfil existente codex-software-architect.
- Desenvolvedor: perfil compartilhado existente codex-dev.
- Configuração solicitada: gpt-6-luna com reasoning xhigh, conforme o modo de trabalho previamente confirmado pelo usuário e os controles expostos pelo cliente.
- Principal e desenvolvedor registram configuração solicitada e origem da confirmação, sem apresentar seleção de spawn como introspecção do runtime.
- Concorrência: um desenvolvedor ativo, sequencial, preservando o ensaio atual.

Antes de editar, o desenvolvedor lê a skill e faz bootstrap independente no workspace correto. Lê RULES completo, AGENTS, README, os guias aplicáveis, a análise e este plano. Retorna OK_BOOTSTRAP internamente com identidade e raiz, fontes, checklist crítico, configuração e confirmação, write scope e estado existente dos alvos. Aguarda autorização explícita do principal.

O principal verifica o acknowledgement e autoriza internamente. Não publicar handshake, autorização, comandos ou cada iteração. Se houver aprovação pendente na TUI, não terminar o agente por silêncio.

O desenvolvedor deve entregar:
- Relatório interno detalhado com paths e linhas, mudanças, critérios atendidos, verificações reais, documentação, desvios e limites.
- Sua própria entrega consolidada na thread sob codex-dev, com artifact anexado através de metadata e message ID no relatório interno.
- A entrega declara revisão do principal pendente e não se apresenta como aprovação técnica ou encerramento.

Somente uma exceção humana explícita pode dispensar a publicação. Falta de MCP ou perfil é bloqueio a resolver, não autorização para o principal ghostwrite ou criar perfil.

## Passos de execução

1. **Preflight:** conferir os alvos e preservar o estado prévio. Registrar fingerprints de fontes autorizadas e da árvore inspecionada sem Git. Confirmar a classificação mista e o blast radius dos formatters. Registrar este plano e suas associações antes do audit preflight.
2. **Regressões:** aproveitar suites existentes. Especificar cenários explícitos para geração e refresh de recomendações, preservação das Custom Rules, composição e publicação consolidada, perfil existente e consumidor sem docs locais. Testar o cursor A/B pelo MCP existente, sem modificar a implementação de leitura. Obter falhas pertinentes para novas expectativas antes da correção quando aplicável.
3. **Fontes e contrato:** atualizar os três módulos de orientação e as Custom Rules. Manter o produto genérico e as restrições locais no contrato do projeto. Evitar instruções concorrentes de composição.
4. **Documentação:** alinhar AGENTS, fluxo, desenvolvimento, contrato de ferramentas e os trechos pertinentes do README. Usar en-US nesses arquivos. Preservar pt-BR com acentos nos registros desta atividade.
5. **Validação do desenvolvedor:** executar regressões, inspeção localizada, code:check e typecheck. Confirmar que o formatter cabe no scope; depois executar pnpm validate, pnpm build e pnpm test. Rever saídas e alvos alterados. Não corrigir/reverter trabalho alheio ou expandir scope por causa de um formatter.
6. **Entrega autoral:** publicar resultado consolidado, relatório e evidências, com pendências e limites reais. Devolver responsabilidade ao principal.
7. **Revisão independente:** o principal revisa todo o estado integrado contra os critérios, incluindo casos de falha, autoridade, manutenção, agnosticismo, validação, escopo e geração. Executa verificações independentes relevantes e compara geração e artifacts associados.
8. **Correções:** devolver achados ao mesmo desenvolvedor por canal interno e repetir a revisão afetada e integrada. Não editar o relatório a cada interação. Consolidar a disposição dos achados ao fechar a revisão técnica.
9. **Refresh e idempotência:** usar a ferramenta oficial workspace_update_recommendations de um processo MCP iniciado a partir do dist recém-compilado. A conexão antiga pode manter módulos carregados e não comprova uso do gerador novo. Verificar a skill emitida, baseline, preservação das Custom Rules e segunda atualização sem alterações.
10. **Resultado ao usuário:** anexar uma revisão final substantiva com verdict approved, pending ou rejected. Apresentar o resultado e avisar sobre reinício da sessão MCP para carregar os novos helpers e redescobrir a skill. Aguardar revisão humana; não criar SUMMARY nem encerrar esta thread.

## Validação e evidências

Classificação: entrega mista com mudanças em código de geração, orientação operacional, testes e documentação. A política vigente exige o fluxo completo, além dos checks específicos.

- pnpm validate
- pnpm build
- pnpm test
- Regressões focadas nas quatro suites autorizadas.
- Checagem de links e âncoras locais dos documentos afetados.
- Leitura dos guias produzidos por marc_helper no servidor recém-compilado.
- Workspace temporário sem docs/agent-workflows.md, com Custom Rules próprias, para não exportar política local.
- Geração idempotente e preservação das Custom Rules.
- Verificação de description e when_to_use sem alterações.
- Conferência de scope e preservação de fontes fora da autorização.

validate inicia code:fix e escreve formatação/lint nos alvos cobertos pela configuração. Inspecionar o efeito; não alegar que é read-only. Se o estado prévio indicar correções fora do scope, resolver isso antes de executar o formatter.

Testes novos devem ser determinísticos, declarativos e sem condicionais ou skips para seleção de cenário. Não mover branches para fixtures, helpers ou scripts. Preservar integrações reais e o runner Node existente. Não carregar/downloadar modelos ou tocar a memória real para esta atividade.

Os checks de geração e de texto não provam obediência universal de modelos. Registrar esse limite e não prometer que o harness elimina toda falha de agente.

## Riscos e questões

- Baseline e skill corrigidos manualmente seriam descartados no refresh. Corrigir seus geradores e comprovar a emissão.
- Processo MCP antigo pode expor helper antigo mesmo após build. Validar dist em processo novo e informar o reinício necessário.
- A regra local de perfil não pode virar obrigação universal de todos os usuários mARC.
- Correção do cursor é orientação de consumo, não alteração da API ou um novo armazenamento de estado.
- Restrições técnicas locais não podem invadir a guidance gerenciada de consumidores.
- Resultado do formatter e mudanças externas durante o loop devem ser tratados sem reversões amplas.

Não há decisões funcionais pendentes que exijam aprovação adicional antes da tarefa delimitada. Ambiguidade de scope, configuração ou ferramenta deve ser levantada antes de expandir ou substituir o fluxo.

## Estado

Plano registrado antes da implementação. Desenvolvimento autorizado pelo usuário para a thread, sujeito ao bootstrap independente e à autorização interna do principal. A thread permanecerá aberta até revisão e autorização humana de encerramento.
