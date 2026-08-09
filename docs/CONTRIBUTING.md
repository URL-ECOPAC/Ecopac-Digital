# Guia de contribucion - Ecopac Digital

Esta guia define como el equipo trabaja en el proyecto: ramas, commits, pull requests,
issues y el tablero de GitHub Projects.

## Estrategia de ramas

Modelo Git Flow simplificado:

```
main (produccion)
  ^ PR aprobado
develop (integracion / staging)
  ^ PR requerida
feature/*, fix/*, chore/* (trabajo)
```

### Ramas principales

| Rama      | Proposito             | Proteccion                          |
| --------- | --------------------- | ----------------------------------- |
| `main`    | Produccion            | Requiere PR aprobado y checks de CI |
| `develop` | Integracion / staging | Requiere PR aprobado y checks de CI |

### Ramas de trabajo

```
feature/<modulo>-<descripcion>   # nueva funcionalidad
fix/<descripcion>                # correccion de bug
chore/<descripcion>              # tareas tecnicas (deps, config, docs)
```

Ejemplos validos:

- `feature/inventario-alertas-vencimiento`
- `feature/pacientes-registro-jornada`
- `fix/pacientes-busqueda-acentos`
- `chore/actualizar-dependencias`

Reglas:

1. Crear ramas desde `develop`, nunca desde `main`.
2. Nombres en minusculas, sin espacios, con guiones.
3. Una rama = un issue.
4. Eliminar la rama despues del merge.

## Flujo de trabajo

1. Crear una rama desde `develop`:

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/<modulo>-<descripcion>
   ```

2. Hacer commits con Conventional Commits:

   ```
   feat(modulo): descripcion breve

   Cuerpo opcional con detalles.

   Closes #42
   ```

   Tipos permitidos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`.

3. Abrir un Pull Request hacia `develop`, con la plantilla
   (`.github/pull_request_template.md`) y el issue enlazado con `Closes #X`.

4. Mergear con "Squash and merge" para mantener el historial de `develop` limpio, lo hace el PM. 

5. La promocion de `develop` a `main` la hace el PM cuando el entregable este listo.

## Pull Requests

Checklist antes de abrir un PR:

- [ ] El codigo pasa el linter: `npm run lint`
- [ ] El build funciona: `npm run build`
- [ ] Se agregaron tests si aplica
- [ ] Se actualizo la documentacion si aplica
- [ ] El PR referencia el issue con `Closes #X`

## Issues

Usar las plantillas de `.github/ISSUE_TEMPLATE/`:

| Plantilla               | Tipo                              | Label          |
| ----------------------- | --------------------------------- | -------------- |
| Bug                     | Reportar un error                 | `type:bug`     |
| Requerimiento Funcional | Nueva funcionalidad               | `type:feature` |
| Tarea Tecnica           | Infraestructura, refactor, config | `type:chore`   |

Los formularios piden modulo, prioridad y plataforma. Los labels usan la convencion:

- Tipo: `type:feature`, `type:bug`, `type:chore`, `type:docs`
- Modulo: `module:usuarios`, `module:pacientes`, `module:inventario`,
  `module:jornadas`, `module:donaciones`, `module:reportes`, `module:infra`
- Prioridad: `priority:alta`, `priority:media`, `priority:baja`
- Plataforma: `platform:web`, `platform:mobile`, `platform:shared`

## GitHub Projects

El tablero de GitHub Projects es un Kanban con las columnas: Backlog, Ready, In Progress,
In Review y Done, con vistas Backlog, Team items, Roadmap y My items. Flujo esperado:

1. Un issue nuevo entra a Backlog.
2. Cuando esta asignado pasa a Ready.
3. Al empezar a trabajarse pasa a In Progress.
4. Al abrir un PR que lo referencia pasa a In Review.
5. Al mergear pasa a Done y el issue se cierra.

## Seguridad de datos

- Los permisos de acceso se validan en las politicas RLS de Supabase, no solo en el
  frontend.
- Nunca se suben llaves reales al repositorio; solo `.env.example`.
