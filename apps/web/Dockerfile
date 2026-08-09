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

# Copia .npmrc para que npm ci use la misma configuracion que en local
# (legacy-peer-deps=true) y los package.json de todos los workspaces para
# que "npm ci" instale el grafo completo.
COPY .npmrc ./
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui-tokens/package.json packages/ui-tokens/package.json

RUN npm ci

# ---------- Development ----------
FROM base AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev:web"]

# ---------- Build ----------
FROM base AS build
COPY . .
RUN npm run build --workspace=apps/web

# ---------- Production ----------
FROM nginx:1.27-alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
