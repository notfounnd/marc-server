# Oportunidade - Provider de memory aquecido com TTL curto

## Contexto

Durante o planejamento da busca na UI sobre a memory existente, ficou claro que a implementacao atual de `memory_recall` cria um `LocalEmbeddingProvider`, gera o embedding da query e chama `dispose()` ao final da chamada.

Isso preserva memoria RAM porque o modelo nao fica residente depois da busca, mas pode gerar custo de cold load quando o usuario ou agente executa varias buscas proximas.

## Problema a investigar

No modelo atual, chamadas independentes de `memory_recall` podem carregar o pipeline local repetidas vezes:

1. `recallMemory(...)` cria `new LocalEmbeddingProvider(info)`.
2. `recallMemoryInWorkspace(...)` chama `embedQuery(query)`.
3. `embedQuery` chama `loadExtractor(...)`.
4. A busca vetorial roda no LanceDB.
5. `recallMemoryInWorkspace(...)` chama `provider.dispose()`.

O cache local evita download do modelo, mas nao deve ser tratado como garantia de pipeline aquecido em memoria pelo contrato atual do mARC.

## Hipotese

Pode ser util manter o provider aquecido por um TTL curto no daemon ou em uma camada de provider manager, reduzindo reloads quando varias buscas acontecem em sequencia, sem deixar o modelo residente indefinidamente.

## Escopo sugerido

- Medir tempo real de chamadas consecutivas de `memory_recall` com cache preparado.
- Verificar uso de memoria antes, durante e depois das chamadas.
- Avaliar se o custo vem do carregamento do pipeline, do LanceDB, da geracao do embedding ou de outro ponto.
- Propor um `MemoryProviderManager` ou boundary equivalente se a evidencia justificar.
- Evitar lock-in e preservar o pattern de provider/adaptador ja existente.
- Garantir `dispose` por idle timeout, por workspace, e por encerramento do daemon.

## Fora de escopo inicial

- Alterar o corpus da memory.
- Criar busca textual paralela.
- Trocar modelo de embeddings.
- Manter modelo carregado sem limite.

## Criterios de aceite futuros

- Evidencia de benchmark antes da mudanca.
- TTL configuravel ou constante conservadora.
- Sem aumento permanente de RAM apos inatividade.
- Sem alterar contrato publico de `memory_recall`.
- Testes cobrindo reuso dentro do TTL e descarte apos idle.
- Documentacao clara de que `memory_status` continua sem carregar modelo.

## Referencia

Esta oportunidade nasceu durante o planejamento de marc://$oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd.
