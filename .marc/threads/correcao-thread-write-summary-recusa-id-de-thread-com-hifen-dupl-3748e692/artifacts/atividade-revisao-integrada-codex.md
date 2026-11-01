# Entrega integrada e revisão final — IDs de thread

A correção atende à proposta registrada nesta thread: novas threads deixam de receber separador duplo quando o título é cortado após um hífen, e resumos podem ser criados ou atualizados em IDs históricos com esse formato. A revisão técnica integrada está **approved**. A thread permanece aberta para revisão humana; não houve autorização de encerramento ou de Git.

## Escopo, fontes e coordenação

Fontes: AGENTS.md, skill marc-ops, contrato completo do bootstrap de `marc-dd422176e1` em `C:\Projetos\marc`, README, docs/agent-workflows.md, docs/development.md, docs/architecture.md, docs/harness-engineering.md, ADRs 0001/0003/0004/0007/0008, plano original, brief de execução e entrega do desenvolvedor. As decisões históricas de resolução de IDs e escrita de SUMMARY foram recuperadas por memory_recall e conferidas nas fontes Markdown correspondentes.

A proposta original foi reutilizada e acompanhada do brief em marc://#msg_4497016781cf4fe2b6. Desenvolvimento executado sequencialmente pelo runtime `/root/fix_thread_ids`, sob marc://@codex-dev, com seleção solicitada gpt-6-luna/xhigh. O bootstrap independente confirmou workspace, fontes, regras, escopo e configuração; o principal conferiu o OK_BOOTSTRAP e autorizou explicitamente as edições no canal interno. A confirmação de configuração veio dos perfis/handoff humanos registrados, não de introspecção do runtime.

Principal: marc://@codex-software-architect, configuração registrada gpt-6.1-sol/high. Uma revisão adicional somente leitura pelo runtime `/root/review_thread_ids`, com gpt-6.1-sol/high, aprovou conformidade e qualidade sem achados. Essa revisão auxilia, mas não substitui a avaliação integrada abaixo.

Entrega própria do desenvolvedor conferida: marc://#msg_225472821a4c4760a9, autoria codex-dev, com `artifacts/entrega-codex.md` em seus metadados. O conteúdo corresponde às alterações e aos resultados observados. O principal não retransmitiu essa entrega como sua autoria.

## Revisão final integrada

### Estado e critérios avaliados

Avaliei os cinco arquivos alterados, sua integração com consumidores e persistência, o plano e o brief, os testes existentes preservados, os registros de validação do context-mode e a entrega do desenvolvedor. As fontes mantiveram os mesmos hashes entre a captura revisada após validate e a comparação final.

| Critério | Implementação e avaliação do principal | Evidência conferida |
| --- | --- | --- |
| Novas threads sem `--` no corte | `src/core/ids.ts:15` acrescenta threadSlug; `src/core/threads.ts:36` o usa somente na criação. A limpeza ocorre após slugify e antes de acrescentar o sufixo. | Teste real com 63 letras e separador, asserção do ID completo por formato e gravação de resumo; GREEN e execução independente do principal. |
| Resumos em IDs históricos | `src/core/thread-summary.ts:272` permite um ou dois hífens exclusivamente na fronteira do sufixo hexadecimal de oito caracteres. A regex continua exigindo segmentos anteriores com hífens simples. | Fixture de filesystem real com CHAT alinhado; criação, referência exata, estado fechado, update e conflito; teste fonte independente e smoke compilado relatado na entrega. |
| Preservar idempotência e revisões | Nenhuma mudança em create/update, normalização, lock ou escrita atômica. Retry equivalente conserva bytes, mtime e revisão; update conserva fechamento e conflito não grava. | Inspeção do fluxo completo e asserções de ciclo da fixture histórica, aprovadas na execução independente. |
| Preservar slugify e consumidores | Comparação direta demonstrou slugify byte a byte idêntico. Remover apenas o novo helper restaura ids.ts original; desfazer as duas substituições planejadas restaura threads.ts original. Agentes e memória continuam usando slugify. | Captura anterior às edições comparada às fontes finais; consumidores em threads.ts, agents.ts e memory/sources/chunks.ts conferidos. |
| Rejeitar formatos inválidos e caminhos inseguros | A alteração na regex não aceita hífen triplo, duplicação interna, slug vazio, sufixo curto ou maiúsculas. Legado sem sufixo e traversal seguem rejeitados. safeJoin, inspeção física e validação do CHAT não mudaram. | Matriz declarada e testes reais de traversal/junctions; core-thread-summary-paths.test.ts permaneceu idêntico à captura inicial. |
| Preservar escopo e padrões | Produção alterada somente nos três arquivos previstos; testes existentes mantidos, com novos cenários em dois arquivos. Sem novos ramos condicionais, else, if aninhado ou skips; não foram criadas abstrações além do helper necessário. | Comparação direta restaurável dos três arquivos; remoção do bloco de novos cenários restaura o teste original; inspeção dos testes e revisão adicional. |

