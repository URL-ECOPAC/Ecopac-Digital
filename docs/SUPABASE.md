# Supabase: nube vs local - Ecopac Digital

Este documento explica como funciona Supabase en el proyecto: donde vive el dato real, donde
se prueban los cambios de esquema, y como se sincronizan ambos. Complementa a
[QUICKSTART.md](./QUICKSTART.md) (que cubre credenciales y secrets) y a
[CONTRIBUTING.md](./CONTRIBUTING.md) (que cubre ramas y PRs).

## Dos formas distintas de trabajar con Supabase

### 1. El proyecto en la nube (`Ecopac-Digital-Dev` / `Ecopac-Digital-Prod`)

Es el proyecto real creado en supabase.com. Ahi es donde la app (web y movil) se conecta
cuando alguien la corre normalmente - las variables `VITE_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_URL` en `.env.development` apuntan a `Ecopac-Digital-Dev`.

Desde el dashboard de Supabase (Studio en la nube) se puede ver el contenido de las tablas,
los usuarios de autenticacion, los archivos en storage, etc. Es el equivalente al panel de
administracion de la base de datos.

**Regla importante:** el esquema (tablas, columnas, politicas RLS) no se edita a mano desde
el dashboard una vez que el desarrollo esta en marcha. Se edita escribiendo archivos `.sql` en
`supabase/migrations/`. Asi el historial de cambios a la base de datos queda versionado en Git
como cualquier otro codigo, y no depende de que alguien recuerde que cambio y por que.

### 2. El stack local (`supabase start`)

`supabase/config.toml` es la configuracion para correr una copia completa de Supabase
(Postgres, Auth, Storage, Studio) en la propia maquina, usando la Supabase CLI. Este stack
local es administrado automaticamente por la CLI (usa Docker por debajo, pero es un Docker
distinto al de `docker-compose.yml` del repo).

Comandos principales:

```bash
supabase start        # levanta el stack local completo
supabase db reset      # borra la base local y vuelve a aplicar todas las migraciones desde cero
supabase stop           # apaga el stack local
```

Sirve para probar una migracion nueva antes de que toque el proyecto real, sin arriesgar los
datos de `Ecopac-Digital-Dev`.

`docker-compose.yml` tenia antes un servicio `db-local`, un Postgres generico sin Auth ni
Storage ni Studio, pensado como respaldo rapido para probar SQL sin depender de internet. Se
retiro en la issue #515: montaba `supabase/migrations` sobre `postgres:16-alpine` liso, que no
tiene el esquema `auth`, el esquema `extensions` ni los roles `anon`/`authenticated`/
`service_role` que la primera migracion ya asume, asi que nunca llegaba a aplicar ni una. El
stack real de Supabase (con todo lo que la app realmente usa) es el que levanta
`supabase start`, y es el unico camino local desde esta issue.

## El flujo completo de una migracion

```
1. Alguien crea un archivo en supabase/migrations/, con el nombre
   NNNNN_descripcion_en_snake_case.sql y un numero MAYOR que el ultimo
   que haya en develop (ver mas abajo: el numero se elige dos veces)
2. Abre un Pull Request hacia develop
3. El workflow supabase.yml levanta un Supabase local desechable,
   aplica todas las migraciones desde cero (supabase db reset) y
   revisa el esquema (supabase db lint). Si hay un error de SQL, el PR falla ahi.
   Ahi mismo se comprueba que la numeracion no choque con otra rama.
4. Se aprueba y mergea el PR
5. Ese mismo workflow aplica la migracion contra el proyecto real en la
   nube (supabase db push): Ecopac-Digital-Dev si el push fue a develop,
   Ecopac-Digital-Prod si fue a main.
6. La app conectada a ese proyecto ya tiene el cambio, sin que nadie
   lo haya escrito a mano en el dashboard.
```

### El numero se elige dos veces

