# 05 — Regras financeiras

Este documento define **o que cada número significa**. Toda tela e relatório segue estas definições.

## 1. Dois eixos: competência e caixa

Cada movimentação é registrada uma única vez como **lançamento** (`Entry`) e dividida em uma ou
mais **parcelas** (`Installment`).

```
Lançamento (competência: "o fato aconteceu")
 ├─ descrição, valor total, data de competência, categoria, operação, fornecedor
 └─ Parcelas (caixa: "o dinheiro entra/sai")
     ├─ parcela 1: vencimento, valor, taxa, forma de pagamento, conta, status, data de liquidação
     └─ parcela 2: ...
```

- Uma venda à vista no Pix é **1 lançamento com 1 parcela** já liquidada.
- Uma venda no crédito em 3x é **1 lançamento** (a venda) com **3 parcelas** a receber.
- Um boleto de matéria-prima em 2 vencimentos é **1 lançamento** com **2 parcelas** a pagar.

A soma das parcelas é sempre igual ao valor do lançamento (validado no servidor).
Por isso uma venda **nunca é contada duas vezes**: o faturamento lê o lançamento; os recebimentos
leem as parcelas. São visões diferentes do mesmo fato.

Quando os módulos de pedidos e quiosques chegarem, cada pedido/fechamento de caixa gerará **no
máximo um** lançamento vinculado (chave única no banco).

## 2. Definições

| Indicador | Definição | Eixo |
| --- | --- | --- |
| **Faturamento (receita bruta)** | Soma dos lançamentos de entrada com categoria do grupo *Vendas*, pela data de competência, exceto cancelados. Independe de já ter sido recebido. | Competência |
| **Deduções** | Estornos e devoluções (grupo *Deduções de vendas*). | Competência |
| **Taxas financeiras** | Taxas de cartão/maquininha informadas nas parcelas de entrada + lançamentos do grupo *Taxas financeiras*. | Competência |
| **Receita líquida** | Faturamento − deduções − taxas. | Competência |
| **Custos de produção** | Grupo *Custos de produção* (matérias-primas, embalagens, insumos...). | Competência |
| **Despesas** | Pessoal, operacionais, administrativas, impostos e outras. | Competência |
| **Resultado do período (lucro/prejuízo)** | Receita líquida − custos − despesas + outras receitas. | Competência |
| **Recebimentos** | Parcelas de entrada liquidadas, pela data de liquidação, pelo valor **líquido** (valor − taxa). | Caixa |
| **Pagamentos** | Parcelas de saída liquidadas, pela data de liquidação. | Caixa |
| **Saldo de caixa** | Saldo inicial da conta + recebimentos − pagamentos ± transferências. | Caixa |
| **Contas a receber / a pagar** | Parcelas pendentes. São **vencidas** quando o vencimento é anterior a hoje. | Caixa |

Itens que **não** entram no resultado, mas afetam o caixa:

- **Transferências internas** (ex.: caixa do quiosque → banco): só movem saldo entre contas.
- **Retiradas do proprietário** (grupo *Retiradas*): distribuição de resultado, não despesa.
- **Investimentos** (grupo *Investimentos*): equipamentos, reformas — exibidos à parte.

## 3. Lucro "calculado" × "estimado"

O resultado só é apresentado como **calculado** quando todos os meses do período foram
**fechados** pelo Val (Configurações → Fechamentos mensais) e não há pendências detectadas.
Caso contrário, aparece como **estimado**, com a lista do que falta, por exemplo:

- mês ainda não fechado;
- há faturamento, mas nenhum custo de produção lançado no mês;
- nenhuma despesa de pessoal lançada no mês;
- operação ativa sem nenhuma venda lançada no período.

Fechar um mês é uma declaração do Val de que os lançamentos daquele mês estão completos. Um mês
fechado pode ser reaberto (fica registrado na auditoria).

## 4. Operações

Toda movimentação pertence a uma operação: os quiosques, a operação online ou *Central /
administrativo* (despesas que não pertencem a uma única unidade). O resultado consolidado é a soma de
todas. Despesas centrais **não são rateadas** automaticamente entre as unidades (ver pendências).

## 5. Estornos e cancelamentos

- **Cancelar** um lançamento: ele deixa de contar em tudo, mas permanece no histórico (com motivo).
- **Estorno** de uma venda já realizada: novo lançamento de saída no grupo *Deduções de vendas*,
  opcionalmente vinculado à venda original. Reduz a receita líquida e registra a saída do dinheiro.
