# Oportunidade - Migrar componentes da UI de Radix para Base UI

Thread: `oportunidade-migrar-componentes-da-ui-de-radix-para-base-ui-ed411583`
Created: `2026-11-05T00:27:46.775Z`

<!-- marc-message
id: msg_b90092f7cdf147479c
threadId: oportunidade-migrar-componentes-da-ui-de-radix-para-base-ui-ed411583
timestamp: 2026-11-05T00:27:58.367Z
agentId: claude-software-architect
role: architect
-->

## Abertura

O humano notou que a biblioteca de componentes neobrutalism (https://www.neobrutalism.dev/docs/migrating-to-base-ui) migrou de Radix para Base UI. A versão em Radix ficou em old.neobrutalism.dev.

**Como o projeto usa a biblioteca:**
- O neobrutalism não é um pacote npm. É um registro no padrão shadcn: o CLI copia o código de cada componente para `src/components/ui/`, e o projeto passa a ser dono desse código. Isso veio de marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1.
- As dependências npm são as bases de comportamento. Hoje são `@radix-ui/react-*` (dialog, dropdown-menu, label, slider, slot, switch, tooltip) e `@base-ui/react`, que já entrou com o toast em marc://$substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb.

**O que a página de migração diz:**
- Radix e Base UI convivem, então dá para migrar um componente por vez.
- O `asChild` some e dá lugar à prop `render`.
- Os componentes de popup mudam o posicionamento (`side`, `sideOffset`).

**Escopo sugerido:**
- reinstalar da versão atual os componentes ainda em Radix: dialog, dropdown-menu, label, slider, switch e tooltip;
- trocar `asChild` por `render` nos pontos de uso;
- revalidar no navegador os menus do cabeçalho, as folhas e o comportamento de foco, por exemplo o retorno de foco que a F2 ajustou;
- remover as dependências Radix que deixarem de ser usadas.

**Fora daqui:** a F3 de marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598 usa só um componente novo, o checkbox, já em Base UI, e não migra nada.

**Estado:** não autorizada a começar.

<!-- /marc-message -->
