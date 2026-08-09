# Dockerfile de la aplicacion web (monorepo con workspaces de npm).
# Targets:
#   development -> servidor Vite con hot reload (usado por docker-compose.yml)
#   production  -> build estatico servido con nginx (usado por docker-compose.prod.yml)
#
# Build:
#   docker compose up --build            (desarrollo)
#   docker compose -f docker-compose.prod.yml up --build -d   (produccion)

# ---------- Base: dependencias del monorepo ----------
FROM node:22-alpine AS base
WORKDIR /app

# Se instala SOLO el workspace web (sin Expo/mobile, que no se usa aqui).
# No se copia el .npmrc del repo porque su legacy-peer-deps=true (necesario
# para Expo en local) hace que npm anide "react" bajo apps/web/node_modules
# en vez de hoistearlo, y rompe el build de produccion.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui-tokens/package.json packages/ui-tokens/package.json

RUN npm ci --workspace=apps/web

# ---------- Development ----------
FROM base AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev:web"]

# ---------- Build ----------
FROM base AS build
# Vite inyecta estas variables en el bundle en tiempo de build. En desarrollo
# se pasan en runtime; en produccion se pasan como build-args desde compose.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
COPY . .
RUN npm run build --workspace=apps/web

# ---------- Production ----------
FROM nginx:1.27-alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
