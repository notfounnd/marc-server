# Oportunidade - Encerramento de threads por SUMMARY e índice JSON

## Ideia central

- `SUMMARY.md` em formato de resumo executivo determina o encerramento da thread.
- Thread fechada = existe `.marc/threads/<threadId>/SUMMARY.md`.
- Thread aberta = não existe `SUMMARY.md`.
- Se o summary sumir, a thread volta a ser aberta.
- O summary deve estar sempre acessível.

## Fonte de verdade e controle

- `CHAT.md` e `SUMMARY.md` continuam sendo a fonte de verdade.
- O índice/cache é controle derivado, não conteúdo autoral.
- Apagar o índice não pode perder estado real; ele deve ser reconstruído a partir dos arquivos.
- SQLite pode ser uma evolução futura, mas JSON é aceitável agora se a arquitetura isolar o storage.

## Índice JSON

- Usar `.marc/cache/thread-index.json` como cache derivado.
- JSON deve ser minificado para reduzir escrita grande.
- Escrita deve ser atômica: escrever `.tmp` e renomear.
- Se uma thread for removida manualmente do JSON, a reconciliação deve readicioná-la lendo os arquivos.
- Se a thread readicionada tiver `SUMMARY.md`, deve voltar como fechada.
- `closedAt` deve vir de `Closed: <ISO timestamp>` no summary; fallback para `mtime` do `SUMMARY.md`.

## Arquitetura sugerida

- Criar uma camada isolada de índice:
  - `ThreadIndexStore`
  - `JsonThreadIndexStore`
  - `ThreadIndexReconciler`
- Separar scanner/reconciler de persistência.
- Isso permite evoluir de JSON para SQLite com adapter pattern, sem mudar core/UI.
- Futuro possível: `SqliteThreadIndexStore`, mantendo o índice como derivado.

## Listagem e UI

- Lista principal mostra abertas por padrão.
- Threads fechadas não aparecem na lista principal imediatamente após criar `SUMMARY.md`.
- Deve existir área de arquivo/closed.
- Área closed lista todas as encerradas, ordenadas por `closedAt desc`.
- Se houver opção de mostrar fechadas na lista principal, abertas devem vir no topo e fechadas depois, nunca intercaladas.

## Performance e benchmarks

- Benchmarks devem ficar em `/performance`, na raiz do projeto.
- Arquivos devem ter sufixo `.benchmark.mjs`.
- Devem rodar como script `.mjs`, não pela ferramenta `node:test`.
- Adicionar script:
  - `"test:benchmark": "pnpm dlx tsx"`
- Execução esperada:
  - `pnpm test:benchmark ./performance/thread-index.benchmark.mjs`

## Cenários de benchmark

- Scan direto sem índice.
- JSON cold rebuild.
- JSON warm list.
- JSON deletado e reconstruído 10x.
- Volumes: 100, 500, 1000 e 5000 threads.
- Capturar custo de 5000 arquivos e também custo de escrever JSON grande repetidamente.

## Observações

- O Node lida bem com concorrência de I/O, mas o gargalo pode ser disco, antivírus, Windows, diretórios sincronizados ou muitos arquivos pequenos.
- O benchmark precisa validar o tradeoff entre scan de arquivos e cache JSON.
- `SUMMARY.md` funciona bem porque thread grande demais provavelmente está fazendo coisas demais; encerrar e dividir é o comportamento correto.
