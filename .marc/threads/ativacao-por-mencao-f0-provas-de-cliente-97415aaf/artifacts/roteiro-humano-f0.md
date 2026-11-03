# Roteiro humano da F0 — Claude Code

Autor: marc://@claude-software-architect
Data: 02/11/2026
Cobre: A1, A2, A4 contra sessão interativa, B1, B3, C1, D2, D3, D4 e D5, no Claude Code. As células interativas do Codex ficam no roteiro da sessão do Codex.

## Execução por script

O caminho recomendado é o script Node `marc-f0/H/roteiro-f0.mjs`, que segue os mesmos blocos. Ele roda sozinho os comandos do terminal 2, grava saídas e logs do MCP de sondagem em `marc-f0/H/resultado-humano.jsonl` e pede ao humano só as ações na sessão interativa e observações curtas. Use `node roteiro-f0.mjs` para os blocos 1 a 5, ou `node roteiro-f0.mjs <n>` para um bloco. Os passos manuais abaixo valem como referência.

## Como usar

- Uma ação por passo. Onde houver **Anote**, copie a resposta ou a saída para a conversa com o arquiteto, ou cole tudo de uma vez no fim de cada bloco.
- Os logs do MCP de sondagem são gravados sozinhos em `marc-f0/probe-logs`, e o arquiteto os lê depois. Não precisa copiá-los.
- Sessões descartáveis em `marc-f0/H`, com Haiku, sem settings do usuário e só com o MCP de sondagem.
- Quando aparecer pedido de permissão, siga o passo; não aprove nada que o passo não peça.
- Se algo sair do esperado, pare e anote o que viu. Isso também é resultado.
- D5 é opcional, porque exige suspender a máquina.

## 0. Preparação, em cada terminal Git Bash novo

1. Cole:

```bash
F0=/c/Users/junior/AppData/Local/Temp/marc-f0; K=$F0/kit/mcp.json; mkdir -p $F0/H; cd $F0/H
c0() { claude --model claude-haiku-5-5 --setting-sources "" --strict-mcp-config --mcp-config "$K" "$@"; }
```

## Bloco 1 — A1, A4 e B1: sessão aberta contra retomada

1. No terminal 1, crie e guarde um ID:

```bash
ID=$(node -e "console.log(crypto.randomUUID())"); echo $ID
```

2. **Anote** o ID.
3. Terminal 1: `c0 --session-id $ID`. Se perguntar sobre confiar na pasta, aceite.
4. Na sessão: `Responda somente com: A1-BASE`.
5. Na sessão: `Chame a ferramenta probe_ping uma vez e mostre o resultado.` Aprove a ferramenta se pedir.
6. Deixe a sessão parada. Abra o terminal 2 e faça a preparação 0.
7. Terminal 2: `ID=<cole o ID>`.
8. Terminal 2: `c0 -p --resume $ID "Responda somente com: A1-PRINT"`.
9. **Anote** a saída e se apareceu algum aviso.
10. Terminal 2: `claude --bg --resume $ID --model claude-haiku-5-5 --setting-sources "" --strict-mcp-config --mcp-config "$K" "Responda somente com: A4-BG"`.
11. **Anote** a saída completa, incluindo qualquer `note:`.
12. Terminal 2: `claude agents --json --all`.
13. **Anote** as entradas com `marc-f0` no `cwd` e o `status` da sua sessão interativa.
14. Volte ao terminal 1 e pergunte: `Liste todas as mensagens que eu te enviei nesta conversa, na ordem.`
15. **Anote** se aparecem A1-PRINT ou A4-BG.
16. Terminal 1: `/exit`.
17. Terminal 2: `claude agents --json --all` de novo, e **anote** as entradas com `marc-f0`.
18. Terminal 2: para cada ID de background criado no passo 10, rode `claude stop <id>` e depois `claude rm <id>`.

## Bloco 2 — A2: alternar `-p` e interativo

