# Proposta - Settings estruturado em JSON

## Contexto

Durante a evolução da tela de configurações de memory, a configuração `memory.autoRebuild` foi persistida em `.marc/SETTINGS.md` usando um bloco estruturado dentro de comentário Markdown:

```md
<!-- marc-settings
memory.autoRebuild: false
-->
```

A intenção original foi manter coerência com a regra arquitetural atual de que Markdown é a fonte de verdade do workspace mARC. Essa decisão preserva legibilidade, versionamento e proximidade com o restante da pasta `.marc`, que já usa Markdown para threads, mensagens, summaries, rules e artefatos.

A conversa atual levantou uma crítica importante: para settings operacionais consumidos por máquina, a escolha por Markdown adicionou complexidade acidental. A UI já é o caminho humano de edição; o humano não deveria precisar abrir `SETTINGS.md` para configurar o recurso. Se o dado é primariamente configuração estruturada, JSON pode ser uma fonte de verdade mais simples, direta e robusta.

## Problema observado

Persistir configuração em Markdown exige código customizado para tarefas que JSON já resolve de forma nativa:

- localizar o bloco de settings dentro do Markdown;
- parsear linhas `chave: valor`;
- serializar novamente sem destruir conteúdo humano ao redor;
- lidar com bloco ausente, duplicado, malformado ou parcialmente editado;
- testar casos de parse e rewrite que não existiriam com `JSON.parse` / `JSON.stringify`;
- separar o que é documento humano do que é contrato de máquina;
- explicar para futuros agentes por que existe uma mini-linguagem de configuração dentro de Markdown.

Essa complexidade apareceu cedo com apenas um setting (`memory.autoRebuild`). A tendência é piorar se surgirem novos settings de workspace, como estado de modelo, políticas de rebuild, thresholds de busca, limites de UI, preferências por workspace ou opções de conectores.

## Hipótese

Para configurações operacionais de workspace, `.marc/settings.json` ou `.marc/SETTINGS.json` deve ser a fonte de verdade.

Markdown continuaria sendo fonte de verdade para conteúdo conversacional e documental do mARC: threads, mensagens, summaries, rules, planos, artefatos e registros de decisão.

Isso preserva o espírito do projeto sem forçar Markdown como formato universal para dados que são claramente estruturados.

## Proposta inicial

Criar uma oportunidade de evolução para substituir o armazenamento atual de settings em Markdown por JSON estruturado.

Direção sugerida:

1. Definir um schema interno de settings, por exemplo:

```json
{
  "memory": {
    "autoRebuild": false
  }
}
```

2. Tratar o arquivo JSON como fonte de verdade para configurações de máquina.

3. Manter `RULES.md`, threads, summaries e artefatos em Markdown como source of truth do conhecimento e da comunicação.

4. Remover ou reduzir o parser customizado de `SETTINGS.md`.

5. Implementar migração compatível:
   - se `settings.json` existir, usar JSON;
   - se apenas `SETTINGS.md` antigo existir, ler uma vez, migrar para JSON e preservar comportamento;
   - após migração, evitar escrever novo estado em Markdown.

6. Decidir se `SETTINGS.md` deve:
   - ser removido;
   - virar apenas documentação gerada;
   - ou permanecer temporariamente como arquivo legado não autoritativo.

## Relação com decisões anteriores

Esta oportunidade toca uma regra arquitetural crítica: Markdown como fonte de verdade.

Referências relevantes para investigação futura:

- marc://$oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f
- marc://$oportunidade-documentacao-do-projeto-e-readme-encantador-e54fb794
- marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa

A mudança não deve ser tratada como abandono do Markdown no mARC. O ponto é delimitar melhor o escopo da regra:

- Markdown continua ideal para conteúdo humano, histórico, conversacional e explicativo.
- JSON é mais adequado para configuração operacional estruturada, especialmente quando a UI é o editor humano primário.

## Benefícios esperados

- Reduzir código customizado de parser e writer.
- Diminuir superfície de bugs em settings.
- Facilitar validação por schema.
- Simplificar testes.
- Tornar novas opções de configuração menos custosas.
- Evitar misturar documentação humana com contrato de máquina.
- Melhorar previsibilidade para daemon, MCP, UI e futuros agentes.

## Riscos e cuidados

- Não enfraquecer a regra de Markdown como fonte de verdade para o conteúdo essencial do mARC.
- Evitar criar múltiplas fontes de verdade entre `SETTINGS.md` e JSON.
- Planejar migração sem quebrar workspaces existentes.
- Documentar claramente que settings são exceção estruturada, não precedente para migrar threads/messages/summaries para JSON.
- Garantir que agentes ainda consigam entender a configuração quando necessário, mesmo que o arquivo seja JSON.

## Critérios de aceite futuros

- Existe um arquivo JSON autoritativo para settings de workspace.
- `memory.autoRebuild` é lido e escrito pelo novo formato.
- Workspaces com `SETTINGS.md` legado continuam funcionando por migração ou fallback explícito.
- Não há escrita concorrente em dois formatos autoritativos.
- Parser customizado de settings em Markdown é removido ou isolado apenas para migração.
- Testes cobrem leitura, escrita, default, migração e arquivo malformado.
- A documentação ou thread registra a nova fronteira: Markdown para conhecimento; JSON para settings estruturados.

## Questões abertas

- Nome do arquivo: `.marc/settings.json` ou `.marc/SETTINGS.json`?
- O arquivo JSON deve ser formatado com indentação estável para diff legível?
- Deve existir schema explícito versionado, como `schemaVersion`?
- `SETTINGS.md` deve desaparecer ou virar documentação gerada?
- A regra em `RULES.md` precisa ser refinada para abrir essa exceção?
