# Estudo de Duas Etapas no LFM350M

## Síntese e Decisão

**Não recomendo aplicar a divisão em duas etapas à busca atual.** A hipótese foi executada integralmente, mas não trouxe ganho de qualidade. O controle atual, o controle verbal combinado, a grafia isolada e a combinação grafia + intenção produziram as mesmas decisões nos 49 casos que exigiam inferência.

O reaproveitamento dos pesos funcionou: houve uma única pipeline carregada, sem download ou duplicação de modelo. O problema foi a decisão. O LFM respondeu sempre `FIX` para grafia e sempre `SAME` para intenção. A segunda etapa não vetou nenhuma proposta, nem mesmo as que deveriam ser recusadas.

A busca em produção permanece inalterada. Este estudo não mede novamente a relevância de threads, top-1 ou top-10 do motor completo. Seus números são do interpretador diante de pares de consultas congelados, não uma taxa de erro global do mecanismo de busca.

## Hipótese e Protocolo

O plano foi anexado antes do desenvolvimento em `plano-estudo-duas-etapas-lfm350m.md`, com SHA-256 `c2c9507b47b8288bd78ed783e2409ad7204c4ab46894b72aa3c8fdc16b985c77`. A implementação e a execução respeitaram seus prompts, grupos, parâmetros e critérios, sem ajuste após observar respostas.

Foram comparados quatro caminhos:

1. **Baseline fresco.** Uma chamada com o contrato numérico atual, executada novamente para cada caso elegível.
2. **Controle verbal combinado.** Uma chamada para avaliar grafia e preservação do pedido, respondendo `FIX` ou `KEEP`.
3. **Grafia isolada.** Uma chamada que avalia apenas se a proposta corrige um erro de escrita.
4. **Grafia + intenção.** A grafia decide primeiro. Uma proposta aceita só permanece aceita se a intenção responder `SAME`. `CHANGED` deve vetá-la.

A intenção recebeu apenas os textos completos de Original e Proposed, sem a resposta, confiança ou aprovação da grafia. Para diagnóstico, foi executada em todos os casos elegíveis. O custo de um fluxo realmente condicional foi calculado separadamente.

A matriz contém 62 casos únicos, com 49 decisões e 13 bypasses sem chamada e sem pontuação de acerto. Os grupos avaliados são 12 erros legítimos de escrita, 12 mudanças indevidas e 25 consultas naturais, incluindo 23 casos históricos e os controles C3/C5. Foram mantidos os sinais de sugestão versus aplicação da correção. Quatro bypasses têm duas variantes e foram respeitados por seu modo literal. Os cinco bypasses cuja expectativa histórica difere da fixture não foram convertidos em acertos do modelo.

As respostas dos mesmos casos foram reutilizadas apenas para recompor as abordagens, sem inferência adicional. Não houve memoização entre IDs distintos, mesmo quando os textos coincidiam. Nenhum dicionário, lista de palavras por idioma, tratamento especial de brutalism ou mudança no corpus foi introduzido.

### Configuração Congelada

- Modelo: `onnx-community/LFM2.5-350M-ONNX`, Q4, com pesos locais já existentes.
- Runtime: Transformers.js 4.3.1 e ONNX Runtime Node 1.30.0.
- CPU: 2 threads intra-op e 2 inter-op, uma pipeline e chamadas sequenciais.
- Geração: `do_sample: false`, `max_new_tokens: 4`, sem acesso remoto ou download.
- Parsing: trim + uppercase e comparação exata com os rótulos do papel. Uma retentativa seria permitida somente para formato inválido, sem retry de decisão válida.
- Snapshot: `20261012171458084_59902dec`, 338 linhas, preservado como fonte dos candidatos. O rebuild mais recente do workspace não foi usado para recalcular a amostra.
- Fingerprint: `cd2e9ff7652f7076d1cd7d3d3d6b205c8fcb830d13465a7c970a9fae5908ae4d`.

O fingerprint inclui plano, fontes e fixtures, snapshot, assets selecionados do modelo, runtime, parâmetros, prompts, sete helpers do estudo anterior e dez módulos novos. A verificação adicional do cache completo confirmou que os demais arquivos também permaneceram intactos.

## Resultados