### Arquitetura, documentação e limites

Markdown continua autoritativo. A correção não renomeia diretórios, reescreve IDs históricos ou migra referências. Cabeçalhos, formatos de SUMMARY, revisões, locks e projeções derivadas mantêm o fluxo existente. A separação em threadSlug evita efeitos sobre IDs de agentes e registros de memória. Nenhuma dependência, schema MCP, configuração ou hook foi acrescentado.

Revisei a necessidade de documentação. O formato interno do ID não é estabelecido em docs/mcp-tools.md; a correção não muda a interface de chamada. Mantive a decisão do plano de não alterar documentação ou changelog. Browser/Playwright não se aplica, pois não houve alteração de UI.

A captura ampla inicial incluiu um log volátil preexistente em `.playwright-output`, que continuava recebendo erros de conexão de uma sessão antiga. Sua variação foi isolada por timestamps; nenhum outro arquivo fora do escopo apresentou modificação posterior à captura. A comparação adicional, excluindo esses logs gerados, confirmou 1.881 arquivos externos ao escopo estáveis até a revisão final. Nenhum log ou processo preexistente foi limpo ou encerrado.

### Validação e origem das evidências

Classificação da entrega: código e contrato de parsing/persistência; não é publicação ou release.

- **RED/GREEN do desenvolvedor, conferido no índice context-mode:** `batch:Focused RED tests` reproduz export ausente, geração com `--` e writer retornando invalid_thread; a fixture já estava corrigida para o cabeçalho real no RED pertinente. `batch:Focused GREEN tests` registra 9 aprovados e zero falhas.
- **Validate, evidência original conferida:** `batch:pnpm validate` mostra code:fix, lint:check, format:check e typecheck concluídos sem erros. Não há marcador separado de exit code nessa captura; a conclusão dos estágios está visível. Não foi repetido apenas por esse detalhe.
- **Build, evidência original conferida:** `batch:pnpm build` e `batch:pnpm build explicit status` registram TypeScript/Vite concluídos, com exit 0 na captura explícita. Há aviso de bundle Vite de 671,22 kB, sem mudança de UI nesta tarefa.
- **Suíte completa do desenvolvedor, evidência original conferida:** `batch:pnpm test full suite`, 1.177 testes aprovados, zero falhas, zero skips e EXIT_CODE=0. A suíte emitiu avisos informativos de criação de datasets temporários LanceDB; não foram tratados como falhas nem ocultados.
- **Execução direta e independente do principal:** Node test runner com core-ids, core-thread-summary, core-thread-summary-paths, mcp-thread-summary e core-thread-resolution; exit 0, 18 aprovados, zero falhas e zero skips.
- **Smoke compilado, relatado pelo desenvolvedor e conferido no relatório de sua autoria:** startMcpTestClient("dist") iniciou processo stdio novo com `node dist/cli.js mcp --workspace <temporário>`, listou 26 ferramentas e criou resumos para o ID longo corrigido e para `example--12345678`, ambos com outcome created e exit 0. O helper de processo foi inspecionado pelo principal para confirmar a seleção de dist. Não repeti esse smoke nem afirmei ter executado seu processo.

O smoke separado demonstra a build compilada, mas não reinicia a conexão MCP já ativa nesta sessão. Para essa conexão carregar a correção, é necessário reiniciá-la. Nenhuma thread real foi encerrada para testar.

### Achados e veredito

Não identifiquei defeitos técnicos pendentes no estado integrado. As comparações, testes independentes e evidências conferidas sustentam os critérios de aceite; a revisão adicional concordou. Os avisos de build/datasets e o reinício necessário da conexão MCP estão explicitados acima. Melhorias de mensagens de erro, migração, limpeza do diretório órfão e UI continuam fora do escopo.

**Veredito: approved.** A implementação corrige geração e compatibilidade de escrita com escopo mínimo, preserva a arquitetura e os dados e tem evidência suficiente de regressão, integração e validação completa. Esta é aprovação técnica do principal, não aceitação humana nem autorização de encerramento.

Qualquer alteração posterior de implementação invalida este veredito para o novo estado e exige reavaliação e checks afetados. Nenhum comando Git, commit, worktree, publicação de release ou alteração de catálogo foi realizado.