El paso 1 tiene una trampa: el numero se elige al abrir la rama, pero **hay que volver a
verificarlo antes de mergear**, porque otra rama pudo tomarlo mientras tanto. Repetir un numero
o quedar por debajo del ultimo de `develop` rompe el despliegue, no solo el orden. El CI lo
comprueba, y el detalle de que pasa exactamente en cada caso esta en
`docs/CI-CD.md` > "La otra regla: el numero se elige dos veces".

El punto clave: ningun cambio de esquema llega al proyecto real sin pasar primero por un PR
revisado y una prueba automatica local. El dashboard de Supabase se usa para consultar datos,
no para modificar el esquema.

## Privilegios: que rol puede tocar que tabla

Supabase expone la base por PostgREST con dos roles de PostgreSQL, y la diferencia entre ellos
es de donde viene la peticion:

| Rol             | Quien es                                                                                             | Que puede tocar en `public`                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `anon`          | Cualquier peticion **sin sesion**, con la llave anonima que viaja publica en el bundle del navegador | **Nada.** Ni una tabla, ni una vista                                                                   |
| `authenticated` | Una peticion con el JWT de un usuario que inicio sesion                                              | SELECT, INSERT, UPDATE y DELETE segun lo que conceda cada migracion de politicas, y **nunca** TRUNCATE |

**`anon` no necesita acceso a ninguna tabla.** El inicio de sesion no pasa por PostgREST:
`iniciarSesion()` de `packages/shared/api/sesion.js` llama a `auth.signInWithPassword`, que es un
endpoint de GoTrue, y el perfil se lee despues, ya con el JWT del usuario. Tampoco hay registro
de cuentas desde el cliente.

Si alguna vez hace falta exponer algo a `anon`, se concede explicitamente en su propia migracion
y se justifica ahi por que. Lo que no se hace es agregar `anon` a la lista de un `GRANT` por
costumbre.

**RLS no es suficiente por si sola.** Las politicas de fila gobiernan SELECT, INSERT, UPDATE y
DELETE, pero `TRUNCATE` se controla unicamente por el privilegio del mismo nombre: ninguna policy
llega a evaluarse. Por eso el `GRANT` es la segunda capa, y por eso ni `anon` ni `authenticated`
tienen TRUNCATE sobre ninguna tabla.

La migracion `00049_retirar_privilegios_anon.sql` deja ese estado y ademas blinda los privilegios
por defecto del esquema, para que una tabla creada por una migracion futura no vuelva a nacer
concediendole TRUNCATE a `anon`.

**El CI hace cumplir la regla.** El job "Validar migraciones y funciones" corre el paso
`Verificar que anon no tenga privilegios`, que despues de aplicar todas las migraciones desde cero
ejecuta:

```bash
supabase test db supabase/tests/database/privilegios_anon.sql
```

Si tu PR deja a `anon` con cualquier privilegio sobre `public`, ese paso falla y nombra la tabla.
Comprueba el **estado real** de la base, no el texto de las migraciones: da igual como se conceda.

Hizo falta porque ya paso una vez. La `00052` volvio a escribir `GRANT SELECT ON gastos TO anon,
authenticated` copiando el patron de las migraciones anteriores a la `00049` (issue #435). Esas
migraciones estan aplicadas y no se pueden editar, asi que el mal ejemplo sigue visible: lo unico
que puede impedir la proxima copia es la guarda.

Para comprobarlo a mano en cualquier momento, la `00056` deja una vista que debe devolver siempre
cero filas:

```sql
SELECT * FROM privilegios_de_anon;
```

## Requisitos para trabajar con el stack local

- Tener Docker corriendo (la Supabase CLI lo necesita para levantar Postgres, Auth, etc.).
- Instalar la Supabase CLI: ver
  [supabase.com/docs/guides/cli/getting-started](https://supabase.com/docs/guides/cli/getting-started).
- No hace falta el stack local para simplemente usar la app conectada a `Ecopac-Digital-Dev` - solo
  hace falta para quien va a escribir o probar migraciones de base de datos.

## Acceso al proyecto en la nube

Ver la tabla de secrets y accesos del equipo en [QUICKSTART.md](./QUICKSTART.md#secrets-de-github-actions-cicd).
