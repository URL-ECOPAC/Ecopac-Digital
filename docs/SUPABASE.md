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

**Esto no es lo mismo que el servicio `db-local` de `docker-compose.yml`.** Ese servicio es un
Postgres generico, sin Auth ni Storage ni Studio, pensado solo como respaldo rapido para
probar SQL sin depender de internet. El stack real de Supabase (con todo lo que la app
realmente usa) es el que levanta `supabase start`.

## El flujo completo de una migracion

```
1. Alguien edita o crea un archivo en supabase/migrations/*.sql
2. Abre un Pull Request hacia develop
3. El workflow backend-ci.yml levanta un Supabase local desechable,
   aplica todas las migraciones desde cero (supabase db reset) y
   revisa el esquema (supabase db lint). Si hay un error de SQL, el PR falla ahi.
4. Se aprueba y mergea el PR
5. El workflow supabase-migrations.yml aplica esa migracion contra el
   proyecto real en la nube (supabase db push): Ecopac-Digital-Dev si el push
   fue a develop, Ecopac-Digital-Prod si fue a main.
6. La app conectada a ese proyecto ya tiene el cambio, sin que nadie
   lo haya escrito a mano en el dashboard.
```

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
concediendole TRUNCATE a `anon`. La prueba
`supabase/tests/database/privilegios_anon.sql` lo verifica; corre con `supabase test db`.

## Requisitos para trabajar con el stack local

- Tener Docker corriendo (la Supabase CLI lo necesita para levantar Postgres, Auth, etc.).
- Instalar la Supabase CLI: ver
  [supabase.com/docs/guides/cli/getting-started](https://supabase.com/docs/guides/cli/getting-started).
- No hace falta el stack local para simplemente usar la app conectada a `Ecopac-Digital-Dev` - solo
  hace falta para quien va a escribir o probar migraciones de base de datos.

## Acceso al proyecto en la nube

Ver la tabla de secrets y accesos del equipo en [QUICKSTART.md](./QUICKSTART.md#secrets-de-github-actions-cicd).
