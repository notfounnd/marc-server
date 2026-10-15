# Complemento: compatibilidade da memória após atualização do runtime

## Descoberta material

A revisão do principal encontrou MEMORY_MODEL_VERSION = transformers-js-4.2.0 em src/core/memory/model-config.ts. Essa versão integra os metadados dos três providers e a comparação do provider de embeddings com o manifesto.

A comparação real usou todos os 338 embeddingText persistidos, mesma ordem, lotes de quatro, mesmos pesos E5 int8 e opções de pooling/normalização, em processos separados para não misturar DLLs dos dois runtimes:

- Transformers.js 4.2.0 reproduziu exatamente os 338 vetores armazenados, diferença máxima zero.
- Transformers.js 4.3.1 produziu diferenças em todos os vetores, similaridade cosseno mínima 0,9954012463639351 e diferença absoluta máxima 0,014543144963681698.
- Duas buscas mantiveram seus alvos em top 1, mas isso não prova que misturar novos vetores de consulta com embeddings antigos seja correto em toda a base.

Não é efeito do agrupamento: os lotes e a ordem foram controlados. A atualização alterou efetivamente a representação numérica. Manter o tag antigo esconderia essa mudança do guard existente.

## Adequação necessária

A autorização de atualizar a dependência exige alinhar a identidade do provider, sem alterar o motor:

- Adicionar ao escopo src/core/memory/model-config.ts, alterando somente MEMORY_MODEL_VERSION para transformers-js-4.3.1.
- Adicionar test/core-memory-runtime-version.test.ts para regressões pequenas, declarativas e autocontidas.
- Não mudar status.ts, permissividade, guard, schema, modelo, quantização, dimensões, batch size, candidatos ou gold.
- Não reescrever manifesto, marcadores de modelos ou vetores antigos para fingir compatibilidade.
- Não chamar prepare/rebuild/purge produtivos automaticamente.

Os pesos locais permanecem preparados. O guard existente deverá marcar o índice antigo como incompatible e exigir full rebuild após o usuário reiniciar. Não deve ocorrer novo download apenas pela mudança da versão do provider.

## Desenvolvimento delegado e aceitação

Reutilizar o mesmo desenvolvedor, perfil e configuração confirmados, sem paralelismo. Contrato independente já conhecido; confirmar os dois novos caminhos e retornar acknowledgement antes da autorização de edição. Esse complemento é material, não um diário de revisão.

Checks obrigatórios:

1. As três funções de metadados retornam a versão 4.3.1.
2. A constante acompanha a versão instalada declarada, impedindo nova atualização de dependência com identidade antiga silenciosa.
3. O comparador rejeita manifesto com versão 4.2.0 e aceita manifesto correspondente à versão 4.3.1, preservando os demais campos.
4. Testes sem branches/skips e abaixo de 300 linhas.
5. Checks focados, typecheck e formatação do escopo.
6. Principal repete validate/build/test no último estado e confere o guard com a base real somente leitura.

A matriz dos interpretadores já foi refeita para os três modelos no mesmo runtime novo. A alteração de identidade do provider não muda prompt, pesos ou inferência dessa matriz; os resultados continuam válidos. Não repeti-los como ritual.

## Entrega e restart

Consolidar a correção e suas evidências na entrega própria. Revisão final independente de todo o escopo, incluindo a atualização da biblioteca e esse alinhamento, antes da aprovação técnica.

Informar explicitamente ao humano: restart para carregar código/biblioteca e full rebuild para gerar embeddings coerentes com o runtime atualizado. Não fechar a thread e não declarar a memória produtiva pronta antes dessa validação humana.

## Proteção adicional do incremental

A revisão do dispatcher confirmou que o status de busca já rejeita provider incompatível, mas reconcileMemory ainda validava apenas schema/contrato e podia preservar vetores antigos ao publicar mudanças sob uma versão nova. Com nenhum conteúdo alterado, poderia reportar um no-op sem explicar a incompatibilidade.

Adicionar src/core/memory/rebuild-operations.ts ao escopo, exclusivamente para reutilizar memoryProvidersMatch e rejeitar provider incompatível antes de materializar fontes, ler/preservar linhas ou executar inferência. Retornar erro técnico orientando full rebuild. Não converter incremental em full automaticamente e não alterar operações full.

Estender somente o novo test/core-memory-runtime-version.test.ts com fixtures Temp/declarativas para: incompatibilidade em no-op e em fonte alterada, manifesto/linhas preservados, nenhuma inferência nova no incremental rejeitado e recuperação full explícita. Manter o arquivo abaixo de 300 linhas e não refatorar testes antigos.

Esse guard é necessário para que a atualização não permita misturar os dois espaços vetoriais pelo caminho incremental manual ou automático. Ele preserva a regra existente de que full precisa ser explícito.
