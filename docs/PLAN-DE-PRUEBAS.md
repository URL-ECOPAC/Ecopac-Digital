# Plan de pruebas

Que se prueba, en que capa, y donde queda la evidencia. Nace de la issue #759 (auditoria de
huecos de prueba: `apps/web` tenia 2 archivos de prueba para 64 paginas, `apps/mobile` 9 para 35
pantallas, y `packages/shared` no podia detectar una consulta mal formada porque su doble del
cliente de Supabase acepta cualquier `select()`), dividida en sub-issues por bloque (#771-#779).

## Las capas, de la mas rapida a la mas cara

| Capa                                                     | Que prueba                                                            | Que NO puede probar                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/shared/**/*.test.js` (vitest, doble del cliente) | Reglas de negocio, formato, permisos del lado del cliente               | La FORMA de una consulta: el doble acepta cualquier `select()`, embebido o columna que no existe |
| `supabase/tests/database/*.sql` (pgTAP)                    | Politicas RLS, funciones SQL, privilegios, restricciones               | `max_rows` y otras configuraciones de PostgREST: pgTAP habla SQL directo con la base, no pasa por la API REST |
| `pruebas/e2e/*.e2e.test.js` (vitest, stack local real)     | Que una consulta de `packages/shared` funcione contra PostgREST real: la FORMA de la consulta, no solo la logica | Rendimiento con volumen realista (los fixtures son pequenos a proposito, para que la suite corra rapido) |
| `apps/web` y `apps/mobile` (component tests)               | Que una pantalla muestre el error cuando la consulta falla, no una lista vacia; que renderice lo que la funcion de `shared` devuelve | Lo mismo que ya cubre `packages/shared`: no se reimplementan las reglas de negocio a nivel de componente |
| Pruebas de carga (`scripts/`)                              | Tiempos con volumen realista (una jornada de 50 pacientes)              | Todo lo demas: es la unica capa pensada para medir tiempo, no correccion            |

La regla practica: un bug de "la pantalla muestra datos inventados" o "la consulta esta mal
formada" solo lo detecta una prueba que llegue hasta PostgREST real (e2e) o hasta el componente
que renderiza el error (component test). Las pruebas de `packages/shared` con doble, aunque sean
muchas, no bastan solas -- son las que ya existian cuando `recetas.api.test.js` pasaba en verde
con una consulta que reventaba siempre en produccion (PGRST108, ver #759).

## Donde vive cada evidencia

| Evidencia                                                | Donde                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Pruebas funcionales de cada modulo, con su camino de error   | `apps/web/src/**/*.test.jsx`, `apps/mobile/src/**/*.test.js` (junto al componente)  |
| Cobertura contra base real (forma de la consulta)            | `pruebas/e2e/*.e2e.test.js`                                                        |
| Baseline de cobertura de `apps/mobile`                       | Numero medido en este documento (abajo); se reproduce con `npm test --workspace=apps/mobile` (issue #775) |
| Prueba de carga de una jornada de 50 pacientes               | Script en `scripts/`, resultados de la corrida anotados en este documento (issue #774) |
| Sesion de usabilidad con el personal de la ONG                | Fuera del alcance de este repositorio: es trabajo de campo, no de codigo (#759). Cuando se realice, sus hallazgos se anotan en este documento. |
| Tiempo de registro de un paciente en campo                    | Igual que la anterior: trabajo de campo, se anota aqui cuando se mida.              |

## Baseline de cobertura de `apps/mobile` (issue #775)

Hasta esta issue, `apps/mobile` corria sus pruebas con Jest sin recoleccion de cobertura
(`jest --passWithNoTests`, sin `collectCoverage`): no habia ningun numero, a diferencia de
`packages/shared`, que reporta cobertura en cada corrida (`vitest run --coverage`).
`apps/mobile/jest.config.js` ahora fija `collectCoverage: true` sobre `src/**/*.{js,jsx}`
(excluyendo los propios `.test.js`), asi que `npm test --workspace=apps/mobile` reporta el
numero en cada corrida, igual que `packages/shared`.

Primera medicion (commit `chore/cobertura-baseline-mobile-775`, 9 suites, 52 pruebas, todas en
verde):

| Metrica    | % de cobertura |
| ---------- | --------------- |
| Statements | 21.43%          |
| Branches   | 14.52%          |
| Functions  | 15.62%          |
| Lines      | 21.57%          |

Es un numero bajo y esperado: `apps/mobile` tiene 35 pantallas y solo 9 archivos de prueba
(issue #759). No es el objetivo de la #775 subirlo -- eso es el trabajo de las issues #776-#779,
una por modulo -- sino dejar de estar "sin cobertura medida": a partir de aqui, cada PR que toque
`apps/mobile` puede comparar contra este numero en vez de no tener ninguno.

## Prueba de carga: jornada de 50 pacientes (issue #774)

Pendiente. Se anota aqui la ubicacion del script y los resultados de la primera corrida cuando
la #774 se resuelva.
