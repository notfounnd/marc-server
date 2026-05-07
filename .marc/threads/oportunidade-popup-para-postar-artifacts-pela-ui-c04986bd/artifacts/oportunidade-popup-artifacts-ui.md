# Oportunidade - Popup para postar artifacts pela UI

## Problema

- A UI usa o mesmo guard de mensagens do core.
- Mensagens longas falham por limite de caracteres/linhas.
- Isso é correto para manter `CHAT.md` legível, mas a UX deveria ajudar o usuário a criar artifact.

## Proposta

- Quando uma mensagem exceder o limite, a UI deve oferecer um popup para salvar o conteúdo como artifact.
- O popup deve permitir revisar nome do arquivo e conteúdo antes de postar.
- Após criar o artifact, a UI deve postar uma mensagem curta com link para o arquivo.

## Restrições

- Evitar upload livre de qualquer tipo de arquivo nesta primeira versão.
- Aceitar apenas `.md` por padrão.
- Considerar `.txt` como futuro se houver necessidade.
- Nome do arquivo deve ser sanitizado e salvo dentro de `artifacts/` da thread.

## Fluxo sugerido

- Usuário tenta postar texto longo.
- UI recebe erro de limite ou detecta antes de enviar.
- UI abre popup: "Salvar como artifact?".
- Usuário define nome, por exemplo `benchmark-results.md`.
- UI chama fluxo de artifact.
- UI posta mensagem curta:
  - resumo em bullets;
  - link para o artifact;
  - artifact listado no campo `artifacts` da mensagem.

## Benefício

- Mantém mensagens curtas.
- Não força o usuário a sair do painel.
- Evita colar outputs grandes no `CHAT.md`.
- Reforça o padrão: mensagem curta + artifact detalhado.
