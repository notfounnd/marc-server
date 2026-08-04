# Plano - Interpretacao de consultas com correcao assistida

## Objetivo

Adicionar uma etapa de interpretacao antes da recuperacao da memory para corrigir erros provaveis de digitacao sem reduzir a busca a correspondencia literal. A consulta original sempre sera preservada, a consulta efetiva sera explicita e toda decisao ambigua retornara ao texto informado pelo usuario.

Esta iteracao complementa a arquitetura de elegibilidade e ranking ja definida na thread. Ela nao cria boosts por palavra exata, listas de stopwords por idioma, regras para termos especificos nem altera o corpus de threads fechadas.

## Decisoes consolidadas

1. Usar `onnx-community/LFM2.5-350M-ONNX`, em Q4, como modelo padrao de interpretacao.
2. Baixar o modelo em runtime pelo fluxo Prepare models. Nenhum arquivo de modelo sera commitado.
3. Nao adicionar aviso, consentimento ou ruido de licenca na interface nesta fase.
4. Manter tres responsabilidades isoladas:
   - E5 para embeddings e recuperacao;
   - mMARCO para reranking;
   - LFM para interpretacao da consulta.
5. Tratar o interpretador como provider independente. Ele nao integra o manifesto de embeddings e nao exige mudanca do schema v4 nem rebuild completo da base.
6. Gerar candidatos de correcao a partir do corpus ativo da propria memory, composto apenas por conteudo de threads fechadas.
7. Preservar a consulta literal como fallback autoritativo.

## Fluxo da consulta

1. Receber a consulta original e o modo solicitado.
2. Em `literal`, pular integralmente a interpretacao.
3. Em `auto`, tokenizar a consulta com suporte Unicode.
4. Identificar apenas tokens plausivelmente corrigiveis.
5. Preservar sem alteracao IDs, referencias `marc://`, caminhos, URLs, hashes e identificadores de codigo.
6. Gerar candidatos usando o vocabulario derivado da geracao ativa da memory.
7. Calcular proximidade ortografica com Damerau-Levenshtein e sinais do corpus, sem listas fixas por idioma.
8. Limitar o protocolo a no maximo oito variantes. O indice zero sempre representa a consulta original.
9. Solicitar ao LFM somente a escolha de um indice permitido.
10. Validar a saida com guard estrito.
11. Em formato invalido, realizar um unico loopback corretivo.
12. Se a segunda resposta continuar invalida, houver erro de worker ou indisponibilidade do modelo, usar a consulta original.
13. Executar E5 e mMARCO sobre a consulta efetiva.
14. Retornar metadados suficientes para a UI e os clientes explicarem o que ocorreu.

A similaridade lexical participa apenas da geracao de candidatos de correcao. Ela nao qualifica threads, nao altera scores e nao interfere diretamente no ranking final.

## Contrato publico

Adicionar `queryMode` com os valores:

- `auto`, padrao quando omitido;
- `literal`, que exige busca pela consulta original.

A resposta passara a expor um bloco de interpretacao com:

- `originalQuery`;
- `effectiveQuery`;
- `suggestedQuery`;
- `mode`;
- `correctionApplied`.

API, MCP e CLI devem aceitar o modo literal explicitamente. Clientes existentes permanecem compativeis quando o campo for omitido.

## Runtime e ciclo de vida

1. Adicionar o papel de inferencia `interpretation`.
2. Executar o LFM em worker proprio, isolado dos workers de embedding e reranking.
3. Aplicar o mesmo TTL de 30 segundos usado pelos demais modelos.
4. Liberar a sessao ONNX ao expirar o TTL.
5. Incorporar o terceiro modelo ao inventario de runtime.
6. Fazer Prepare models baixar e validar os tres modelos.
7. Considerar a busca pronta apenas quando embeddings, reranker e interpretador estiverem preparados.
8. Incluir os arquivos do LFM no purge e na apuracao de espaco liberado.
9. Manter o cache sob `.marc/cache/memory-models`.
10. Tratar o modelo principal e seus dados externos como uma unidade de instalacao.

A adicao do interpretador nao deve invalidar embeddings existentes. Troca ou ausencia do modelo de interpretacao afeta a disponibilidade da busca em modo automatico, nao o formato da base vetorial.

## Estado entre buscas e deep retry

