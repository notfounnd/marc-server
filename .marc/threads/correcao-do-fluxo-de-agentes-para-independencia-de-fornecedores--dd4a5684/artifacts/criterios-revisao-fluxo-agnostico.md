# Cenários de revisão documental

Estes são critérios manuais de leitura do fluxo, não testes executáveis nem verificação de modelos reais.

1. Trocar o cliente mantendo capacidades e reasoning confirmados não exige alterar o procedimento.
2. Trocar fornecedor ou família de modelo não exige encontrar nome em whitelist ou seguir links de fornecedores na regra.
3. Perfis cadastrados com IDs diferentes continuam válidos quando os papéis estão confirmados. A regra consulta o inventário e não presume prefixo.
4. Dois subagentes temporários no mesmo papel reutilizam o perfil persistente adequado, com identidade runtime na evidência quando necessária.
5. Reasoning usa controle ou nomenclatura diferente. O fluxo exige equivalência confirmada, não inventa campo de configuração nem assume correspondência por nome.
6. Configuração efetiva desconhecida exige humano antes da implementação. Confirmação humana pode estabelecer a configuração sem introspecção disponível.
7. Principal medium atende mínimo, high é recomendado. Desenvolvedor high atende mínimo, xhigh é recomendado. Nível abaixo do mínimo não é aceito silenciosamente.
8. Reasoning mais alto não compensa incapacidade do modelo para arquitetura, revisão ou implementação da tarefa.
9. Perfil de papel ausente ou ambíguo exige mapeamento confirmado pelo humano antes de administrar/publicar. O worker não cria um perfil por conta própria.
10. Atual cadastro e configuração permanecem como dados de atividade, sem rename, apagamento ou reescrita histórica.
11. Teto, override, modo sequencial atual, bootstrap independente, autorização explícita, handoff completo e loop de revisão continuam obrigatórios.
12. A política é do workspace e não configura automaticamente modelos, hooks ou ferramentas dos usuários do produto mARC.
