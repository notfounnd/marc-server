# Plano - Interpretação de consultas com correção assistida

## Objetivo

Adicionar uma etapa de interpretação antes da recuperação da memory para corrigir erros prováveis de digitação sem reduzir a busca a correspondência literal. A consulta original sempre será preservada, a consulta efetiva será explícita e toda decisão ambígua retornará ao texto informado pelo usuário.

Esta iteração complementa a arquitetura de elegibilidade e ranking já definida na thread. Ela não cria boosts por palavra exata, listas de stopwords por idioma, regras para termos específicos nem altera o corpus de threads fechadas.

## Decisões consolidadas

1. Usar `onnx-community/LFM2.5-350M-ONNX`, em Q4, como modelo padrão de interpretação.
2. Baixar o modelo em runtime pelo fluxo Prepare models. Nenhum arquivo de modelo será commitado.
3. Não adicionar aviso, consentimento ou ruído de licença na interface nesta fase.
4. Manter três responsabilidades isoladas:
   - E5 para embeddings e recuperação;
   - mMARCO para reranking;
   - LFM para interpretação da consulta.
5. Tratar o interpretador como provider independente. Ele não integra o manifesto de embeddings e não exige mudança do schema v4 nem rebuild completo da base.
6. Gerar candidatos de correção a partir do corpus ativo da própria memory, composto apenas por conteúdo de threads fechadas.
7. Preservar a consulta literal como fallback autoritativo.

## Fluxo da consulta

1. Receber a consulta original e o modo solicitado.
2. Em `literal`, pular integralmente a interpretação.
3. Em `auto`, tokenizar a consulta com suporte Unicode.
4. Identificar apenas tokens plausivelmente corrigíveis.
5. Preservar sem alteração IDs, referências `marc://`, caminhos, URLs, hashes e identificadores de código.
6. Gerar candidatos usando o vocabulário derivado da geração ativa da memory.
7. Calcular proximidade ortográfica com Damerau-Levenshtein e sinais do corpus, sem listas fixas por idioma.
8. Limitar o protocolo a no máximo oito variantes. O índice zero sempre representa a consulta original.
9. Solicitar ao LFM somente a escolha de um índice permitido.
10. Validar a saída com guard estrito.
11. Em formato inválido, realizar um único loopback corretivo.
12. Se a segunda resposta continuar inválida, houver erro de worker ou indisponibilidade do modelo, usar a consulta original.
13. Executar E5 e mMARCO sobre a consulta efetiva.
14. Retornar metadados suficientes para a UI e os clientes explicarem o que ocorreu.

A similaridade lexical participa apenas da geração de candidatos de correção. Ela não qualifica threads, não altera scores e não interfere diretamente no ranking final.

## Contrato público

Adicionar `queryMode` com os valores:

- `auto`, padrão quando omitido;
- `literal`, que exige busca pela consulta original.

A resposta passará a expor um bloco de interpretação com:

- `originalQuery`;
- `effectiveQuery`;
- `suggestedQuery`;
- `mode`;
- `correctionApplied`.

API, MCP e CLI devem aceitar o modo literal explicitamente. Clientes existentes permanecem compatíveis quando o campo for omitido.

## Runtime e ciclo de vida

1. Adicionar o papel de inferência `interpretation`.
2. Executar o LFM em worker próprio, isolado dos workers de embedding e reranking.
3. Aplicar o mesmo TTL de 30 segundos usado pelos demais modelos.
4. Liberar a sessão ONNX ao expirar o TTL.
5. Incorporar o terceiro modelo ao inventário de runtime.
6. Fazer Prepare models baixar e validar os três modelos.
7. Considerar a busca pronta apenas quando embeddings, reranker e interpretador estiverem preparados.
8. Incluir os arquivos do LFM no purge e na apuração de espaço liberado.
9. Manter o cache sob `.marc/cache/memory-models`.
10. Tratar o modelo principal e seus dados externos como uma unidade de instalação.

A adição do interpretador não deve invalidar embeddings existentes. Troca ou ausência do modelo de interpretação afeta a disponibilidade da busca em modo automático, não o formato da base vetorial.

## Estado entre buscas e deep retry

