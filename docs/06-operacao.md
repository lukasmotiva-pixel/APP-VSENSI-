# 06 — Instalação, operação e backup

## Requisitos

- Node.js 22+
- PostgreSQL 16+
- Um servidor com HTTPS (obrigatório em produção: o cookie de sessão só trafega em HTTPS)

## Instalação

```bash
npm ci
cp .env.example .env          # ajuste DATABASE_URL, STORAGE_DIR
npm run db:deploy             # aplica as migrações
npm run admin:create          # cria o ÚNICO usuário (Val) + configurações padrão
npm run build
npm start                     # porta 3000 (use um proxy reverso com HTTPS à frente)
```

`admin:create` pergunta nome, e-mail e senha no terminal (a senha não aparece ao digitar).
O banco recusa um segundo usuário. Depois do primeiro login, gere os **códigos de recuperação**
em Configurações → Segurança e guarde-os fora do celular.

### Proxy reverso

Coloque a aplicação atrás de um proxy (Nginx, Caddy) com HTTPS. O proxy deve definir
`X-Forwarded-For` com o IP real do cliente — ele é usado no limite de tentativas de login e na
auditoria. Não exponha a porta 3000 diretamente.

## Recuperação de acesso

1. **Código de recuperação** (tela "Esqueci minha senha"): cada código vale uma vez; todas as sessões
   são encerradas.
2. **No servidor**: `npm run admin:reset-password`.

## Backup

```bash
DATABASE_URL=... STORAGE_DIR=./storage/uploads BACKUP_DIR=/var/backups/vsensi ./scripts/backup.sh
```

Gera `vsensi-db-<data>.dump` (pg_dump), `vsensi-anexos-<data>.tar.gz` e um arquivo de checksums,
mantendo 30 dias (`KEEP_DAYS`). Agendamento diário sugerido (crontab do servidor):

```
15 3 * * * cd /srv/vsensi && DATABASE_URL=... BACKUP_DIR=/var/backups/vsensi ./scripts/backup.sh >> /var/log/vsensi-backup.log 2>&1
```

**Importante:** copie os backups para fora do servidor (outro provedor/armazenamento), senão a perda
do servidor leva os backups junto. Teste a restauração periodicamente.

## Restauração

```bash
DATABASE_URL=... STORAGE_DIR=./storage/uploads ./scripts/restore.sh backups/vsensi-db-....dump backups/vsensi-anexos-....tar.gz
```

Pede confirmação digitada (`RESTAURAR`) e roda em transação única.

## Testes

```bash
npm test             # unitários + integração (usa TEST_DATABASE_URL — banco LIMPO a cada execução)
npm run build && npm run test:e2e   # navegador real, celular e desktop (usa E2E_DATABASE_URL)
```

Os testes recusam rodar em bancos cujo nome não contenha `test`/`e2e`.
