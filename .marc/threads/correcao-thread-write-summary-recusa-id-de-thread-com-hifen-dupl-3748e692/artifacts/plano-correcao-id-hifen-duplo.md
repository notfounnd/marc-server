# Plano — correção do ID de thread com hífen duplo

Autor: marc://@claude-software-architect
Data: 31/10/2026
Estado: plano pronto para execução em outra sessão. Execução ainda não iniciada.
Autorização: o humano autorizou registrar este plano e passá-lo a outra sessão para corrigir o problema. Git não está autorizado.

## 1. Resumo

`thread_write_summary` recusa threads cujo ID tem hífen duplo antes do sufixo, com o erro `invalid_thread`. As demais ferramentas aceitam esse ID, então a thread funciona normalmente e só trava ao fechar.

A correção tem duas partes pequenas:

1. Aceitar esse formato existente no validador de escrita de resumo.
2. Impedir que novas threads nasçam com esse formato.

## 2. Problema

Reprodução em 31/10/2026:

```text
thread_write_summary(threadId: "oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc", mode: "create", body: "...")
→ { "code": "invalid_thread", "message": "The thread identity is invalid." }
```

Nada foi gravado. A thread segue aberta, e `thread_info`, `thread_read_since`, `message_post` e `workspace_audit` funcionam com o mesmo ID.

## 3. Causa raiz

Dois pontos combinados:

**Geração.** `src/core/ids.ts:3` remove hífens das pontas **antes** de cortar em 64 caracteres:

```ts
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "")
.slice(0, 64);
```

Quando o caractere 64 é um hífen, o slug termina em hífen. `src/core/threads.ts:36` monta `${slugify(title)}-${sufixo}` e o ID ganha `--`.

**Validação.** `src/core/thread-summary.ts:272-274` exige um hífen simples entre todos os segmentos:

```ts
return /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{8}$/.test(threadId);
```

Esse é o único ponto da escrita que rejeita o formato:

- `isCanonicalWriteThreadId` só é usado na linha 96;
- `inspectThreadFiles` (`src/core/thread-summary-paths.ts:40`) valida caminhos e arquivos, não o formato do ID;
- `parseChatThreadId` compara o ID com o cabeçalho do `CHAT.md`, que coincide;
- `resolveThreadId` não usa regex de formato, só traversal e sufixo.

## 4. Alcance

| Item | Resultado da verificação |
| --- | --- |
| Threads com `--` | 2 de 85 entradas em `.marc/threads`: a a54ceabc, aberta, e `dd4a5684`, fechada em 09/10/2026 |
| `dd4a5684` | Fechou antes de existir esse validador. Hoje, um `update` do resumo dela também falharia |
| Regra nova sobre as threads existentes | Aceita todas, exceto `b84827bb`, que já é recusada hoje |
| `b84827bb` | Diretório só com `artifacts/`, sem `CHAT.md`. Fora de escopo; ver seção 11 |

O histórico está em marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7 e marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa. Ferramentas de escrita exigem o ID completo, e a regra de IDs legados continua valendo: `test/core-thread-summary.test.ts` fixa que `legacy-readable-thread` é legível, mas não recebe resumo. Esta correção preserva isso.

## 5. Decisões

**D1. Aceitar `--` somente antes do sufixo.** O formato real é um slug com hífens simples seguido de um ou dois hífens e do sufixo. Não abrir `--` no meio do slug, porque `[^a-z0-9]+` nunca o produz.

**D2. Corrigir a geração só para IDs de thread, sem alterar `slugify`.** Na conversa, cheguei a recomendar mudar `slugify`. A verificação mudou essa recomendação:

- `slugify` também gera `recordId` de seções da memória (`src/core/memory/sources/chunks.ts:21`) e IDs de agentes (`src/core/agents.ts:23`, `src/core/threads.ts:84`).
- Fora do cache, 12 headings em `.marc`, `docs` e README geram slug terminado em hífen. Alterar `slugify` mudaria esses `recordId` sem nenhum ganho.
- Nenhum arquivo de agente termina em hífen, então agentes não têm o problema.

**D3. Não migrar a thread nem os dados.** IDs existentes continuam iguais, porque há referências a eles em outras threads.

**D4. Sem mudança de documentação.** `docs/mcp-tools.md` não descreve o formato interno do ID. A entrega deve confirmar isso. `CHANGELOG.md` só é atualizado em release.

## 6. Mudanças

Escopo autorizado para escrita:

| Arquivo | Mudança |
| --- | --- |
| `src/core/ids.ts` | Nova função `threadSlug` |
| `src/core/threads.ts` | Usar `threadSlug` na linha 36 e ajustar o import |
| `src/core/thread-summary.ts` | Regex da linha 273 |
| `test/core-ids.test.ts` | Arquivo novo |
| `test/core-thread-summary.test.ts` | Cenários de escrita |
| `test/core-thread-summary-paths.test.ts` | Somente se os cenários negativos couberem melhor nele |

**`src/core/ids.ts`:**

```ts
export function threadSlug(title: string): string {
  return slugify(title).replace(/-+$/, "");
}
```

**`src/core/threads.ts:36`:**

```ts
const id = `${threadSlug(title)}-${newId("thread").slice(-8)}`;
```