| Abordagem | Erros de escrita reconhecidos | Mudanças indevidas recusadas | Decisões corretas em consultas naturais | Decisões corretas no total |
| --- | --- | --- | --- | --- |
| Baseline fresco | 12/12 | 0/12 | 2/25 | 14/49 |
| Verbal combinado | 12/12 | 0/12 | 2/25 | 14/49 |
| Grafia isolada | 12/12 | 0/12 | 2/25 | 14/49 |
| Grafia + intenção | 12/12 | 0/12 | 2/25 | 14/49 |

Os 12/12 positivos não demonstram que o modelo distinguiu erros de escrita de palavras válidas. Ele aceitou todas as propostas, tanto as corretas quanto as indevidas. Os dois acertos naturais são C3/C5 e não uma recuperação dos outros 23 casos.

No modo normal, cada papel teve 49 respostas válidas: combinado `FIX` 49 vezes, grafia `FIX` 49 vezes e intenção `SAME` 49 vezes. Na inversão da ordem dos campos, foram mais 16 respostas por papel com os mesmos rótulos.

### Estabilidade e Critérios de Aceite

As três abordagens verbais mantiveram a mesma escolha textual em 16/16 casos de stress. Essa estabilidade decorreu da resposta invariável, não de uma melhora no discernimento.

| Critério Predefinido | Exigência | Resultado das Abordagens Verbais |
| --- | --- | --- |
| Positivos | Pelo menos 10/12 | 12/12, passou |
| Negativos | Pelo menos 9/12 | 0/12, falhou |
| Naturais | Pelo menos 20/25 | 2/25, falhou |
| C3/C5 | Ambos corretos | Passou |
| Erros e respostas inválidas necessárias | Zero, inclusive inválidos recuperados | Zero, passou |
| Estabilidade textual | Pelo menos 14/16 | 16/16, passou |
| Ganho conjunto sobre combinado e grafia | Ganho em negativos ou naturais, sem perder positivos acertados | Nenhum ganho, falhou |

**Nenhuma abordagem passou no conjunto dos critérios.** Não houve ganho ou perda de casos em relação ao baseline fresco. Não houve positivo perdido contra os controles, mas também não houve veto útil, veto prejudicial ou caso recuperado pela segunda etapa.

### Exemplos Verificados

- `invoice` → `involve`: o esperado era preservar a palavra original. Grafia respondeu `FIX`, intenção respondeu `SAME` e a combinação aceitou uma mudança de assunto.
- `buscar workspace_ref: WS-041` → `buscar workspace_ref: WS-014`: a troca de identificador deveria ser recusada. As duas etapas a aceitaram.
- `onde fica o protocolo operacional estavel e onde ficam as regras comportamentais do workspace?` → a mesma frase começando por `node`: o texto original completo estava disponível, mas as duas etapas aceitaram a substituição indevida.
- `toogle` → `toggle`: a proposta correta foi reconhecida. Nos casos com sinal de sugestão, o contrato produtivo preservou a consulta original e ofereceu a sugestão, em vez de aplicar automaticamente a troca.

Esses exemplos ilustram resultados da matriz congelada. Não foram usados para escrever novas regras ou modificar os prompts depois da execução.

## Custos e Ciclo de Vida

A execução real ocorreu de 2026-10-13 14:40:27 UTC a 14:50:59 UTC. O launcher retornou em 1.337 segundos e registrou o PID 15924. A matriz terminou, a pipeline foi desalocada e o principal confirmou que o processo já não estava ativo.

Foram **244 chamadas iniciais reais**, zero retentativas, zero erros de provider e zero respostas de formato inválido: 49 do baseline, 147 dos três papéis normais e 48 do stress invertido. Os 13 bypasses não geraram chamadas. A execução não foi relançada após iniciada.

| Caminho Normal | Chamadas | Tempo Somado de Inferência | Média por Decisão |
| --- | --- | --- | --- |
| Baseline fresco | 49 | 168.25 s | 3.43 s |
| Verbal combinado | 49 | 112.52 s | 2.30 s |
| Grafia isolada | 49 | 117.48 s | 2.40 s |
| Grafia + intenção condicional | 98 | 241.03 s | 4.92 s |

