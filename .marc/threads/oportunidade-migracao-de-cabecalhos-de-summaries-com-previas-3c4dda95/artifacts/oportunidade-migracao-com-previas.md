# Oportunidade: migração de cabeçalhos de summaries com prévias

## Origem e propósito

Durante o planejamento de marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7, o usuário decidiu não alterar os summaries antigos nesta entrega e sugeriu registrar uma oportunidade separada de migração com prévias.

Objetivo futuro: aplicar o formato de cabeçalho adotado para novas gravações aos resumos legados, somente após o usuário avaliar as alterações propostas. Nenhuma migração foi iniciada ou autorizada por este registro.

## Formato de referência

H1 com o assunto canônico da thread, referência raw em Thread, timestamp original em Closed, separador e corpo descritivo. Thread/Closed são chaves técnicas do formato; o texto livre preserva o idioma de comunicação escolhido pelo workspace.

## Requisitos para o planejamento futuro

- Inventariar os summaries existentes e produzir prévias legíveis por thread, sem escrever nas fontes durante a análise.
- Preservar o corpo descritivo e sua formatação; não traduzir conteúdo ou impor seções novas.
- Preservar identidade, data original de fechamento e histórico de decisões. Distinguir datas explícitas, fallback por mtime e datas ambíguas; não fabricar precisão histórica.
- Detectar títulos, campos duplicados, metadados contraditórios, timestamps inválidos e outros casos ambíguos, separando-os dos casos seguros.
- Mostrar exatamente o que muda, com critério de elegibilidade, totais e limitações. A aprovação será sobre uma prévia concreta.
- Proteger a aplicação contra mudanças entre prévia e escrita, usando revisão esperada, locks e substituição atômica do core.
- Manter SUMMARY.md como fonte de verdade. Não alterar CHAT.md, artifacts ou estado de fechamento como efeito editorial.
- Planejar reconciliação derivada incremental e preservar autoRebuild e demais configurações. Não modificar ranking, corpus ou schema da memory.
- Definir recuperação de falhas parciais e idempotência por thread, sem alegar transação global de múltiplos documentos.
- Usar workspaces temporárias para testes e classificar a validação conforme o impacto real de eventual tooling ou contrato de parsing.

## Fora de escopo deste registro

Nenhuma implementação, migração, rebuild, purge ou fechamento de thread. O futuro planejamento deverá ler a implementação e o contrato efetivamente entregues em 2f441fa7 antes de escolher a aplicação.
