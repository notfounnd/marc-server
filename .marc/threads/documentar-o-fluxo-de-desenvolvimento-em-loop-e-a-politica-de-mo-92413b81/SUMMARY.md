# Documentar o fluxo de desenvolvimento em loop e a política de modelos, reasoning e delegação

Thread: marc://$documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81

Closed: `2026-10-09T03:33:26Z`

---

## Objetivo e aceite

Documentar o fluxo de desenvolvimento em loop e sua política de modelos, reasoning, delegação, revisão e encerramento. Consolidar as identidades persistentes dos agentes e corrigir a apresentação dos perfis na UI.

O humano autorizou explicitamente o encerramento nesta conversa. A aprovação técnica foi registrada antes do aceite. Não há pendência de implementação nesta thread.

## Fluxo consolidado

- AGENTS.md orienta a entrada local, docs/agent-workflows.md detalha o procedimento e Custom Rules em .marc/RULES.md estabelece as obrigações. A parte gerenciada das regras foi preservada.
- O principal planeja, orquestra, integra, revisa o desenvolvimento completo e concede aprovação técnica. Usa modelo de alta capacidade com reasoning mínimo medium e recomendado high.
- Desenvolvedores recebem tarefas atômicas, autocontidas, claras e completas, com escopo autorizado, fontes, critérios de aceite, verificações, exclusões e condições de bloqueio. Usam modelo adequado ao escopo com reasoning mínimo high e recomendado xhigh.
- Modelo e reasoning são tratados separadamente. Configuração solicitada e efetiva, origem da confirmação e limites do cliente devem ser registrados sem inventar introspecção. Configuração desconhecida, incompatibilidade ou capacidade abaixo do mínimo exige consulta ao humano antes da implementação.
- O teto padrão é dois desenvolvedores, salvo override humano confirmado e respeitados os limites do cliente. É um máximo, não uma meta. O teste atual deste workspace permanece sequencial com um desenvolvedor ativo até nova orientação humana.
- Cada desenvolvedor faz bootstrap independente, lê marc-ops e o contrato completo, confirma OK_BOOTSTRAP e aguarda autorização explícita antes de editar. Context-mode, Bash e apply_patch permanecem obrigatórios conforme as regras locais.
- A revisão independente cobre requisitos, comportamento, arquitetura, manutenção, regras, testes e documentação. Achados voltam ao mesmo desenvolvedor até atingir o critério de qualidade. Auditoria estrutural não substitui essa revisão.
- Apenas o humano aceita o resultado e autoriza SUMMARY.md e encerramento. A documentação é local a este repositório, sem hooks ou configuração de terceiros no produto mARC.

## Perfis persistentes

- Cadastro ativo limitado a codex-software-architect, role architect, modelo gpt-6.1-sol, e codex-dev compartilhado, role developer, modelo gpt-6-luna, além de ui-user preservado.
- Reasoning atual high para o principal e xhigh para os desenvolvedores consta no contexto manual com origem da confirmação humana. Não integra o campo Model nem implica observação runtime.
- Description continua em uma linha conforme o contrato do MCP. Responsabilidades, limites e configuração foram complementados em bullets abaixo dos metadados e preservados em novo registro.
- Somente o principal administra o cadastro e registra as entregas no mARC. Subagentes temporários reutilizam codex-dev sem perfis por tarefa ou spawn. A identidade runtime e variações de configuração ficam nas evidências da tarefa.
- Cinco perfis redundantes foram removidos. Snapshot dos perfis anteriores foi anexado antes da remoção. Autoria e corpos das mensagens históricas não foram reescritos.

## Apresentação dos agentes

MarkdownPanel recebeu preserveLineBreaks desativado por padrão e ativado apenas na visualização dos agentes. CSS white-space pre-line preserva quebras simples dos parágrafos e mantém wrapping de texto longo. Threads, mensagens, artefatos e regras permanecem com a renderização padrão.

Arquivos dos perfis, parsers e metadados não foram modificados por esse ajuste de UI. O principal realizou esta correção diretamente, conforme exceção humana explícita para o ajuste simples, sem alterar a regra geral de desenvolvimento delegado.

## Validação

- Planos e revisões anexados pelo MCP antes das respectivas implementações e registros de entrega. Bootstrap e autorizações dos desenvolvedores registrados.
- pnpm validate, pnpm build e pnpm test passaram na ordem estabelecida. Rodada final com 199 testes, zero falhas e zero skips. O build apresentou somente o warning conhecido de bundle acima de 500 kB.
- Regressão de UI reproduziu a ausência da opção antes da correção e passou depois. É verificação de integração por fonte, não teste visual de navegador.
- Prettier API verificou os Markdown da consolidação e os links locais foram conferidos.
- MCP confirmou exatamente três perfis. Novo agent_register retornou unchanged para os dois perfis Codex, preservando o contexto manual em bullets.
- ui-user, prefixo gerenciado de RULES.md e 284 arquivos protegidos de código, testes, scripts e histórico das outras threads permaneceram intactos durante a consolidação.
- Auditorias agents e messages passaram sem findings. A auditoria de mensagens do encerramento foi executada após o registro completo dos anexos.
- HTTP 200 da UI confirmou referências aos assets do novo build. Não foi registrada execução visual automatizada desktop/mobile.

## Limites e continuidade

Os links para os cinco perfis removidos não resolvem mais no cadastro ativo. Nove mensagens conservam esses autores históricos. O snapshot também documenta que codex-dev anteriormente representava o principal, antes de passar a representar desenvolvedores. Não foram criados aliases nem reatribuídas mensagens de outros ferramentais ao Codex.

O backlog de marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a foi revisado e recebeu cenários pendentes para quebras dos metadados, wrapping responsivo, conteúdo Markdown dos perfis e isolamento do restante do renderizador. Cobertura E2E durável continua nessa oportunidade, sem bloquear o encerramento autorizado desta thread.

Os planos, o snapshot e as revisões detalhadas permanecem nos artefatos anexados ao histórico desta thread. O mecanismo de busca e os contratos do produto não foram alterados.
