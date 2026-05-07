# Oportunidade - Status health e rebuild de índice em background

## Problema

- O benchmark mostrou `json rebuild 10x` chegando a aproximadamente 24s em 5k/10k threads.
- Rebuild pesado não deve travar a UI nem surpreender agentes entre consultas.
- A listagem deve continuar funcional enquanto o índice JSON é reconstruído.

## Objetivo

- Expor status/health dos módulos do mARC.
- Tornar rebuild do índice uma atividade de background.
- Permitir que UI e agentes saibam quando algum módulo está degradado, reconstruindo ou pronto.

## Proposta de status

- Criar uma API/tool de health, por exemplo:
  - HTTP: `GET /api/status` expandido ou `GET /api/health`
  - MCP: `workspace_status` ou `workspace_health`
- Retornar módulos e estado operacional:
  - daemon
  - workspace registry
  - thread index
  - file watcher
  - sqlite/cache opcional

## Exemplo de resposta

```json
{
  "ok": true,
  "modules": {
    "threadIndex": {
      "status": "ready",
      "rebuilding": false,
      "lastRebuildAt": "2026-05-01T05:00:00.000Z",
      "lastError": null
    }
  }
}
```

## Estados sugeridos

- `ready`: módulo operacional.
- `rebuilding`: rebuild em background em andamento.
- `degraded`: usando cache antigo ou fallback, mas ainda funcional.
- `error`: módulo indisponível ou falhou.

## Resiliência da UI

- UI deve continuar exibindo a última lista conhecida enquanto rebuild acontece.
- Mostrar badge/aviso discreto: "Index rebuilding".
- Quando rebuild terminar, UI atualiza a lista automaticamente.
- Se rebuild falhar, UI mantém dados anteriores e mostra estado degradado.

## Comportamento do índice

- Rebuild pesado deve rodar em background quando possível.
- Listagens podem usar o último índice válido enquanto o novo é construído.
- Escrita continua atômica: `.tmp` + rename.
- Se não houver índice válido, fallback pode fazer scan direto com aviso de status.

## Benefício para agentes

- Agentes podem consultar health antes de operações sensíveis.
- Se `threadIndex.status = rebuilding`, o agente entende que listagem pode estar momentaneamente defasada.
- Evita surpresa entre uma consulta e outra.
