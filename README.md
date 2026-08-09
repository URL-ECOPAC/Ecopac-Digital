# Ecopac Digital

Ecosistema digital para Ecopac Guatemala, ONG dedicada a la ejecucion de jornadas medicas y
dentales gratuitas en comunidades rurales vulnerables de Quetzaltenango. El sistema digitaliza
el registro de pacientes, el control de inventario de medicamentos y la planificacion de
jornadas, reemplazando el proceso actual basado en papel y WhatsApp.

Proyecto desarrollado para el curso de Proyectos de Ingenieria en Informatica y Sistemas,
Universidad Rafael Landivar, Campus de Quetzaltenango.

## Modulos

1. Gestion de Pacientes e Historiales: expediente clinico, triaje, consulta medica y recetas.
2. Gestion de Recursos y Finanzas: inventario, lotes, alertas de vencimiento y donaciones.
3. Gestion de Jornadas y Voluntariado: planificacion con tablero Kanban y asignacion de
   personal.
4. Gestion de Proyectos y Reportes: indicadores de impacto para sostenibilidad y donantes.

## Stack tecnologico

| Componente               | Tecnologia          |
| ------------------------ | ------------------- |
| Web (administracion)     | React + Vite        |
| Movil (campo)            | React Native + Expo |
| Backend / Auth / Storage | Supabase            |
| Base de datos            | PostgreSQL          |
| Hosting web              | Vercel              |
| CI/CD                    | GitHub Actions      |

## Estructura del repositorio

```
apps/
  web/        Aplicacion React + Vite (panel de administracion)
  mobile/     Aplicacion React Native + Expo (operaciones en campo)
packages/
  shared/     Logica de negocio compartida sin JSX (API, validaciones, tipos, hooks)
  ui-tokens/  Colores, tipografia y textos comunes
supabase/
  migrations/ Esquema de base de datos versionado
  functions/  Rutinas programadas (alertas de vencimiento)
docs/         Documentacion, entregables y contexto para IA
.github/      Plantillas de issues, PR, GitHub Projects y workflows de CI/CD
scripts/      Scripts de soporte del equipo
```

Regla de arquitectura: toda la logica que no es JSX/CSS vive en `packages/shared`. Las apps
`web` y `mobile` solo importan esa logica y la envuelven en componentes visuales.

## Ambientes

| Ambiente             | Rama    | Donde                                  |
| -------------------- | ------- | -------------------------------------- |
| Desarrollo / Staging | develop | Supabase `ecopac-dev` + Vercel Preview |
| Produccion           | main    | Supabase `ecopac-prod` + Vercel (main) |

Las variables de entorno se copian desde `.env.example` a `.env.development` o
`.env.production`. Nunca se suben llaves reales al repositorio.

## Inicio rapido

### Con Docker

```bash
cp .env.example .env.development
npm run docker:dev
```

La web queda en http://localhost:5173. Para produccion: `npm run docker:prod`.

### Sin Docker

```bash
npm install
cp .env.example .env.development
npm run dev:web
```

### App movil

```bash
npm install
npm run dev:mobile
```

## Estrategia de ramas

```
main (produccion)
  ^ PR aprobado
develop (integracion / staging)
  ^ PR requerida
feature/*, fix/*, chore/* (trabajo)
```

Una rama por issue, PRs hacia `develop` con "Closes #X", merge con squash.

## Documentacion

| Documento                                                                          | Para que sirve                                     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| [docs/README.md](./docs/README.md)                                                 | Indice de documentacion                            |
| [docs/QUICKSTART.md](./docs/QUICKSTART.md)                                         | Guia de inicio rapido                              |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)                                     | Guia de contribucion (ramas, commits, PRs, issues) |
| [AGENTS.md](./AGENTS.md)                                                           | Contexto del repositorio para asistentes de IA     |

## Links utiles

- [GitHub Issues](https://github.com/LisAY22/Ecopac-Digital/issues) - trabajo pendiente
- [GitHub Projects](https://github.com/LisAY22/Ecopac-Digital/projects) - tablero y sprints