O fluxo condicional teria chamado intenção em todas as 49 decisões porque grafia sempre respondeu `FIX`. Os 98 pedidos e 241.03 segundos são a composição de tentativas reais desses casos, não uma segunda execução end-to-end em produção. Tempos microscópicos de replay do avaliador não foram usados como latência de modelo.

A matriz inteira, incluindo controles e stress, durou 631.768 segundos. Isso não é o tempo de uma busca. A média por caminho acima também não inclui recuperação, reranking ou UI da busca completa.

O RSS observado foi 193.0 MiB no início da medição, 406.0 MiB após carregar a pipeline, pico amostrado de 526.2 MiB e 126.6 MiB após dispose. O runtime reportou maxRSS de 542584 KiB, aproximadamente 529.9 MiB. O processo terminou depois. Essas são medidas desse worker e incluem seu harness e buffers, não uma garantia de consumo em toda máquina ou do ecossistema completo.

Nenhum modelo adicional foi baixado ou copiado. Nenhum TTL produtivo foi alterado. Reutilizar os pesos evitou uma segunda residência do modelo, mas não eliminou o trabalho da segunda inferência.

## Validação e Preservação

Classificação: estudo experimental offline com executáveis temporários, sem mudança em código, dependências, configurações ou UI do produto. Não é uma entrega produtiva ou release-ready.

O principal executou e conferiu independentemente:

- 34/34 testes da extensão, sem falhas nem skips, em nove arquivos.
- 21/21 testes existentes de contratos do interpretador e benchmark, sem falhas nem skips.
- AST dos 19 arquivos: sem else, if aninhado, condicionais nos testes ou excedente de 300 linhas não-brancas.
- CLI real `--validate-inputs`: exit 0, `pipelineLoaded: false`, 62/49/13 e runtime/modelo esperados.
- Recomputação das escolhas e contagens a partir das respostas reais, com zero divergências em 62 IDs únicos.
- Conferência de todas as entradas reais dos papéis, prompts, ordem dos campos, parsing, chamadas e fingerprints dos módulos e helpers.
- SHA-256 antes, durante e após o estudo para código, testes, docs, skills, configurações, memória real, cache de modelos e arquivo de stage.
- Decodificação do arquivo de evidências anexado, comparando bytes e SHA-256 com o resultado real.
- Dispose antes do marcador de conclusão e término efetivo do PID.

Os grupos `src`, `scripts`, `test`, `docs`, `.agents/skills`, `.marc/memory` e `.marc/cache/memory-models` não tiveram mudança. Também permaneceram iguais AGENTS.md, README.md, package.json, pnpm-lock.yaml, RULES.md, INSTRUCTIONS.md e `.git/index`. O stage segue com SHA-256 `6114d02ce70419e12c10734d4e73e018349cda1a9fe4b289073a08da7a6b421a`.

Somente os registros autorizados desta thread e a extensão no root temporário foram criados. Nenhum comando Git, PowerShell, hook, rebuild, purge ou download foi executado. Os helpers do root anterior foram apenas lidos.

Os comandos pnpm validate/build/test do produto não foram executados ou apresentados como aprovados. A validação focada selecionada no plano cobre a extensão temporária e os contratos efetivamente reutilizados. Validação de navegador não se aplica. Os docs do produto foram revisados quanto ao impacto e não exigem atualização, pois nenhum comportamento produtivo mudou.

Fixtures temporárias de testes ficaram no root autorizado. O developer relatou uma tentativa de limpeza recusada pelo sandbox e não a repetiu. Elas não representam modelos, processos ativos ou alterações na memória do usuário. Não foi usada outra ferramenta para contornar a recusa.

## Revisão Final Integrada do Principal

**Veredicto do estudo: aprovado como evidência experimental. Veredicto da promoção de duas etapas: rejeitada nesta configuração.**

A revisão cobriu o plano congelado, as fontes produtivas de interpretação e avaliação, os sete helpers reutilizados, os dez módulos e nove testes novos, a entrega autoral do developer, o CLI real, o ciclo de vida do worker e as evidências de toda a matriz. Não se limitou ao último diff, ao relatório do executor ou a um audit estrutural.

O trabalho foi delegado sequencialmente a um developer no perfil compartilhado codex-dev, runtime Beauvoir, com gpt-6-luna/xhigh confirmado pelo humano. O principal atuou como codex-software-architect com a configuração de arquitetura previamente confirmada. O developer fez bootstrap independente do workspace marc-dd422176e1, leu skill, RULES completo, documentos e fontes do handoff, devolveu OK_BOOTSTRAP e recebeu autorização explícita antes de editar. Nenhum perfil foi criado ou alterado.

