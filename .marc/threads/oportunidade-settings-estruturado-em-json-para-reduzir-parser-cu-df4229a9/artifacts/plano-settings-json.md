# Plano - Settings estruturado em JSON

## Objetivo

Substituir o armazenamento de settings de workspace em `.marc/SETTINGS.md` por `.marc/marc.config.json`, removendo o parser customizado de Markdown para configuração operacional.

## Decisões da thread

- Usar nome `marc.config.json`, seguindo padrão reconhecível de ferramentas como `jest.config.json`, `vitest.config.json` e `eslint.config.json`.
- Fazer substituição direta do arquivo atual.
- Não manter fallback para `SETTINGS.md`, porque o recurso ainda não foi para produção e não há necessidade de compatibilidade legado.
- Preservar Markdown como fonte de verdade para conhecimento, histórico, threads, summaries, regras e artefatos.
- Tratar JSON como exceção explícita para configuração operacional estruturada de máquina.

## Contexto técnico levantado

- O fluxo atual está concentrado em `src/core/memory/settings.ts`.
- `SETTINGS.md` usa um bloco de comentário Markdown com `memory.autoRebuild`.
- A UI e o daemon acessam settings por wrappers (`readWorkspaceSettings`, `updateWorkspaceSettings`) e endpoints existentes; isso reduz a mudança principalmente ao core, testes e documentação.
- A thread marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa introduziu settings de memory em Markdown.
- A thread marc://$oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f confirmou Markdown como SoT para conteúdo gerenciado; esta mudança precisa ser registrada como exceção deliberada para settings estruturados.

## Arquitetura proposta

Formato autoritativo:

```json
{
  "memory": {
    "autoRebuild": false
  }
}
```

Regras:

- Arquivo ausente usa defaults em memória: `memory.autoRebuild = true`.
- Escrita cria `.marc/marc.config.json` com JSON indentado e newline final.
- `SETTINGS.md` deixa de ser lido.
- `SETTINGS.md` deixa de ser escrito.
- O código deve validar a forma mínima da configuração ao ler JSON, sem recriar mini-parser textual.
- O caminho público exposto por `workspaceSettingsPath` passa a apontar para `marc.config.json`.

## Plano de implementação

### Task 1 - Testes do contrato de persistência

Arquivos:

- Modificar: `test/core-memory-background.test.ts`

Passos:

- Atualizar o teste existente de persistência para verificar que o arquivo criado é `.marc/marc.config.json`.
- Verificar que o conteúdo persistido é JSON válido com `memory.autoRebuild`.
- Verificar que `SETTINGS.md` não é criado no fluxo novo.
- Adicionar cobertura de substituição direta: um `SETTINGS.md` legado presente sozinho não deve controlar `autoRebuild`; sem `marc.config.json`, o default continua `true`.

### Task 2 - Implementar storage JSON

Arquivos:

- Modificar: `src/core/memory/settings.ts`

Passos:

- Trocar `SETTINGS_FILE` de `SETTINGS.md` para `marc.config.json`.
- Remover `AUTO_REBUILD_PATTERN`, `readAutoRebuild` e `renderSettings` em Markdown.
- Ler JSON com `JSON.parse` quando o arquivo existir.
- Normalizar shape lido para `WorkspaceSettings`, preservando default quando campos opcionais estiverem ausentes.
- Escrever JSON com `JSON.stringify(settings, null, 2)` e newline final via `writeFileAtomically`.
- Manter `withWorkspaceWriteLock` no mesmo recurso lógico (`workspace-settings`).
- Manter guard clauses simples, sem `else` e sem `if` aninhado.

### Task 3 - Atualizar configuração real do workspace

Arquivos:

- Criar/modificar: `.marc/marc.config.json`
- Remover: `.marc/SETTINGS.md`, se existir

Passos:

- Preservar o estado operacional atual do usuário: se `memory.autoRebuild` está desabilitado hoje, registrar isso no JSON novo.
- Remover o arquivo Markdown antigo para não deixar duas fontes aparentes.

### Task 4 - Atualizar documentação

Arquivos:

- Modificar: `docs/memory.md`
- Modificar: `docs/ui-and-daemon.md`

Passos:

- Trocar referências de `.marc/SETTINGS.md` para `.marc/marc.config.json`.
- Explicar de forma curta que settings de workspace são configuração operacional estruturada.
- Manter a documentação em en-US conforme regra do projeto.

### Task 5 - Validação

Comandos via context-mode, sem git:

- `pnpm test test/core-memory-background.test.ts`
- `pnpm run validate`
- `pnpm test`
- `pnpm build`

Critérios de aceite:

- Teste focado comprova JSON e ausência de escrita de `SETTINGS.md`.
- Validação completa passa.
- Documentação não menciona mais `SETTINGS.md` como storage de settings.
- Thread recebe comentário final com arquivos alterados, validação e pendências.

## Riscos

- Mudança contradiz a leitura literal da regra atual “Markdown como fonte de verdade”. Mitigação: registrar como exceção de settings estruturados, sem alterar threads, summaries, rules ou artifacts.
- Se o arquivo JSON for editado manualmente com JSON inválido, a leitura deve falhar como configuração inválida. Isso é aceitável para configuração de máquina, mas pode merecer tratamento mais amigável em oportunidade futura.
- Como não haverá fallback para `SETTINGS.md`, o estado atual precisa ser transferido para `marc.config.json` durante esta implementação.
