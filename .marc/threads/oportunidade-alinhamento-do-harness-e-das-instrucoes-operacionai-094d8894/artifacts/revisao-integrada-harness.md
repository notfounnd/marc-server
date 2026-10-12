# Revisão Integrada do Harness

## Síntese e Veredito

**Veredito técnico: aprovado.** O principal revisou o estado integrado dos 13 arquivos autorizados, os resultados gerados no workspace real, a entrega do desenvolvedor e as evidências independentes abaixo. As sete inconsistências da análise e a observação de manutenção do AGENTS foram tratadas sem mudar contratos de ferramentas, formatos de persistência ou o motor de busca.

A thread permanece aberta para revisão e aceite humano. Esta aprovação não autoriza encerramento, commit ou comandos Git.

## Escopo e Fontes Revisadas

- Análise original e plano detalhado anexados nesta thread.
- Geradores em `src/core/recommendations.ts` e `src/core/marc-ops-skill.ts`, além das orientações em `src/mcp/helper.ts`.
- Quatro arquivos de teste autorizados: recomendações, bootstrap, catálogo/helper MCP e leitura incremental de threads.
- `AGENTS.md`, Custom Rules de `.marc/RULES.md`, `docs/agent-workflows.md`, `docs/development.md`, `docs/mcp-tools.md` e `README.md`.
- Skill e baseline efetivamente emitidos pelo MCP recém-compilado, documentação de autoridade e ADRs aplicáveis já consultados no planejamento.
- Entrega de autoria do perfil compartilhado `codex-dev`, mensagem `msg_7b6108ddf22044ef88`, e seu relatório anexo.

As inspeções e verificações do principal usaram context-mode. Não foram executados comandos Git ou PowerShell.

## Delegação e Autoria

O desenvolvimento foi sequencial, com um único desenvolvedor. Foi solicitado `gpt-6-luna` com raciocínio `xhigh`, conforme configuração confirmada pelo humano. Essa confirmação não foi apresentada como introspecção do modelo efetivamente executado.

O principal verificou o bootstrap independente, a identidade `marc-dd422176e1`, a raiz `C:/Projetos/marc`, as fontes, as regras críticas, os fingerprints dos alvos e o escopo antes de autorizar edições pelo canal interno. O runtime delegado foi `01a130a3-b2ac-7d20-9e18-95e60b679214`, reutilizando `codex-dev`, sem criar perfil por spawn.

A entrega própria do desenvolvedor foi lida e conferida pelo principal. Ela possui metadados do relatório anexo, evidências compatíveis com o trabalho e revisão do principal explicitamente pendente. O principal não retransmitiu a entrega como se fosse sua.

## Critérios e Avaliação Técnica

| Critério | Implementação integrada | Evidência e avaliação do principal |
|---|---|---|
| Cursor consumido | Gerador, skill, helper e documentos distinguem conteúdo processado de metadados. `thread_info` não avança o cursor e `thread_tail` cobre somente sua janela. | A regressão MCP e o probe independente do `dist` leram A, publicaram B, consultaram metadados de B e receberam B por `thread_read_since` usando o cursor A. A janela de tail também foi conferida. O cursor continua responsabilidade do chamador, sem estado ou API novos. |
| Descoberta e reutilização de perfis | As orientações gerais privilegiam inventário e reutilização, condicionando registro ou atualização à necessidade e ao contrato do workspace. | Helper compilado e baseline gerado conferidos. Não há catálogo fechado ou prefixo obrigatório exportado a consumidores. O catálogo real e os três perfis existentes permaneceram preservados. |
| Publicações relevantes | A skill, o baseline e o helper deixam de induzir confirmação rotineira de leitura ou comentários incrementais de operação. | As orientações preservam decisões, descobertas, riscos, bloqueios, resultados, entregas consolidadas e handovers reais. O loop local continua exigindo a entrega autoral do desenvolvedor. Não foi introduzido silêncio obrigatório ou gate de publicação. |
| Autoridade das restrições locais | Custom Rules agora contém autorização Git, Playwright CLI, edição manual com apply_patch e solicitação explícita para hooks de cliente. AGENTS referencia a fonte canônica. | As regras permaneceram sob a fronteira preservada, não no baseline exportado. O retry Git não autoriza contornar negativas ou aprovações pendentes. Não foram adicionados hooks nem configuração de cliente. |
| Bootstrap e manutenção | A documentação e as orientações separam estabelecimento/recuperação de contexto de atualização de recomendações. | Foi preservada a frequência existente de manutenção antes de trabalhar numa thread. Refresh não é apresentado como confirmação de bootstrap; contrato conhecido continua reutilizável. |
| Fronteira de Markdown | A autoridade de Markdown fica delimitada a registros legíveis de conhecimento e coordenação, preservando formatos estruturados. | JSON de configuração permaneceu intacto. Não houve migração, alteração de parsers de persistência ou mudança na distinção entre registros autoritativos e projeções reconstruíveis. |
| Consumidor sem docs locais | O helper remete composição e encerramento ao contrato do workspace atual, sem presumir `docs/agent-workflows.md`. | Probe com processo MCP compilado num workspace temporário comprovadamente sem esse arquivo passou. O loop particular deste repositório não virou obrigação geral do produto. |
| Composição compartilhada | AGENTS usa referência concisa para mensagens, artefatos e resumos, sem repetir a política de formatação. | Links e âncoras foram conferidos. Limites específicos de mensagens e a orientação compartilhada continuam separados, sem template rígido ou aprovação prévia de cada mensagem. |
| Durabilidade e idempotência | As correções estão nos geradores; o principal atualizou os resultados gerenciados por ferramentas oficiais do MCP recém-compilado. | A skill emitida é idêntica à constante do gerador compilado. Custom Rules foi preservado exatamente no refresh. Repetição de `workspace_update_recommendations` retornou zero atualizações e manteve os arquivos estáveis. |
| Preservação do loop e dos contratos | Bootstrap independente, autorização, entrega autoral, revisão integrada e aceite humano permanecem separados. | Comparação com os fontes anteriores confirmou corpos operacionais de geração e helper sem mudanças. Catálogo compilado mantém 25 ferramentas. `description` e `when_to_use` permanecem exatamente iguais no fonte e no arquivo gerado. |

