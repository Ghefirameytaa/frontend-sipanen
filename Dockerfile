# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Alamat API untuk pemakaian di sisi PERAMBAN (belum dipakai saat ini).
#
# Variabel import.meta.env.PUBLIC_* disubstitusi secara statis oleh Vite ketika
# `npm run build` dijalankan, sehingga nilai ini tidak dapat diubah saat
# runtime. Karena itu ia hanya dipakai untuk hal yang memang harus diketahui
# peramban, dan alamatnya harus dapat dijangkau dari komputer pengguna.
#
# Alamat yang benar-benar dipakai dashboard ada di API_BASE_URL (lihat bawah),
# karena seluruh pengambilan data berjalan di sisi server.
ARG PUBLIC_API_BASE_URL=http://localhost:3000/api
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL

# Cache npm dependencies
COPY package*.json ./
RUN npm install

# Build
COPY . .
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Only copy built output + production deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

ENV HOST=0.0.0.0
ENV PORT=4321

# Alamat backend yang dipakai saat halaman dirender di server.
#
# Dibaca saat RUNTIME, bukan disematkan saat build, sehingga satu image yang
# sama dapat dipakai untuk beberapa lingkungan tanpa dibangun ulang.
# Di dalam Docker Compose, nama service dipakai sebagai nama host; "localhost"
# di sini akan menunjuk ke container frontend sendiri dan gagal tersambung.
ENV API_BASE_URL=http://backend-go:3000/api

EXPOSE 4321

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/ || exit 1

CMD ["node", "./dist/server/entry.mjs"]
