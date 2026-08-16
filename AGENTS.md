# AGENTS.md - Contexto del repositorio para asistentes de IA

Este archivo es leido por asistentes de codigo (opencode, GitHub Copilot, Claude Code,
Cursor, etc.) para entender el repositorio. Si un agente necesita mas contexto, debe leer los
documentos enlazados al final.

## Proyecto

Ecopac Digital es un ecosistema digital para Ecopac Guatemala, ONG que ejecuta jornadas
medicas y dentales gratuitas en comunidades rurales. El sistema digitaliza
el registro de pacientes, el inventario de medicamentos y la planificacion de jornadas,
reemplazando el proceso actual basado en papel y WhatsApp.

## Estructura del monorepo

```
apps/
  web/        Aplicacion React + Vite (panel de administracion)
  mobile/     Aplicacion React Native + Expo (operaciones en campo)
packages/
  shared/     Logica de negocio compartida sin JSX (API, validaciones, tipos, hooks)
  ui-tokens/  Diseño tokens: colores, tipografía y textos comunes
supabase/
  migrations/ Esquema de base de datos versionado (SQL)
  functions/  Rutinas programadas (alertas de vencimiento)
docs/         Documentacion, entregables y contexto del curso
scripts/      Scripts de soporte del equipo
.github/      Plantillas de issues, PR, GitHub Projects y workflows de CI/CD
```

## Regla de arquitectura clave

El frontend se escribe una sola vez y se reutiliza en las dos plataformas. La regla completa
esta en `docs/ARQUITECTURA-FRONTEND.md` y es de lectura obligatoria antes de tocar `apps/` o
`packages/shared`. En resumen:

> Una pantalla es **un hook y unos descriptores en `packages/shared`**, mas **un componente por
> app**.

En `packages/shared/<modulo>/` van `api.js`, `validaciones.js`, `campos.js` (esquema de
formulario), `columnas.js` (columnas de tabla y campos de tarjeta), `filtros.js`, `permisos.js`
y un `use<Pantalla>.js` por pantalla. Las apps solo renderizan eso: web con `react-bootstrap`,
movil con los componentes de `apps/mobile/src/components/`. `packages/shared/pacientes/` es el
ejemplar de referencia.

Ambas apps implementan el **mismo catalogo de componentes con las mismas props**
(`FilterBar`, `DataList`, `TextField`, `StatusChip`, ...), de modo que portar una pantalla de
web a movil sea mecanico.

Restricciones:

- `packages/shared` no puede importar `react-dom`, `react-native` ni `react-bootstrap`, ni usar
  `document`, `window`, `localStorage` o `AsyncStorage`, ni devolver JSX.
- `apps/web` y `apps/mobile` no pueden importar `@supabase/supabase-js` directamente, ni
  escribir validaciones, formateo, reglas de negocio o decisiones de permisos dentro de un
  componente.
- Ningun color, espaciado ni tamano de fuente se escribe a mano: todo sale de
  `@ecopac/ui-tokens`. En la web se consumen como `var(--color-*)`, publicadas por
  `apps/web/src/theme.js`.
- No importar componentes UI de `web` en `mobile` ni viceversa.
- Los roles nunca se escriben como string suelto: se usan los de
  `packages/shared/usuarios/roles.js`, que replican el enum `rol_usuario` de la migracion 00001.
- La app movil usa Expo v57.0.0: leer la documentacion versionada
  https://docs.expo.dev/versions/v57.0.0/ antes de escribir codigo movil (ver
  `apps/mobile/AGENTS.md`).

## Fuente de verdad

Cuando el codigo, la documentacion y la base de datos no coincidan, manda **lo que ya esta en
`supabase/migrations/`**. Las migraciones aplicadas no se editan: los cambios entran como una
migracion nueva.

## Stack

| Componente               | Tecnologia          |
| ------------------------ | ------------------- |
| Web                      | React + Vite        |
| Movil                    | React Native + Expo |
| Backend / Auth / Storage | Supabase            |
| Base de datos            | PostgreSQL          |
| Hosting web              | Vercel              |
| CI/CD                    | GitHub Actions      |

## Ambientes

| Ambiente             | Rama    | Donde                                  |
| -------------------- | ------- | -------------------------------------- |
| Desarrollo / Staging | develop | Supabase `ecopac-dev` + Vercel Preview |
| Produccion           | main    | Supabase `ecopac-prod` + Vercel (main) |

Las variables de entorno se copian desde `.env.example` a `.env.development` o
`.env.production`. Nunca se suben llaves reales al repositorio.

Los secrets del CI/CD se configuran en GitHub (Settings > Secrets and variables > Actions) y
los nombres que usan los workflows estan documentados en `docs/QUICKSTART.md`. Mientras no
esten configurados, los workflows de Supabase se omiten y terminan en verde (no fallan).

## Comandos

### Local (sin Docker)

```bash
npm install
cp .env.example .env.development
npm run dev:web        # web en http://localhost:5173
npm run dev:mobile     # Expo, mobile en http://localhost:8081
npm run lint
npm run build
```

### Docker

```bash
npm run docker:dev     # o: docker compose up --build
npm run docker:prod    # o: docker compose -f docker-compose.prod.yml up --build -d
```

## Flujo de trabajo con Git

Ramas:

- `main` -> produccion (solo se mergea desde `develop` con PR aprobado).
- `develop` -> integracion / staging. Es la rama base para todo trabajo nuevo.
- `feature/<modulo>-<descripcion>` para nueva funcionalidad.
- `fix/<descripcion>` para correcciones.
- `chore/<descripcion>` para tareas tecnicas.

Reglas:

1. Una rama por issue.
2. Crear ramas desde `develop`, nunca desde `main`.
3. Los PRs van hacia `develop` y referencian el issue con "Closes #X".
4. Merge con squash and merge para mantener historial limpio.

Commits (Conventional Commits):

- `feat(modulo): descripcion`
- `fix(modulo): descripcion`
- `chore: descripcion`
- `docs: descripcion`
- `refactor(modulo): descripcion`

## Issues, PRs y GitHub Projects

- Las plantillas de issues estan en `.github/ISSUE_TEMPLATE/` (Bug, Requerimiento Funcional,
  Tarea Tecnica). Los labels usan la convencion `type:*`, `module:*`, `priority:*`,
  `platform:*`.
- La plantilla de PR esta en `.github/pull_request_template.md`.
- El tablero de GitHub Projects es un Kanban con columnas Backlog, Ready, In Progress,
  In Review y Done, y vistas Backlog, Team items, Roadmap y My items.
- Los workflows de CI/CD estan en `.github/workflows/`.

## Convenciones de codigo

- Componentes en PascalCase; hooks con prefijo `use` en camelCase; carpetas en kebab-case.
- Tablas y columnas en PostgreSQL en snake_case.
- ESLint + Prettier a nivel de monorepo.
- No usar datos reales de pacientes en pruebas ni en logs (regla de confidencialidad).
- No usar emojis en codigo, descripciones, mensajes de commit, issues ni PRs.

## Documentacion de referencia

- `docs/README.md` - indice de documentacion.
- `docs/QUICKSTART.md` - guia de inicio rapido.
- `docs/CONTRIBUTING.md` - guia de contribucion.
- `docs/entregables/` - PDFs de entregables del curso.
