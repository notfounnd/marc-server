# Oportunidade - memory_deep para aprofundamento em threads fechadas

Thread: marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae

Closed: `2026-10-15T14:57:22.277Z`

---

Oportunidade registrada para criar um `memory_deep`, uma busca aprofundada em `SUMMARY.md`, `CHAT.md`, artifacts e `RULES.md` de threads fechadas, com proveniência explícita. A thread foi encerrada como superada, sem desenvolvimento: o humano decidiu recomeçar o tema do zero em marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7, para não misturar contextos.

## O que continua válido

- **Regras:** só threads fechadas; Markdown como fonte da verdade; status sem carregar modelo.
- **Proveniência por trecho:** tipo de fonte, thread, mensagem, artifact, caminho e linhas.
- **Uso pelos agentes:** primeiro `memory_recall`, depois aprofundamento com escopo, sempre lendo a fonte original.
- **Avaliação:** as quatro consultas de avaliação desta proposta entram como casos do harness da E4.

## O que ficou desatualizado

- O modelo `paraphrase-multilingual-MiniLM`, que não é mais usado (decisão D8: E5-small, mMARCO MiniLM e LFM 350M).
- O parâmetro `minScore`, que foi removido dos contratos.
- A snapshot de índice separada e as três ferramentas próprias. A E4 usa o índice único por camadas das etapas E1 e E3 e uma única ferramenta `memory_deep`.

O plano da E4 tem uma tabela com cada diferença em relação a esta proposta. O humano autorizou o encerramento das threads legadas que não são mais necessárias.
