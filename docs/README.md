# Documentacion - Ecopac Digital

Indice de la documentacion del repositorio. En esta carpeta viven las guias. Los archivos de
configuracion de GitHub (plantillas de issues, PR y los workflows de CI/CD) estan en
`.github/`.

## Para empezar

| Documento                            | Para que sirve                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- |
| [MANUAL-TECNICO.md](./MANUAL-TECNICO.md) | **Empezar aqui**: herramientas, requisitos, puesta en marcha, configuracion y claves, arquitectura, buenas practicas, base de datos y pantallas, con enlaces al detalle |
| [ARQUITECTURA.md](./ARQUITECTURA.md) | Que construye el sistema, en que piezas se divide y por que |
| [QUICKSTART.md](./QUICKSTART.md)     | Guia de inicio rapido: instalar y correr el proyecto (con y sin Docker) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Como contribuir: ramas, commits, PRs, issues y el tablero               |
| [DISENO.md](./DISENO.md)             | Referencia de diseno: pantallas, navegacion y trazabilidad con issues  |
| [DISENO-MOVIL.md](./DISENO-MOVIL.md) | Criterio de diseno de la app movil: reglas, fuentes y donde se aplicaron |
| [CI-CD.md](./CI-CD.md)               | Que valida y despliega cada workflow, y que hacer cuando falla         |
| [SEGURIDAD.md](./SEGURIDAD.md)       | Politica de contrasenas, expiracion de sesion, credenciales y observabilidad (errores, fallos de red, bitacora, respaldos) |
| [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md) | Lista de verificacion de lo que se configura a mano en el Dashboard de cada ambiente |
| [PROTECCION-DE-DATOS.md](./PROTECCION-DE-DATOS.md) | Logs, almacenamiento movil, cifrado de columnas y secretos (OWASP A02) |
| [MARCO-LEGAL.md](./MARCO-LEGAL.md) | Marco jurídico guatemalteco aplicable: obligaciones, riesgos, licencia, consentimiento, transferencia internacional y delimitación de responsabilidad del equipo de desarrollo |
| [formal/documentacion-tecnica.docx](./formal/documentacion-tecnica.docx) | Documento formal para quien no tiene acceso al repositorio (issue #867): permisos, modelo de datos, pantallas, conexion con Supabase, configuracion y herramientas, consolidados de los `.md` de esta carpeta |

## Referencia tecnica

| Documento                                              | Para que sirve                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| [DICCIONARIO-DE-DATOS.md](./DICCIONARIO-DE-DATOS.md)   | **Generado** (`npm run docs:diccionario`). Cada tabla con todos sus campos, tipos, llaves, restricciones, relaciones, politicas y triggers; diagramas entidad-relacion por modulo; vistas, enums y funciones |
| [PANTALLAS.md](./PANTALLAS.md)                         | **Generado** (`npm run docs:pantallas`). Las pantallas de la web y del movil y que tablas, vistas y funciones usa cada una |
| [MODELO-DE-DATOS.md](./MODELO-DE-DATOS.md)             | El porque del modelo: tablas, enums, funciones, vistas y politicas RLS |
| [MODULOS.md](./MODULOS.md)                             | Que pantalla existe, en que app, servida por que hook y en que estado |
| [API-SHARED.md](./API-SHARED.md)                       | Que exporta cada modulo de `packages/shared`                          |
| [ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md) | Como se comparte el frontend entre web y movil                        |
| [PERMISOS.md](./PERMISOS.md)                           | Quien puede hacer que en cada modulo, y donde esta escrito            |
| [SUPABASE.md](./SUPABASE.md)                           | Supabase en la nube contra el stack local, y como se sincronizan      |
| [DATOS-DEMO.md](./DATOS-DEMO.md)                       | Datos de prueba para desarrollo                                       |
| [PLAN-DE-PRUEBAS.md](./PLAN-DE-PRUEBAS.md)             | Los ocho tipos de prueba con su criterio de aprobacion, que mide la cobertura, politica de evidencias y riesgos al ejecutarlo |
| [CASOS-DE-PRUEBA.md](./CASOS-DE-PRUEBA.md)             | Cada caso de prueba vinculado a su requerimiento, y los requerimientos que no tienen ninguno |
| [CUMPLIMIENTO-DE-REQUERIMIENTOS.md](./CUMPLIMIENTO-DE-REQUERIMIENTOS.md) | Los 34 RF y 15 RNF: donde esta cada uno, que issues lo cubren, su evidencia y su estado (issue #253) |
| [evidencias/](./evidencias/)                           | Registro de cada ejecucion completa del plan, con fecha y commit      |

## Dependencias y Herramientas

| Documento                                    | Para que sirve                                                    |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [DEPENDENCIES.md](./DEPENDENCIES.md)         | Estrategia de versionado de paquetes, cuando actualizar y por que |
| [COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md) | Limites de las capas gratuitas, que se agota primero y que cuesta el siguiente escalon |

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

La vision completa esta en [ARQUITECTURA.md](./ARQUITECTURA.md); el detalle de la frontera, en
[ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md).
