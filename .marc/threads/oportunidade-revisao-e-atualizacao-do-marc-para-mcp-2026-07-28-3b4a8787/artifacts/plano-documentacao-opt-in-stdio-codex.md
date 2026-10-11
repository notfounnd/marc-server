# Plano de correção do guia de configuração Codex stdio

## Resumo

O usuário habilitou mcp_2026_07_28 e reiniciou o Codex, mas o painel F2 continuou mostrando initialize2025-06-18. O diagnóstico anterior de que a feature bastava estava incompleto.

A fonte do tag rust-v0.162.1 exige um segundo opt-in de servidor stdio: env.CODEX_MCP_PROTOCOL_VERSION="2026-07-28". O cliente consome esse marcador e escolhe Legacy quando ele está ausente. Não se trata apenas de variável do fixture de conformidade.

O principal comprovou os dois cenários com o executável nativo0.162.1, app-server isolado, sem thread/turn/modelo e sem alterar configurações reais:
- Feature ativa sem marcador: primeira mensagem initialize2025-06-18, erro-32022, catálogo vazio.
- Mesma configuração com marcador: server/discover2026-07-28, tools/list2026-07-28, 24 ferramentas, toolsErrornull, exit0.

## Escopo autorizado

Editar somente docs/mcp-migration-2026-07-28.md, em en-US, acrescentando orientação de CodexCLI0.162.1 no trecho de configuração local.

Explicar os dois ajustes, apresentar tabela de ambiente por servidor, preservar argumentos/credenciais existentes e esclarecer que a variável seleciona o lifecycle no Codex. O usuário já habilitou a feature global; o próximo ajuste humano é a tabela [mcp_servers.mcp-marc.env] no .codex/config.toml do projeto. Não alterar nenhum dos três arquivos locais de configuração, nem configuração global, código, dependências, skills ou perfis. Nenhuma compatibilidade legada no mARC.

## Fontes e critérios

Ler o contrato vigente completo, AGENTS.md, README e docs/mcp-migration-2026-07-28.md. Usar fontes oficiais do tag exato:
- https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/rmcp-client/src/protocol_mode.rs
- https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/rmcp-client/src/rmcp_client.rs

Critérios de aceitação: orientação contém ambos os opt-ins; exemplo TOML é uma adição à configuração existente, não substitui command/args/token; política modern-only intacta; afirmações limitadas à versão verificada; nenhum servidor/cliente real reconfigurado pelo agente. A conexão da sessão humana será confirmada após o próximo reinício.

memory_recall não será usado neste complemento de documentação: não altera decisão histórica e as fontes específicas atuais e evidência da thread já foram lidas. Não carregar modelos para esse diagnóstico.

## Execução, revisão e validação

Developer reutilizado codex-dev, runtime codex_modern_startup_trace, gpt-6-luna/xhigh, configuração humana previamente confirmada; limite sequencial1developer. Brief bounded e ACK de escopo antes da autorização de edição. Apply_patch para edição manual. Principal fará revisão independente do trecho final e integração.

Executar pnpm validate, pnpm build e pnpm test, conforme contrato, com hashes para detectar efeitos fora do escopo. Preservar alterações externas/cache derivado e reportar conflito antes de qualquer correção fora do arquivo autorizado. Não usar Git.

Consolidar diagnóstico corrigido, documentação, evidência nativa, validação e revisão final em um único relatório ao fim. Thread permanece aberta. Sem questões de implementação pendentes.
