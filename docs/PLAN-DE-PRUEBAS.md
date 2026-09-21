# Plan de pruebas

Que se prueba, en que capa, y donde queda la evidencia. Nace de la issue #759 (auditoria de
huecos de prueba: `apps/web` tenia 2 archivos de prueba para 64 paginas, `apps/mobile` 9 para 35
pantallas, y `packages/shared` no podia detectar una consulta mal formada porque su doble del
cliente de Supabase acepta cualquier `select()`), dividida en sub-issues por bloque (#771-#779).

La issue #758 lo amplia a los ocho tipos de prueba, con quien los ejecuta, cuando y con que
criterio se aprueban, y lo traza contra los requerimientos del proyecto.

## Documentos del plan

| Documento | Que contiene |
| --- | --- |
| Este archivo | Los tipos de prueba, sus criterios de aprobacion, la politica de evidencias y los riesgos al ejecutarlo |
| [CASOS-DE-PRUEBA.md](./CASOS-DE-PRUEBA.md) | Cada caso de prueba vinculado al requerimiento que cubre, y la lista de requerimientos sin ningun caso |
| [evidencias/](./evidencias/) | Un registro por ejecucion completa, con fecha y commit |

Los requerimientos salen de la Matriz de Trazabilidad del Entregable Semana 5 (7 funcionales) y de
la lista del Entregable Semana 3-4 (15 no funcionales). `CASOS-DE-PRUEBA.md` explica por que no
coinciden con la numeracion `RF-xx` que usan las issues.

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

Lo mismo pasa con los permisos: un doble del cliente no conoce los `GRANT` de la base. Una politica
RLS escrita sin el privilegio de tabla que la habilita pasa todas las pruebas con doble y falla
contra la base real para todo el mundo, como le paso a la creacion de comunidades de la #662. Todo
cambio de politica o de `GRANT` necesita un caso pgTAP o e2e, no solo pruebas en `packages/shared`.

## Los ocho tipos de prueba

| Tipo | Herramienta | Quien lo ejecuta | Cuando | Criterio de aprobacion | Estado |
| --- | --- | --- | --- | --- | --- |
| **Unitarias** | Vitest en `packages/shared` y `packages/ui-tokens` | Quien abre el PR, y el CI | Antes de subir, y en cada PR | Cero fallos en `npm test`. La cobertura de las validaciones no baja de 97 % statements, 94 % branches, 100 % functions y 98 % lines | Ejecutable |
| **Integracion** | Vitest contra el stack local real (`pruebas/e2e/`) | El CI | En cada PR que toca `supabase/`, `packages/shared/` o `pruebas/`, y en cada push a `develop` y `main` | Las 49 pruebas de los flujos criticos en verde | Ejecutable |
| **Funcionales** | Vitest y Testing Library en `apps/web`; Jest en `apps/mobile` | Quien abre el PR, y el CI | Antes de subir, y en cada PR | Cero fallos. Cada pantalla que consulta datos prueba tambien su camino de error | Ejecutable |
| **Seguridad basica** | pgTAP (`supabase/tests/database/`) y `npm audit` | El CI; la auditoria, quien prepara una entrega | pgTAP con la misma regla que la integracion; la auditoria antes de cada entrega y antes de produccion | pgTAP con `Result: PASS`. Ninguna vulnerabilidad critica en dependencias de produccion; las altas quedan revisadas y anotadas en la evidencia | Ejecutable |
| **Usabilidad** | Sesion guiada con tareas y observacion | El equipo, con personal de la organizacion | Una vez antes de produccion, y despues de cada cambio grande de flujo | Propuesta a validar con la PM: el personal completa sin ayuda al menos 8 de cada 10 tareas de HU01 a HU07 | **No ejecutada**: requiere a la organizacion |
| **Rendimiento** | `npm run prueba:carga-jornada` | Quien toque un flujo de la jornada | Despues de cambiar registro, triaje, consulta o receta | RNF-5: ningun maximo crece con el indice del paciente a lo largo de las 50 iteraciones | Ejecutable con stack local |
| **Regresion** | Los checks requeridos del CI | El CI | En cada PR y en cada push a `develop` y `main` | Todos los checks requeridos en verde antes de mergear. Un bug corregido deja una prueba que lo reproduce, como `ModalAltaPaciente.regresion.test.jsx` | Ejecutable |
| **Aceptacion** | Recorrido de los criterios de aceptacion de HU01 a HU07 | La organizacion, acompanada por el equipo | Antes de pasar a produccion | La organizacion confirma cada criterio de aceptacion de las siete historias | **No ejecutada**: requiere a la organizacion |

Las pruebas estaticas -`npm run lint`, `npm run format:check`, `npm run build` y
`scripts/verificar-shared-vs-esquema.mjs`- no son un tipo aparte: son la primera barrera de la
regresion y corren en el mismo job del CI. **Son cuatro comandos antes de subir, no tres**: la
plantilla del PR nombra lint, pruebas y build, pero el CI tambien comprueba el formato con Prettier.

## Que mide y que no mide la cobertura

El resumen del CI de `packages/shared` dice **97.91 %**, y es facil leerlo como la cobertura del
paquete. **No lo es.** `packages/shared/vitest.config.js` solo mide `**/validaciones.js`,
`**/*.validaciones.js` y `validations/index.js`: las reglas de negocio que se pueden probar enteras
sin base de datos. El propio archivo lo explica, y es una decision razonada, pero el efecto es que
un numero alto convive con areas enteras sin medir:

| Paquete | Que entra en el porcentaje | Que queda fuera |
| --- | --- | --- |
| `packages/shared` | Solo las validaciones | Las APIs, los hooks, los descriptores y el formato |
| `apps/mobile` | Todo `src/` (51.97 % en la ultima medicion) | Nada del alcance, pero casi la mitad de las lineas no se ejecuta en ninguna prueba |
| `apps/web` | **Nada**: no recolecta cobertura | Las 77 paginas |

Y ninguna cobertura, por alta que sea, dice si una consulta tiene la forma que PostgREST acepta o
si la base concede el privilegio que usa: eso solo lo dicen las pruebas contra base real.

## Pruebas manuales

Lo que no se puede automatizar hoy. Cada una tiene su caso en `CASOS-DE-PRUEBA.md` y se registra
en `evidencias/` cuando se ejecuta.

### Fidelidad con la ficha clinica fisica (RNF-3)

Con una ficha clinica en papel al lado, recorrer el alta de paciente y el registro de consulta en
web y en movil. Para cada campo de la ficha: si existe en el formulario, si esta en el mismo orden,
y si la validacion acepta lo que se escribiria a mano. HU04 exige como minimo nombre, edad, razon de
consulta, antecedentes, sintomas, diagnostico, tratamiento y seguimiento. Una diferencia se acepta
solo si mejora el formato y queda justificada.

### Diseno responsivo y compatibilidad de navegadores (RNF-15)

Recorrer inicio de sesion, listado y ficha de paciente, bandeja de validacion, detalle de jornada y
dashboard en esta matriz:

| Navegador | 1366 px | 768 px | 375 px |
| --- | --- | --- | --- |
| Chrome | | | |
| Firefox | | | |
| Safari | | | |

Se aprueba si ninguna pantalla desborda horizontalmente, ningun control queda tapado o fuera de
alcance, y las tablas siguen siendo legibles.

### Accesibilidad de la web

Sin requerimiento oficial, pero absorbido por esta issue. Recorrer las mismas pantallas solo con
teclado, y pasar Lighthouse en modo accesibilidad. Se aprueba si todo control se alcanza con el
teclado en un orden logico, el foco siempre es visible, y Lighthouse no reporta fallos criticos de
contraste ni de etiquetas en formularios.

### Cifrado en transito (RNF-8)

Abrir la web desplegada por `http://` y comprobar que redirige a `https://`, y revisar que las URL
de Supabase configuradas en web y movil sean `https://`.

### Usabilidad y aceptacion

Las prepara el equipo y las ejecuta la organizacion. Se graba o se toman notas **sin datos reales
de pacientes**: se trabaja sobre `seed-demo.sql` o sobre una copia anonimizada, nunca sobre
`ecopac-prod`.

## Donde vive cada evidencia

| Evidencia                                                | Donde                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Pruebas funcionales de cada modulo, con su camino de error   | `apps/web/src/**/*.test.jsx`, `apps/mobile/src/**/*.test.js` (junto al componente)  |
| Cobertura contra base real (forma de la consulta)            | `pruebas/e2e/*.e2e.test.js`                                                        |
| Baseline de cobertura de `apps/mobile`                       | Numero medido en este documento (abajo); se reproduce con `npm test --workspace=apps/mobile` (issue #775) |
| Prueba de carga de una jornada de 50 pacientes               | Script en `scripts/`, resultados de la corrida anotados en este documento (issue #774) |
| Sesion de usabilidad con el personal de la ONG                | Fuera del alcance de este repositorio: es trabajo de campo, no de codigo (#759). Cuando se realice, sus hallazgos se anotan en este documento. |
| Tiempo de registro de un paciente en campo                    | Igual que la anterior: trabajo de campo, se anota aqui cuando se mida.              |

## Politica de evidencias

**Una ejecucion completa deja un archivo en `docs/evidencias/`**, con la fecha como nombre
(`AAAA-MM-DD.md`). Cada archivo registra:

- El **commit** sobre el que se ejecuto y la **fecha**. Una evidencia sin version no sirve para
  comparar despues de un cambio.
- El **entorno**: sistema operativo, version de Node y version de la CLI de Supabase.
- El **resultado de cada tipo** ejecutable, con sus numeros, y los tipos que no se pudieron
  ejecutar y por que.
- Las **incidencias del entorno**, separadas de los defectos del sistema, para que un fallo de la
  maquina no se lea como un fallo del codigo.

**Los resultados se copian, no solo se enlazan.** Una corrida del CI se cita por su numero, pero sus
numeros se anotan en el archivo: GitHub conserva los registros de las corridas por un tiempo
limitado (90 dias por defecto), y despues el enlace ya no demuestra nada.

**Capturas, grabaciones y notas de sesiones** con la organizacion no se suben al repositorio. Se
guardan donde decida la organizacion y el archivo de evidencia apunta a ellas.

**Politica de datos**, siguiendo `AGENTS.md` y `docs/PROTECCION-DE-DATOS.md`:

- Ningun dato real de pacientes en una evidencia: ni en capturas, ni en grabaciones, ni en salidas
  de consola copiadas. Se ejecuta sobre `supabase/seed-demo.sql`, cuyos datos son ficticios.
- Las pruebas nunca se ejecutan contra `ecopac-prod`, y no se escribe a mano sobre `ecopac-dev`.
- En una sesion de usabilidad o de aceptacion, las personas participantes se registran por su rol,
  no por su nombre, y la grabacion requiere su consentimiento.

## Riesgos conocidos al ejecutar el plan

Problemas del entorno que ya ocurrieron y que hacen parecer roto algo que no lo esta:

| Sintoma | Causa | Que hacer |
| --- | --- | --- |
| `Failed to resolve import` en muchas suites de `apps/web` y en el build | `node_modules` desactualizado despues de un merge que agrego una dependencia | `npm install` antes de ejecutar |
| Una prueba de `apps/mobile` falla con `Exceeded timeout of 5000 ms` y en el CI pasa | Arranque en frio de Jest en una maquina lenta: la primera prueba de una suite carga todo el arbol de React Native | Repetir la suite sola. Si se confirma, no es un defecto |
| `supabase start` o `db reset` fallan con `bind: An attempt was made to access a socket in a way forbidden` | Windows reserva tramos de puertos con WinNAT, y pueden cubrir los 544xx de `supabase/config.toml` | Revisar con `netsh interface ipv4 show excludedportrange protocol=tcp`. Liberarlos requiere permisos de administrador |
| La suite pgTAP sale roja en local y verde en el CI | Una version de la CLI de Supabase distinta de la que fija el CI (2.115.0) | Usar `npx supabase@2.115.0`. Con otra version cambian los privilegios por defecto de la base |
| Las pruebas e2e fallan con `No se pudo leer la configuracion del stack local` | El arnes llama a `supabase status` y la CLI no esta en el `PATH` | Instalar la CLI de forma que `supabase` se resuelva en la terminal |

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

**Medicion del 2026-09-16** (commit `feef572`, 30 suites, 175 pruebas), despues de las pruebas
funcionales de las issues #776 a #779:

| Metrica    | % de cobertura |
| ---------- | --------------- |
| Statements | 51.97%          |
| Branches   | 44.29%          |
| Functions  | 39.26%          |
| Lines      | 53.48%          |

Registro completo en [evidencias/2026-09-16.md](./evidencias/2026-09-16.md).

## Prueba de carga: jornada de 50 pacientes (issue #774)

Script: `scripts/prueba-de-carga-jornada-50-pacientes.mjs` (`npm run prueba:carga-jornada`).
Registra 50 pacientes reales contra el stack local, les toma triaje, y un medico les registra
consulta y receta -- el mismo camino que usa la aplicacion (`packages/shared` hablando con
PostgREST real, login por contrasena, RLS incluido), midiendo el tiempo de cada paso con
`performance.now()`. Es una herramienta manual (no corre en CI, mismo criterio que
`scripts/verificar-concurrencia-numero-ficha.mjs`) y queda repetible: se puede volver a correr
despues de un cambio para comparar contra estos numeros.

Corre con vitest y no con `node` a secas: `@ecopac/shared` resuelve un import sin extension
(`packages/shared/entorno/index.js`, deliberado para que Metro y Vite resuelvan cada uno su
version de `fuente.js`) que solo el motor de Vite/vitest sabe seguir. La configuracion vive
aparte en `scripts/vitest.carga.config.mjs`, con su propio `include`, para que este archivo no
quede alcanzable por accidente desde `npm run test:e2e`.

**Primera medicion** (stack local en Docker, sin latencia de red real -- estos numeros son un
piso, no lo que se veria en campo con la conexion de una comunidad rural; sirven para comparar
contra si mismos despues de un cambio, no como el tiempo real que va a sentir el personal):

| Paso     | n  | Total  | Promedio | Minimo | Maximo |
| -------- | -- | ------ | -------- | ------ | ------ |
| Registro | 50 | 0.29 s | 5.8 ms   | 4.2 ms | 40.4 ms |
| Triaje   | 50 | 0.29 s | 5.8 ms   | 4.6 ms | 8.6 ms  |
| Consulta | 50 | 1.10 s | 22.1 ms  | 18.3 ms | 29.8 ms |
| Receta   | 50 | 0.81 s | 16.3 ms  | 13.7 ms | 24.1 ms |

No aparecio ningun cuello de botella: los cuatro pasos escalan de forma lineal (nada crece con
el indice del paciente dentro de la corrida, que es justo lo que indicarian valores maximos
crecientes hacia el final de las 50 iteraciones). `consulta` es el paso mas caro porque es el
unico que escribe en tres tablas dentro de la misma llamada (`consultas`,
`consulta_diagnostico`, mas la lectura previa del catalogo).

El script limpia lo que crea (pacientes, y los movimientos de inventario pendientes que deja
cada receta) al terminar, incluso si una corrida falla a medio camino.
