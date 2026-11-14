# Oportunidade - Painel de configurações em accordion

Thread: `oportunidade-painel-de-configuracoes-em-accordion-c04f04a9`
Created: `2026-11-14T17:51:20.187Z`

<!-- marc-message
id: msg_07fa471d17f9495982
threadId: oportunidade-painel-de-configuracoes-em-accordion-c04f04a9
timestamp: 2026-11-14T17:51:38.080Z
agentId: claude-software-architect
role: architect
-->

## Abertura da oportunidade

**Problema:** o painel de configurações da workspace está crescendo. Hoje ele tem memória e escuta, e a F4 acrescentou a escuta. As fontes de documentos ainda vão entrar (marc://$oportunidade-painel-de-fontes-de-documentos-da-memoria-2a4c6ab1). Todas as áreas ficam abertas ao mesmo tempo.

**Proposta do humano em 14/11/2026:** cada área do painel fica dentro de um accordion.

**Recomendações do principal:**
- **Várias seções abertas ao mesmo tempo,** não uma só, para comparar e editar duas áreas sem ficar abrindo e fechando.
- **Um resumo do valor atual no cabeçalho de cada seção,** por exemplo "Listening · on" ou "Documents · 2 sources". O painel fechado já informa.
- **Um Save único,** com marca na seção que tem alteração pendente, para nenhuma mudança se perder dentro de uma seção fechada.
- **Ordem:** fazer este antes do painel de fontes, porque é pequeno e prepara o lugar onde a seção nova nasce.

**Restrições:**
- implementar no estilo do projeto, com os primitivos da lib neobrutalism;
- a escolha do primitivo considera marc://$oportunidade-migrar-componentes-da-ui-de-radix-para-base-ui-ed411583;
- `src/ui/thread-sessions-menu.tsx` já tem seções recolhíveis, e vale reaproveitar o mesmo padrão, para manter a consistência entre elementos equivalentes;
- antes da decisão de UI, uma maquete com as variantes.

**Estado:** registrada, não autorizada a começar.

<!-- /marc-message -->