## Arquitetura e Manutenibilidade

A solução corrige as fontes das instruções, em vez de depender de edição manual de arquivos gerenciados. A separação entre orientação genérica do produto e política local do repositório evita exportar restrições deste workspace para consumidores.

Não foram adicionados gates, roteamento automático, estado de cursor persistido, novas ferramentas ou camadas de abstração. As mudanças executáveis ficam nos textos emitidos por estruturas existentes. Os testes verificam tanto esses contratos de orientação quanto o comportamento real via MCP; não dependem apenas de snapshots de frases.

As regressões foram organizadas por assuntos coerentes no arquivo existente de bootstrap. A inspeção por AST dos quatro arquivos de teste não encontrou `IfStatement`, `SwitchStatement` ou `ConditionalExpression` selecionando cenários.

## Validação Independente

Classificação: entrega mista de harness, documentação, geradores executáveis e testes. Aplicado o fluxo completo, não apenas validação editorial.

| Verificação executada pelo principal | Resultado |
|---|---|
| `pnpm validate` | Passou: correções de lint/formatação, checagens e typecheck. |
| `pnpm build` | Passou: TypeScript e Vite produziram o `dist`. |
| `pnpm test` | 284 passaram, zero falhas, cancelamentos ou skips. |
| MCP compilado em workspace temporário | Passou: 25 ferramentas, cinco tópicos do helper, consumidor sem documentação local, cursor A/B e janela de tail. |
| Refresh oficial no workspace real | Passou: identidade correta, Custom Rules exato, skill idêntica ao gerador, metadata imutável e repetição sem atualizações. |
| Links dos seis documentos, por parser Markdown | 55 links locais e 15 âncoras verificados, zero erros. |
| Testes, por AST TypeScript | Nenhum condicional de seleção de cenário nos quatro arquivos. |
| Fronteira de edição, por fingerprints | Os 298 arquivos monitorados fora do escopo autorizado permaneceram idênticos. Arquivos protegidos também permaneceram preservados. |

`pnpm validate` possui efeitos de formatação. O principal conferiu a fronteira de edição após sua execução, sem restaurar ou limpar trabalho alheio. Build e refresh geraram somente as saídas previstas; registros consolidados desta thread foram publicados por MCP oficial.

A conferência do workspace real também preservou `.marc/INSTRUCTIONS.md`, `.marc/marc.config.json`, os três perfis, manifestos, lockfile e configuração de cliente monitorada. Não houve alteração de UI, modelos ou índice semântico. Validação de browser não se aplica a esta entrega e não foi registrada como aprovação ou pendência.

## Achados Resolvidos

A revisão identificou e devolveu ao mesmo desenvolvedor os ajustes necessários para cumprir integralmente o plano:

- Abranger mensagens, artefatos e resumos no AGENTS, sem duplicar a política compartilhada.
- Preservar a frequência existente de manutenção ao explicar sua diferença em relação ao bootstrap.
- Evitar ampliar a regra Git para uma proibição absoluta de qualquer retry legitimamente autorizado.
- Separar as novas regressões por contratos coerentes, em vez de reunir assuntos distintos num teste de artifacts.

Os ajustes foram conferidos no estado final e estão cobertos pela validação independente. Não há achado aberto que impeça aprovação técnica desta thread.

## Limites e Próximo Passo

O build emitiu aviso do Vite para um bundle acima de 500 kB. Não foi ampliado o escopo para otimização da UI; suas fontes e dependências permaneceram preservadas.

O desenvolvedor observou variação anterior de `.marc/cache/thread-index.json`, sem determinar a causa. Esse cache é derivado; foi preservado, sem limpeza ou restauração automática. Isso não foi atribuído às alterações do harness nem confundido com alteração de registros autoritativos.

A avaliação comprova coerência dos documentos, geração e comportamento das ferramentas. Não garante que todo cliente ou modelo seguirá instruções textuais em toda sessão; não foram implementados hooks específicos para tentar impor esse comportamento.

Reiniciar o processo MCP e a sessão do agente permite carregar o helper compilado e redescobrir a skill atualizada. O build já foi executado. Após isso, uma validação real do próximo trabalho delegado pode confirmar o comportamento do agente sob o contrato revisado.

**Aguardando revisão humana. Thread aberta, sem summary de encerramento.**
