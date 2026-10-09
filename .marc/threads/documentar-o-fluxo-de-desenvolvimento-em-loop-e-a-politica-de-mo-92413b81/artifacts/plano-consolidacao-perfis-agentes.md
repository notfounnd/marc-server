# Consolidação dos perfis de agentes

## Escopo aprovado

- Manter apenas codex-software-architect, codex-dev e ui-user no cadastro ativo.
- Configurar architect com gpt-6.1-sol e developer com gpt-6-luna. Reasoning separado em contexto manual, high e xhigh respectivamente, com origem da confirmação.
- Registrar metadados canônicos pelo MCP. Manter Description concisa em uma linha e complementar abaixo com bullets de responsabilidades, limites e configuração.
- Remover os cinco perfis redundantes com apply_patch, sem alterar CHAT.md e SUMMARY.md existentes.
- Preservar ui-user byte a byte e conservar snapshot dos perfis anteriores como artefato.
- Alinhar AGENTS.md, docs/agent-workflows.md e apenas Custom Rules para reutilização de perfis por papel. Subagentes temporários não criam perfis por spawn e não alteram o cadastro. O principal registra entregas e atribuição.

## Limites e efeitos históricos

Não implementar aliases ou ferramentas novas. Links antigos para perfis excluídos não resolverão. Metadados de autoria históricos permanecem intactos. O snapshot registra que codex-dev anteriormente era architect. Sem reatribuir mensagens de Claude ou Copilot ao Codex.

## Execução e aceitação

1. [x] Inspecionar formato atual e preservar snapshot.
2. [x] Registrar os dois perfis definitivos via MCP.
3. [x] Um desenvolvedor gpt-6-luna/xhigh confirma bootstrap e aguarda autorização para contexto manual, cinco exclusões e três ajustes documentais.
4. [x] Principal revisa responsabilidades, perfis, regras, formato, histórico e invariantes.
5. [x] Executar pnpm validate, pnpm build, pnpm test nesta ordem. Verificar Markdown, inventário MCP com exatamente três perfis, modelos exatos, ui-user intacto e histórico protegido.
6. [x] Registrar evidências e comunicar resultado. Thread permanece aberta para avaliação humana.

## Resultado

Cadastro consolidado e revisão técnica aprovada. pnpm validate, pnpm build e pnpm test passaram, com 198 testes. Audit de agents sem findings. Perfis re-registrados pelo MCP retornaram unchanged, preservando os bullets. ui-user, histórico protegido e prefixo gerenciado de RULES.md permaneceram intactos.

Avaliação humana e encerramento da thread continuam pendentes.
