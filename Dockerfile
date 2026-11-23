# Imagem de produção do V'Sensi Gestão
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
# O build não acessa o banco; a URL abaixo é apenas um valor sintático.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build
# As dependências completas são mantidas: o Prisma CLI (migrações) e o tsx (scripts de
# administração, ex.: npm run admin:create) são necessários em produção.

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates postgresql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 STORAGE_DIR=/app/storage/uploads
COPY --from=build --chown=node:node /app ./
RUN mkdir -p /app/storage/uploads && chown -R node:node /app/storage
USER node
EXPOSE 3000
# Aplica migrações pendentes e inicia o servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000 -H 0.0.0.0"]
