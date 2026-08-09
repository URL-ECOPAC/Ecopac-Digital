# Guia de inicio rapido - Ecopac Digital

Para el flujo completo de contribucion, ver [CONTRIBUTING.md](./CONTRIBUTING.md).

## Requisitos

- Docker (recomendado para la web)
- Node.js >= 20 y npm (alternativa sin Docker, y para la app movil)
- Git
- Cuenta de Supabase (opcional, para datos reales)

## Configurar variables de entorno

```bash
cp .env.example .env.development
```

Edita `.env.development` con los valores de Supabase (pidelos al PM). Si aun no tienes
Supabase configurado, el esqueleto corre igualmente con valores vacios.

## Secrets de GitHub Actions (CI/CD)

Los workflows de CI/CD leen los secrets desde **Settings > Secrets and variables > Actions**
del repositorio en GitHub. No van en ningun archivo del repo (solo `.env.example` con valores
vacios). Mientras no esten configurados, los workflows de Supabase se omiten y terminan en
verde, sin errores.

| Secret                       | Para que se usa               | De donde sale                                                           |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `VITE_SUPABASE_URL_DEV`      | Build de la web (CI)          | Proyecto Supabase `ecopac-dev`                                          |
| `VITE_SUPABASE_ANON_KEY_DEV` | Build de la web (CI)          | Proyecto Supabase `ecopac-dev`                                          |
| `SUPABASE_URL_DEV`           | Keep-alive de Supabase        | Proyecto Supabase `ecopac-dev`                                          |
| `SUPABASE_ANON_KEY_DEV`      | Keep-alive de Supabase        | Proyecto Supabase `ecopac-dev`                                          |
| `SUPABASE_ACCESS_TOKEN`      | CLI de Supabase (migraciones) | Panel de Supabase, Account > Access tokens                              |
| `SUPABASE_DB_PASSWORD`       | CLI de Supabase (migraciones) | Password de la base del proyecto                                        |
| `SUPABASE_PROJECT_REF_DEV`   | Migraciones en `develop`      | Project ref de `ecopac-dev` (parte de la URL del proyecto)              |
| `SUPABASE_PROJECT_REF_PROD`  | Migraciones en `main`         | Project ref de `ecopac-prod` (se configura al final, antes de entregar) |

Recomendacion: crear el proyecto `ecopac-dev` al inicio del Sprint 0 y configurar los secrets
de desarrollo. El proyecto de produccion (`ecopac-prod`) se crea cerca de la entrega final
(el plan gratuito de Supabase solo permite 2 proyectos).

## Ejecutar la web con Docker (recomendado)

```bash
npm run docker:dev
# o directamente: docker compose up --build
```

La web queda en http://localhost:5173 con hot reload.

Postgres local opcional para probar el esquema sin internet:

```bash
docker compose --profile db-local up
```

## Ejecutar sin Docker

```bash
npm install
npm run dev:web
# o: npm run dev --workspace=apps/web
```

La web queda en http://localhost:5173.

## Ejecutar la app movil

La app movil se corre con Expo en el dispositivo o emulador (no se necesita Docker):

```bash
npm install
npm run dev:mobile
```

Se abre el Expo development server en http://localhost:8081. Escanea el codigo QR con Expo
Go. Atajos: `a` para Android, `i` para iOS, `w` para web.

## Ejecutar en produccion (Docker)

```bash
cp .env.example .env.production
# llena las variables reales
npm run docker:prod
```

Compila la web y la sirve con nginx en http://localhost:80.

Nota: dev y prod usan project names distintos (`ecopac-dev` / `ecopac-prod`), asi que pueden
correr al mismo tiempo sin reemplazar sus contenedores.

## Comandos utiles

```bash
npm run lint              # linter de todos los workspaces
npm run build             # build de todos los workspaces
npm run dev:web           # web con hot reload
npm run dev:mobile        # expo (mobile)
```

## Estructura del proyecto

```
apps/
  web/         React + Vite (administracion)
  mobile/      React Native + Expo (campo)
packages/
  shared/      logica compartida sin JSX (API, validaciones, tipos, hooks)
  ui-tokens/   colores, tipografia y textos comunes
supabase/
  migrations/  esquema de base de datos versionado
  functions/   rutinas programadas (alertas de vencimiento)
docs/          documentacion, entregables y contexto para IA
.github/       plantillas de issues, PR, Projects y workflows
```

Regla de arquitectura: toda la logica que no es JSX/CSS vive en `packages/shared`. Las apps
solo la importan y la envuelven en componentes visuales.

## Flujo de trabajo en resumen

1. Obtener el numero del issue (ej. #42).
2. Crear rama desde `develop`:

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/<modulo>-<descripcion>
   ```

3. Commits con Conventional Commits: `feat(modulo): descripcion`.
4. Push y abrir PR hacia `develop` con `Closes #42`.
5. Esperar review y merge con squash.

Detalles en [CONTRIBUTING.md](./CONTRIBUTING.md).

## Errores comunes

- "Module not found: @ecopac/shared" -> verificar el alias en `apps/web/vite.config.js` y que
  `packages/shared` exista.
- Docker no levanta la web -> verificar que el puerto 5173 este libre y que `.env.development`
  exista (aunque sea con valores vacios).
- Agregue una dependencia y el container sigue usando la vieja -> el `node_modules` vive dentro
  de la imagen (no se monta desde el host), asi que despues de tocar `package.json` hay que
  rebuildar: `npm run docker:dev`. Si quedo un volumen anonimo de una configuracion anterior:
  `docker compose down -v` y levante de nuevo.
- Expo no abre -> reiniciar con `npm run dev:mobile` y luego `npm run dev:mobile -- --clear`.
- Las variables de entorno no cargan -> reiniciar el servidor despues de editar
  `.env.development`.

## Documentacion adicional

- [README.md](../README.md) - overview del proyecto
- [CONTRIBUTING.md](./CONTRIBUTING.md) - flujo de trabajo completo
- [AGENTS.md](../AGENTS.md) - contexto del repositorio para asistentes de IA
