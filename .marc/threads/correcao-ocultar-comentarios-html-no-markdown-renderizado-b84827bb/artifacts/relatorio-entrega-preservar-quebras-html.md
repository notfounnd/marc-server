# Entrega de implementação: preservar quebras de HTML no Markdown

## Estado

Implementação concluída e entregue para revisão integrada do principal. O parecer técnico integrado permanece pendente; a thread segue aberta. Não alterei configurações, dependências, manifestos, lockfiles ou perfis.

## Escopo e comportamento

O plugin rehype local percorre a árvore HAST e agrupa nós `raw` consecutivos, incluindo apenas texto whitespace que fique entre dois nós raw. Cada raw isolado ou agrupado vira um `span.markdown-html-source` com conteúdo em nó de texto, portanto o React escapa as tags e mantém o HTML literal. A contagem de quebras usa `position.end.line` / `position.start.line` quando disponível; para posições ausentes usa o separador HAST, e na mesma linha preserva os espaços originais. Separadores diante de outros nós Markdown continuam fora do wrapper.

O CSS aplica `white-space: pre-wrap` e `overflow-wrap: anywhere` somente à classe nova. Código inline, fenced e indentado continua no fluxo de código existente. `preserveLineBreaks` não foi alterado.

## Arquivos

- `src/ui/markdown-html-source.ts:18` implementa o plugin; `:50` percorre filhos e agrupa runs raw; `:115` reconstrói gaps com posições ou fallback; `:137` cria o wrapper de texto.
- `src/ui/markdown-panel.tsx:1` importa o namespace React para o JSX clássico no SSR; `:7` importa o plugin; `:42` o registra em `rehypePlugins`.
- `src/ui/styles/thread-content.css:384` define quebra preservada e wrapping longo para o wrapper.
- `test/ui-markdown-html-source.test.ts:54` verifica os comentários reais de Custom Rules; `:67` verifica `\n\n\n` no span e fonte inalterada; `:94` cobre comentário dentro de parágrafo; `:107` raw adjacentes com posições; `:128` fallback HAST sem posições; `:141` raw multilinha isolado; `:157` separação por conteúdo Markdown.
- `test/ui-markdown-panel.test.ts:14` verifica tags como texto escapado; `:29` cobre exemplos inline/fenced/indented; `:51` verifica títulos, listas, tabelas, links e referência mARC.
- `docs/ui-and-daemon.md:72` documenta que o HTML bruto é exibido como texto escapado, com quebras mantidas e linhas longas quebráveis.

Os dois testes SSR importam o componente real por URL dinâmica tipada como `React.ComponentType<{ markdown: string }>`. Isso mantém a verificação de integração sem puxar TSX/browser para o grafo de tipos NodeNext dos testes.

## Verificações

- Foco Markdown — `ctx_execute: focused Markdown tests`: exit 0, 11/11, 0 skips.
- Lint e Prettier focados — exit 0.
- `pnpm validate` — `ctx_execute: Run authorized pnpm validate after clean no-write preflight`: exit 0; lint, formatação global e `tsc -p tsconfig.json --noEmit` concluíram. O preflight imediatamente anterior encontrou zero diferenças Prettier e zero edições no ESLint dry-run.
- `pnpm build` — `ctx_execute: Run required production build`: exit 0; Vite transformou 2.392 módulos e concluiu em 10,97 s. O bundle JS minificado de 672,27 kB gerou o aviso existente de chunk acima de 500 kB. O build removeu e recriou `dist`, conforme script do projeto.
- `pnpm test` isolado de outras validações — `ctx_batch_execute: Final exclusive full pnpm test output`: 327 testes, 325 pass, 2 fail, 0 skips, 50,08 s. Os únicos fails foram deadlines de subprocessos MCP: discovery sem resposta em `test/mcp-protocol.test.ts:1:1393` (~5,1 s) e EOF/write-drain sem resposta em `test/mcp-write-drain.test.ts:1:621` (~5,8 s), ambos em `test/mcp-process.ts:91`.
- Reexecução serial completa — `ctx_batch_execute: Serial full Node test output`, comando `pnpm exec node --test --test-concurrency=1 --import tsx test/**/*.test.ts`: 328/328 pass, 0 fail, 0 skips, 85,12 s. Os dois casos MCP que excederam o prazo na execução paralela passaram serialmente em 529 ms e 807 ms. O teste de captura memory-eval também passou serialmente.

Rodadas anteriores capturadas: a primeira suíte completa terminou 325/326 e apontou o teste `captures channels, the reranker matrix and latency for every case`; isolado, ele passou 1/1 em 1,61 s. A segunda rodada completa indexada terminou 321/327 com seis falhas MCP de resposta/processo/limiter e coincidiu com uma checagem TypeScript independente do principal. A suíte serial íntegra passou depois. Essa sequência é consistente com pressão de concorrência/deadline, mas isso é uma inferência; nenhum teste MCP ou memory-eval foi alterado.

O principal reportou validação de navegador independente nas quatro superfícies, wide e narrow: comentários separados, gap multilinha de 1, gap de linha vazia de 3, sem overflow nem page errors, script inerte, e code/tags/links/lista/tabela preservados. Essa evidência pertence à execução do principal.

## Bootstrap, autorização e integridade do escopo

Bootstrap independente confirmou workspace `marc-dd422176e1` em `C:\\Projetos\\marc`. Li `AGENTS.md`, `.agents/skills/marc-ops/SKILL.md`, `.marc/INSTRUCTIONS.md` e `.marc/RULES.md` com Custom Rules, README, docs de workflows/development/UI, ADRs 0001/0003/0004/0007/0008, thread canônica e artifact do plano; o preflight inicial da thread reportou zero achados. Revisei a decisão histórica de manter `preserveLineBreaks`.

O perfil compartilhado atribuído foi `codex-dev`; seleção solicitada e confirmada pelo perfil: modelo `gpt-6-luna`, reasoning `xhigh`. A confirmação é baseada no perfil/configuração humana fornecida para este modo, sem alegação de introspecção runtime. Aguardei `OK_BOOTSTRAP` e autorização explícita do principal antes de editar os seis caminhos delimitados.

`test/memory-eval-capture.test.ts` apareceu temporariamente como diferença do Prettier fora do escopo. A intervenção de formatação nesse path foi autorizada humanamente, mas antes do validate o arquivo já estava estável e o preflight global ficou limpo. Não editei esse arquivo; seu hash `cf2222ed5ad9188759062fcde288e7feea855258fb668618f0ebb837d9eeec3e` permaneceu idêntico antes e depois do validate. Os hashes dos seis caminhos autorizados também permaneceram estáveis através de validate. A revisão integrada final do principal continua pendente.