1. Toda nova consulta inicia em depth 0 e modo `auto`, salvo escolha literal explicita.
2. A interpretacao acontece uma vez por consulta.
3. Deep retries reutilizam a mesma consulta original, consulta efetiva e decisao de correcao.
4. Deep retry altera apenas a profundidade da recuperacao.
5. Uma nova consulta limpa depth, correcao sugerida e escolha literal anterior.
6. O estado persistido na UI tera versao atualizada para impedir restauracao de payload antigo incompatível.

## Interface

Quando houver correcao aplicada, a coluna de busca exibira:

- `Searching for {effectiveQuery}`;
- uma acao `Search instead for {originalQuery}`.

A acao refaz a consulta em modo `literal`. Quando nao houver correcao, nenhum aviso adicional sera exibido.

O indicador de processamento existente cobre interpretacao, recuperacao e reranking como uma unica operacao. Cards, ordenacao, estados vazios e deep retry permanecem visualmente inalterados.

Todo texto novo sera adicionado ao arquivo de localizacao en-US, conforme a ADR 0008 e o guard de localizacao do projeto.

## Qualidade e testes

### Interpretacao isolada

Cobrir:

- typo simples, incluindo `toogle`;
- typo com sufixo, incluindo `brutalismp`;
- erro em frase, incluindo `interace com brutalism`;
- erro em termo do dominio, incluindo `memria`;
- palavra valida proxima de outra palavra;
- consultas multilíngues;
- nomes proprios;
- IDs e hashes;
- referencias `marc://`;
- caminhos e URLs;
- identificadores de codigo;
- mais de um erro na mesma consulta;
- ausencia de candidato seguro;
- saida invalida do modelo;
- loopback valido e invalido;
- timeout, falha e encerramento do worker;
- fallback integral para a consulta original.

### Integracao

Cobrir:

- Prepare models, status, inventario e purge com tres modelos;
- TTL e descarregamento independente;
- busca automatica corrigida;
- busca literal explicita;
- omissao retrocompativel de `queryMode`;
- API, MCP e CLI;
- nova consulta depois de deep retry;
- deep retry sem nova interpretacao;
- persistencia e migracao do estado da UI;
- mensagens localizadas;
- habilitacao e desabilitacao coerente dos controles.

### Avaliacao empirica

Expandir o harness de qualidade com familias variadas de consultas curtas, compostas, corretas, incorretas e multilíngues. Os termos discutidos na thread entram como regressao, nao como alvo de regras especiais.

A aprovacao exige:

1. melhorar consultas com typos sem promover correspondencia literal irrelevante;
2. preservar consultas corretas;
3. manter resultados contextualmente relevantes;
4. apresentar comportamento deterministico em falhas do interpretador;
5. nao introduzir vies para `brutalism`, `toggle` ou qualquer thread especifica.

## Documentacao

Atualizar a documentacao da memory para explicar:

- os tres papeis de modelo;
- o fluxo de interpretacao;
- os modos `auto` e `literal`;
- o fallback;
- o TTL;
- cache, Prepare models e purge;
- a separacao entre correcao da consulta e elegibilidade de resultados.

Nao adicionar aviso de licenca na experiencia do usuario nesta entrega.

## Ordem de desenvolvimento

1. Criar testes de contrato e o corpus de regressao.
2. Implementar vocabulario derivado da geracao ativa e geracao de candidatos.
3. Implementar provider e worker de interpretacao com guard e loopback.
4. Integrar lifecycle, Prepare models, status, inventario, purge e TTL.
5. Integrar `queryMode` e metadados na camada de busca.
6. Propagar o contrato por API, MCP e CLI.
7. Integrar UI, persistencia e localizacao.
8. Atualizar documentacao.
9. Executar testes unitarios, integrados e o harness empirico.
10. Validar a interface com Playwright CLI.
11. Registrar na thread evidencias, resultados e limitacoes observadas.

## Limites desta iteracao

- Nao alterar o corpus para conteudo fora de threads fechadas.
- Nao criar dicionarios ou stopwords por idioma.
- Nao usar match exato como criterio de relevancia.
- Nao adicionar seletor de modelos nesta entrega.
- Nao otimizar latencia antes de comprovar qualidade funcional.
- Nao iniciar rebuild completo apenas pela instalacao do interpretador.

## Criterio de conclusao

A entrega estara pronta para avaliacao quando consultas com e sem typo produzirem resultados contextualmente coerentes, o usuario puder rejeitar uma correcao, todos os clientes compartilharem o mesmo contrato, os tres modelos tiverem ciclo de vida controlado e a bateria de regressao passar sem regras especificas para os exemplos usados durante a investigacao.
