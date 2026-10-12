# Oportunidade - Alinhamento do harness e das instruções operacionais do mARC

Thread: marc://$oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894

Closed: `2026-10-12T17:07:23.960Z`

---

O harness do repositório foi alinhado para eliminar instruções contraditórias de bootstrap, leitura de threads, perfis, publicações e autoridade das regras. O desenvolvimento foi concluído e aprovado tecnicamente após revisão integrada independente. O humano confirmou o restart do ecossistema e autorizou o encerramento desta thread.

## Resultado e Decisões

- O cursor representa conteúdo efetivamente lido e processado. Metadados de `thread_info` não avançam esse cursor e `thread_tail` cobre somente a janela retornada.
- As orientações gerais privilegiam descoberta e reutilização de perfis. Registro ou atualização depende da necessidade e do contrato do workspace, sem catálogo fechado ou perfil novo por spawn.
- Publicações priorizam decisões, descobertas, riscos, bloqueios, resultados, entregas consolidadas e transferências reais de responsabilidade. A entrega própria do desenvolvedor continua obrigatória no loop local, sem transformar threads ou artefatos em diários.
- As restrições deste repositório ficam nas Custom Rules. AGENTS referencia a autoridade canônica e a composição compartilhada para mensagens, artefatos e resumos.
- Bootstrap e atualização de recomendações permanecem distintos. Foi preservada a manutenção antes de iniciar trabalho numa thread, sem repetir bootstrap como ritual.
- Markdown permanece autoritativo para registros de conhecimento e coordenação. JSON e outros formatos estruturados legítimos foram preservados.
- O helper remete ao contrato do workspace consumidor, sem presumir arquivos da documentação deste repositório.

As correções foram feitas nos geradores, helper, testes e documentos autorizados. O refresh oficial emitiu a skill e o baseline atualizados, preservando exatamente Custom Rules, `description` e `when_to_use`. Não houve mudança de ferramentas, persistência, UI ou motor de busca.

## Validação e Aceite

Na revisão independente desta entrega, `pnpm validate`, `pnpm build` e `pnpm test` passaram. A suíte completa teve 284 testes aprovados, sem falhas, cancelamentos ou skips.

Também passaram as verificações de MCP compilado em consumidor sem documentação local, cursor A/B após consulta de metadados, janela de tail, geração idempotente, preservação de arquivos protegidos, links e âncoras e ausência de condicionais de seleção de cenários nos testes. A auditoria estrutural de mensagens não encontrou problemas.

O desenvolvedor publicou sua própria entrega sob perfil compartilhado. O principal conferiu essa autoria, revisou o conjunto final e verificou as correções solicitadas durante o loop. Após o restart confirmado pelo humano, o bootstrap e os tópicos do helper foram conferidos no MCP reconectado.

## Limites e Continuidade

Não há pendência de implementação desta thread. O aviso do Vite sobre bundle acima de 500 kB permaneceu fora do escopo. Instruções textuais orientam os agentes, mas não garantem cumprimento por todos os clientes e modelos; não foram adicionados hooks específicos.

A observação do próximo desenvolvimento real poderá confirmar o comportamento do harness em uso. Isso não é condição pendente de encerramento.

## Referências

- [Análise original](artifacts/analise-coerencia-harness.md)
- [Plano de desenvolvimento](artifacts/plano-alinhamento-harness.md)
- [Entrega do desenvolvedor](artifacts/relatorio-desenvolvimento-harness.md)
- [Revisão integrada do principal](artifacts/revisao-integrada-harness.md)
