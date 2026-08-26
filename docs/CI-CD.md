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

Seis jobs. Los tres primeros validan; los ultimos despliegan y avisan.

| Job | Cuando | Que hace |
| --- | ------ | -------- |
| Detectar cambios | siempre | Averigua si el cambio toca `supabase/`, para no levantar el stack local sin necesidad |
| **Migraciones no editadas** | PR | Falla si el PR modifica o borra una migracion que ya existe en la rama base |
| **Validar migraciones y funciones** | PR y push | Levanta el stack local, aplica todas las migraciones desde cero, corre `db lint` y el lint de Edge Functions |
| Estado de la base remota | PR | Lista que migraciones estan aplicadas en `ecopac-dev` y cuales se aplicarian al mergear |
| Aplicar migraciones | push a develop o main | `supabase db push` contra el proyecto del ambiente. Depende de que los dos jobs en negrita hayan pasado |
| Avisar fallo | si algo fallo en un push | Abre una issue con el paso que fallo y **si las migraciones se aplicaron o no** |

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

## Que hacer cuando falla el despliegue

El workflow abre una issue automatica. **Lo primero es leer que dice sobre el estado de la base**,
porque hay dos desenlaces muy distintos y se arreglan de forma opuesta. La issue lo afirma leyendo
el resultado de cada paso de la corrida, no suponiendolo.

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

Nunca se arregla editando la migracion que fallo: eso deja la base a medias y el proximo
ambiente hereda el problema.

## La version del CLI de Supabase va fija

Los tres pasos `Instalar Supabase CLI` del workflow declaran `version: 2.115.0` y **no**
`version: latest`. No es por gusto:

`setup-cli` resuelve `latest` consultando la API de releases de GitHub **sin autenticar**, y los
runners comparten esa cuota por IP. El 25 de agosto el despliegue de `develop` murio con
`Failed to resolve latest Supabase CLI release: rate limit exceeded` sin aplicar una sola
migracion (issue #422). Con una version concreta esa llamada no se hace y el fallo no puede
repetirse.

De paso, el CI valida con la misma version que tiene instalada el equipo, en vez de con la que
resulte ser la ultima ese dia.

**Al subirla hay que cambiarla en los tres pasos a la vez**, y conviene que coincida con la que
usa el equipo en local (`supabase --version`).

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