1. Toda nova consulta inicia em depth 0 e modo `auto`, salvo escolha literal explícita.
2. A interpretação acontece uma vez por consulta.
3. Deep retries reutilizam a mesma consulta original, consulta efetiva e decisão de correção.
4. Deep retry altera apenas a profundidade da recuperação.
5. Uma nova consulta limpa depth, correção sugerida e escolha literal anterior.
6. O estado persistido na UI terá versão atualizada para impedir restauração de payload antigo incompatível.

## Interface

Quando houver correção aplicada, a coluna de busca exibirá:

- `Searching for {effectiveQuery}`;
- uma ação `Search instead for {originalQuery}`.

A ação refaz a consulta em modo `literal`. Quando não houver correção, nenhum aviso adicional será exibido.

O indicador de processamento existente cobre interpretação, recuperação e reranking como uma única operação. Cards, ordenação, estados vazios e deep retry permanecem visualmente inalterados.

Todo texto novo será adicionado ao arquivo de localização en-US, conforme a ADR 0008 e o guard de localização do projeto.

## Qualidade e testes

### Interpretação isolada

Cobrir:

- typo simples, incluindo `toogle`;
- typo com sufixo, incluindo `brutalismp`;
- erro em frase, incluindo `interace com brutalism`;
- erro em termo do domínio, incluindo `memria`;
- palavra válida próxima de outra palavra;
- consultas multilíngues;
- nomes próprios;
- IDs e hashes;
- referências `marc://`;
- caminhos e URLs;
- identificadores de código;
- mais de um erro na mesma consulta;
- ausência de candidato seguro;
- saída inválida do modelo;
- loopback válido e inválido;
- timeout, falha e encerramento do worker;
- fallback integral para a consulta original.

### Integração

Cobrir:

- Prepare models, status, inventário e purge com três modelos;
- TTL e descarregamento independente;
- busca automática corrigida;
- busca literal explícita;
- omissão retrocompatível de `queryMode`;
- API, MCP e CLI;
- nova consulta depois de deep retry;
- deep retry sem nova interpretação;
- persistência e migração do estado da UI;
- mensagens localizadas;
- habilitação e desabilitação coerente dos controles.

### Avaliação empírica

Expandir o harness de qualidade com famílias variadas de consultas curtas, compostas, corretas, incorretas e multilíngues. Os termos discutidos na thread entram como regressão, não como alvo de regras especiais.

A aprovação exige:

1. melhorar consultas com typos sem promover correspondência literal irrelevante;
2. preservar consultas corretas;
3. manter resultados contextualmente relevantes;
4. apresentar comportamento determinístico em falhas do interpretador;
5. não introduzir viés para `brutalism`, `toggle` ou qualquer thread específica.

## Documentação

Atualizar a documentação da memory para explicar:

- os três papéis de modelo;
- o fluxo de interpretação;
- os modos `auto` e `literal`;
- o fallback;
- o TTL;
- cache, Prepare models e purge;
- a separação entre correção da consulta e elegibilidade de resultados.

Não adicionar aviso de licença na experiência do usuário nesta entrega.

## Ordem de desenvolvimento

1. Criar testes de contrato e o corpus de regressão.
2. Implementar vocabulário derivado da geração ativa e geração de candidatos.
3. Implementar provider e worker de interpretação com guard e loopback.
4. Integrar lifecycle, Prepare models, status, inventário, purge e TTL.
5. Integrar `queryMode` e metadados na camada de busca.
6. Propagar o contrato por API, MCP e CLI.
7. Integrar UI, persistência e localização.
8. Atualizar documentação.
9. Executar testes unitários, integrados e o harness empírico.
10. Validar a interface com Playwright CLI.
11. Registrar na thread evidências, resultados e limitações observadas.

## Limites desta iteração

- Não alterar o corpus para conteúdo fora de threads fechadas.
- Não criar dicionários ou stopwords por idioma.
- Não usar match exato como critério de relevância.
- Não adicionar seletor de modelos nesta entrega.
- Não otimizar latência antes de comprovar qualidade funcional.
- Não iniciar rebuild completo apenas pela instalação do interpretador.

## Critério de conclusão

A entrega estará pronta para avaliação quando consultas com e sem typo produzirem resultados contextualmente coerentes, o usuário puder rejeitar uma correção, todos os clientes compartilharem o mesmo contrato, os três modelos tiverem ciclo de vida controlado e a bateria de regressão passar sem regras específicas para os exemplos usados durante a investigação.
