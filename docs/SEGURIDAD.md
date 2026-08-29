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
  cuales no revisaba `perfil.activo`): era anterior a #230 y se corrigio aparte, con la issue
  #512. Ver "Login web: el bug de wiring que hubo (resuelto)" mas abajo.

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
  `auth.users.encrypted_password`. El repositorio nunca toca esa columna: solo llama a
  `auth.signInWithPassword` de `supabase-js`, que nunca devuelve el hash al cliente. (Antes esta
  linea decia tambien `auth.signUp`; se corrigio con la issue #508, porque **no hay ninguna
  llamada a `signUp` en el repositorio** y mencionarla daba a entender que el registro desde el
  cliente era parte del diseno.)
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

## Alta de cuentas: quien entra al sistema y como (issue #508)

**En este sistema nadie se da de alta a si mismo.** El registro publico esta cerrado.

Estuvo abierto hasta el 28 de agosto de 2026, y no era teorico: un `POST /auth/v1/signup` con la
llave anonima -que viaja en el bundle del navegador y es publica por diseno- devolvia una sesion
utilizable. El trigger `trg_auth_users_crear_perfil` de la `00002` creaba entonces el perfil sin
`rol` ni `activo`, que caen a sus DEFAULT: `voluntario general` y `TRUE`. Ese rol no es de solo
lectura -por las politicas de la `00032` y la `00033` lee y registra pacientes, expedientes,
atenciones y triajes-, asi que cualquiera obtenia acceso de escritura a datos clinicos. Se
comprobo contra el stack local: la cuenta recien creada leyo la tabla `pacientes` y registro uno
nuevo.

### Las dos capas que lo cierran

| Capa | Donde | Que alcanza |
| --- | --- | --- |
| `enable_signup = false` en `[auth]` | `supabase/config.toml` | Stack local y CI. **No alcanza los proyectos remotos** |
| Ajuste "Allow new users to sign up" | Dashboard de cada proyecto | Solo el proyecto donde se toca |
| Trigger de la migracion `00074` | Base de datos | **Los tres ambientes**, porque viaja con `db push` |

La tercera es la que importa, por lo que explica la seccion 4 de este documento: `config.toml` no
se sincroniza con los proyectos remotos. El trigger rechaza cualquier alta que venga de GoTrue sin
la marca administrativa en `raw_app_meta_data`, columna que **el cliente no puede escribir**: un
`signup` solo controla `raw_user_meta_data`. Asi la proteccion no depende de que nadie vuelva a
activar el ajuste en un Dashboard.

> **Cuidado al tocar `config.toml`:** basta con `enable_signup = false` en `[auth]`. Ponerlo
> **tambien** en `[auth.email]` apaga el proveedor de correo entero y el login empieza a
> responder `422 email_provider_disabled`: deja de entrar todo el mundo. Comprobado.

### Estado de cada ambiente

- **Local y CI**: cerrado por `config.toml`.
- **`Ecopac-Digital-Dev`**: revisado en el Dashboard el 28 de agosto de 2026. "Allow new users to
  sign up" estaba **activado**. "Confirm email" tambien, lo que obliga a confirmar el correo antes
  de poder iniciar sesion, pero **el perfil se crea igual** con rol `voluntario general`, y quien
  use un buzon propio completa el paso sin problema. Cerrar ese ajuste es una tarea de Dashboard,
  no de este repositorio; hasta que se haga, **quien protege a dev es el trigger de la `00074`**,
  y por eso la defensa no se dejo solo en `config.toml`.
- **`Ecopac-Digital-Prod`**: existe y esta **pausado**, asi que su API no responde y su
  configuracion no se puede leer sin reanudarlo. **Al reanudarlo hay que comprobar y cerrar el
  registro antes de exponerlo**: el default de Supabase al crear un proyecto es tenerlo abierto.
  La migracion `00074` lo protege en cuanto se le apliquen las migraciones.

