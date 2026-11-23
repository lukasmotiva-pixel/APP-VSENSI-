# V'Sensi Gestão

Plataforma de gestão empresarial da V'Sensi — financeiro, quiosques, operação online e resultados,
com acesso exclusivo do proprietário.

## Situação

| Módulo | Estado |
| --- | --- |
| Autenticação exclusiva, sessões, recuperação, auditoria | ✅ |
| Layout celular (barra inferior) e desktop (menu lateral) | ✅ |
| Dashboard financeiro com filtros de período | ✅ |
| Financeiro: lançamentos, parcelas, a pagar/receber, baixas, estornos, transferências, anexos, saldos, fechamento mensal | ✅ |
| Relatórios financeiros: DRE, por operação, fluxo de caixa, categorias, formas de pagamento, comparativo mensal | ✅ |
| Configurações: operações, contas, categorias, fornecedores, segurança | ✅ |
| Quiosques: fechamento de caixa diário, painel individual e comparativo | ✅ |
| Pedidos: fluxo de 8 etapas, entregas (Correios/carro/excursão), venda automática no financeiro | ✅ |
| Atendimento (CRM): clientes, atendimentos, oportunidades, respostas rápidas, conversão | ✅ |
| Pessoas: funcionários, salários, geração da folha mensal | ✅ |
| Compras e produção: custos por fornecedor/categoria, boletos, custo × faturamento | ✅ |
| Exportação Excel (lançamentos) e PDF (impressão dos relatórios) | ✅ |
| App instalável no celular (PWA) e implantação com Docker | ✅ |
| Integração WhatsApp/Instagram (APIs Meta) e migração do Modal | Aguardando contas/informações — ver [docs/07](docs/07-integracoes.md) |

## Documentação

- [Arquitetura e stack](docs/01-arquitetura.md)
- [Banco de dados](docs/02-banco-de-dados.md)
- [Plano de execução](docs/03-plano-de-execucao.md)
- [Pendências e perguntas para o Val](docs/04-pendencias-e-perguntas.md)
- [Regras financeiras](docs/05-regras-financeiras.md) — o que cada número significa
- [Instalação, operação, backup e instalação no celular](docs/06-operacao.md)
- [Integrações externas e migração do Modal](docs/07-integracoes.md)

## Desenvolvimento rápido

```bash
npm ci && cp .env.example .env
npm run db:migrate && npm run admin:create
npm run dev
```
