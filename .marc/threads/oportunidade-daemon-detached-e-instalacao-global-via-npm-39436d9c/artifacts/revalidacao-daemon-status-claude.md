# Revalidação — daemon status (Claude)

**Comando**

```
node dist/cli.js daemon status
```

**Response**

```json
{
  "status": "running",
  "source": "api",
  "dataDir": "C:\\Projetos\\marc\\.marc-daemon",
  "statePath": "C:\\Projetos\\marc\\.marc-daemon\\daemon.json",
  "daemon": {
    "status": "ready",
    "pid": 23256,
    "mode": "foreground",
    "uptimeMs": 32162,
    "url": "http://127.0.0.1:4187",
    "dataDir": "C:\\Projetos\\marc\\.marc-daemon",
    "tokenPath": "C:\\Projetos\\marc\\.marc-daemon\\token",
    "fingerprint": "C:\\nvm4w\\nodejs\\node.exe|C:\\Projetos\\marc\\src\\cli.ts|1778904198879",
    "autoIdleMs": 1800000,
    "idleForMs": 3648,
    "activeUiClients": 1,
    "leases": [
      {
        "clientId": "mcp-22796-beae3c50-5331-4933-90f4-64df267dd5de",
        "workspaceId": "marc-dd422176e1",
        "clientType": "mcp",
        "startedAt": "2026-05-16T04:18:29.687Z",
        "lastSeenAt": "2026-05-16T04:18:44.692Z",
        "expiresAt": "2026-05-16T04:19:29.692Z"
      },
      {
        "clientId": "mcp-10544-b9295625-1992-44d4-ad8e-7076f1c5affc",
        "workspaceId": "marc-dd422176e1",
        "clientType": "mcp",
        "startedAt": "2026-05-16T04:18:38.898Z",
        "lastSeenAt": "2026-05-16T04:18:53.903Z",
        "expiresAt": "2026-05-16T04:19:38.903Z"
      }
    ]
  },
  "httpStatus": 200
}
```
