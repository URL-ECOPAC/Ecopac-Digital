# CI/CD - Ecopac Digital

Que corre automaticamente, cuando, contra que ambiente, y que hacer cuando algo falla.

## Los cuatro workflows

| Workflow                 | Archivo                                      | Cuando corre                                 |
| ------------------------ | -------------------------------------------- | -------------------------------------------- |
| CI                       | `.github/workflows/ci.yml`                   | PR hacia develop o main, y push a esas ramas |
| Supabase                 | `.github/workflows/supabase.yml`             | PR hacia develop o main, y push a esas ramas |
| Verificar despliegue     | `.github/workflows/verificar-despliegue.yml` | Todos los dias a las 13:00 UTC, y a mano     |
| Mantener Supabase activo | `.github/workflows/keep-alive-supabase.yml`  | Cada 3 dias, y a mano                        |

El despliegue de la web **no** es un workflow: lo hace la app de Vercel conectada al
repositorio. Vercel publica un preview por cada PR y produccion desde `main`, al margen del
CI, asi que un CI en rojo no detiene un deploy de Vercel.

## Que hace el workflow de CI

Un solo job, **Lint y build**, que corre en este orden:

1. **Guarda de esquema**: `packages/shared` contra `supabase/migrations/` (issue #492).
2. `npm run lint` en todos los workspaces.
3. `npm test` en todos los workspaces que tengan el script (issue #218), que desde la issue
   **#219** comprueba ademas **cobertura de las validaciones**.
4. **Resumen de las pruebas** en la pagina de la corrida (issue #223).
5. Build de la web con los secrets del ambiente que corresponde a la rama.

Cada paso va antes del siguiente por lo que cuesta: la guarda de esquema es analisis de texto y
tarda un segundo; una prueba rota se ve en segundos, sin esperar a que la web compile. Y todo va
dentro de este job y no en uno propio porque **Lint y build** ya es check requerido en `develop`
y `main`; un job nuevo no lo seria hasta que alguien lo agregue en Settings > Branches, y
mientras tanto un PR en rojo se podria mergear igual.

### El presupuesto de tiempo del pipeline

**Diez minutos**, y lo fija la issue #223. Lo hacen cumplir los `timeout-minutes` de los **dos
checks requeridos que corren en cada PR**, que son los que componen el tiempo que alguien espera
para poder mergear:

| Job                                 | Workflow       | Tope   | Medido                     |
| ----------------------------------- | -------------- | ------ | -------------------------- |
| **Lint y build**                    | `ci.yml`       | 10 min | 37-50 s                    |
| **Validar migraciones y funciones** | `supabase.yml` | 10 min | 4-9 s, o 142-187 s con SQL |

Dentro de **Lint y build**, `npm ci` son ~14 s, el lint ~6 s, las pruebas ~10 s y el build ~1 s.
El job caro es el de Supabase, que levanta el stack, aplica las migraciones desde cero y corre
las suites pgTAP; su coste crece con cada migracion y cada suite nuevas, asi que **es el que hay
que mirar** cuando alguien se pregunte si el presupuesto sigue alcanzando.

`Aplicar migraciones` se queda en 15 minutos a proposito: corre en `push`, despues del merge, y
no es tiempo que nadie este esperando.

**Un tope no es una meta.** Si un dia una corrida se acerca a los diez minutos, lo que hay que
averiguar es que la hizo crecer; subir el numero es la ultima opcion, no la primera.

### El resultado de las pruebas en el PR

La DoD de la #223 pide que el resultado de las pruebas **se vea en el PR**. Se reparte en dos, y
conviene saber cual pone cada parte:

- **El conteo lo publica vitest solo.** Cuando detecta que corre en Actions agrega su reporter
  `github-actions`, que escribe un "Vitest Test Report" en el resumen de la corrida con cuantos
  archivos y cuantas pruebas pasaron. **No se ve al correr las pruebas en local**, porque ese
  reporter solo se activa con `GITHUB_ACTIONS`, y por eso es facil creer que no existe.
- **La cobertura la publica `scripts/resumen-de-pruebas.mjs`**, que es lo que vitest no trae. Y es
  el numero que hace falta vigilar: desde la #219 la cobertura de las validaciones es una guarda
  con umbral, no una estadistica, asi que ver cuanto margen queda vale mas que repetir el conteo.

Detalles que conviene conocer antes de tocarlo:

- **Los umbrales no se copian al workflow**: se leen de `packages/shared/vitest.config.js`, que es
  donde los declara la guarda de la #219. Una segunda copia podria divergir en silencio.
- **Corre con `if: always()`** -el resumen de una corrida en rojo es el que mas falta hace- y
  **nunca falla**: si el informe de cobertura no existe, escribe una nota y sale con 0. Es un
  reporte, no una guarda. En una corrida roja ese informe no existe, y no es un caso raro: vitest
  limpia su directorio de cobertura al arrancar y no lo reescribe si las pruebas fallan.
- Se eligio el resumen y no un comentario en el PR porque escribir en `$GITHUB_STEP_SUMMARY` no
  pide permisos: el workflow sigue con `contents: read`. Comentar obligaria a
  `pull-requests: write` y a ensuciar el hilo en cada push.

### La guarda de cobertura de las validaciones

Las validaciones de `packages/shared` son las reglas de negocio del sistema: vencimiento de
medicamentos, disponibilidad de stock, jornada activa, rangos de signos vitales, datos de
paciente. Hoy las cubren **193 casos** en once archivos, con una cobertura de **97.7% de
sentencias, 94.9% de ramas y 100% de funciones**.

Nada vigilaba que eso siguiera asi. La guarda vive en `packages/shared/vitest.config.js`, y entra
por donde ya pasa todo: el script `test` del paquete es `vitest run --coverage`, asi que la
comprueban por igual `npm test` en la maquina de quien desarrolla y el job **Lint y build** del
CI. **No hizo falta agregar ningun paso al workflow.**

|         |                                                                       |
| ------- | --------------------------------------------------------------------- |
| Alcance | `**/validaciones.js`, `**/*.validaciones.js` y `validations/index.js` |
| Umbral  | sentencias 97, ramas 94, funciones 100, lineas 98                     |
| Coste   | la suite pasa de ~4.0 s a ~4.7 s                                      |

**El umbral es un trinquete y solo sube.** Los numeros son el suelo medido, redondeado hacia
abajo, no una aspiracion: una guarda que nace por encima de lo real solo deja el CI en rojo el
primer dia. Quien mejore la cobertura sube el suelo en el mismo PR; quien la baje lo explica en
la descripcion, no cambia el numero en silencio.

**Que caza y que no**, comprobado a proposito y dicho aqui para que nadie le pida mas de lo que
da:

- **Una validacion nueva sin pruebas**: la caza, y es la regresion que mas importa. Los cuatro
  umbrales fallan a la vez, porque `functions: 100` no admite una funcion sin ejercer.
- **Una suite entera borrada**: la caza de sobra (la cobertura cae al 84%).
- **Un solo caso de prueba borrado**: **no la caza**. Es un umbral global sobre once archivos y un
  caso de 193 no mueve el porcentaje. Un umbral por archivo lo detectaria, pero habria que
  bajarlo al 87% para que el repositorio lo cumpliera hoy, y eso protege menos que este.

### La guarda de esquema

`scripts/verificar-shared-vs-esquema.mjs` lee las migraciones, construye el inventario de tablas,
columnas y funciones, y lo compara con lo que `packages/shared` pide. **Falla el PR** si shared
nombra algo que no existe, diciendo archivo, linea y nombre.

Existe porque **siete issues describen el mismo defecto** (#454, #396, #489, #490, #491, #509,
#523): codigo de shared que consulta columnas inexistentes, mergeado con el CI en verde. Las
pruebas no lo detectan y no es descuido: el doble del cliente de Supabase se escribe leyendo el
codigo que se va a probar, no la migracion, asi que reproduce el mismo error y lo verifica contra
si mismo. Pasaria en verde aunque el esquema no existiera.

Comprueba, para cada `.from("tabla")` y dentro del mismo statement:

| Que                         | Donde                                                              |
| --------------------------- | ------------------------------------------------------------------ |
| que la tabla exista         | `.from()`                                                          |
| las columnas pedidas        | `.select()`, literal o por constante                               |
| las columnas de los filtros | `.eq .neq .gt .gte .lt .lte .in .is .like .ilike .contains .order` |
| **las claves escritas**     | `.insert()`, `.update()`, `.upsert()`                              |
| que la funcion exista       | `.rpc()`                                                           |

Las claves de escritura son la fila que importa: por ahi entraron #490, #491 y #509, y es lo que
una revision por encima no mira.

**Lo que no comprueba, a proposito**, y lo dice en cada corrida en vez de callarlo:

- **Las columnas de las vistas.** Salen del `SELECT` que las define, y `vista_reporte_impacto` se
  redefine en la 00027, la 00054 y la 00064. Los siete defectos conocidos eran sobre tablas.
- **Los `.rpc()` con nombre dinamico**, que no se resuelven sin ejecutar el codigo.
- **Los `.select()` cuya constante no se pueda resolver.** Hoy son dos, las dos de
  `historial.api.js`, que compone la lista con arrays anidados.
- **Las Edge Functions.** La comprobacion **esta escrita y probada pero apagada** tras la
  constante `VERIFICAR_EDGE_FUNCTIONS`: hoy encontraria `invitar-usuario`, que es la issue #523 y
  tiene dueno. Se enciende poniendola en `true` en el mismo PR que escriba la funcion.

Avisa aparte, sin fallar, de los archivos de `shared` que **ningun barril reexporta**: `vite build`
no los compila, asi que un error suyo no aparece hasta que alguien conecta la pantalla. Fue el
segundo motivo por el que #454 paso el CI.

**Salida de emergencia:** la etiqueta **`esquema-verificado-a-mano`** en el PR salta la guarda,
igual que `migracion-editada-a-proposito` con la de migraciones. Deja un aviso visible en el
resumen de la corrida, y la descripcion del PR tiene que decir por que.

El analizador tiene sus propias pruebas: `npm run verificar:shared-esquema -- --autoprueba` corre
catorce casos que cubren las trampas reales del repositorio -`ALTER TABLE` multi-clausula,
relaciones embebidas anidadas, objetos dentro de llamadas, propiedades shorthand, constantes-.
`scripts/` no es un workspace, asi que `npm test` no lo alcanza; por eso la autoprueba es un paso
propio del CI.

## Que hace el workflow de Supabase

Siete jobs. Los tres primeros validan, los siguientes despliegan y avisan, y el ultimo
resume el resultado de todos.

| Job                                 | Cuando                   | Que hace                                                                                                                                                                   |
| ----------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detectar cambios                    | siempre                  | Averigua si el cambio toca `supabase/`, para no levantar el stack local sin necesidad                                                                                      |
| **Migraciones no editadas**         | PR y push                | Falla si el PR modifica o borra una migracion que ya existe en la rama base, y si la numeracion de `supabase/migrations/` tiene un choque                                  |
| **Validar migraciones y funciones** | PR y push                | Levanta el stack local, aplica todas las migraciones desde cero, corre `db lint` y el lint de Edge Functions                                                               |
| Estado de la base remota            | PR                       | Lista que migraciones estan aplicadas en `Ecopac-Digital-Dev` y cuales se aplicarian al mergear                                                                            |
| Aplicar migraciones                 | push a develop o main    | Comprueba que el historial de la base coincida con la rama y corre `supabase db push` contra el proyecto del ambiente. Depende de que los dos jobs en negrita hayan pasado |
| Avisar fallo                        | si algo fallo en un push | Abre una issue con el paso que fallo y **si las migraciones se aplicaron o no**                                                                                            |
| Supabase completo                   | siempre                  | Mira el resultado de los otros cinco jobs -validacion **y despliegue**- y falla si alguno termino en `failure` o `cancelled`                                               |

Los jobs en negrita son **checks requeridos** hoy: sin ellos en verde, la rama protegida no
deja mergear. **Supabase completo** esta pensado para reemplazarlos a los dos, pero eso se
configura a mano en Settings; mientras no se haga, es un job mas que corre sin bloquear nada.
Ver "Ramas protegidas".

### Por que existe Supabase completo

Por dos motivos, y el primero es una trampa que no se ve:

1. **Un check requerido que termina en `skipped` cuenta como aprobado.** No como fallo, ni como
   pendiente: como aprobado. `Estado de la base remota` solo corre en `pull_request`, asi que en
   cada push queda `skipped`, y como check requerido eso se ve igual que si hubiera pasado.
   Marcar cada job por separado da una lista larga que aparenta cobertura, pero algunos de esos
   nombres se satisfacen solos. **Supabase completo** mira el resultado job por job y decide
   explicitamente: acepta `success` y `skipped`, rechaza `failure` y `cancelled`.
2. **Deja la lista de checks requeridos en un nombre por workflow.** Los nombres de los checks no
   viven en el repositorio: renombrar un job obliga a ir a Settings a corregirlo, y si nadie lo
   hace, el PR queda esperando un check que ya no existe. Con un solo nombre por workflow,
   renombrar o agregar jobs adentro ya no rompe la configuracion.

**`Aplicar migraciones` entra en esa cuenta**, aunque solo corra en push. No estaba, y por eso un
despliegue fallido se reportaba como exito: el 30 de agosto los merges de #606 y #607 tumbaron el
despliegue -deriva de historial, y ninguno de los dos traia una linea de SQL- y **Supabase
completo** dijo `success` en las dos corridas. El resumen que explica el fallo estaba escrito y
bien escrito; lo que fallaba era que nada lo senalaba, y hay que saber que existe un job aparte
para ir a abrirlo. En un `pull_request` el job sale `skipped` y cuenta como aprobado, asi que
incluirlo no cambia nada ahi.

### La deriva de historial se avisa en el PR

Mientras la base de `ecopac-dev` tenga aplicada una migracion cuyo archivo no esta en `develop`,
`supabase db push` falla en **todo** push a esa rama, traiga SQL o no: valida el historial
completo antes de mirar si hay algo pendiente. El fallo le aparece a quien mergee despues, que
normalmente no tiene nada que ver.

`Estado de la base remota` ya corria el `--dry-run` que lo detecta, pero su salida caia dentro de
un bloque de codigo del resumen y no la miraba nadie. Ahora, cuando aparece deriva, ese job emite
un `::warning::` y una seccion propia diciendo que el PR no la causa y que no la empeora. **Sigue
sin fallar nunca**: depende de secrets y de la red, y convertirlo en guarda haria que un corte de
conexion bloquee PRs ajenos. Quien corta es `Aplicar migraciones`, despues del merge.

Lo que ninguna de las dos cosas arregla es una **rama que se quedo vieja**: ningun check se vuelve
a correr solo cuando `develop` avanza, asi que dos PRs pueden reservar el mismo numero de
migracion y las dos pasar en verde. Eso lo cierra `strict` ("Require branches to be up to date"),
que vive en Settings > Branches.

No se puede llegar a **un** unico check para todo el repositorio: `Lint y build` vive en otro
workflow y un job no puede declarar `needs` de un workflow ajeno. El minimo son dos nombres.

### Lo que el CI no puede predecir: los privilegios del rol

`Validar migraciones y funciones` aplica todo desde cero, pero lo hace en el stack local, donde
el rol que corre las migraciones **es superusuario**. En Supabase gestionado no lo es. Todo lo
que dependa de ese privilegio pasa el CI en verde y falla en el despliegue.

Es lo que ocurrio con la `00068` (issue #487). La funcion `fn_buscar_pacientes` llevaba
`SET pg_trgm.word_similarity_threshold = 0.4` en el `CREATE FUNCTION`, y el despliegue murio con:

```
ERROR: permission denied to set parameter "pg_trgm.word_similarity_threshold" (SQLSTATE 42501)
```

Postgres valida la clausula `SET` contra las GUCs que conoce. Si la libreria de la extension no
esta cargada en la sesion, `pg_trgm.word_similarity_threshold` todavia no es una GUC: es un
placeholder con prefijo custom, y fijar un placeholder exige superusuario, porque Postgres no
puede saber aun si la variable sera `USERSET` o `SUSET`. En local el rol es superusuario y pasa;
en Supabase no. La solucion no fue bajar el umbral ni cambiar de rol, sino **cargar pg_trgm antes
del `CREATE FUNCTION`**, en el mismo archivo -llamar a una funcion C de la extension ejecuta su
`_PG_init`, que es donde la GUC se define-. Con la GUC ya conocida, el permiso se comprueba como
lo que es, `USERSET`, y cualquier rol puede fijarla.

La leccion general: **verde en el CI no prueba que el despliegue vaya a pasar** cuando la
migracion toca privilegios, GUCs de extensiones, roles o propiedad de objetos. Eso se prueba
corriendo el SQL como un rol `NOSUPERUSER` (basta un cluster desechable con `initdb`), no
mirando el check.

## Ambientes

| Rama      | Proyecto Supabase   | Secret del project-ref      | Despliegue web    |
| --------- | ------------------- | --------------------------- | ----------------- |
| `develop` | Ecopac-Digital-Dev  | `SUPABASE_PROJECT_REF_DEV`  | Local             |
| `main`    | Ecopac-Digital-Prod | `SUPABASE_PROJECT_REF_PROD` | Vercel Produccion |

Cada migracion se aplica **una vez por base**. El push a `develop` va contra `Ecopac-Digital-Dev` y el
push a `main` contra `Ecopac-Digital-Prod`: son bases distintas, no una doble aplicacion. Ademas
`supabase db push` consulta `supabase_migrations.schema_migrations` del destino y aplica solo
lo pendiente, asi que aunque el workflow corriera dos veces no repetiria nada.

### Secrets

Se configuran en Settings > Secrets and variables > Actions.

| Secret                                                  | Lo usa                         |
| ------------------------------------------------------- | ------------------------------ |
| `SUPABASE_ACCESS_TOKEN`                                 | Vincular con proyectos remotos |
| `SUPABASE_DB_PASSWORD`                                  | Vincular con proyectos remotos |
| `SUPABASE_PROJECT_REF_DEV`                              | Aplicar migraciones en develop |
| `SUPABASE_PROJECT_REF_PROD`                             | Aplicar migraciones en main    |
| `SUPABASE_URL_DEV`, `SUPABASE_ANON_KEY_DEV`             | Keep-alive                     |
| `SUPABASE_SERVICE_ROLE_KEY_DEV`                         | Disparar alertas-vencimiento   |
| `VITE_SUPABASE_URL_DEV`, `VITE_SUPABASE_ANON_KEY_DEV`   | Build de la web en develop     |
| `VITE_SUPABASE_URL_PROD`, `VITE_SUPABASE_ANON_KEY_PROD` | Build de la web en main        |

Cuando falta un secret, el workflow **avisa de forma visible pero no falla**: deja un bloque en
el resumen de la corrida y una anotacion de warning. La idea es no bloquear al equipo mientras
termina de configurar los ambientes, pero que una omision nunca se vea igual que un despliegue
exitoso.

## La regla mas importante: una migracion aplicada no se edita

Cuando una migracion corre en una base, Supabase la registra en
`supabase_migrations.schema_migrations` y **no la vuelve a ejecutar nunca**. Editar el archivo
despues no cambia nada en esa base.

Eso crea una divergencia silenciosa:

|                          | Que ejecuta                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| El CI en el PR           | `supabase db reset`: aplica **todo desde cero** en una base limpia    |
| El despliegue al mergear | `supabase db push`: aplica **solo lo pendiente sobre el estado real** |

Mientras nadie edite una migracion aplicada, los dos escenarios coinciden y el CI predice bien
lo que va a pasar. En cuanto alguien la edita, dejan de coincidir: el CI queda verde y el
despliegue falla despues del merge.

### Como corregir una migracion aplicada

Hacia adelante, con una migracion nueva. Nunca editando la anterior.

`supabase/migrations/00005_corregir_schema_de_extensiones.sql` es el ejemplo: mueve las
extensiones al schema correcto **solo si hace falta**, de modo que corrige `Ecopac-Digital-Dev` y es un
no-op en una base fresca. El mismo archivo sirve para los tres destinos.

### Cuando de verdad hay que editarla

Solo si la migracion no se aplico todavia en ninguna base — tipicamente porque se agrego en el
mismo PR. Ahi la guarda ya la deja pasar, porque contra la rama base figura como archivo nuevo.

Si aun asi hace falta saltarse la guarda, se agrega la etiqueta
`migracion-editada-a-proposito` al PR. Queda registrado en la corrida que se salto y por que.

## Las migraciones se aplican mergeando, no a mano

**Nadie corre `supabase db push` contra `ecopac-dev` ni `ecopac-prod` desde su maquina.** Una
migracion llega a una base de un solo modo: se mergea su PR y la aplica el workflow.

La razon no es de estilo. `db push` valida el historial completo antes de aplicar nada, asi que
en cuanto la base tiene registrada una version cuyo archivo no esta en la rama, **todo push a esa
rama falla**, lo traiga o no:

```
Remote migration versions not found in local migrations directory.
```

El que aplica a mano no rompe su propio trabajo: rompe el de todos los demas, hasta que su PR
entre. Y el fallo aparece en el merge de otra persona, que no toco SQL y no tiene forma de
adivinar por que. Es el [Caso 4](#caso-4-la-base-tiene-una-migracion-que-la-rama-no).

Para probar una migracion antes de mergear esta el stack local:

```bash
supabase start
supabase db reset   # aplica todo desde cero, igual que el CI
```

Eso es tambien lo que corre el CI en el PR, asi que si pasa ahi, pasa al mergear.

## La otra regla: el numero se elige dos veces

El nombre de una migracion es `NNNNN_descripcion_en_snake_case.sql`, con cinco digitos y
numeracion secuencial. Elegir mal el numero rompe el despliegue de dos formas distintas, y las
dos las comprueba el paso **Verificar la numeracion de las migraciones**.

### Repetir un numero

En `supabase_migrations.schema_migrations`, la columna `version` es **el prefijo numerico solo**
\-`00065`, sin el nombre, que va en otra columna- y es **clave primaria**. Medido contra una base
local con dos archivos `00066`:

```
Applying migration 00066_prueba_dup_a.sql...
Applying migration 00066_prueba_dup_b.sql...
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505)
Key (version)=(00066) already exists.
```

El primero se aplica y se registra. El segundo ejecuta su SQL, choca al registrarse, y **toda su
transaccion se revierte**: ni esa migracion ni las que vinieran despues quedan aplicadas, y
`db push` sale con codigo 1. No es un problema de orden, como podria parecer: es un despliegue
roto.

Y limpiarlo despues del merge es mas caro de lo que parece, porque renumerar el archivo es
renombrarlo, y renombrar un archivo que ya existe en la rama base es justo lo que bloquea la
guarda de inmutabilidad: hace falta la etiqueta `migracion-editada-a-proposito`.

### Usar un numero por debajo del ultimo

`supabase db push` se niega a aplicar una migracion anterior a la ultima que la base ya registro:
aborta con `Found local migration files to be inserted before the last migration on remote
database` y exige `--include-all`. **La salida correcta es renumerar por encima con `git mv`,
nunca pasar `--include-all`**, que aplicaria la migracion fuera de orden en unas bases y no en
otras.

### Por eso el numero se verifica dos veces

Se elige al abrir la rama y **se vuelve a verificar antes de mergear**, porque otra rama pudo
tomarlo mientras tanto. La comprobacion compara contra el **tip actual** de la rama base, no
contra el punto donde nacio la rama, asi que cada vez que el check se reejecuta usa el estado de
`develop` de ese momento.

Eso deja un unico hueco, y conviene conocerlo: **dos PR abiertos a la vez que reserven el mismo
numero pasan los dos**, porque cuando cada uno se evaluo el numero todavia estaba libre. Si
ninguno se reejecuta entre un merge y el otro, el duplicado entra. Tres cosas lo acotan:

1. La comprobacion corre tambien en `push`, asi que `develop` se pone rojo en el momento del
   merge, y no cuando falle el despliegue.
2. Cualquier commit nuevo en el segundo PR lo reevalua contra el `develop` ya avanzado, y ahi si
   lo caza.
3. Activar `strict` en `develop` (exigir la rama al dia antes de mergear) fuerza esa reevaluacion
   siempre y cierra el hueco del todo. `main` ya lo tiene activo; `develop` no. Ver
   "Ramas protegidas".

### Caso de estudio: la `00061` y la `00062` duplicadas

`00061_agregar_rls_bodegas_y_proveedores.sql` y `00062_agregar_rls_bodegas_y_proveedores.sql`
crean las mismas cuatro politicas sobre las mismas dos tablas. La `00062` es la `00061` mas un
`DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`; por eso, aplicadas en ese orden, la
segunda reemplaza a la primera sin error y el CI, que aplica todo desde cero, sale en verde.

**No se corrigen.** Las dos ya estan aplicadas en `Ecopac-Digital-Dev`, asi que borrar o editar
cualquiera de las dos seria justo lo que prohibe la regla de arriba: cambiaria lo que valida el
CI sin cambiar nada en las bases reales. Quedan como estan, documentadas aqui.

Como se llego a eso: los PR #444 a #449 se crearon **unos encima de otros** en vez de cada uno
desde `develop`, asi que cada rama arrastraba los commits de la anterior y el mismo cambio de RLS
viajo en dos PR distintos con dos numeros de migracion.

De ahi la regla que ya esta en `AGENTS.md` y que conviene recordar con el caso concreto:

> **Una rama por issue, y siempre desde `develop` recien actualizado.** Nunca desde otra rama de
> trabajo, aunque lo que se necesite de ella parezca imprescindible.

Si de verdad hace falta algo que todavia esta en revision, es mejor esperar el merge que apilar:
apilar convierte cada PR en una revision de todo lo anterior, y ahi es donde un duplicado pasa
inadvertido.

### Caso de estudio: la `00031` que no existe

La secuencia tiene huecos en `00014`, `00015`, `00031` y `00043`. No son migraciones borradas:
esos numeros **nunca existieron**. Son numeros que una rama reservo y tuvo que abandonar porque
otra mergeo primero. El PR #395 llego a describir su archivo como `00043` en el cuerpo del PR y
termino mergeando como `00044`.

El hueco en si no hace dano. Lo que quedo es peor: los comentarios de la `00032`, la `00033` y la
`00034` **citan una `00031` que no existe**, y le atribuyen un `GRANT SELECT ON eventos_auditoria`
que en realidad esta en la `00032` y la `00038`. Tres migraciones aplicadas documentan mal el
esquema, y como no se pueden editar, ese error es permanente.

Es el argumento de por que la guarda de numeracion existe: el numero equivocado no solo rompe un
despliegue, tambien deja referencias cruzadas que ya no se pueden arreglar.

## Que hacer cuando falla el despliegue

El workflow abre una issue automatica. **Lo primero es leer que dice sobre el estado de la base**,
porque hay desenlaces muy distintos y se arreglan de forma opuesta. La issue lo afirma leyendo
el resultado de cada paso de la corrida, no suponiendolo.

Los casos 1, 2 y 4 son los que avisa el propio workflow de Supabase. Los casos 3 y 5 son los que
**ningun workflow puede avisar de si mismo**: en uno la corrida nunca se creo y en el otro se
cancelo antes de arrancar, asi que el job que avisa tampoco existio.

### Caso 1: el paso `Aplicar migraciones` no llego a correr

Algo fallo antes -instalar el CLI, vincular el proyecto, un secret que falta- y el `supabase db
push` quedo en `skipped`. **No se aplico nada y la base no quedo a medias.**

No hay ninguna migracion rota que buscar. Se mira el paso que si fallo, se corrige la causa y se
relanza la corrida; el siguiente push aplica lo pendiente igual, porque `db push` sube todo lo que
falte.

Es lo que paso en la issue #422: `setup-cli` no pudo resolver la version del CLI y el despliegue
murio en su primer paso. La base se puso al dia sola en el merge siguiente.

### Caso 2: el paso `Aplicar migraciones` corrio y fallo

Ahi si se detuvo dentro de una migracion y **la base puede haber quedado a medias**:

1. Abrir el log del job **Aplicar migraciones** y ver en que migracion se detuvo.
2. Preguntarse primero si alguna migracion ya aplicada fue editada. Es la causa mas comun.
3. Corregir con una migracion nueva y abrir un PR normal.
4. Tras el merge, confirmar con `supabase migration list --linked` que la base quedo al dia.
5. Cerrar la issue.

Nunca se arregla editando una migracion que **si llego a quedar aplicada**: eso deja la base a
medias y el proximo ambiente hereda el problema.

#### La excepcion: la migracion que fallo no quedo registrada

`supabase db push` aplica cada archivo **en una transaccion**. Si el error salta dentro de esa
transaccion, se revierte entera: ni el SQL ni la fila de `supabase_migrations.schema_migrations`
quedan. Esa migracion sigue **pendiente**, y el proximo push la vuelve a intentar **antes** que
cualquier archivo posterior.

Ahi corregir hacia adelante **no funciona**: la migracion nueva nunca se alcanza, porque el push
muere otra vez en la que ya falla. La unica salida es corregir el archivo que falla, con la
etiqueta `migracion-editada-a-proposito` en el PR. Es exactamente el caso que la seccion
[Cuando de verdad hay que editarla](#cuando-de-verdad-hay-que-editarla) autoriza: no se aplico en
ninguna base, asi que editarla no divide nada.

Antes de editar hay que **confirmarlo**, no suponerlo: `supabase migration list --linked` tiene
que mostrar esa version como pendiente en todas las bases (`develop` y `main`). Si alguna la
tiene aplicada, se vuelve al camino normal, migracion nueva.

### Caso 3: la corrida nunca se creo

Es el mas dificil de ver, porque **no hay nada rojo que mirar**. No falla un paso: no existe la
corrida.

El 26 de agosto GitHub Actions tardo horas en despachar workflows. En el commit `864d3e5`
-el merge del PR #447 en `develop`- solo se crearon dos check-runs, `Lint y build` y el
`Supabase Preview` de Vercel. **El workflow de Supabase nunca se creo para ese push**, asi que
`Aplicar migraciones` no corrio y la `00062` no se desplego.

Y nadie se entero, por una razon estructural: el job `Avisar fallo` vive **dentro de ese mismo
workflow**. Si el workflow no se crea, tampoco se crea el job que avisa.

> **Un workflow no puede avisar de que el mismo no existio.** Cualquier alerta que dependa de la
> corrida que fallo en crearse no sirve para esto.

#### Como se detecta

Con el workflow **Verificar despliegue**, que corre por su cuenta todos los dias y no depende de
ninguna corrida de despliegue. En vez de vigilar el proceso, mira el resultado: pregunta a cada
ambiente si tiene aplicadas todas las migraciones del repositorio.

```bash
supabase db push --dry-run --linked --output-format json
# {"upToDate":true,"dryRun":true,"migrations":[],...}
```

`--dry-run` no aplica nada. Si `upToDate` es `false`, `migrations` trae exactamente las que no
llegaron, y el workflow abre una issue con esa lista. Si ya hay una issue abierta para ese
ambiente, no la duplica.

Lo mismo se puede correr a mano en cualquier momento, o desde Actions con **Run workflow**.

#### Que hacer cuando aparece esa issue

1. Buscar el commit de merge que introdujo la primera migracion pendiente.
2. Abrir su pagina de checks y ver si tiene corrida del workflow de Supabase.
3. Si **no la tiene**, es este caso: relanzar el despliegue con `gh workflow run supabase.yml
--ref develop`, o con un commit vacio a la rama.
4. Si **si la tiene y fallo**, no es este caso: seguir el Caso 1 o el Caso 2 de arriba.
5. Confirmar con `supabase migration list --linked` que la base quedo al dia y cerrar la issue.

#### Que hacer si Actions no esta despachando corridas ahora mismo

Cuando se nota que un PR lleva minutos sin que aparezcan sus checks (o
[status.github.com](https://www.githubstatus.com/) reporta incidencia en Actions):

- **No mergear** un PR al que le falten checks porque no llegaron a crearse. Un check ausente no
  es un check en verde.
- Forzar la corrida con un push vacio (`git commit --allow-empty`) o con `gh run rerun`.
- **Nunca** usar el merge de administrador para saltarse un check que no aparecio. Es
  precisamente lo que deja una migracion sin desplegar sin que quede rastro.

Conviene saber que hoy **`enforce_admins` esta desactivado en `develop` y en `main`**, o sea que
esa puerta esta abierta y solo la cierra la disciplina del equipo. Ver "Ramas protegidas".

### Caso 4: la base tiene una migracion que la rama no

El paso **Comprobar el historial remoto** falla y `Aplicar migraciones` queda en `skipped`. **No
se aplico nada y la base no quedo a medias.** El resumen de la corrida lista las versiones que
sobran en la base.

Sin ese paso, el sintoma es el mensaje crudo del CLI:

```
Remote migration versions not found in local migrations directory.
supabase migration repair --status reverted 00088
```

Lo que hay detras: la base tiene registrada una migracion cuyo archivo no esta en la rama.
`supabase db push` valida el historial **completo** antes de mirar si hay algo pendiente, asi
que mientras eso dure **falla todo push a la rama, traiga migraciones o no**.

> Por eso este caso se reconoce por una senal rara: **fallo el despliegue de un merge que no
> toca una sola linea de SQL**. El commit que lo dispara casi nunca es el culpable.

La causa casi siempre es que alguien aplico esa migracion **a mano** contra `ecopac-dev` antes
de mergear su PR. Ver [Las migraciones se aplican mergeando, no a
mano](#las-migraciones-se-aplican-mergeando-no-a-mano).

Como se sale:

1. Buscar el PR que trae ese archivo y mergearlo. Con eso se arregla solo, y es lo que
   corresponde si la migracion es legitima y solo llego antes de tiempo.
2. Solo si esa migracion se descarto de verdad y no va a existir nunca, despegar el registro de
   la base con `supabase migration repair --status reverted <version>`.
3. Confirmar con `supabase migration list --linked` que la base quedo al dia.

Relanzar la corrida **no sirve**: el problema esta en la base, no en la corrida.

Caso real: el 30 de agosto la `00088` se aplico a mano contra `ecopac-dev` antes de que su PR
(#586) se mergeara. El merge que se comio el fallo fue el #588, un hook de filtros de reportes
sin nada de SQL. Se resolvio solo al entrar el #586.

### Caso 5: la corrida se cancelo sin ejecutar ningun job

Aparece como `cancelled` en la lista de Actions, pero al abrirla **no tiene ni un job**. Nadie la
cancelo a mano: la descarto la cola de concurrencia.

GitHub guarda **una sola corrida en espera** por grupo de concurrencia. Cuando el grupo era solo
la rama, cada push nuevo a `develop` descartaba a la que todavia no habia arrancado -y
`cancel-in-progress: false` no lo evita, porque solo protege a la que ya esta corriendo. El 30 de
agosto se perdieron asi los despliegues de `676acb3` y `c71692f`.

Hoy el grupo incluye el SHA en los push, asi que cada commit tiene el suyo y ninguno descarta a
otro:

```yaml
group: supabase-${{ github.ref }}-${{ github.event_name == 'push' && github.sha || 'pr' }}
```

En los PR se conserva el grupo por rama, que es donde si conviene cancelar lo superado.

Si aun asi aparece una corrida cancelada sin jobs, se trata como el Caso 3: la base pudo quedarse
atras y quien lo detecta es **Verificar despliegue**. Se relanza con `gh workflow run
supabase.yml --ref develop`.

## La version del CLI de Supabase va fija

Los cuatro pasos `Instalar Supabase CLI` -tres en `supabase.yml` y uno en
`verificar-despliegue.yml`- declaran `version: 2.115.0` y **no** `version: latest`. No es por
gusto:

`setup-cli` resuelve `latest` consultando la API de releases de GitHub **sin autenticar**, y los
runners comparten esa cuota por IP. El 25 de agosto el despliegue de `develop` murio con
`Failed to resolve latest Supabase CLI release: rate limit exceeded` sin aplicar una sola
migracion (issue #422). Con una version concreta esa llamada no se hace y el fallo no puede
repetirse.

De paso, el CI valida con la misma version que tiene instalada el equipo, en vez de con la que
resulte ser la ultima ese dia.

**Al subirla hay que cambiarla en los cuatro pasos a la vez**, y conviene que coincida con la
que usa el equipo en local (`supabase --version`).

## Correr las validaciones en local

Lo que corre el job **Lint y build**:

```bash
npm run verificar:shared-esquema
npm run verificar:shared-esquema -- --autoprueba
npm run lint
npm test
npm run build
```

La tabla de cobertura que se publica en el PR se puede ver igual en local, despues de correr
`npm test`:

```bash
node scripts/resumen-de-pruebas.mjs
```

El conteo de pruebas que acompana a esa tabla en el PR **no sale en local**: lo agrega el reporter
`github-actions` de vitest, que solo se activa dentro de Actions.

Lo que corre el job **Validar migraciones y funciones**:

```bash
supabase start
supabase db reset          # aplica todas las migraciones desde cero
supabase db lint --local --fail-on warning
```

Esto ultimo reproduce el job. Lo que no reproduce es el escenario incremental contra una base
con historial, que es justo lo que la guarda de inmutabilidad protege.

## Ramas protegidas

`develop` y `main` requieren Pull Request y no admiten push directo, force-push ni borrado.

Los nombres de los checks requeridos **no viven en el repositorio**: se configuran en
Settings > Branches y solo se cambian ahi. Es la unica parte del CI/CD que no entra por PR, y
por eso conviene tener escrito cual es el estado y cual deberia ser.

### Estado configurado hoy

|                                                      | `develop`                                                                    | `main`          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- | --------------- |
| Checks requeridos                                    | `Lint y build`, `Migraciones no editadas`, `Validar migraciones y funciones` | los mismos tres |
| Exigir la rama al dia (`strict`)                     | no                                                                           | si              |
| Aplicar tambien a administradores (`enforce_admins`) | **no**                                                                       | **no**          |

### Lo que conviene cambiar

1. **Reemplazar los dos checks de Supabase por `Supabase completo`.** Los checks requeridos
   quedan en dos nombres, `Lint y build` y `Supabase completo`, y dejan de romperse cada vez que
   se renombra o se agrega un job. El porque esta en "Por que existe Supabase completo".
2. **Activar `enforce_admins` en las dos ramas.** Hoy un administrador puede mergear saltandose
   un check que no aparecio, que es exactamente como se cuela una migracion sin desplegar. Es un
   cambio de politica del equipo, no una decision tecnica: conviene acordarlo antes de activarlo,
   porque tambien quita la salida de emergencia para desbloquear un PR atascado.

3. **Activar `strict` en `develop`** (exigir la rama al dia antes de mergear). `main` ya lo tiene.
   Es lo unico que cierra del todo el hueco de dos PR que reservan el mismo numero de migracion,
   porque obliga a reevaluar el PR contra el `develop` ya avanzado. El coste es que hay que
   actualizar la rama antes de mergear cuando develop avanzo.

Cuidado con el orden al hacer el cambio 1: **agregar `Supabase completo` primero, comprobar en un
PR que aparece, y solo entonces quitar los otros dos.** Si se agrega un check que todavia no
existe en ningun workflow, los PR abiertos quedan esperando para siempre un check que nadie va a
reportar.

Y al reves: quitar un check requerido no rompe nada, pero deja de bloquear en el momento. Los dos
cambios se hacen en Settings > Branches > Edit, en la seccion "Require status checks to pass
before merging".

## Cuando toman efecto los cambios a los workflows

| Disparador                      | De donde toma el archivo        | Cuando aplica                                             |
| ------------------------------- | ------------------------------- | --------------------------------------------------------- |
| `pull_request`                  | Del merge ref (base + PR)       | En el propio PR que lo introduce                          |
| `push`                          | Del commit pusheado             | Al mergear a develop o a main                             |
| `schedule`, `workflow_dispatch` | De la rama por defecto (`main`) | Solo tras promover develop a main                         |
| Ramas protegidas                | No vive en el repositorio       | Al configurarlo en Settings, sin depender de ningun merge |

Por eso un cambio al keep-alive no surte efecto hasta que `develop` llegue a `main`, aunque el
archivo ya este en develop.

**Y por eso `Verificar despliegue` no va a correr solo al mergearlo a `develop`.** Se dispara por
`schedule`, asi que GitHub lo lee de `main`: hasta la siguiente promocion a produccion, la
comprobacion diaria no existe. Mientras tanto se puede correr a mano desde Actions >
Verificar despliegue > Run workflow, eligiendo la rama, porque `workflow_dispatch` si permite
escoger de donde tomar el archivo.
