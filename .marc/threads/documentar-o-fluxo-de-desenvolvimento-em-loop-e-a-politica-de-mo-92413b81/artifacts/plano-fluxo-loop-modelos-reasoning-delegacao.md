# Plano de desenvolvimento do fluxo em loop

## Objetivo

Concluir a organização aprovada em três camadas. AGENTS.md é a entrada operacional. Custom Rules em .marc/RULES.md é o contrato obrigatório deste workspace. docs/agent-workflows.md explica o procedimento completo. Não implementar mecanismos de configuração, hooks ou adaptações para CLIs de terceiros.

## Escopo e fontes

Alterar docs/agent-workflows.md e apenas a área Custom Rules de .marc/RULES.md. Ajustar AGENTS.md somente onde sua descrição anterior de modelos, concorrência e fonte do procedimento conflitar com o contrato agora documentado. Não alterar código, dependências, INSTRUCTIONS.md, skill gerenciada, ADRs, mecanismo de busca nem configurações de clientes.

As fontes são a solicitação atual do usuário, o AGENTS.md já revisado, marc-ops, o bootstrap e RULES.md completo, README.md, docs/agent-workflows.md, docs/harness-engineering.md e ADR 0007. A decisão histórica d34b7486 confirmou a separação entre bootstrap gerenciado e contrato customizado. Documentação oficial de Codex e Claude foi consultada para não confundir parâmetros solicitados com configurações efetivas.

## Contrato aprovado e novos requisitos

- Principal é arquiteto, orquestrador, revisor e responsável pelo aceite técnico. Usa modelo de alta capacidade com reasoning mínimo medium e recomendado high.
- Desenvolvedor é subagente com modelo mais econômico e de capacidade adequada a uma tarefa limitada. Usa reasoning mínimo high e recomendado xhigh. Aumentar reasoning não transforma um modelo de menor capacidade em equivalente ao principal.
- Sol e Opus exemplificam o papel principal. Luna e Haiku exemplificam o desenvolvedor. As famílias ilustram o perfil, não são whitelist, comparação numérica universal ou promessa de disponibilidade por versão.
- Modelo e esforço são dimensões separadas. Registrar modelo selecionado, configuração de reasoning solicitada e efetiva quando verificável, origem da confirmação e restrições do cliente. Nomes de níveis e suporte variam. Não inventar configuração equivalente, supor herança ou ignorar limites/fallbacks do cliente.
- Reutilizar uma configuração válida e confirmada. Quando a seleção, nível efetivo ou mapeamento equivalente não puderem ser estabelecidos, solicitar definição ao humano antes da implementação. Reconfiguração do principal pode exigir ação do humano. Não criar código para controlar clientes nem fazer downgrade silencioso.
- O teto padrão é dois desenvolvedores ativos. Confirmar outro limite com o humano quando houver indefinição, conflito ou impedimento da ferramenta. Instruções mais restritivas, incluindo a experimentação sequencial já acordada, continuam tendo prioridade. Para esta entrega usar um desenvolvedor por vez porque os arquivos compartilham um contrato.
- Só paralelizar tarefas independentes com escopos de escrita separados. Agentes aguardando aprovação continuam ocupando sua vaga. Não encerrar um agente por silêncio ou presumido travamento.
- Tarefas delegadas precisam ser planejadas, claras, completas, autocontidas e atômicas. Entregar objetivo, contexto necessário, entradas/fontes, caminhos autorizados e exclusões, resultado esperado, critérios de aceite, validação, dependências e condições de bloqueio. Não depender de histórico oculto nem repassar ao desenvolvedor a decisão do que deve ser construído.
- Cada desenvolvedor executa bootstrap independente e fornece OK_BOOTSTRAP com evidências, configuração/modelo, workspace, fontes, regras aplicáveis e escopo. O principal verifica e autoriza as edições. A obrigação de delegar é do principal. Desenvolvedores não iniciam uma cadeia recursiva de agentes.
- O principal devolve problemas ao desenvolvedor até satisfazer os critérios de qualidade. Revisa thread inteira e implementação acumulada, requisitos, comportamento, arquitetura, manutenção, cobertura, evidência e docs. Audit estrutural não substitui esse crivo.
- Depois do aceite técnico, aguardar revisão e autorização humana para fechamento da thread. Não criar SUMMARY.md como consequência automática do fim da tarefa.

