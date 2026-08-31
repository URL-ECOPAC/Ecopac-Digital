# Documentacion - Ecopac Digital

Indice de la documentacion del repositorio. En esta carpeta viven las guias. Los archivos de
configuracion de GitHub (plantillas de issues, PR y los workflows de CI/CD) estan en
`.github/`.

## Para empezar

| Documento                            | Para que sirve                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- |
| [QUICKSTART.md](./QUICKSTART.md)     | Guia de inicio rapido: instalar y correr el proyecto (con y sin Docker) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Como contribuir: ramas, commits, PRs, issues y el tablero               |
| [DISENO.md](./DISENO.md)             | Referencia de diseno: pantallas, navegacion y trazabilidad con issues  |
| [ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md) | Como se comparte el frontend entre web y movil        |
| [CI-CD.md](./CI-CD.md)               | Que valida y despliega cada workflow, y que hacer cuando falla         |
| [SEGURIDAD.md](./SEGURIDAD.md)       | Politica de contrasenas, expiracion de sesion y almacenamiento de credenciales |
| [PROTECCION-DE-DATOS.md](./PROTECCION-DE-DATOS.md) | Logs, almacenamiento movil, cifrado de columnas y secretos (OWASP A02) |
| [PERMISOS.md](./PERMISOS.md)         | Quien puede hacer que en cada modulo, y donde esta escrito                     |

## Dependencias y Herramientas

| Documento                            | Para que sirve                                                    |
| ------------------------------------ | ----------------------------------------------------------------- |
| [DEPENDENCIES.md](./DEPENDENCIES.md) | Estrategia de versionado de paquetes, cuando actualizar y por que |

## Contexto para asistentes de IA

- [AGENTS.md](../AGENTS.md) - contexto del repositorio para opencode, GitHub Copilot,
  Claude Code, Cursor, etc.

## Configuracion de GitHub

| Archivo                                                                 | Para que sirve                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [.github/pull_request_template.md](../.github/pull_request_template.md) | Plantilla de Pull Requests                                         |
| [.github/ISSUE_TEMPLATE/](../.github/ISSUE_TEMPLATE/)                   | Plantillas de issues (Bug, Requerimiento Funcional, Tarea Tecnica) |
| [.github/workflows/](../.github/workflows/)                             | CI/CD: lint + build, migraciones de Supabase y keep-alive          |

Tablero de GitHub Projects: Kanban con columnas Backlog, Ready, In Progress, In Review y
Done, con vistas Backlog, Team items, Roadmap y My items. El flujo esperado esta descrito en
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Regla de arquitectura

Todo lo que no es JSX/CSS vive en `packages/shared` (llamadas a Supabase, validaciones,
reglas de negocio). Las apps `web` y `mobile` solo importan esa logica y la envuelven en
componentes visuales. Asi se evita duplicar codigo entre plataformas.
