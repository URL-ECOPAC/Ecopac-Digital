# CI/CD - Ecopac Digital

Que corre automaticamente, cuando, contra que ambiente, y que hacer cuando algo falla.

## Los tres workflows

| Workflow | Archivo | Cuando corre |
| -------- | ------- | ------------ |
| CI | `.github/workflows/ci.yml` | PR hacia develop o main, y push a esas ramas |
| Supabase | `.github/workflows/supabase.yml` | PR hacia develop o main, y push a esas ramas |
| Mantener Supabase activo | `.github/workflows/keep-alive-supabase.yml` | Cada 3 dias, y a mano |

El despliegue de la web **no** es un workflow: lo hace la app de Vercel conectada al
repositorio. Vercel publica un preview por cada PR y produccion desde `main`, al margen del
CI, asi que un CI en rojo no detiene un deploy de Vercel.

## Que hace el workflow de CI

Un solo job, **Lint y build**, que corre en este orden:

1. `npm run lint` en todos los workspaces.
2. `npm test` en todos los workspaces que tengan el script (issue #218).
3. Build de la web con los secrets del ambiente que corresponde a la rama.

Las pruebas van antes del build a proposito: una prueba rota se ve en segundos, sin esperar a
que la web compile. Y van dentro de este job y no en uno propio porque **Lint y build** ya es
check requerido en `develop` y `main`; un job nuevo no lo seria hasta que alguien lo agregue en
Settings > Branches, y mientras tanto un PR con pruebas en rojo se podria mergear igual.

## Que hace el workflow de Supabase

Siete jobs. Los cuatro primeros validan; los ultimos despliegan y avisan.

| Job | Cuando | Que hace |
| --- | ------ | -------- |
| Detectar cambios | siempre | Averigua si el cambio toca `supabase/`, para no levantar el stack local sin necesidad |
| **Migraciones no editadas** | PR | Falla si el PR modifica o borra una migracion que ya existe en la rama base |
| **Numeracion de migraciones** | PR y push | Falla si dos migraciones comparten numero, o si el PR agrega una por debajo de la ultima de la rama base |
| **Validar migraciones y funciones** | PR y push | Levanta el stack local, aplica todas las migraciones desde cero, corre `db lint` y el lint de Edge Functions |
| Estado de la base remota | PR | Lista que migraciones estan aplicadas en `ecopac-dev` y cuales se aplicarian al mergear |
| Aplicar migraciones | push a develop o main | `supabase db push` contra el proyecto del ambiente. Depende de que los dos jobs en negrita hayan pasado |
| Avisar fallo | si algo fallo en un push | Abre una issue con el enlace a la corrida |

Los jobs en negrita son **checks requeridos**: sin ellos en verde, la rama protegida no deja
mergear.

## Ambientes

| Rama | Proyecto Supabase | Secret del project-ref | Despliegue web |
| ---- | ----------------- | ---------------------- | -------------- |
| `develop` | Ecopac-Digital-Dev | `SUPABASE_PROJECT_REF_DEV` | Local |
| `main` | Ecopac-Digital-Prod | `SUPABASE_PROJECT_REF_PROD` | Vercel Produccion |

Cada migracion se aplica **una vez por base**. El push a `develop` va contra `Ecopac-Digital-Dev` y el
push a `main` contra `Ecopac-Digital-Prod`: son bases distintas, no una doble aplicacion. Ademas
`supabase db push` consulta `supabase_migrations.schema_migrations` del destino y aplica solo
lo pendiente, asi que aunque el workflow corriera dos veces no repetiria nada.

### Secrets

Se configuran en Settings > Secrets and variables > Actions.

| Secret | Lo usa |
| ------ | ------ |
| `SUPABASE_ACCESS_TOKEN` | Vincular con proyectos remotos |
| `SUPABASE_DB_PASSWORD` | Vincular con proyectos remotos |
| `SUPABASE_PROJECT_REF_DEV` | Aplicar migraciones en develop |
| `SUPABASE_PROJECT_REF_PROD` | Aplicar migraciones en main |
| `SUPABASE_URL_DEV`, `SUPABASE_ANON_KEY_DEV` | Keep-alive |
| `VITE_SUPABASE_URL_DEV`, `VITE_SUPABASE_ANON_KEY_DEV` | Build de la web en develop |
| `VITE_SUPABASE_URL_PROD`, `VITE_SUPABASE_ANON_KEY_PROD` | Build de la web en main |

Cuando falta un secret, el workflow **avisa de forma visible pero no falla**: deja un bloque en
el resumen de la corrida y una anotacion de warning. La idea es no bloquear al equipo mientras
termina de configurar los ambientes, pero que una omision nunca se vea igual que un despliegue
exitoso.

## La regla mas importante: una migracion aplicada no se edita

Cuando una migracion corre en una base, Supabase la registra en
`supabase_migrations.schema_migrations` y **no la vuelve a ejecutar nunca**. Editar el archivo
despues no cambia nada en esa base.

Eso crea una divergencia silenciosa:

| | Que ejecuta |
| --- | --- |
| El CI en el PR | `supabase db reset`: aplica **todo desde cero** en una base limpia |
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

## Como se elige el numero de una migracion

El numero es el prefijo del archivo: `00053_seguimiento_avance_proyectos.sql`. Se toma el
siguiente al ultimo que haya en `develop` en ese momento.

**El numero se elige al abrir la rama y se vuelve a verificar antes de mergear.** Entre una
cosa y la otra pueden pasar dias, y en ese rato otras ramas mergean las suyas. Es la parte que
mas se olvida y la que produce los dos problemas de abajo.

Una issue **nunca** prescribe un numero de migracion. Si hay que mencionarlo, se dice "revisar
que migracion corresponde".

### Dos migraciones con el mismo numero

Cual corre primero pasa a depender del resto del nombre del archivo, no de la intencion de
quien las escribio. La secuencia ya tiene huecos en `00014`, `00015`, `00031` y `00043`:
numeros que una rama reservo y tuvo que abandonar porque otra mergeo primero.

Quedo ademas una consecuencia permanente: los comentarios de `00032`, `00033` y `00034` citan
una migracion `00031` que no existe. Como no se pueden editar, ese error se queda.

### Una migracion nueva por debajo de la ultima aplicada

El caso mas frecuente, y el que no se ve venir. El PR se abre con el numero correcto, espera
revision, y mientras tanto entran otras. Al mergear, el job **Aplicar migraciones** corre
`supabase db push`, que aborta:

```
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations.
```

**No se resuelve pasando `--include-all`.** Aplicar fuera de orden separa el estado real de la
base del que valida el CI, que aplica todo desde cero — la misma divergencia que evita la
guarda de inmutabilidad. Lo que se hace es renumerar por encima de la ultima:

```bash
git mv supabase/migrations/00043_lo_que_sea.sql supabase/migrations/00053_lo_que_sea.sql
```

Renombrar un archivo que ninguna base aplico todavia no tiene coste, y contra la rama base
sigue figurando como archivo nuevo, asi que la guarda de inmutabilidad no se dispara.

### Que comprueba el CI

El job **Numeracion de migraciones** falla en los dos casos. No mira el diff, mira el arbol que
queda tras el merge, porque el choque lo produce la suma de dos PRs que por separado son
correctos. Corre en cada push a la rama del PR, asi que la verificacion previa al merge la hace
solo.

Las versiones se comparan como texto, que es como Supabase decide el orden de aplicacion. Con
prefijos de cinco digitos coincide con el orden numerico, y un timestamp (`20260825190000`)
siempre queda despues de un `000NN`: si algun dia se adopta la convencion nativa de Supabase
(`supabase migration new`), la guarda sigue sirviendo sin cambios.

## Que hacer cuando falla el despliegue

El workflow abre una issue con el enlace a la corrida. El procedimiento:

1. Abrir el log del job **Aplicar migraciones** y ver en que migracion se detuvo.
2. Preguntarse primero si alguna migracion ya aplicada fue editada. Es la causa mas comun.
3. Corregir con una migracion nueva y abrir un PR normal.
4. Tras el merge, confirmar con `supabase migration list --linked` que la base quedo al dia.
5. Cerrar la issue.

Nunca se arregla editando la migracion que fallo: eso deja la base a medias y el proximo
ambiente hereda el problema.

## Correr las validaciones en local

Lo que corre el job **Lint y build**:

```bash
npm run lint
npm test
npm run build
```

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
Checks requeridos: **Lint y build**, **Migraciones no editadas** y **Validar migraciones y
funciones**.

Si se renombra un job, hay que actualizar el check requerido en Settings > Branches. Los
nombres de los checks no viven en el repositorio: un PR esperando un check que ya no existe
queda bloqueado para siempre.

## Cuando toman efecto los cambios a los workflows

| Disparador | De donde toma el archivo | Cuando aplica |
| ---------- | ------------------------ | ------------- |
| `pull_request` | Del merge ref (base + PR) | En el propio PR que lo introduce |
| `push` | Del commit pusheado | Al mergear a develop o a main |
| `schedule`, `workflow_dispatch` | De la rama por defecto (`main`) | Solo tras promover develop a main |
| Ramas protegidas | No vive en el repositorio | Al configurarlo en Settings, sin depender de ningun merge |

Por eso un cambio al keep-alive no surte efecto hasta que `develop` llegue a `main`, aunque el
archivo ya este en develop.
