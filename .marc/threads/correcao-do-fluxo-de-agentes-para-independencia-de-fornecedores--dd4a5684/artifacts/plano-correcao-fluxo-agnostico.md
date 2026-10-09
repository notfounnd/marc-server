# Corrigir a independência do fluxo de agentes

## Problema e escopo

A documentação transformou modelos, fornecedores, links de clientes e IDs atuais em referência normativa do loop. O fluxo deve sobreviver a mudanças de cliente, fornecedor ou modelo sem exigir revisão das regras.

Alterar apenas AGENTS.md, docs/agent-workflows.md e Custom Rules de .marc/RULES.md. Preservar perfis existentes, histórico, thread encerrada, parte gerenciada, código e testes. A escolha atual de modelos e perfis continua sendo configuração de sessão/cadastro, não regra documental permanente.

## Desenvolvimento

1. [x] Inspecionar os três documentos e ler a conclusão da thread anterior.
2. [x] Desenvolvedor delegado confirma bootstrap e aguarda autorização para editar.
3. [x] Remover exemplos de fornecedores/famílias de modelos e links OpenAI/Anthropic da política do loop. Trocar exemplo codex-dev na orientação geral por nome neutro orientado a papel.
4. [x] Descrever capacidades por responsabilidade, mantendo principal mínimo medium/recomendado high e desenvolvedor mínimo high/recomendado xhigh. Níveis são referências conceituais do projeto, não campos/API universais. Equivalências precisam de confirmação do humano ou cliente, nunca presunção.
5. [x] Resolver perfis do principal e desenvolvedores por inventário, responsabilidade e mapeamento confirmado. Reutilizar perfil persistente adequado ao papel. Nenhum ID fechado, quantidade fixa, prefixo de ferramenta ou perfil por spawn. Principal administra cadastro e registra entregas, desenvolvedor reporta evidências.
6. [x] Revisar independência com cenários de troca de cliente/modelo, nome de perfil diferente, controles de reasoning diferentes e ausência de informação. Manter fallback humano, bootstrap, autorização, teto/override, tarefa autocontida e revisão independente.
7. [x] Executar pnpm validate, pnpm build e pnpm test, checar Markdown, links e hashes de perfis, parte gerenciada e resumo histórico.
8. [x] Entrega registrada e aprovada pelo humano. Encerramento explicitamente autorizado.

## Aceitação

Nenhuma referência normativa aos fornecedores ou IDs de perfil atuais nos três documentos. Nenhuma configuração universal inventada. A política permite novos clientes/modelos quando adequados ao papel e com reasoning/limites confirmados. Bootstrap e evidências identificam o perfil e a configuração selecionados para aquela tarefa. Trocar fornecedor não exige alterar AGENTS, regras ou procedimento.

## Execução atual

Um desenvolvedor sequencial no modelo gpt-6-luna com reasoning xhigh conforme configuração explicitamente escolhida anteriormente pelo humano. Esta escolha é dado desta atividade, não restrição normativa do fluxo.

## Resultado técnico

Revisão independente aprovada após refinamentos do mesmo desenvolvedor. Os 12 critérios documentais atendidos. pnpm validate, pnpm build e pnpm test passaram com 199 testes, zero falhas e zero skips. Markdown e links verificados. Perfis, código, histórico, documentos fora do escopo e prefixo gerenciado preservados.

Entrega registrada e aprovada pelo humano. Encerramento explicitamente autorizado nesta conversa. Resumo executivo e verificação de status registram o fechamento.
