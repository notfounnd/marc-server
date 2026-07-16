# Oportunidade - Rebuild incremental e batches limitados da memory

Thread: `oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682`
Created: `2026-07-16T19:22:10.120Z`

<!-- marc-message
id: msg_4e7fff05247e491e8d
threadId: oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
timestamp: 2026-07-16T19:24:00.187Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-rebuild-incremental-e-batches-limitados.md
-->

Oportunidade registrada para tornar a manutencao da memory incremental e segura em memoria.

O anexo consolida:

- o diagnostico do pico de 2,67 GiB no ONNX Runtime
- batches limitados com um unico batch de inferencia em voo
- reconciliacao incremental como fluxo normal
- rebuild completo manual usando o mesmo executor
- consistencia, locks, testes e criterios de aceite

A oportunidade reune os dois mecanismos em uma unica entrega. Nenhum desenvolvimento foi iniciado.

<!-- /marc-message -->
