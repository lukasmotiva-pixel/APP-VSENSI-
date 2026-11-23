# 01 — Análise e arquitetura

## 1. Situação encontrada

O repositório estava vazio (apenas um `README.md`). Não havia código, banco de dados ou
decisões técnicas anteriores a preservar. Por isso a stack foi escolhida do zero, considerando:

- um único usuário (Val), com uso principal pelo celular;
- dados financeiros sensíveis, que exigem consistência transacional;
- muitos relacionamentos entre entidades (vendas, recebimentos, pedidos, despesas, quiosques,
  funcionários, fornecedores) → banco **relacional**;
- crescimento por módulos, sem reescrever a base.

## 2. Stack escolhida

| Camada | Tecnologia | Por quê |
| --- | --- | --- |
| Aplicação web | **Next.js 15 (App Router) + React 19 + TypeScript** | Front-end e back-end no mesmo projeto, renderização no servidor (rápida no celular), Server Actions para formulários sem expor uma API pública. |
| Estilo | **Tailwind CSS 4** + componentes próprios | Interface consistente, leve, sem dependência de kit visual genérico. |
| Banco de dados | **PostgreSQL 16** | Relacional, transações ACID, `CHECK constraints`, tipos de data sem fuso. |
| ORM / migrações | **Prisma 6** | Tipagem ponta a ponta e migrações versionadas no Git. |
| Validação | **Zod** | Mesmos esquemas validam formulários e regras no servidor. |
| Senhas | **Argon2id** (`@node-rs/argon2`) | Algoritmo de hash recomendado pela OWASP para senhas. |
| Gráficos | **Recharts** | Gráficos responsivos em SVG. |
| Testes | **Vitest** (unidade e integração com banco real) + **Playwright** (ponta a ponta, celular e desktop) | |

Não foi adotado serviço de autenticação de terceiros: com um único usuário, autenticação própria
com sessões no banco é mais simples, auditável e não depende de contas externas.

## 3. Organização do código

```
prisma/              schema, migrações e seed (apenas configurações padrão, nunca dados de negócio)
scripts/             criação do administrador, redefinição de senha, backup e restauração
src/
  app/
    (auth)/          login e recuperação de acesso (rotas públicas)
    (app)/           área protegida — cada módulo em sua pasta (financeiro, configuracoes, ...)
    api/             apenas rotas que não cabem em Server Actions (download de anexos)
  components/
    ui/              botões, campos, cartões, tabelas responsivas, badges...
    layout/          menu lateral (desktop), barra inferior (celular), filtro de período
  lib/               infraestrutura: banco, sessão, senha, auditoria, dinheiro, datas, armazenamento
  modules/
    finance/         regras financeiras (cálculos puros, consultas, serviços, ações)
    settings/        operações, categorias, contas, fornecedores, segurança
    ...              (quiosques, pedidos, crm, pessoas, compras entram nas próximas etapas)
tests/
  unit/              cálculos e utilitários sem banco
  integration/       serviços contra um PostgreSQL de teste
  e2e/               fluxos reais no navegador (celular e desktop)
docs/                esta documentação
```

Regras de dependência:

- `app/` (telas) chama apenas `modules/*/actions` e `modules/*/queries`.
- `modules/*/service` concentra regras de escrita; sempre valida com Zod e grava em transação.
- `modules/*/calculations` contém funções puras (sem banco), testadas isoladamente.
- Toda ação de escrita chama `requireAdmin()` no servidor — o middleware sozinho não é a proteção.

## 4. Segurança

| Requisito | Implementação |
| --- | --- |
| Acesso exclusivo do Val | Tabela `AdminUser` com coluna `singleton` única: o banco **não aceita** um segundo usuário. Não existe tela de cadastro; o administrador é criado por script no servidor. |
| Senha | Argon2id; mínimo de 12 caracteres. |
| Sessão | Token aleatório de 256 bits em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção. O banco guarda apenas o hash SHA-256 do token. Expira por inatividade (7 dias) e por tempo absoluto (30 dias). Val pode ver e encerrar sessões. |
| Força bruta | Bloqueio da conta após 5 falhas seguidas (15 min) e limite por IP. Mensagem de erro genérica. |
| Recuperação de senha | Códigos de recuperação de uso único (guardados com hash) gerados pelo Val, e script de redefinição no servidor. Recuperação por e-mail depende de um serviço SMTP — ver pendências. |
| Proteção de rotas | Middleware redireciona quem não tem cookie; layout protegido e cada Server Action validam a sessão no banco. |
| Validação | Zod no servidor em todas as escritas; restrições `CHECK` no banco (valores positivos, etc.). |
| Auditoria | Tabela `AuditLog` com login, falhas, logout, troca de senha e toda criação/edição/exclusão financeira. |
| Anexos | Tipos permitidos (PDF, JPG, PNG, WEBP), limite de tamanho, nome aleatório em disco, download apenas autenticado. |
| Cabeçalhos HTTP | `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS em produção. |
| Backup | `scripts/backup.sh` (pg_dump + anexos, com rotação) e `scripts/restore.sh`. Ver `docs/06-operacao.md`. |

## 5. Datas, fuso e dinheiro

- **Dinheiro** é armazenado em **centavos inteiros** (`Int`). Nenhum cálculo financeiro usa ponto flutuante.
- **Datas de negócio** (competência, vencimento, pagamento) usam o tipo `DATE` do PostgreSQL, sem hora
  e sem fuso. "Hoje" é sempre calculado no fuso `America/Sao_Paulo`.
- "Vencido" **não é gravado**: é derivado (pendente + vencimento anterior a hoje), para nunca ficar desatualizado.

## 6. Integrações externas

As integrações com WhatsApp/Instagram (APIs oficiais da Meta) e a migração do Modal serão
**investigadas na etapa do módulo de CRM**, com verificação das documentações oficiais, requisitos e
custos reais. Nada será simulado: enquanto não houver integração, o registro será manual.
