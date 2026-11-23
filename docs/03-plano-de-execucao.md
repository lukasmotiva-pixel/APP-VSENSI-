# 03 — Plano de execução

Cada etapa termina com o sistema funcionando, testado e versionado.

| Etapa | Conteúdo | Situação |
| --- | --- | --- |
| 1. Análise e planejamento | Arquitetura, banco, regras financeiras, pendências | ✅ Concluída |
| 2. Estrutura principal | Autenticação exclusiva, sessões, recuperação, auditoria, layout (celular e desktop), navegação, configurações (operações, contas, categorias, fornecedores, segurança), dashboard | ✅ Concluída |
| 3. Financeiro | Lançamentos com parcelas, contas a pagar/receber, liquidação, cancelamento, estornos, transferências, anexos, fechamento mensal, relatórios (DRE, fluxo de caixa, categorias, operações, comparativo mensal, saldos) | ✅ Concluída |
| 4a. Quiosques | Fechamento de caixa diário por quiosque, painel individual e comparativo | Próxima |
| 4b. Pedidos e entregas | Catálogo de produtos, pedidos, fluxo visual de status, Correios/carro/excursão, geração de lançamento ao confirmar pagamento | |
| 4c. CRM | Clientes, atendimentos, oportunidades, respostas rápidas, indicadores de conversão | |
| 4d. Pessoas | Funcionários, salários, folha mensal ligada ao financeiro | |
| 4e. Compras e produção | Fornecedores, compras de matéria-prima com boletos, custos de produção | |
| 5. Relatórios e integrações | Exportação PDF/Excel, indicadores gerenciais completos, pesquisa e (se viável) integração com APIs oficiais da Meta, plano de migração do Modal | |
| 6. Testes e entrega | Testes completos, revisão de segurança, Docker/implantação, manual de uso | |

## Critério de "concluído"

- Funcionalidade acessível pela interface no celular e no computador.
- Validação no servidor e mensagens de erro claras.
- Testes automatizados para as regras (cálculos e serviços) e fluxo ponta a ponta para o caminho principal.
- Registro de auditoria nas operações de escrita.
- Sem botões sem função e sem dados fictícios.
