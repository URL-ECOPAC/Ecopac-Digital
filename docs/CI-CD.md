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

1. `npm run lint` en todos los workspaces.
2. `npm test` en todos los workspaces que tengan el script (issue #218).
3. Build de la web con los secrets del ambiente que corresponde a la rama.

Las pruebas van antes del build a proposito: una prueba rota se ve en segundos, sin esperar a
que la web compile. Y van dentro de este job y no en uno propio porque **Lint y build** ya es
check requerido en `develop` y `main`; un job nuevo no lo seria hasta que alguien lo agregue en
Settings > Branches, y mientras tanto un PR con pruebas en rojo se podria mergear igual.

## Que hace el workflow de Supabase

Siete jobs. Los tres primeros validan, los siguientes despliegan y avisan, y el ultimo
resume el resultado de todos.

| Job                                 | Cuando                   | Que hace                                                                                                     |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Detectar cambios                    | siempre                  | Averigua si el cambio toca `supabase/`, para no levantar el stack local sin necesidad                        |
| **Migraciones no editadas**         | PR                       | Falla si el PR modifica o borra una migracion que ya existe en la rama base                                  |
| **Validar migraciones y funciones** | PR y push                | Levanta el stack local, aplica todas las migraciones desde cero, corre `db lint` y el lint de Edge Functions |
| Estado de la base remota            | PR                       | Lista que migraciones estan aplicadas en `Ecopac-Digital-Dev` y cuales se aplicarian al mergear              |
| Aplicar migraciones                 | push a develop o main    | `supabase db push` contra el proyecto del ambiente. Depende de que los dos jobs en negrita hayan pasado      |
| Avisar fallo                        | si algo fallo en un push | Abre una issue con el paso que fallo y **si las migraciones se aplicaron o no**                              |
| Supabase completo                   | siempre                  | Mira el resultado de los cuatro jobs de validacion y falla si alguno termino en `failure` o `cancelled`      |

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

No se puede llegar a **un** unico check para todo el repositorio: `Lint y build` vive en otro
workflow y un job no puede declarar `needs` de un workflow ajeno. El minimo son dos nombres.

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

## Que hacer cuando falla el despliegue

El workflow abre una issue automatica. **Lo primero es leer que dice sobre el estado de la base**,
porque hay desenlaces muy distintos y se arreglan de forma opuesta. La issue lo afirma leyendo
el resultado de cada paso de la corrida, no suponiendolo.

Los casos 1 y 2 son los que avisa el propio workflow de Supabase. El caso 3 es el que **ningun
workflow puede avisar de si mismo**, y por eso lo detecta otro workflow aparte.

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
