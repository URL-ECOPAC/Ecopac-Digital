# Seguridad de autenticacion - Ecopac Digital

Este documento reune la politica de contrasenas, bloqueo de cuenta y expiracion de sesion
(issue #230, RNF-10 y OWASP A07). Complementa a [SUPABASE.md](./SUPABASE.md) (nube vs local,
privilegios de roles) y no repite lo que ya esta ahi.

## Alcance de este documento

Issue #230 pedia cinco criterios. Tres quedaron fuera de este documento porque salieron del
alcance del issue durante su revision:

- **Bloqueo de cuenta tras intentos fallidos + registro del intento** (criterio 2 original):
  se movio a un issue nuevo. Motivo: Supabase Auth no tiene bloqueo nativo por cuenta (solo
  limites por IP, ver mas abajo), y la unica forma de bloquear el intento tambien para quien
  llame a `signInWithPassword` directo con la llave anonima (sin pasar por esta aplicacion) es
  un mecanismo del lado de GoTrue, no de `packages/shared`. Ver "Bloqueo por intentos fallidos
  (fuera de alcance)" mas abajo.
- **El bug de wiring del login web** (dos implementaciones de `iniciarSesion`, una de las
  cuales no revisa `perfil.activo`): es anterior a #230 y se corrige en un bug aparte. Ver
  "Login web: bug de wiring conocido (fuera de alcance)" mas abajo.

## 1. Politica de contrasenas (criterio 1)

La politica tiene dos mitades que tienen que coincidir, y cada una se configura en un lugar
distinto:

| Mitad | Donde vive | Regla |
| --- | --- | --- |
| Cliente (web y movil) | [`packages/shared/usuarios/validaciones.js`](../packages/shared/usuarios/validaciones.js) | Minimo 8 caracteres (`LONGITUD_MINIMA_CONTRASENA`, linea 31), al menos una letra y al menos un numero (`REGLAS_DE_CONTRASENA`, lineas 39-55) |
| Servidor (Supabase Auth) | Dashboard del proyecto, no versionable en `supabase/config.toml` | Se configura a mano, ver instrucciones abajo |

