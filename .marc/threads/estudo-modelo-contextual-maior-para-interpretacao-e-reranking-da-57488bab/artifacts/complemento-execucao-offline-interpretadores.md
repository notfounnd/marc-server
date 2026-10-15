# Complemento de execução offline do experimento

## Motivo

A primeira execução revelou duas incompatibilidades diferentes. O Qwen3.5-0.8B-ONNX-OPT não inicializa no onnxruntime-node 1.24.3 instalado porque o operador com.microsoft:CausalConvWithState não está registrado. Não trocar dependências ou exportação silenciosamente.

O LFM1.2B inicializa os gráficos, mas a factory pipeline do Transformers.js 4.2.0 consulta metadados sem encaminhar a revisão. Com allowRemoteModels false e arquivos em uma revisão fixada, get_tokenizer_files retorna uma lista vazia. O pipeline fica sem tokenizer e todas as chamadas falham antes da inferência. O exit code zero do coletor não significa inferência bem-sucedida.

## Prova independente

Os arquivos tokenizer.json e tokenizer_config.json estão presentes e válidos na revisão original. Carregar o mesmo modelo via pipeline a partir do diretório local dessa revisão, com CPU, q4, duas threads, mensagens originais e max_new_tokens 4, inicializou o tokenizer e retornou 0 para P06-en-negated-command. Não houve troca de modelo, metadados, prompt ou rótulos.

A API foi conferida na documentação Context7 e na implementação instalada. A causa é descoberta de metadados, não ausência dos arquivos nem resultado semântico do modelo.

## Adequação autorizada

Manter os sete caminhos já autorizados. Não editar src, dependências, modelos produtivos, índice, configurações, UI ou rótulos.

- Na preparação, manter o download explícito do ID e da revisão fixados.
- Em run e smoke, usar o diretório local exato do modelo preparado. Baseline usa seu bundle existente, sem revisão presumida. Modelos experimentais usam a pasta da revisão validada. Aplicar a mesma estratégia de carregamento local a todos os perfis.
- Preservar pipeline público, tokenizer original, CPU, q4, duas threads, prompt, feedback, retry e quatro tokens.
- Validar arquivos de tokenizer e gráficos no diretório selecionado. Não fabricar configuração, copiar metadados de outro modelo, alterar node_modules ou liberar acesso remoto na avaliação.
- Vincular a estratégia de carregamento à assinatura dos checkpoints e usar nomes v2 para os novos resultados. Os resultados anteriores permanecem como diagnóstico, não entram na comparação final.
- Smoke exige uma decisão inteira válida efetivamente produzida pelo modelo. Saída inválida ou erro de provider devem falhar o smoke, mantendo evidência de erro. Correção semântica é medida pela bateria, não pelo exit code.
- Acrescentar regressões determinísticas para caminho/revisão e smoke com decisão, saída inválida e erro. Manter testes sem branches e abaixo do limite de linhas.

## Execução e revisão

O desenvolvedor faz a adequação e validação focada. O principal revisa a integração inteira e repete validate, build e test. Depois, repetir baseline e LFM1.2B nos mesmos 62 casos, sem mudar gold. Repetir o impedimento do Qwen com carregamento local para confirmar que a ausência do tokenizer não explica o erro nativo.

Executar ainda um controle frio de negação com o baseline, usando um caso gold existente, para verificar se a preferência por índice 1 depende da ordem ou do reuso do pipeline. Não incorporar esse controle repetido ao denominador da matriz.

Registrar resultados consolidados e limites na thread. Não promover modelos e não encerrar a thread sem autorização humana.