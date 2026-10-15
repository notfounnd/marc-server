# Complemento de desenvolvimento: atualizar Transformers.js e liberar avaliação do Qwen

## Objetivo

Atualizar @huggingface/transformers de ^4.2.0 para ^4.3.1, conforme autorização humana, preservando o padrão de dependências do projeto. A versão publicada 4.3.1 depende de onnxruntime-node 1.30.0, cujo código oficial inclui CausalConvWithState em CPU.

Uma versão minor não comprova ausência de regressão. A entrega exige validar o produto existente e depois conferir o carregamento real do Qwen. Não promover o modelo, não mudar o motor ou o gold.

## Escopo autorizado

- package.json: apenas a dependência Transformers.js.
- pnpm-lock.yaml: regeneração pelo pnpm com o menor fechamento de dependências necessário. Não editar YAML manualmente.
- scripts/memory-interpreter-benchmark-support.ts e scripts/memory-interpreter-benchmark-worker.ts: somente identidade do runtime/versão de metadados e assinatura que impeça reutilizar resultados do runtime anterior.
- test/memory-interpreter-benchmark.test.ts e test/memory-interpreter-benchmark-contract.test.ts: regressões focadas da identidade/assinatura, somente se necessárias, mantendo cada arquivo abaixo de 300 linhas não vazias.

Não tocar src, UI, configurações de busca, corpus, pesos, perfis, harness, docs de produto ou outros testes. Não alterar prompt, candidatos, gold, CPU threads, quantização, opções de geração, parser ou critérios de qualidade.

Instalação atualiza node_modules e lockfile como saídas da ferramenta. Não adicionar overrides do ONNX Runtime por padrão e não atualizar outras dependências diretas. Se o install bloquear, houver build pendente, API incompatível ou necessidade de editar fora do escopo, informar e aguardar. Não contornar permissões.

## Delegação e protocolo

Reutilizar Rawls, perfil codex-dev, gpt-6-luna com reasoning xhigh conforme confirmação humana anterior, um desenvolvedor por vez. Bootstrap independente, fontes e OK_BOOTSTRAP antes de qualquer edição. O principal verifica e autoriza internamente.

Brief completo: ler contrato atual, AGENTS.md, docs/agent-workflows.md, docs/development.md, plano do experimento, complemento offline e relatório de resultados. Reusar os caminhos e arquivos preparados em Temp, sem deletar ou baixar modelos.

O desenvolvedor entrega relatório interno com caminhos, evidências, versões resolvidas e limites, além de sua própria mensagem consolidada pelo MCP. Não registrar cada comando, confirmação ou ajuste. Não administrar perfis nem spawnar outros agentes.

## Implementação

1. Registrar hashes dos arquivos-alvo e identificar seu conteúdo atual, sem Git.
2. Aplicar a alteração manual no package.json com native apply_patch e executar instalação pnpm a partir de Bash/context-mode, respeitando prompts.
3. Conferir que a instância efetivamente resolvida por Transformers.js é 4.3.1 e seu runtime nativo é 1.30.0, não apenas que existe uma cópia top-level.
4. Manter coerência dos metadados do benchmark e invalidar somente checkpoints/resultados anteriores. Não invalidar marcadores de modelos ou pesos pinados.
5. Adicionar cobertura focada proporcional quando necessária, usando fixtures declarativas sem branches/skips.
6. Conferir fechamento do lock e ausência de atualização de dependências diretas não autorizadas.

## Aceitação e revisão

- Versão nova e runtime correto efetivamente resolvidos.
- Arquivos de produção, memória e modelos preservados.
- Benchmark não atribui execução nova a Transformers.js 4.2.0 e não mistura checkpoints anteriores.
- Checks focados, typecheck ampliado para scripts e formatação explícita do escopo.
- Principal executa pnpm validate, pnpm build e pnpm test e faz revisão integrada de todo o estado autorizado.
- Principal executa smoke do Qwen em processo novo, local-only, com o mesmo bundle pinado e protocolo; valida resposta real, não apenas exit do coletor.
- Se smoke válido, executar a matriz congelada do Qwen e repetir os perfis necessários sob o novo runtime para comparação justa. Não apresentar resultados de runtimes diferentes como comparação equivalente sem explicitar essa limitação.
- Se aparecer novo operador ou erro, registrar precisamente; não afirmar que a instalação garante inferência completa nem ampliar dependências silenciosamente.
- Validar preservação por hashes, sem stage, checkout, reset ou outros comandos Git.

## Registros e restart

Consolidar entrega e revisão/resultado no final do trabalho. Anexar evidências por MCP e auditar depois de arquivos e metadados completos. A thread permanece aberta.

Processos novos usarão a biblioteca atualizada. Daemon/MCP/UI já em execução podem manter módulos e bundles anteriores; orientar restart após build para validar o produto em uso. Esse restart não é necessário para o smoke isolado em processo novo e não autoriza rebuild dos embeddings.

## Limites

O upgrade é uma evolução de infraestrutura, não promoção do Qwen ou aceite de sua qualidade. Não cria garantia para Linux, 8 GB ou todos os modelos. Mudança de comportamento do runtime deve ser medida, não presumida por semver.
