# 02 — Banco de dados

Fonte da verdade: [`prisma/schema.prisma`](../prisma/schema.prisma). Restrições adicionais
(`CHECK`) ficam nas migrações SQL em `prisma/migrations/`.

## Visão geral dos relacionamentos

```
                        ┌──────────────┐
                        │  Operation   │  Quiosque 1..5 · Online · Central
                        └──────┬───────┘
          ┌────────────────────┼──────────────────────────┐
          │                    │                          │
 ┌────────▼────────┐   ┌───────▼────────┐        ┌────────▼─────────┐
 │FinancialAccount │   │     Entry      │◄───────│     Category     │ (grupo DRE)
 │ caixa/banco/    │   │  competência   │◄───────│     Supplier     │
 │ maquininha      │   └───────┬────────┘        └──────────────────┘
 └───┬─────────▲───┘           │ 1..n
     │         │       ┌───────▼────────┐   ┌──────────────┐
     │         └───────│  Installment   │   │  Attachment  │◄── Entry
     │                 │     caixa      │   └──────────────┘
     │                 └────────────────┘
 ┌───▼──────┐
 │ Transfer │ conta → conta (não é receita/despesa)
 └──────────┘
```

## Tabelas implementadas (Etapas 2 e 3)

| Tabela | Função |
| --- | --- |
| `admin_users` | O único usuário (Val). Coluna `singleton` única impede um segundo cadastro. |
| `sessions` | Sessões ativas (hash do token, IP, navegador, expiração). |
| `recovery_codes` | Códigos de recuperação de uso único (hash). |
| `login_attempts` | Tentativas de login por IP (limite contra força bruta). |
| `audit_logs` | Registro de atividades importantes. |
| `operations` | Quiosques, online, central. Nome/endereço editáveis. |
| `financial_accounts` | Contas onde o dinheiro está (caixa, banco, maquininha) com saldo inicial. |
| `categories` | Categorias de entrada/saída, cada uma ligada a um grupo da DRE. |
| `suppliers` | Fornecedores. |
| `entries` | Lançamentos (competência). |
| `installments` | Parcelas (caixa): vencimento, liquidação, taxa, forma de pagamento, conta. |
| `transfers` | Transferências internas. |
| `attachments` | Comprovantes/documentos. |
| `period_closes` | Fechamentos mensais. |

## Tabelas planejadas (Etapa 4 em diante)

Estas tabelas serão criadas em migrações próprias, quando cada módulo for desenvolvido, para não
manter estruturas sem uso.

| Módulo | Tabelas | Ligação com o financeiro |
| --- | --- | --- |
| Quiosques | `kiosk_closings` (fechamento diário por quiosque e forma de pagamento) | Cada fechamento gera 1 lançamento `KIOSK_CLOSING` (chave única `kiosk_closing_id`). |
| Produtos | `products` (nome, preço de venda, ativo) | Itens de pedido. |
| CRM | `customers`, `customer_interactions` (canal, data, resumo, resultado), `quick_replies`, `opportunities` | Conversão = atendimentos que geraram pedido. |
| Pedidos | `orders`, `order_items`, `order_status_history`, `shipments` (Correios: rastreio; carro: entregador; excursão: identificação, previsão) | Pedido pago gera 1 lançamento `ORDER` (chave única `order_id`) — sem duplicidade. |
| Pessoas | `employees` (nome, função, operação, salário, dia de pagamento), `payroll_runs`, `payroll_items` | Cada pagamento gera lançamento `PAYROLL` no grupo Pessoal. |
| Compras/produção | `purchases`, `purchase_items`, `raw_materials` | Cada compra gera lançamento `PURCHASE` (Custos de produção) com parcelas = boletos. |

Para isso, `entries` receberá colunas opcionais e únicas (`order_id`, `kiosk_closing_id`,
`payroll_item_id`, `purchase_id`), garantindo no banco que cada documento de origem gere no máximo
um lançamento.

## Restrições de integridade (SQL)

- `entries.amount > 0`, `installments.amount > 0`, `installments.fee_amount >= 0`,
  `installments.fee_amount <= amount`, `transfers.amount > 0`.
- `transfers.from_account_id <> to_account_id`.
- Parcela liquidada exige `settled_at` (e pendente não pode tê-lo).
- `admin_users.singleton = true`.
- A soma das parcelas = valor do lançamento é garantida pelo serviço, dentro de transação, e coberta por testes.