Os critérios estão ligados às seguintes evidências:

- **Escopo isolado e fontes preservadas.** A extensão permaneceu no root autorizado. Hashes antes e depois comprovam preservação da produção, cache, memória e stage.
- **Comparação justa e sem adaptação posterior.** O mesmo snapshot, candidatos, parâmetros e modelo foram usados. As 244 tentativas retêm os inputs completos e outputs brutos. Não houve ajuste a partir dos resultados.
- **Duas responsabilidades realmente separadas.** As mensagens reais da intenção não contêm saída da grafia. A recomposição reaproveita apenas o mesmo caso e mantém bypasses não pontuados.
- **Erro não convertido em acerto.** Parsing, retry de formato, falha de provider, intenção necessária e desnecessária, preservação de positivos por ID e denominadores têm testes e conferência independente.
- **Execução rastreável.** Lock exclusivo, PID, checkpoints, falha durável e cleanup foram revisados. O worker real terminou e as evidências completas foram preservadas.
- **Recomendação sustentada pelo comportamento.** A ausência de vetos e os resultados 0/12 negativos e 2/25 naturais impedem a promoção, apesar dos formatos válidos e da estabilidade.

Na revisão foram corrigidos o uso de contagens agregadas para preservação de positivos, a checagem de status da intenção necessária, o fingerprint de helpers, a guarda do índice original, a exclusão mútua de lançamento e a persistência de falhas anteriores à carga do modelo. Os testes afetados foram repetidos após as correções e antes da execução. Essas iterações ficaram no canal interno, sem transformar os registros em diário.

A entrega autoral do developer foi conferida e sua atribuição de aprovação prematura foi corrigida na própria mensagem. A aprovação explícita do principal antecedeu a matriz real. A evidência técnica final é deste estado integrado congelado.

### Limites

A amostra é pequena e congelada. Este teste não demonstra que dividir tarefas nunca ajuda modelos pequenos, nem isola uma causa exclusiva entre pesos, quantização e formulação da tarefa. Demonstra que a divisão especificada não resolveu a aceitação indiscriminada nesta configuração. Também não avalia outro modelo, full-text, retrieval, reranking ou o corpus atual após rebuild.

Não recomendo promover o controle verbal combinado ou a grafia isolada: ambos também falharam nos critérios de qualidade. Não foram adotados novos parâmetros, listas de palavras ou regras por idioma para fazer a matriz passar.

A thread permanece aberta para avaliação humana. Aprovação técnica do estudo não equivale a aceite ou autorização de encerramento.

## Evidências Reproduzíveis

O arquivo anexado `evidencias-estudo-duas-etapas-lfm350m.gzip.json` preserva sem perda o result.json real de 1,679,800 bytes. Ele contém identidade e parâmetros, casos, todas as mensagens e respostas brutas, erros, durações, efeitos, métricas e amostras de recursos. O envelope usa gzip + base64 para evitar tráfego bruto volumoso pelo contexto. Foi descomprimido e verificado após anexação.

SHA-256 do conteúdo descomprimido: `9429bbe12f07c997b1e32b8d73e0e4c13fe451c19831fadf8570740c6398408f`.

Inspeção com módulos nativos de Node, sem escrever arquivos:

```javascript
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const archive = JSON.parse(readFileSync("evidencias-estudo-duas-etapas-lfm350m.gzip.json", "utf8"));
const raw = gunzipSync(Buffer.from(archive.payload, "base64"));
const sha256 = createHash("sha256").update(raw).digest("hex");
console.log({ bytes: raw.length, sha256, matches: sha256 === archive.decodedSha256 });
const result = JSON.parse(raw.toString("utf8"));
console.log(result.analysis.summaries);
```

O resultado temporário original permanece em `C:/Users/junior/AppData/Local/Temp/marc-two-stage-study-57488bab-20261013/runs/cd2e9ff7652f7076d1cd7d3d3d6b205c8fcb830d13465a7c970a9fae5908ae4d/result.json`. O anexo persistido na thread não depende da permanência desse root.
