# Consenso do julgamento do marc-deep (E4)

## Resumo

Este é o consenso proposto pelo principal para os trechos em que os avaliadores a e b deram graus diferentes, na captura marc-deep/58686cbe9fc0.

O consenso foi escrito e registrado **antes** de rodar o merge e o relatório por variante. Nenhum resultado de Success@5, ranking ou variante foi consultado para decidir os graus.

**Arquivos na captura:**

| Arquivo | sha256 |
|---|---|
| `judgments-a.json` | `d0819c58164c9498489e578a1979da893cd292aa8f56ba3b1505fdc1417ae9ac` |
| `judgments-b.json` | `e8746bbbbf5481d541573884a11d1cd1b40480095e383d931d8c38921c9d4462` |
| `judgments-consensus.json` | `2ca331bce156cfd252e963d12e2dd87bf2d2fc12c140a81b33d30080e069dae3` (final, depois do parecer do Codex; a versão proposta era `68f5da2244547c690da553d87f0a88908039893bd440f8f776ec3327d77ccbcd`) |

## Concordância

- 101 trechos; 72 com o mesmo grau e 91 do mesmo lado da linha de relevância (grau ≥ 2).
- Kappa binário na linha ≥ 2: **0,80**. Na E3, o marc ficou em 0,47.
- Matriz de graus (linhas: a; colunas: b; graus 0 a 3): `[[29,7,0,0],[2,12,9,1],[0,0,6,9],[0,0,1,25]]`.
- Os 10 trechos contestados na linha de relevância têm a = 1 e b ≥ 2. O avaliador a foi mais severo em todos.

## Trechos contestados na linha de relevância

| Caso | Trecho | a | b | Consenso | Motivo |
|---|---|---|---|---|---|
| D04 | memory-deep, seção Rebuild (`2d14067e`) | 1 | 3 | 2 | É uma regra, mas local ao rebuild da proposta, não a regra operacional do workspace |
| D04 | memory-deep, Critérios de aceite (`7e2fcdb7`) | 1 | 2 | 1 | Critério de aceite mais a lista das consultas de avaliação; não diz qual regra manda preservar o Markdown |
| D04 | settings JSON, Relação com decisões (`316d893e`) | 1 | 2 | 2 | Descreve a regra crítica e o recorte do escopo dela |
| D04 | settings JSON, Contexto (`537f07ab`) | 1 | 2 | 1 | Cita a regra só como motivação da escolha anterior |
| D04 | settings JSON, Hipótese (`c98d315b`) | 1 | 2 | 2 | Traz o escopo que depois virou o texto da regra: threads, mensagens, summaries e artefatos |
| D07 | plano 3d40719f, Implementação (`14bf0ca0`) | 1 | 2 | 2 | Afirma que a escrita atômica não é uma transação de múltiplos arquivos, que é a raiz do risco |
| D08 | proposta 774d1e99, Escopo esperado (`39b71056`) | 1 | 2 | 2 | Trata do retorno da segunda solicitação, ainda como opções |
| D09 | plano de testabilidade (`87baa1ee`) | 1 | 2 | 1 | Exige um teste de falhas de acesso, mas não diz que essa foi a falha achada na revisão da primeira implementação |
| D12 | CHAT 834716ba, loop de correção (`53cd2a13`) | 1 | 2 | 2 | Nomeia a correção do snapshot do purge sob lock |
| D14 | plano do estudo 2, Corpus (`aaf2e34f`) | 1 | 2 | 2 | "Apenas SUMMARY e CHAT" responde por complemento, sem listar as fontes de fora |

Resultado: 7 trechos sobem para 2 e 3 ficam em 1.

## Divergências do mesmo lado da linha

São 19 trechos que não mudam a relevância. Os critérios:
- proposta que antecipa o comportamento final vale 2, e o resultado ou a entrega vale 3 (D05 `bce616ad`, D06 `00393dce` e D08 `24230c8e` em 2);
- resposta completa vale 3 mesmo fora da fonte principal (D02 `da1eaab2`, D04 `d0d94d43` e `aa0f3315`, D09 `372ed96b`, D11 `efd68637`);
- uma decisão com justificativa curta vale 2 quando a justificativa completa está em outro trecho (D01 `ca26e1a8`; D11 `35254af5`);
- tema vizinho vale 0 e menção incidental vale 1 (D02 `bb7021c9`, D09 `7bc84710`, D11 `a08be353` e D14 `bfcd9444` e `9de9cb5e` em 0; D07 `a3ec9d7f`, D12 `a0f3af4e` e D13 `5404fa64` e `74bc05a8` em 1).

## Ajustes do parecer do Codex

O Codex aceitou 24 dos 29 graus e contestou 5. O principal conferiu os 5 trechos na worksheet e aceitou todos:

| Caso | Trecho | Proposto | Final | Motivo |
|---|---|---|---|---|
| D04 | settings JSON, Contexto (`537f07ab`) | 1 | 2 | Enuncia a regra de Markdown autoritativo e os registros cobertos; é resposta parcial substantiva |
| D05 | CHAT 3c45fa83 (`bce616ad`) | 2 | 3 | Diz `cursor_not_found`, `shouldReadFullThread: true` e que não relê em silêncio; responde por completo |
| D06 | CHAT d14fb686 (`00393dce`) | 2 | 3 | Lista as três tools livres |
| D11 | CHAT 1042e2b3, revisão 3 (`35254af5`) | 2 | 3 | Separa localizador de identidade e explica textos diferentes na mesma seção |
| D12 | plano do loop 834716ba (`a0f3af4e`) | 1 | 0 | Só diz "concorrência de manutenção", sem purge, snapshot nem lock; repete o tema da consulta |

**Critérios revistos:**
- A proposta não tem teto automático de 2.
- Uma justificativa curta não rebaixa o grau.
- O grau cai só quando falta conteúdo substantivo, não por causa da autoridade da fonte ou da extensão do trecho.

Os critérios de resposta completa = 3 fora da fonte principal e tema vizinho = 0 continuam.

Resultado final na linha de relevância: 8 trechos sobem para 2 e 2 ficam em 1 (D04 `7e2fcdb7` e D09 `87baa1ee`).

## Merge

O merge rodou com a, b e o consenso final:
- 101 pares, 72 concordantes, 29 divergências, nenhuma sem resolução;
- 101 graus escritos, nenhum conflito;
- kappa ponderado de 0,896.

`validate --corpus marc-deep` terminou sem issues.
