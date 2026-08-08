# syntax=docker/dockerfile:1.6

# ---------- Stage 1: Builder (instala dependências e compila) ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copia arquivos de dependência primeiro para cachear a camada de npm install
COPY package*.json ./

# Instala dependências (inclui devDeps como vite, typescript etc.)
RUN npm ci

# Copia o restante do código (inclui src/, public/, vite.config, tsconfig etc.)
COPY . .

# Expõe as variáveis de build time (serão substituídas no build pelo compose).
# Valores vazios são seguros pois o push.ts e supabase.ts têm fallback.
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""

ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

# Build final do Vite (gera dist/)
RUN npm run build

# ---------- Stage 2: Runtime (nginx servindo dist/) ----------
FROM nginx:1.27-alpine AS runtime

# Remove configurações padrão do nginx (inclui a pasta html padrão e confs de exemplo)
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Configuração do nginx: SPA fallback (tudo cai no index.html) + cache de hashed assets
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia o build do Vite (dist/) para a raiz do nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Informa que o container expõe a porta 80 (Traefik vai se conectar nela)
EXPOSE 80

# Desativa qualquer HEALTHCHECK (de imagem/compose tem healthcheck; prefere Status = Running
HEALTHCHECK NONE

# nginx rodando em foreground (padrão da imagem)
CMD ["nginx", "-g", "daemon off;"]