## Unidade de desenvolvimento

Uma tarefa atômica e integrada de documentação e contrato, delegada a gpt-6-luna com reasoning xhigh, com escrita limitada aos três arquivos informados. Não paralelizar versões concorrentes do mesmo contrato.

1. Complementar docs/agent-workflows.md com escopo local do loop, matriz de papéis e níveis, preflight de configuração, concorrência, especificação autocontida, bootstrap comprovado, autorização, execução, revisão iterativa e aceite humano. Preservar conteúdo útil existente e corrigir orientação de fechamento/auditoria que contradiga os novos controles.
2. Adicionar regras operacionais em Custom Rules com Trigger, Do instead, Evidence e Severity. Preservar byte a byte a área gerenciada e todo o contrato preexistente, exceto atualizar a linha dos comandos de validação para pnpm validate, pnpm build e pnpm test na ordem acordada.
3. Alinhar AGENTS.md por referências e resumos curtos à regra canônica e procedimento, retirando a versão fixa de modelo como requisito universal. Preservar bootstrap, comunicação, ferramentas e demais instruções já avaliadas. Manter os overrides humanos sem tratar o teto de dois como autorização automática para paralelizar.

## Validação e revisão

Antes da edição, capturar hashes do trecho gerenciado de RULES e dos arquivos fora do escopo. Depois da edição, comparar a preservação e conferir links Markdown, fontes, blocos, formatação e ausência de quebras físicas forçadas no meio das frases. Documento técnico em en-US e registros operacionais em pt-BR.

Revisar os cenários de configuração confirmada, desconhecida, esforço abaixo do mínimo, xhigh não suportado mas high válido, nível sem mapeamento verificável, herança/default não comprovados, teto padrão dois, override sequencial, tarefas sobrepostas, vaga aguardando aprovação, handoff incompleto, bootstrap não comprovado, retrabalho e tentativa de fechamento sem aceite humano. O texto deve orientar decisões inequívocas sem prometer fiscalização em runtime.

Executar pnpm validate, pnpm build e pnpm test nessa ordem. validate aplica fixes, portanto verificar que não introduziu alterações fora do escopo. Conferir Markdown diretamente porque a configuração atual do formatter não inclui os arquivos Markdown na checagem geral. Usar workspace_audit nos checkpoints aplicáveis após registrar arquivos, mensagens e metadados completos.

## Progresso

- [x] Escopo, requisitos, decisões históricas e fontes conferidos.
- [x] Plano anexado e registro completo auditado antes da implementação.
- [x] Bootstrap e escopo do desenvolvedor verificados pelo principal.
- [x] Documentação, Custom Rules e consistência do AGENTS desenvolvidos.
- [x] Revisão independente e eventuais ajustes concluídos.
- [x] Validação integrada e relatório final registrados.
- [ ] Revisão e autorização humana recebidas para encerramento.

## Configuração desta execução

O usuário informou o principal em gpt-6.1-sol com reasoning high. Isso é configuração declarada pelo humano, não introspecção técnica do cliente. O desenvolvedor será selecionado explicitamente por spawn com gpt-6-luna e reasoning xhigh. Esta entrega permanece sequencial, sem impedir que o fluxo documentado tenha teto padrão de dois e overrides humanos.

Não há perguntas de escopo pendentes. O comportamento de fallback para configurações desconhecidas será documentado, sem solicitar novamente escolhas já confirmadas.

## Referências oficiais consultadas

- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://code.claude.com/docs/en/model-config
- https://www.aihero.dev/a-complete-guide-to-agents-md
- https://www.aihero.dev/my-agents-md-file-for-building-plans-you-actually-read
- https://agents.md/

Essas referências complementam o fluxo acordado. Não são copiadas como regras de produto nem exigem ferramentas de um fornecedor.