Manter `slugify` importado, porque a linha 84 ainda o usa.

**`src/core/thread-summary.ts:273`:**

```ts
return /^[a-z0-9]+(?:-[a-z0-9]+)*-{1,2}[a-f0-9]{8}$/.test(threadId);
```

Comentário de uma linha acima da regex, em en-US, explicando que IDs existentes podem ter dois hífens antes do sufixo, porque o slug foi truncado depois de um hífen.

**Não alterar:** `slugify`, `resolveThreadId`, `parseChatThreadId`, memória, UI, daemon, MCP, docs, `.marc/` ou configuração.

## 7. Testes

Siga a regra de testes do workspace: cenários declarados, sem `if`, ternário ou skip, com asserções explícitas. Lógica de teste não pode ir para helpers.

**`test/core-ids.test.ts`**

| Entrada | Esperado |
| --- | --- |
| `threadSlug("a".repeat(63) + " b")` | 63 vezes `a`, sem hífen no fim |
| `threadSlug("Título curto")` | `titulo-curto` |
| `threadSlug("!!!")` | `item` |
| `slugify("a".repeat(63) + " b")` | 63 vezes `a` seguido de `-`. Fixa que `slugify` não mudou |

**`test/core-thread-summary.test.ts`**

1. **Geração:** `createThread` com título `"a".repeat(63) + " b"` produz ID sem `--`, e `writeThreadSummary` fecha essa thread.
2. **ID existente com `--`:** partindo de `createThread`, renomear o diretório para `exemplo--12345678`, reescrever a linha `Thread:` do `CHAT.md` com o mesmo ID e chamar `writeThreadSummary`. Esperado: thread fechada, `SUMMARY.md` com `Thread: marc://$exemplo--12345678`.
3. **Continuação:** repetir `create` com o mesmo corpo devolve `unchanged`, e `update` com a revisão correta funciona no mesmo ID.
4. **Rejeições, em tabela declarada:** todas com `invalid_thread` e sem `SUMMARY.md` criado.

| ID | Motivo |
| --- | --- |
| `legacy-readable-thread` | Sem sufixo; caso já coberto, deve continuar |
| `exemplo---12345678` | Três hífens |
| `a--b-12345678` | `--` no meio do slug |
| `--12345678` | Sem slug |
| `exemplo--1234567` | Sufixo curto |
| `EXEMPLO--12345678` | Maiúsculas |
| `../exemplo--12345678` | Traversal |

Os testes existentes não podem ser alterados, salvo inclusão de cenários. Os casos de traversal e maiúsculas em `test/core-thread-summary-paths.test.ts` devem continuar passando sem mudança.

## 8. Validação

Classificação: mudança de código e de contrato de persistência.

```bash
pnpm validate
pnpm build
pnpm test
```

`pnpm validate` escreve correções de lint e formatação. Antes da entrega, confira que nada fora do escopo mudou. Não reverta alterações que já existiam: há registros `.marc/` pendentes de commit nesta árvore.

Verifique as regras de código: sem `else`, sem `if` aninhado.

O MCP em uso roda `dist/cli.js`. Por isso, a ferramenta real só reflete a correção depois de `pnpm build` e de reiniciar o servidor MCP. Informe isso na entrega.

## 9. Execução

1. Faça bootstrap, leia `.marc/RULES.md` e o `marc-ops`, e chame `workspace_update_recommendations`.
2. Leia esta thread.
3. Rode `workspace_audit` com `scope: preflight`.
4. Confirme a configuração do desenvolvedor. Em Claude Code: agente `general-purpose`, perfil marc://@claude-dev, modelo `claude-haiku-5-5`, reasoning xhigh, conforme confirmação anterior do humano. Em Codex: perfil marc://@codex-dev, com configuração confirmada pelo humano.
5. Despache com brief completo. Um desenvolvedor por vez. O desenvolvedor devolve `OK_BOOTSTRAP` e só edita depois da autorização.
6. O desenvolvedor implementa, valida e publica a entrega de autoria dele nesta thread.
7. O principal faz a revisão integrada e registra o veredito.
8. Apresente o resultado ao humano. Esta thread só fecha com autorização dele. Git só com autorização dele.

## 10. Critérios de aceite

- `create` e `update` de resumo funcionam em ID com `--`.
- Novas threads com título que cai no corte não ganham `--`.
- `slugify` continua idêntico.
- Todas as rejeições da seção 7 seguem válidas.
- `pnpm validate`, `pnpm build` e `pnpm test` passam.
- Diff restrito ao escopo da seção 6.

## 11. Riscos e pendências

- **Baixo:** relaxar a regex alcança só um formato já produzido pelo core. O caminho continua protegido por `safeJoin` e pela validação de arquivos.
- **Comportamento novo:** threads novas têm ID um caractere menor nesse caso de corte. Nenhum contrato depende do tamanho.
- **Fora de escopo:** o diretório `b84827bb` só tem `artifacts/`, sem `CHAT.md`. Não foi criado por esta correção. Registre como observação; apagar depende do humano.
- **Mensagem de erro genérica:** `invalid_thread` não diz o motivo. Melhorar isso é oportunidade separada.