1. Terminal 2, com o mesmo ID: `c0 -p --resume $ID "Responda somente com: A2-PRINT"`.
2. Terminal 1, depois da preparação 0 e de `ID=<cole o ID>`: `c0 --resume $ID`.
3. Na sessão: `Liste todas as mensagens que eu te enviei nesta conversa, na ordem.`
4. **Anote** a lista.
5. Na sessão: `Responda somente com: A2-TUI`. Depois `/exit`.
6. Terminal 2: `c0 -p --resume $ID "Qual foi a ultima mensagem que eu te enviei antes desta?"`.
7. **Anote** a resposta.

## Bloco 3 — B3: vida do MCP

Use uma sessão nova no terminal 1.

1. `c0`
2. Na sessão: `Chame probe_ping e mostre o resultado.` **Anote** o `pid`.
3. Deixe parada por 5 minutos e repita o pedido do passo 2. **Anote** o `pid`.
4. `/clear` e repita o pedido do passo 2. **Anote** o `pid`.
5. `/compact` e repita o pedido do passo 2. **Anote** o `pid`.
6. `/mcp`, escolha o servidor `probe`, peça reconexão e repita o pedido do passo 2. **Anote** o `pid`.
7. `/exit`.

## Bloco 4 — D2, D3 e D4: despertar e ciclo de vida

**D2, `/clear` com waiter ativo.** Sessão nova no terminal 1, em `$F0/H`.

1. `c0`
2. Na sessão: `Execute com a ferramenta Bash, em background (run_in_background), o comando: node C:/Users/junior/AppData/Local/Temp/marc-f0/D1/waiter.mjs. Nao espere terminar.` Aprove o Bash.
3. `/clear`
4. Terminal 2, em `$F0/H`: `touch trigger.flag`
5. Espere 15 segundos e **anote** o que a sessão do terminal 1 fez sozinha.
6. Terminal 2: `rm trigger.flag`

**D3, sair com waiter ativo.** Na mesma sessão:

7. Repita o pedido do passo 2.
8. `/exit`
9. Terminal 2: `cat waiter.pid`.
10. Terminal 2: `tasklist //FI "PID eq <número do passo 9>"`.
11. **Anote** se o processo `node.exe` aparece.
12. Se aparecer, `touch trigger.flag`. O waiter sai sozinho em até 1 segundo. Confira com o passo 10 e rode `rm trigger.flag`.

**D4, despertar com aprovação pendente.** Sessão nova no terminal 1.

13. `c0`
14. Na sessão: `Execute em background o comando node C:/Users/junior/AppData/Local/Temp/marc-f0/D1/waiter.mjs. Quando ele terminar, use a ferramenta Write para criar o arquivo d4.txt com o conteudo D4. Nao espere agora.` Aprove só o Bash.
15. Terminal 2: `touch trigger.flag`
16. **Anote** o que aparece no terminal 1: se ele pede aprovação da Write e se espera.
17. Espere 2 minutos sem responder. **Anote** se algo mudou.
18. Negue a Write. `/exit`. Terminal 2: `rm trigger.flag`.

## Bloco 5 — C1: abrir a TUI por wrapper

1. Git Bash (mintty), em `$F0/H`:

```bash
node -e "require('child_process').spawn('claude',['--model','claude-haiku-5-5','--setting-sources',''],{stdio:'inherit'}).on('exit',c=>process.exit(c??0))"
```

2. **Anote** se a TUI abriu, se o teclado funciona e se as cores aparecem. Saia com `/exit`.
3. Repita no Windows Terminal com PowerShell, em `C:\Users\junior\AppData\Local\Temp\marc-f0\H`, com o mesmo comando `node -e`. Use aspas simples por fora, se o PowerShell reclamar.
4. **Anote** a mesma observação.

## Bloco 6 — D5, opcional: suspensão durante a espera

1. Sessão nova: `c0`, e o pedido do passo 2 do bloco 4.
2. Suspenda a máquina por 2 minutos e volte.
3. Terminal 2: `touch trigger.flag`.
4. **Anote** se a sessão acordou.
5. `/exit` e `rm trigger.flag`.

## Ao terminar

Avise o arquiteto. Ele lê os logs, consolida as células e limpa `marc-f0/H`, as sessões criadas e qualquer ID de background que tenha ficado.
