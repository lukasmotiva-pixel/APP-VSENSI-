# 04 — Pendências e perguntas para o Val

Nenhuma destas questões bloqueia o desenvolvimento: onde possível, o sistema usa configurações
editáveis. As respostas melhoram a precisão dos números.

## Financeiro

1. **Saldos iniciais**: a partir de qual data o sistema passará a ser a referência, e quais os saldos
   de cada conta (bancos, caixas dos quiosques, maquininhas) nessa data?
2. **Maquininhas e taxas**: quais adquirentes são usadas (e em quais quiosques) e quais as taxas de
   débito, crédito à vista, crédito parcelado e Pix? Hoje a taxa é informada em cada parcela; com essas
   informações dá para preencher automaticamente.
3. **Prazo de recebimento do cartão**: as vendas no crédito caem em D+1, D+30 ou parceladas?
4. **Despesas centrais**: aluguel do escritório, contador etc. devem ser **rateadas** entre os quiosques
   e o online para medir o resultado de cada um? Se sim, por qual critério (igual, % do faturamento)?
   Por enquanto ficam na operação *Central* e entram só no consolidado.
5. **Impostos**: qual o regime tributário (MEI, Simples Nacional, outro)? Permite estimar o imposto
   sobre o faturamento.
6. **Retiradas do Val / pró-labore**: devem ser tratadas como despesa de pessoal (pró-labore) ou como
   retirada de lucro? O sistema tem as duas categorias.
7. **Histórico**: há dados anteriores (planilhas, cadernos) que precisam ser importados?

## Quiosques

8. Nomes e endereços dos 5 quiosques (cadastráveis em Configurações → Operações).
9. Como as vendas dos quiosques são registradas hoje? Existe PDV/sistema de caixa, ou anotação
   manual? Isso define se o registro será por **fechamento diário** (total por forma de pagamento) ou
   venda a venda.

## Online, pedidos e CRM

10. Qual é exatamente o "Modal" (site/link, fornecedor, plano contratado)? Ele oferece exportação
    (CSV/Excel) ou API?
11. O WhatsApp da empresa usa o **WhatsApp Business (aplicativo)** ou a **API oficial**? O Instagram é
    conta profissional ligada a uma Página do Facebook? Existe conta no Meta Business Manager verificada?
12. Existe uma lista de produtos com preços (catálogo) para usar nos pedidos?

## Infraestrutura

13. Onde o sistema será hospedado (VPS própria, provedor em nuvem)? Haverá domínio próprio?
14. Qual e-mail o Val quer usar para recuperação de acesso? Haverá serviço de envio de e-mail (SMTP)?
    Sem isso, a recuperação é feita por **códigos de recuperação** e por script no servidor.
