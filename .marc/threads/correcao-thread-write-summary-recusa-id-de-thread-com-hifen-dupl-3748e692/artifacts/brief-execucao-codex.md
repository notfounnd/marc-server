# Execução — correção de IDs de thread com hífen duplo

## Objetivo e fontes

Implementar a proposta de marc://#msg_16bb617fe97642eca2 e o plano anexo `plano-correcao-id-hifen-duplo.md`, já revisados pelo principal. O humano autorizou a execução com “Implement the plan”. Fonte normativa: AGENTS.md, `.agents/skills/marc-ops/SKILL.md`, bootstrap e `.marc/RULES.md`; ler README, docs/agent-workflows.md, docs/development.md, ADRs aplicáveis e o plano original.

## Configuração e coordenação

Principal: marc://@codex-software-architect, configuração registrada gpt-6.1-sol/high. Desenvolvedor: marc://@codex-dev, gpt-6-luna/xhigh. Ambos os perfis registram confirmação humana para este modo; não são introspecção de runtime. Usar essa seleção no despacho e registrar o que é solicitado e verificável. Um desenvolvedor por vez, conforme ensaio sequencial do workspace. Não despachar outros agentes. Sem Git, commits, worktrees ou alterações de catálogo. Não fechar threads.

Antes de editar: bootstrap independente, leitura das fontes e retorno interno `OK_BOOTSTRAP` com identidade/caminho, fontes, regras críticas, configuração e fonte de confirmação, escopo e estado dos alvos. Aguardar autorização explícita do principal.

## Escopo autorizado

- `src/core/ids.ts`: exportar `threadSlug(title: string): string` como `slugify(title).replace(/-+$/, "")`; preservar `slugify` byte a byte, salvo formatação necessária no arquivo.
- `src/core/threads.ts`: usar `threadSlug` apenas na criação do ID; manter `slugify` no uso para agentes.
- `src/core/thread-summary.ts`: regex `^[a-z0-9]+(?:-[a-z0-9]+)*-{1,2}[a-f0-9]{8}$`; comentário en-US sobre IDs históricos truncados após hífen.
- Criar `test/core-ids.test.ts`; acrescentar cenários em `test/core-thread-summary.test.ts`. `test/core-thread-summary-paths.test.ts` somente se indispensável para cenários negativos; preferir mantê-lo intacto.
- Publicar relatório consolidado `artifacts/entrega-codex.md` nesta thread e mensagem de entrega sob codex-dev via ferramentas oficiais mARC. Nenhuma outra escrita manual em `.marc/`.

Excluídos: alterações em slugify, resolvedor, parser de cabeçalhos, memória, UI, daemon, schemas MCP, dependências, configuração, docs, changelog, dados históricos e trabalho preexistente. O principal escreve a revisão integrada separadamente. Não manter diário ou atualizar artefatos a cada comando.

## Critérios e testes

Criar primeiro testes que reproduzam os dois defeitos e observar falhas pertinentes antes de alterar produção. Testes determinísticos, sem if/else/switch/ternário/skip ou lógica condicional escondida em helpers.

1. `threadSlug("a".repeat(63) + " b")` retorna 63 letras a; normalização de “Título curto” retorna `titulo-curto`; pontuação retorna `item`. `slugify` da entrada longa continua retornando 63 letras a e hífen.
2. `createThread` com essa entrada longa não produz `--`, e o resumo é gravável.
3. Em workspace temporário, renomear a thread para `exemplo--12345678` e alinhar o cabeçalho CHAT. `create` grava resumo com referência exata e fecha apenas a fixture; repetição equivalente retorna unchanged preservando revisão, bytes e mtime; update com revisão correta funciona, preservando identidade e data de fechamento. Fixar também conflito de revisão sem gravação.
4. Rejeitar legacy-readable-thread, exemplo---12345678, a--b-12345678, --12345678, exemplo--1234567, EXEMPLO--12345678 e ../exemplo--12345678; erro invalid_thread e nenhum SUMMARY criado. Preservar testes existentes e proteções físicas de caminhos.

## Validação e entrega

Classificação: código e contrato de persistência. Usar PowerShell, conforme ambiente do humano, via context-mode para investigação e validação; edições manuais apenas por ferramenta nativa apply_patch. Código, comentários e testes en-US; comunicação pt-BR. Sem else ou if aninhado; guardas com early return.

Executar testes focados, `pnpm validate`, `pnpm build`, `pnpm test`. `validate` tem efeitos de escrita: preservar trabalho existente, identificar conflitos fora do escopo e comunicá-los antes de qualquer correção não autorizada. Confirmar regras de código e testes. Evidências já reunidas pelo principal antes da implementação: oito testes existentes passaram, reprodução pura confirma rejeição do ID gerado e preflight sem achados; isso não substitui validação da entrega.

Após build, inspecionar o servidor compilado em `dist/mcp/server.js`; exercitar comportamento compilado em workspace temporário, nunca encerrar threads reais. O processo MCP ativo pode continuar com código antigo até reiniciar; informar limite de validação ao vivo. Browser não se aplica. Rever necessidade de docs; a decisão vigente dispensa alterações porque o formato interno do ID não é documentado.

Ao concluir escopo e checks, publicar a própria entrega consolidada nesta thread, com relatório anexado e revisão do principal pendente. Retornar internamente: caminhos e linhas, mudanças, evidência RED/GREEN, comandos e resultados/limites, preservação de escopo, documentação, riscos, identidade runtime/configuração e confirmação, e ID da própria mensagem. Se acesso MCP impedir publicação, reportar o bloqueio real; não criar perfil ou simular entrega.
