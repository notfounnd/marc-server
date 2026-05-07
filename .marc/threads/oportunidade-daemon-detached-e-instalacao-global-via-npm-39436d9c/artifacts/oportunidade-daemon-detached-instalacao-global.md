# Oportunidade - Daemon detached e instalacao global

## Contexto

O projeto esta sendo preparado para ser aberto como open source e, futuramente, poder ser instalado globalmente via npm. A base tecnica do CLI ja existe: o pacote tem `bin` apontando para `dist/cli.js`, o arquivo gerado tem shebang e o build produz o servidor, MCP e UI em `dist`.

O ponto pendente e a experiencia operacional do daemon. Hoje `marc daemon` roda em foreground e prende o terminal, o que e aceitavel em desenvolvimento, mas ruim para uma ferramenta global usada no dia a dia.

## Problema

Quando o usuario instala uma ferramenta com `npm -g`, a expectativa e conseguir iniciar o servico local e voltar ao terminal imediatamente. Se o comando principal fica preso, o usuario precisa manter uma janela aberta, criar atalhos manuais, usar shell-specific backgrounding ou depender de ferramentas externas.

Isso aumenta atrito e deixa o mARC com cara de ferramenta de desenvolvimento interno, nao de produto instalavel.

## Experiencia desejada de CLI

Manter o comportamento atual para desenvolvimento:

```bash
marc daemon
```

Adicionar comandos operacionais:

```bash
marc daemon start
marc daemon stop
marc daemon restart
marc daemon status
```

## Contrato dos comandos

### `marc daemon`

- Continua rodando em foreground.
- Mantem compatibilidade com o fluxo atual.
- Bom para debug e desenvolvimento.

### `marc daemon start`

- Inicia o daemon em background/detached.
- Nao prende o terminal.
- Grava estado operacional em disco.
- Imprime PID, URL, caminho do token e caminho do log.
- Se ja houver daemon rodando, nao inicia outro sem necessidade.

### `marc daemon stop`

- Le o PID salvo.
- Encerra o processo.
- Remove ou marca estado stale quando o processo nao existir mais.
- Deve falhar com mensagem clara se nao houver daemon conhecido.

### `marc daemon restart`

- Executa stop e start de forma segura.
- Deve lidar com PID stale.

### `marc daemon status`

- Mostra `running` ou `stopped`.
- Mostra PID quando existir.
- Mostra URL, token path, log path e uptime quando disponivel.
- Pode indicar workspaces registrados se isso for barato.

## Estrategia tecnica cross-platform

A implementacao deve ser feita em Node, sem depender de comandos externos como `nohup`, `&`, `Start-Process` ou systemd.

Abordagem provavel:

- usar `child_process.spawn` com `detached: true`;
- usar `stdio: "ignore"` ou redirecionar para arquivos de log;
- chamar `child.unref()`;
- persistir um arquivo de estado no `dataDir` do daemon.

No Windows, macOS e Linux, o detalhe mais sensivel sera encerrar corretamente o processo pelo PID e tratar processo inexistente sem quebrar a UX.

## Estado em disco e logs

Arquivos sugeridos dentro do `dataDir` do daemon, hoje `.marc-daemon` por padrao:

```text
.marc-daemon/
  token
  daemon.json
  daemon.log
```

`daemon.json` pode conter:

```json
{
  "pid": 12345,
  "host": "127.0.0.1",
  "port": 4187,
  "url": "http://127.0.0.1:4187",
  "startedAt": "2026-05-02T00:00:00.000Z",
  "tokenPath": "C:/.../.marc-daemon/token",
  "logPath": "C:/.../.marc-daemon/daemon.log"
}
```

## Casos de falha

- PID existe no arquivo, mas o processo morreu.
- Porta ja esta em uso por outro processo.
- `start` chamado duas vezes.
- `stop` chamado sem daemon rodando.
- Permissao de escrita negada no `dataDir`.
- Processo inicia, mas falha antes de abrir porta.
- Logs crescem indefinidamente.

## Validacoes necessarias

- Testes unitarios para leitura/escrita de estado do daemon.
- Testes de CLI para parse de `daemon start|stop|restart|status`.
- Validacao manual cross-platform, especialmente Windows.
- Teste de pacote local:

```bash
pnpm pack
npm install -g ./marc-server-0.1.0.tgz
marc daemon start
marc daemon status
marc daemon stop
```

## Relacao com publicacao npm/open source

Essa oportunidade e prerequisito de experiencia para publicar como ferramenta instalavel. Ela nao substitui outras tarefas de publicacao, como:

- remover `private: true` quando chegar a hora de publicar;
- adicionar `LICENSE`;
- adicionar metadata de pacote;
- definir `files` no `package.json`;
- revisar README e guias de instalacao;
- testar `pnpm pack` e instalacao global.

## Relacao com outras oportunidades

Esta oportunidade e separada da thread de `Status health e rebuild de indice em background`. Aquela trata resiliencia operacional e feedback de modulos internos. Esta trata ciclo de vida do processo daemon e experiencia de uso via CLI global.
