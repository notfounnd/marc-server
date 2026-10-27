# Entrega captura E3: capturas reais dos dois corpora

Escopo: capturas E3 (identidade e3-v2, camadas [0, 1, 2], escopo fechado por K_max=30, com production recall), executadas com `capture --corpus <corpus> --resume`. Autor: claude-dev.

## Resultado

| corpus | captureId | casos | executados | pulados | incomplete | evidence_unindexable | evidence_missing | pares previstos | pares pontuados (recordScores / rerankScores) | duração | vazão medida |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ledgerline-en | 0d31bd4afd3f | 79 | 79 | 0 | 0 | 0 | 0 | 20 917 | 20 917 / 20 917 | 1 132 560 ms (≈18,9 min) | 18,47 pares/s |
| marc | 87cd2e4d96f7 | 137 | 137 | 0 | 0 | 0 | 0 | 320 241 | 320 241 / 320 241 | 39 740 062 ms (≈11,0 h) | 8,06 pares/s |

- Pares previstos: contagem `count-only` de cada corpus (T-captura, Entrega 1d).
- Pares pontuados: soma das chaves de `recordScores` e de `rerankScores` em `capture.json`, por caso.
- Erros no log dos dois corpora: 0.

## Manifest de produção

- `.marc/memory/manifest.json`, sha256 antes e depois das duas capturas: `b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a`. Sem alteração.

## Processos e workspace temporário

- Os processos da captura do marc (tsx 16184, node 7816 e workers 27200, 18512 e 18764) saíram sozinhos ao terminar. Nenhum processo meu permaneceu.
- Nenhum workspace `marc-memory-eval-*` restou em `%TEMP%` depois da captura.
- Os cinco node.exe do ecossistema (2696, 16292, 34812, 27740 e 21388) seguem como estavam e não foram encerrados.

## Incidente (sem impacto na captura)

- O observador em segundo plano que aguardava o fim do marc foi interrompido pelo sistema por pressão de memória, em torno do caso 41 de 137. A captura não foi afetada: seguiu até 137 de 137, sem erros. Não encerrei nenhum processo por causa disso.

## Observações

- A vazão do marc (8,06 pares/s) ficou abaixo da vazão usada na contagem (~11,7 pares/s). A duração real (~11,0 h) ficou abaixo do limite de 12 h.
- Os dois corpos fecharam com pares pontuados iguais aos previstos.
