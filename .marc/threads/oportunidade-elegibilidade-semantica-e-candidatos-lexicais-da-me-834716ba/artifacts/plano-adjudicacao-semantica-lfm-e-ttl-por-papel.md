# Iteração adicional - adjudicação semântica com LFM e TTL por papel

## Contexto

A investigação confirmou que o segundo reranking de threads com mMARCO não generaliza. O mMARCO funciona bem ao pontuar passagens, mas se comporta de forma instável quando recebe uma representação agregada da thread. A etapa foi removida e o fluxo voltou a usar um único reranking de passagens seguido por fusão determinística no nível da thread.

O LFM2.5-350M já usado para interpretação de consulta pode ser reaproveitado depois da fusão. Contudo, ele não deve produzir pesos numéricos nem substituir o ranking inteiro. A tarefa será limitada a uma adjudicação semântica entre poucos candidatos.

## Decisões

- Manter E5 para recuperação vetorial.
- Manter mMARCO para reranking de passagens.
- Manter a fusão determinística como resultado padrão e fallback.
- Executar a adjudicação apenas quando os canais relevantes discordarem ou o resultado continuar sem elegibilidade suficiente.
- Entregar ao LFM no máximo três candidatos, cada um com título, identidade e melhor passagem.
- Exigir como saída apenas um índice permitido ou abstenção.
- Preservar integralmente o ranking determinístico se a saída for inválida, incerta ou se a inferência falhar.
- Não introduzir listas de termos, idiomas ou correções específicas.
- Não permitir que o modelo invente pesos ou candidatos fora do conjunto recuperado.

## Ciclo de vida dos modelos

O timeout atual é único e encerra qualquer worker após 30 segundos de ociosidade. A política será separada por papel:

- embedding: 30 segundos;
- reranking: 30 segundos;
- interpretation: 5 minutos.

Correção de consulta e adjudicação usarão o mesmo worker e a mesma instância carregada do LFM. Cada operação reiniciará o timeout. Dispose, purge e encerramento explícito continuarão liberando o processo imediatamente.

## Etapas

1. Criar testes para a política de timeout por papel.
2. Adaptar o gerenciador de inferência para resolver o timeout pelo papel sem alterar a fila e a exclusão mútua existentes.
3. Criar uma ação de protocolo específica para adjudicação.
4. Implementar prompt restrito, parser, guard e uma única repetição corretiva.
5. Criar uma interface própria para adjudicação, sem ampliar indevidamente o contrato de correção de typo.
6. Definir o gatilho estrutural de discordância entre canais.
7. Integrar a adjudicação antes da elegibilidade final, mantendo fallback determinístico.
8. Executar a bateria unitária e o harness com o modelo real.
9. Comparar métricas agregadas e invariantes por família de consultas.
10. Manter a adjudicação desligada do ranking de produção se houver regressão ou ganho não demonstrado.

## Critérios de aceite

- Buscas sequenciais dentro de cinco minutos reutilizam o LFM carregado.
- E5 e mMARCO continuam com retenção curta.
- O LFM nunca cria um candidato novo nem altera o corpus.
- Saída inválida, falha ou abstenção mantém o ranking anterior.
- Nenhuma família de qualidade existente regride.
- A ativação em produção exige evidência do harness com o modelo real.
- O fluxo mantém Markdown como fonte de verdade. Modelos, índices e resultados continuam derivados e descartáveis.
