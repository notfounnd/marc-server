# Estudo controlado da apresentação da tarefa ao LFM 350M

## Objetivo e decisão esperada

Verificar se mudar apenas a apresentação da decisão reduz correções indevidas sem sacrificar correções legítimas. O estudo não autoriza trocar modelos nem alterar a busca produtiva. A restrição do usuário é absoluta: não adicionar dicionários, listas de palavras, exceções por termo ou regras por idioma.

Ao final, recomendar uma das duas decisões: a hipótese não apresentou ganho suficiente e deve ser encerrada nesta rodada, ou uma apresentação mostrou ganho consistente e merece proposta separada de implementação e validação da busca completa. Não confundir acerto de correção com relevância das threads retornadas.

## Contexto e fontes

A thread 57488bab contém a avaliação dos interpretadores no runtime 4.3.1. O LFM 350M reconheceu 12/12 typos positivos, mas rejeitou 0/12 mudanças indevidas e acertou 2/25 decisões naturais. Modelos maiores ficaram mais conservadores, com custo de memória que o usuário considerou inadequado.

Fontes obrigatórias: AGENTS.md, skill marc-ops, contrato integral de bootstrap, README.md, docs/memory.md, docs/development.md, docs/agent-workflows.md, scripts/memory-interpreter-benchmark-cases.ts, scripts/memory-interpreter-benchmark-support.ts, scripts/memory-interpreter-benchmark-worker.ts, src/core/memory/query-interpretation-inference.ts e a evidência congelada evidencias-interpretadores-onnx-runtime-v3.json.

O usuário já reiniciou e executou full rebuild. O MCP confirmou memória ready, 53 summaries indexadas e três modelos preparados. A comparação deste estudo usará as consultas e alternativas congeladas da rodada anterior, sem recalcular candidatos a partir da nova geração.

## Variáveis fixas

- Modelo onnx-community/LFM2.5-350M-ONNX, arquivos Q4 já preparados.
- Transformers.js 4.3.1 e ONNX Runtime 1.30.0.
- CPU, duas threads intra-op e duas inter-op, um processo experimental por vez.
- do_sample false e max_new_tokens 4.
- Consultas, alternativas, expectativas e regras de aplicação/sugestão congeladas. Recuperar suggestionOnlyIndexes das fixtures explícitas e, nos casos históricos sem esse campo, dos outcomes congelados do baseline, que selecionou a alternativa em todas as chamadas: alternativa selecionada com correctionApplied false e suggestedQuery correspondente identifica sugestão sem aplicação. Validar essa recuperação contra os demais outcomes, sem recalcular alternativas.
- Sem downloads, novos modelos, embeddings, reranking, rebuild, purge ou alteração de configurações.
- Sem mudanças em src, scripts, test, package.json, lockfile, docs, AGENTS, RULES ou skill.
- Sem comandos Git e sem operações de stage.

## Apresentações predefinidas

O formato atual será reproduzido com a função produtiva queryInterpretationMessages. Para o diagnóstico de ordem invertida, somente a indicação de qual índice é o original será ajustada de 0 para 1. O original deve continuar sendo a opção de preservação, não passar a ser tratado como correção. O feedback produtivo semanticAuditFeedback também contém referências aos índices 0 e 1. Na ordem invertida, remapear suas indicações de original e alternativa de modo consistente, preservando a faixa de índices permitidos e instruções de retry. Essa inversão mecânica não deve criar instruções contraditórias. Na ordem normal, manter mensagens e feedback do baseline byte a byte.

A alternativa A terá a mensagem de sistema abaixo, substituindo {originalIndex} pelo índice correto:

> Select the candidate that preserves the user's intended search. The original query is candidate {originalIndex}. A different candidate is allowed only to repair a small accidental character-level spelling error. If the original word or phrase is already valid, keep it even when another candidate is more common or better written. Do not change meaning, grammar, inflection, accents alone, negation, numbers, or identifiers. If uncertain, keep the original. Return only the integer index of the selected candidate.

A alternativa B terá a mensagem de sistema abaixo:

> Compare the original query with the alternatives. Accept an alternative only when it fixes an accidental spelling mistake within a word and preserves everything else the user asked. Reject substitutions of valid words, grammar or inflection edits, accent-only edits, and changes to negation, numbers, or identifiers. The original is candidate {originalIndex} and must be selected unless that spelling repair is clear. Return only one candidate index, with no explanation.

Em A e B, a mensagem do usuário será a mesma do formato atual: consulta original, candidatos enumerados e feedback existente quando aplicável. Não fornecer exemplos resolvidos nem termos da bateria no prompt. Não mudar estas apresentações após observar resultados.

## Piloto e critérios registrados antes da inferência

Piloto com 16 decisões reais:

