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
| Quiosques (fechamento diário), Pedidos/entregas, CRM, Funcionários, Compras/produção | Próximas etapas |
| Exportação PDF/Excel, integrações Meta, migração do Modal | Etapa 5 |

## Documentação

- [Arquitetura e stack](docs/01-arquitetura.md)
- [Banco de dados](docs/02-banco-de-dados.md)
- [Plano de execução](docs/03-plano-de-execucao.md)
- [Pendências e perguntas para o Val](docs/04-pendencias-e-perguntas.md)
- [Regras financeiras](docs/05-regras-financeiras.md) — o que cada número significa
- [Instalação, operação e backup](docs/06-operacao.md)

## Desenvolvimento rápido

```bash
npm ci && cp .env.example .env
npm run db:migrate && npm run admin:create
npm run dev
```
