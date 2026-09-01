FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Bun kur
RUN npm install -g bun

WORKDIR /app

# Bağımlılık dosyalarını kopyala
COPY package.json bun.lock* ./

# Build araçlarını kur (better-sqlite3 için gerekli)
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# Bağımlılıkları yükle
RUN bun install --frozen-lockfile

# Kaynak kodları kopyala
COPY . .

# Production build
RUN bun run build

# Veri dizinini oluştur
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