- Seis typos positivos: P01-en-toogle, P03-en-recieve-context, P09-es-interpetacion, P11-es-reconstrucion-context, P17-pt-interpetacao, P19-pt-reconstrucao-context.
- Seis negativos: P05-en-grammar, P07-en-invoice-involve, P13-es-negacion, P15-es-identifier, P21-pt-onde-node, P24-pt-accent-only.
- Quatro consultas naturais válidas: 1D, 2I, 7I, 10D.

Executar formato atual, A e B nas duas ordens de candidatos. Cada execução deve registrar a ordem exibida, resposta bruta, índice exibido, índice canônico e alternativa selecionada. São 96 chamadas iniciais sem retries; qualquer retry efetivo será registrado à parte.

Uma alternativa só avança se, na ordem normal, acertar pelo menos 5/6 positivos, 4/6 negativos e 3/4 consultas naturais, sem erros ou respostas inválidas. Exigir também a mesma escolha textual em pelo menos 14/16 casos nas duas ordens. Na ordem invertida, exigir os mesmos mínimos por grupo; estabilidade isolada não é qualidade.

Se nenhuma avançar, encerrar a hipótese nesta rodada. Não abrir uma terceira apresentação nem ajustar temperatura, quantização ou orçamento de tokens para perseguir os resultados.

## Avaliação completa condicional

Se houver apresentação aprovada no piloto, selecionar uma única alternativa pelo maior número de decisões corretas; desempatar por menos mudanças indevidas e depois por estabilidade de ordem. Empate persistente favorece A, regra definida antes dos resultados.

Executar o formato atual e a selecionada sobre os 62 casos congelados, incluindo bypass literal e ausência de alternativas. Casos sem chamada devem permanecer separados, nunca contados como acertos do modelo. Avaliar a apresentação selecionada também com a ordem invertida para todas as decisões reais.

O piloto não é uma amostra nova na rodada completa. Informar resultados totais e resultados dos casos fora do piloto separadamente. Qualquer divergência do baseline em relação à rodada anterior precisa ser investigada antes de atribuir ganhos ao prompt.

Para considerar a hipótese promissora, exigir na matriz normal pelo menos 10/12 typos positivos, 9/12 negativos rejeitados e 20/25 decisões naturais corretas, nenhum erro/saída inválida, preservação dos controles C3 e C5 e estabilidade textual de pelo menos 90% das decisões entre ordens. Resultado promissor não é autorização de implementação nem prova de melhoria no ranking.

## Execução e loop

O principal planeja, registra o protocolo, congela critérios e revisa independentemente código, evidência e conclusão. Um desenvolvedor compartilhado codex-dev, gpt-6-luna com reasoning xhigh, constrói e valida somente o runner isolado. O trabalho permanece sequencial.

Antes de editar, o desenvolvedor faz bootstrap independente e retorna OK_BOOTSTRAP com fontes, configuração e escopo. O principal autoriza explicitamente no canal interno. O desenvolvedor não administra perfis nem despacha outros agentes.

Escopo de escrita experimental: C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/. Usar apply_patch para os arquivos manuais. Resultados gerados pelo runner são saídas experimentais, não edição manual de arquivos do projeto. Registrar entrega consolidada própria via MCP quando o runner estiver validado e a responsabilidade retornar ao principal.

O principal executa ou acompanha a inferência real, revisa os resultados e consolida o relatório final na thread. Sem atualizações de artefatos por handshake ou iteração.

## Validação e preservação

- Testes determinísticos do runner para indexação reversa, remapeamento, gates, desempate, leitura congelada, bypass literal/sem alternativa e tratamento de erro/saída inválida.
- Conferir igualdade byte a byte do prompt normal atual e invariância da instrução de preservação na ordem invertida.
- Conferir runtime real, modelo local, hashes das fontes e dos pesos, e parâmetros efetivos.
- Ler cache produtivo sem preparar ou modificar pesos; desabilitar downloads.
- Registrar hashes do código do repositório, índice do Git e manifest da memória antes/depois; mudanças externas devem ser relatadas, nunca revertidas.
- Encerrar o processo experimental após descarregar o pipeline, sem workers pendentes.
- Entrega classificada como estudo isolado e registros mARC, não mudança de tooling produtivo nem entrega release-ready. Aplicar testes focados do runner e checagens de integridade/metadata. Não executar pnpm validate em modo de escrita sem mudança produtiva que o justifique.
- Auditoria preflight antes da execução e messages após os anexos finais.

## Entrega e limites

Relatório em pt-BR com uma resposta direta sobre a hipótese, métricas por grupo, exemplos de acertos/erros, diagnóstico de influência da posição, consumo observado, limitações e revisão integrada do principal. Anexar a evidência bruta estruturada com consultas, alternativas, expectativas, prompts exatos, ordens, respostas e parâmetros.

Manter a thread aberta para o usuário avaliar ao acordar. Nenhuma implementação produtiva ou encerramento está autorizado por este estudo.
