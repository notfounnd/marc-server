# Entrega T-worksheet-2 (claude-dev), final

Substitui a versão anterior deste artifact e a mensagem msg_9c5f586823184ae9a3.

## 1. Cegueira

- A marca "Sem score nesta captura" saiu de `worksheet.md`. O template não muda.
- `worksheet-meta.json`, interno e ao lado da worksheet, guarda por linha: caso, grupo, camada e escolha (`score`, `cosine` ou `none`).

## 2. Complemento dos grupos das linhas por cosseno (feito)

- Entrada: `capture --complement-groups <arquivo>`, com `complement-groups.json` gerado a partir de `worksheet-meta.json` e de `audit-sample.json`.
- Rodada 1 no marc: 2608 pares pontuados com o reranker, em 306 s, em 137 casos. Execução em primeiro plano, sem processos em segundo plano a encerrar.
- Só acrescenta células. Canais, vetores, registros e escores existentes não mudaram. A rodada foi gravada em `complementRounds` do `capture.json`, com as chaves que pontuou.
- U exclui as chaves complementadas do cálculo (`scoredRecordsOf` com `complementedKeysOf`). Assim, os escores novos não entram no pool do reranker top.

## 3. Verificações pedidas

- Manifest de produção `C:\Projetos\marc\.marc\memory\manifest.json`: sha256 `b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a` antes e depois. Sem mudança.
- `audit-sample.json` do marc: reutilizado sem mudança, com os mesmos bytes de antes.
- Worksheets regeneradas: marc com 0 linha por cosseno e 0 sem passagem (4275 linhas, todas por score). ledgerline-en com 0 linha por cosseno (1654 linhas).
- Replay `M0,DEPTH0,DEPTH1,DEPTH2` no marc, comparado com `replay-DEPTH0-DEPTH1-DEPTH2.json` de antes: DEPTH0..2 idênticas nos 137 casos (resultados, `judgedDepth` e `incomplete`). Nenhuma variante incompleta. M0 coincide com DEPTH0 nos 137 casos.

## 4. Números finais

| Corpus | Pendentes | Camada 0 | Camada 1 | Camada 2 | Sorteados | Células da auditoria | Mediana de externos | Removidas pela saturação | Linhas por cosseno |
|---|---|---|---|---|---|---|---|---|---|
| marc (87cd2e4d96f7) | 4275 | 894 | 1704 | 1677 | 274 | 795 | 34 | 200 | 0 |
| ledgerline-en (0d31bd4afd3f) | 1654 | 548 | 236 | 870 | 158 | 343 | 17 | 55 | 0 |

- Os pendentes não mudaram com o complemento: ele altera a escolha do trecho, não as células pedidas.

## 5. Arquivos internos (pasta da captura)

- `worksheet.md`, `worksheet-template.json`, `worksheet-meta.json`, `complement-groups.json`, `audit-sample.json`, `replay-M0-DEPTH0-DEPTH1-DEPTH2.json`.
- marc: `C:\Projetos\marc\.marc\cache\memory-eval\marc\87cd2e4d96f7\`. ledgerline-en: `C:\Projetos\marc\.marc\cache\memory-eval\ledgerline-en\0d31bd4afd3f\`.

## 6. Validação

- `pnpm validate`: código 0. `pnpm build`: código 0. `pnpm test`: 994 passam, 0 falham.

## 7. Riscos

- O complemento usa o reranker local com a taxa observada de 8,06 pares/s. O tempo real foi de cerca de 5 min, de acordo com a estimativa.
- Os sorteados ficam fora da completude das variantes, como combinado.