Esta regla solo aplica a contrasenas **nuevas** (alta, cambio, restablecimiento):
`validarCredenciales()` ([validaciones.js:198-218](../packages/shared/usuarios/validaciones.js#L198-L218)),
que es la que usa el formulario de inicio de sesion, deliberadamente NO exige fortaleza al
iniciar sesion. Es una decision previa (issue #96): subir la exigencia en Supabase Auth no
reevalua contrasenas ya creadas (Supabase no puede volver a validar un hash existente contra
una regla nueva), asi que no deja fuera a nadie que haya creado su cuenta antes de esta
politica.

### Instrucciones de Dashboard (repetir en los dos proyectos)

Hace falta repetirlo en `Ecopac-Digital-Dev` y en `Ecopac-Digital-Prod` por separado (son
proyectos Supabase distintos, ver [SUPABASE.md](./SUPABASE.md)). Los rotulos exactos de
pantalla pueden variar segun la version de Supabase Studio; esto es lo mejor verificado sin
acceso al Dashboard real del proyecto:

1. Entrar a [supabase.com/dashboard](https://supabase.com/dashboard) y seleccionar el proyecto
   (`Ecopac-Digital-Dev` primero).
2. Ir a **Authentication > Policies** (o **Authentication > Providers > Email**, segun la
   version — buscar la seccion "Password Requirements" / "Minimum password length").
3. Fijar la longitud minima en **8**.
4. Si la version del plan lo permite, fijar la regla de complejidad mas cercana a "letras y
   numeros", para que coincida con `REGLAS_DE_CONTRASENA`.
5. Repetir exactamente igual en `Ecopac-Digital-Prod`.

## 2. Expiracion de sesion (criterio 3)

Hay dos mecanismos, y son cosas distintas a proposito:

- **Control real (servidor):** `jwt_expiry` y la rotacion de refresh token de Supabase Auth,
  versionados en [`supabase/config.toml`](../supabase/config.toml) bajo `[auth]`. Esto expira
  la sesion sin importar que haga el cliente.
- **Capa de interfaz (cliente):** un temporizador de inactividad,
  [`packages/shared/hooks/useExpiracionPorInactividad.js`](../packages/shared/hooks/useExpiracionPorInactividad.js),
  montado en `apps/web/src/components/MainLayout.jsx`. Cierra la sesion localmente si nadie
  interactua con la pagina (`mousemove`, `keydown`, `mousedown`, `touchstart`, `scroll`)
  durante `MINUTOS_INACTIVIDAD_POR_DEFECTO` minutos.

**El temporizador de cliente NO es un control de seguridad.** Quien controla el navegador (o
abre la consola de devtools) puede desactivarlo sin esfuerzo — solo mejora la experiencia de
quien deja la sesion abierta por descuido en un dispositivo compartido. Lo que de verdad limita
cuanto dura una sesion robada o abandonada es `jwt_expiry` en el servidor, que sigue vigente
sin importar el cliente.

**El numero de minutos NO esta acordado.** `MINUTOS_INACTIVIDAD_POR_DEFECTO = 30` en el hook, y
`jwt_expiry = 3600` (1 hora) en `config.toml`, son valores de partida para no dejar el codigo
sin default — no una decision tomada con la organizacion. Cuando se acuerde el numero real, hay
que actualizar los dos lugares.

## 3. Almacenamiento de contrasenas y logs (criterio 4)

Ya se cumple; no hubo que cambiar codigo.

- Supabase Auth (GoTrue) guarda las contrasenas hasheadas con **bcrypt** en
  `auth.users.encrypted_password`. El repositorio nunca toca esa columna ni la tabla
  `auth.users` directamente: solo llama a `auth.signInWithPassword` / `auth.signUp` de
  `supabase-js`, que nunca devuelve el hash al cliente.
- Se revisaron todos los `console.log/error/warn` de `packages/shared` y las pantallas de login
  de ambas apps. Ninguno loguea el objeto de credenciales completo (`{correo, contrasena}`).
  Los dos `console.warn` de
  [`packages/shared/api/cliente.js`](../packages/shared/api/cliente.js) son mensajes fijos sin
  datos de usuario. El `console.error` de
  [`packages/shared/usuarios/useRestablecerContrasena.js:27`](../packages/shared/usuarios/useRestablecerContrasena.js#L27)
  solo puede traer un correo (esa llamada nunca recibe una contrasena) y es alcance de la issue
  #101, no de esta; se dejo sin tocar.
- `apps/mobile/src/screens/LoginScreen.js` es un placeholder sin logica de login todavia, asi
  que no hay nada que revisar ahi por ahora.

## 4. `supabase/config.toml`: que aplica y que no

**Aviso importante, para quien vaya a tocar `[auth]` en `config.toml` creyendo que eso alcanza
produccion:** `.github/workflows/supabase.yml` (el unico workflow que despliega a
`Ecopac-Digital-Dev` y `Ecopac-Digital-Prod`) solo corre `supabase db push`, que aplica
**migraciones de esquema**. En ningun paso corre `supabase config push`, que es el comando que
sincroniza la seccion `[auth]` de este archivo con un proyecto remoto.

Eso significa que `jwt_expiry`, `enable_refresh_token_rotation`, `refresh_token_reuse_interval`
y `[auth.rate_limit]` en `config.toml` **hoy solo afectan el stack local** (`supabase start`,
`supabase db reset`) y la validacion del CI. El valor que de verdad rige en `Ecopac-Digital-Dev`
y `Ecopac-Digital-Prod` es el que este configurado en el Dashboard de cada proyecto
(**Authentication > Sessions** para la duracion de sesion, **Authentication > Rate Limits**
para los limites de intentos), y hay que mantenerlo sincronizado a mano con lo que diga este
archivo.

**Recomendacion, no implementada:** agregar un paso `supabase config push` al job `aplicar` de
`.github/workflows/supabase.yml`, para que `config.toml` deje de ser documentacion y pase a ser
la fuente real de la configuracion de Auth, igual que ya lo es para el esquema. Es una decision
de infraestructura que excede este documento.

Los limites de `[auth.rate_limit]` (`sign_in_sign_ups`, `token_verifications`, `token_refresh`)
son el default de la CLI, dejados explicitos para que quede documentado que existen y para que
sea facil ajustarlos. Son limites **por IP** en una ventana de 5 minutos: no bloquean una cuenta
especifica ni dejan un registro de intentos por cuenta (ver la seccion siguiente).

## Bloqueo por intentos fallidos (fuera de alcance de #230)

El criterio "tras varios intentos fallidos la cuenta se bloquea temporalmente y el intento
queda registrado" se investigo pero se movio a un issue nuevo ("Bloqueo de cuenta tras
intentos fallidos de inicio de sesion"). Motivo resumido (el detalle completo, con las
opciones evaluadas, esta en el issue):

- Supabase Auth no tiene bloqueo nativo por cuenta, solo los limites por IP de la seccion
  anterior.
- Un contador construido en `packages/shared` (tabla propia + logica en
  `packages/shared/api/sesion.js`) **no es un control de seguridad real**: la llave anonima de
  Supabase es publica por definicion, asi que cualquiera puede llamar a
  `auth.signInWithPassword` directamente, sin pasar por `sesion.js` ni por esta aplicacion. Un
  bloqueo que solo vive del lado del cliente protege a quien use nuestra interfaz, no a la
  cuenta frente a un atacante — que es precisamente de quien protege este criterio.
- Lo unico que corre del lado de GoTrue sin importar quien llame es un **Auth Hook** de
  Supabase (`password_verification_attempt`), que se ejecuta en cada intento de verificacion de
  contrasena sin importar el cliente que lo origino. Su disponibilidad depende del plan
  contratado del proyecto (verificar antes de decidir el enfoque).

## Login web: bug de wiring conocido (fuera de alcance de #230)

Durante la investigacion de #230 se encontro un bug preexistente en el formulario de login
web, anterior e independiente de este issue. Queda para un bug aparte; se documenta aqui para
que no se pierda:

`packages/shared` tiene dos implementaciones independientes de `iniciarSesion`. La cuidadosa
(`packages/shared/api/sesion.js`, issue #97) valida con `validarCredenciales`, revisa
`perfil.activo` antes de dar la sesion por valida, y devuelve el mismo error generico tanto
para una contrasena incorrecta como para una cuenta desactivada. La pantalla web, sin embargo,
esta conectada a una segunda implementacion (`packages/shared/usuarios/api.js#iniciarSesion`,
agregada en el PR #424, commit `26d05b6`, issue #100) que **no llama a `evaluarPerfilDeSesion`
y por lo tanto no revisa `perfil.activo`**. Ademas, `apps/web/src/pages/LoginPage.jsx`
desestructura del hook (`packages/shared/usuarios/useInicioSesion.js`) las claves
`erroresDeCampo`, `error`, `enviando` y `destinoPorDefecto`, ninguna de las cuales existe en lo
que ese hook realmente devuelve — asi que **ningun error de login se muestra hoy en la pantalla
web**. Dos consecuencias concretas: (1) una cuenta desactivada (`perfil.activo = false`) puede
seguir iniciando sesion por la web, y (2) un mensaje de error del servidor — incluido un futuro
mensaje de bloqueo del issue de arriba — no llegaria a verse en pantalla hasta que se corrija
este wiring.