### Como se da de alta a una persona

La via prevista es la Edge Function `invitar-usuario`, que `packages/shared/usuarios/api.js`
invoca desde `crearUsuario()`. **Esa funcion todavia no existe** (`supabase/functions/` solo tiene
un `.gitkeep`), asi que el alta desde la aplicacion no funciona; tiene su propia issue.

Mientras tanto, la administradora ejecuta desde el SQL editor del Dashboard:

```sql
SELECT fn_crear_usuario_administrativo(
  'persona@ejemplo.org', 'Nombres', 'Apellidos', 'medico'
);
```

La funcion crea la cuenta con la marca administrativa, su fila en `auth.identities` y el perfil
con el rol indicado. **No fija contrasena**, por el mismo criterio que el primer administrador de
la `00063`: la persona la establece con "olvide mi contrasena". Es tambien lo que llamara la Edge
Function cuando se escriba.

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

## Login web: el bug de wiring que hubo (resuelto)

**Esta seccion es historica.** Se conserva porque describio durante semanas un agujero como
abierto, y quien la leyera pudo tomar decisiones sobre esa base. Lo que decia ya no es cierto.

### Que se afirmaba

Que `packages/shared` tenia dos implementaciones de `iniciarSesion`; que la pantalla web estaba
conectada a la mala, la de `packages/shared/usuarios/api.js` (PR #424, issue #100), que no
comprueba `perfil.activo`; que `LoginPage.jsx` desestructuraba del hook claves que no existian y
por eso **ningun error de login se mostraba en pantalla**; y como consecuencia, que una cuenta
desactivada podia entrar por la web.

### Que es cierto hoy

De esas cuatro afirmaciones **solo la primera lo era**, y ya tampoco:

- **El wiring se corrigio antes.** `packages/shared/usuarios/useInicioSesion.js` se reescribio e
  importa `iniciarSesion` de `../api/sesion.js`, la que valida credenciales, resuelve el perfil y
  cierra la sesion si la cuenta esta desactivada. Su cabecera enumera los cinco defectos de la
  version anterior.
- **Los errores si se ven.** Las claves que `apps/web/src/pages/LoginPage.jsx` desestructura
  -`erroresDeCampo`, `error`, `enviando`, `destinoPorDefecto`- son exactamente las que el hook
  devuelve; se comprobaron una a una.
- **Una cuenta desactivada no entra por la web.** `evaluarPerfilDeSesion()` la rechaza y
  `iniciarSesion()` cierra la sesion recien emitida.
- **Ya no hay dos implementaciones.** La issue #512 borro la copia de `usuarios/api.js` -y con
  ella un `cerrarSesion` duplicado que hacia `signOut()` global, revocando los refresh tokens del
  usuario en todos sus dispositivos-. El barril tenia que desempatar los dos nombres a mano
  porque ESM excluye del namespace un nombre que le llega por dos estrellas (bug #365); ese
  desempate se retiro. Una prueba en `packages/shared/usuarios/api.test.js` impide que la segunda
  puerta vuelva a aparecer.

### Lo que si sigue abierto, y no es lo mismo

**Desactivar una cuenta es hoy un control de cliente.** `iniciarSesion()` cierra la sesion, pero
lo hace *despues* de que GoTrue ya emitio un JWT valido. Ese token sigue sirviendo hasta que
expire, y quien llame a `/auth/v1/token` directamente con la llave anonima obtiene uno sin pasar
por la aplicacion.

La base no lo frena: `rol_actual()` (`00004`) resuelve el rol con
`SELECT rol FROM perfiles WHERE id = auth.uid()`, **sin mirar `activo`**, y toda la matriz RLS
cuelga de esa funcion. Comprobado con grep sobre las 71 migraciones: ninguna politica ni funcion
de autorizacion consulta esa columna.

Es la misma leccion que dejo la issue #508: el cliente decide que dibujar, el servidor decide
quien pasa. Tiene issue propia.
