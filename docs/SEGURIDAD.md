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
  montado en `apps/web/src/components/MainLayout.jsx`. Cierra la sesion si nadie interactua con
  la pagina (`mousemove`, `keydown`, `mousedown`, `touchstart`, `scroll`) durante
  `MINUTOS_INACTIVIDAD_POR_DEFECTO` minutos.

### Como se comporta el cierre por inactividad (web)

El temporizador existia desde la #230, pero en la practica parecia que no: vivia solo en memoria
(cerrar la pestana o la laptop y volver al dia siguiente restauraba la sesion y la cuenta empezaba
de cero), cerraba sin avisar y cada pestana llevaba su propia cuenta. Desde la revision de
uniformidad y observabilidad:

| Situacion | Que pasa |
| --- | --- |
| Faltan `SEGUNDOS_DE_AVISO_POR_DEFECTO` (60) segundos para el limite | Aparece `AvisoDeInactividad`: cuenta regresiva, "Seguir conectado" y "Cerrar sesion ahora". No se descarta con Escape ni tocando fuera, y mover el raton no lo apaga: pide una decision. |
| Se cumple el limite | Se cierra la sesion y la pantalla de inicio de sesion dice "Tu sesion se cerro por inactividad". |
| Se recarga la pagina o se reabre el navegador | La ultima actividad esta guardada (`CLAVE_ULTIMA_ACTIVIDAD`, en el almacenamiento de la plataforma): si ya paso el limite, la sesion se cierra al abrir, sin llegar a pintar la pantalla. |
| Hay varias pestanas abiertas | La actividad en cualquiera cuenta para todas, y el aviso de una se apaga si se trabaja en otra. |
| Se vuelve a entrar despues de un cierre | La pantalla de inicio de sesion borra la marca vieja (`olvidarUltimaActividad`), para que no saque a nadie en cuanto termine de entrar. |

La marca guardada es solo una hora (un numero de milisegundos); no identifica a nadie ni guarda
nada de la sesion. En movil el hook funciona como antes, en memoria: `AsyncStorage` no es
sincrono y el contrato del almacenamiento que usa este hook si lo exige.

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
  datos de usuario. `solicitarRestablecimiento()` en
  [`packages/shared/usuarios/useRestablecerContrasena.js`](../packages/shared/usuarios/useRestablecerContrasena.js)
  tiene un `catch` vacio a proposito -ni siquiera loguea el correo, que en este proyecto es dato
  de contacto de una persona real- y el comentario del propio archivo explica por que: distinguir
  "correo enviado" de "esa cuenta no existe" permitiria enumerar usuarios (issue #101).
- `apps/mobile/src/screens/LoginScreen.js` es un placeholder sin logica de login todavia, asi
  que no hay nada que revisar ahi por ahora.

## Observabilidad: errores, fallos de red y respaldos (issue #762)

La pregunta de la #762 es **cuando algo falle en una comunidad rural sin senal, como nos enteramos
y como lo recuperamos**, y el patron que tiene que hacer imposible es "algo no funciona y el
sistema dice que si". Este es el estado por bloque.

### Reporte de errores

Todo error pasa por un unico punto,
[`packages/shared/observabilidad/errores.js`](../packages/shared/observabilidad/errores.js):

- `reportarError(error, contexto)` acepta cualquier cosa que se haya lanzado (un `Error`, el
  `{ mensaje, codigo }` de las APIs de shared, el `{ message, code }` de supabase-js) y nunca
  lanza.
- **Nada sale sin pasar por `limpiarDatosSensibles`**, que quita UUID (las rutas llevan el del
  paciente), correos, DPI, telefonos, corridas de 8 o mas digitos, el valor que Postgres copia en
  el `detail` de una violacion de unicidad (`Key (dpi)=(...)`) y tokens. Prefiere quitar de mas.
- `configurarDestinoDeErrores(destino)` es el **unico** punto que hay que tocar para conectar una
  herramienta de monitoreo. Hoy el destino es la consola del equipo: no sale de el.

Lo que se captura en la web:

| Fuente | Donde se engancha |
| --- | --- |
| Excepcion al pintar una pantalla | `LimiteDeError` alrededor del `<Outlet />` de `MainLayout` (el menu sigue vivo y se reinicia al navegar) y otro alrededor de `<App />` en `main.jsx` |
| Excepcion en un manejador de eventos o un `setTimeout` | `window` `error`, en `main.jsx` |
| Promesa rechazada que nadie espero | `window` `unhandledrejection`, en `main.jsx` |

Antes de esto, una excepcion al pintar dejaba **la pagina en blanco** -sin menu, sin mensaje y sin
registro-: es lo que pasaba con "Nuevo paciente" hasta la #827.

**Pendiente:** elegir la herramienta (dentro de la capa gratuita, ver #234), conectarla con
`configurarDestinoDeErrores` en las dos apps y en las Edge Functions, y enganchar los errores
globales de movil (`ErrorUtils.setGlobalHandler`).

### Errores tragados

Revisados en `apps/` y `packages/shared`:

- **`alert()` para errores de escritura:** no queda ninguno en la web. Los de `InventarioPage`,
  `AdministracionBodegasProveedoresPage` y `PanelAlertasVencimiento` ya pintan el error en la
  pantalla que lo provoco.
- **`catch` vacios:** quedan cinco y los cinco son deliberados y comentados: `cerrarSesion()` (el
  objetivo, no dejar sesion, ya se persigue en supabase-js), `useRestablecerContrasena` (distinguir
  "correo enviado" de "no existe esa cuenta" permite enumerar usuarios), el cuerpo no JSON de una
  Edge Function en `usuarios/api.js`, un mensaje mal formado del WebView del mapa en movil, y el
  almacenamiento bloqueado del temporizador de inactividad.
- **Alias equivocado (`{ data, err }`):** corregido en `useReporteInventario` (#696); no queda
  ningun otro.
- **Valor de retorno descartado:** `marcarComoAtendida` ya no marca como atendida una alerta que
  la base rechazo (#709).
- **El indicador de la cabecera** decia "Sistema activo" siempre, con o sin red. Ahora dice
  "En linea" o "Sin conexion" segun el navegador.
- **`keep-alive-supabase.yml`** ya falla con un error HTTP (`--fail-with-body`), y cuando faltan
  los secrets deja una anotacion de warning y un bloque en el resumen en vez de un `echo` que solo
  se veia abriendo el log.

### Fallos de red

- **Web:** `useEnLinea` (`apps/web/src/hooks/`) escucha `online`/`offline`. Sin red aparece
  `AvisoSinConexion`, una franja fija bajo la cabecera que dice que lo que se guarde no llegara a
  la base. `navigator.onLine` en `false` es fiable; en `true` solo dice que hay una interfaz de
  red, por eso alimenta un aviso y no una decision: quien sabe si una escritura llego es la
  respuesta de la API, que ya se pinta en pantalla.
- **Pendiente en movil:** definir que se puede seguir haciendo sin red, que se bloquea y que se le
  dice a quien atiende. Hoy movil no tiene el aviso.
- **Receta emitida con stock sin descontar** (R-57 de la revision integral): resuelto por la #711.
  La receta y sus salidas de inventario se escriben juntas en `fn_generar_receta` (00112): si una
  salida falla por red o por stock, no queda ni la receta ni el descuento, en vez de una receta
  emitida con el inventario inflado.

### Eventos de seguridad y bitacora

`eventos_auditoria` (00026, 00045, 00070) ya registra los borrados logicos y los cambios de
permisos. Consultarla desde la aplicacion es la #643. **Pendiente de decidir:** que eventos de
autenticacion se registran (intentos fallidos, desactivaciones, invitaciones), cuanto se
conservan, y confirmar que ninguno guarda datos clinicos de mas. El cierre por inactividad
**no** se registra en la base: ocurre en el cliente y quien lo necesita es la persona que vuelve a
entrar, a quien ya se le dice.

### Respaldos

Procedimiento en [CI-CD.md, "Respaldos y restauracion"](./CI-CD.md#respaldos-y-restauracion).
**La restauracion no esta probada todavia**: un respaldo sin restauracion probada no es un
respaldo, y esa prueba es el criterio que sigue abierto de la #762.

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

La via normal es la Edge Function `invitar-usuario` (`supabase/functions/invitar-usuario/`, issue
#523), que `packages/shared/usuarios/api.js` invoca desde `crearUsuario()`. El flujo completo:

1. `ModalAltaUsuario.jsx` recoge nombres, apellidos, correo, telefono y rol, y llama a
   `crearUsuario()`.
2. `crearUsuario()` valida los datos en el cliente y llama a `invitar-usuario` con el JWT de la
   sesion actual.
3. La Edge Function comprueba que quien llama sea administrador **contra la base**, no contra lo
   que diga el cliente (el modal no tiene ningun chequeo de rol propio: el guard de rutas decide
   quien entra a `/colaboradores`, no quien puede invitar). Si no lo es, responde 403.
4. Reutiliza `fn_crear_usuario_administrativo()` con la llave de servicio -la unica forma de
   llamarla, esta `REVOKE ALL FROM PUBLIC`- para crear la cuenta, su fila en `auth.identities` y
   el perfil con el rol pedido. La funcion valida `rol` contra el enum `rol_usuario` de Postgres
   sola; un valor que no exista en el enum se traduce en un 400.
5. La funcion dispara `auth.resetPasswordForEmail()` -el mismo mecanismo que la pantalla "olvide
   mi contrasena", `useRestablecerContrasena.js`- para que la persona reciba el correo y
   establezca su contrasena. **No fija contrasena** por el mismo criterio que el primer
   administrador de la `00063`.

Salida de emergencia, si la Edge Function no esta desplegada en un ambiente o algo la bloquea: la
administradora puede ejecutar el mismo `fn_crear_usuario_administrativo()` a mano desde el SQL
editor del Dashboard -

```sql
SELECT fn_crear_usuario_administrativo(
  'persona@ejemplo.org', 'Nombres', 'Apellidos', 'medico'
);
```

-pero en ese camino nadie dispara el correo de "olvide mi contrasena": hay que enviarselo aparte
o guiar a la persona a pedirlo desde el login.

**Nota de despliegue:** el workflow de CI (`supabase.yml`) hace lint de la funcion (`deno lint` +
`deno check`) en cada PR, pero no tiene ningun paso `supabase functions deploy`: escribirla no la
publica sola en `ecopac-dev`/`ecopac-prod`, hace falta desplegarla aparte.

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

## 5. URLs de redireccion: el enlace de "olvide mi contrasena" (issue #875)

El correo de recuperacion lleva un enlace a `/auth/v1/verify`, y ese enlace arrastra un
`redirect_to` que decide **a donde cae la persona despues de verificar el token**. Cada
plataforma pide el suyo:

| Plataforma | Que manda como `redirectTo` | De donde sale |
| --- | --- | --- |
| Web | `https://<dominio>/nueva-contrasena` | `window.location.origin`, en `RestablecerContrasenaPage.jsx` |
| Movil | `ecopac://recuperar` | `Linking.createURL("recuperar")`, en `RestablecerContrasenaScreen.js`; el esquema `ecopac` lo declara `apps/mobile/app.config.js` |

GoTrue **no acepta cualquier `redirect_to`**: solo los que esten en la lista de redirecciones
permitidas. Si el que llega no esta en la lista, no falla con un error visible: **cae en silencio
al `site_url`**. Por eso el sintoma no es "no llego el correo", sino "el correo llego pero abrio
la web en vez de la app".

**El comodin `*` no cubre los esquemas propios.** Esta es la trampa que costo encontrar: aunque
`additional_redirect_urls` incluya `"*"`, un `ecopac://recuperar` NO coincide y se descarta. El
comodin solo cubre `http` y `https`. Hay que listar el esquema aparte.

Reproducido contra el stack local: pidiendo `redirect_to=ecopac://recuperar`, el correo llegaba
con `redirect_to=http://localhost:5173`. Agregando `ecopac://*` y `exp://*` a
`additional_redirect_urls` en [`supabase/config.toml`](../supabase/config.toml), el mismo enlace
pasa a llegar con `redirect_to=ecopac://recuperar`.

### Que hay que registrar en cada proyecto

`config.toml` **no gobierna los proyectos remotos** (ver la seccion 4 de arriba): el despliegue
solo corre `supabase db push`. Estas entradas van a mano en el Dashboard.

| Entrada | Para que |
| --- | --- |
| `ecopac://recuperar` | El deep link de una build de la app movil (development build o tienda) |
| `exp://*` | Expo Go durante el desarrollo: el host y el puerto cambian en cada arranque |
| `https://<dominio de la web>/nueva-contrasena` | El destino de la web en ese ambiente |

`exp://*` solo tiene sentido en `Ecopac-Digital-Dev`. En `Ecopac-Digital-Prod` se registran
unicamente el deep link de la app publicada y el dominio real de la web: un comodin en produccion
es una redireccion abierta.

### Instrucciones de Dashboard (repetir en los dos proyectos)

1. Entrar a [supabase.com/dashboard](https://supabase.com/dashboard) y seleccionar el proyecto
   (`Ecopac-Digital-Dev` primero).
2. Ir a **Authentication > URL Configuration**.
3. Comprobar que **Site URL** apunta al dominio de la web de ese ambiente.
4. En **Redirect URLs**, agregar las entradas de la tabla de arriba con "Add URL".
5. Guardar y repetir en `Ecopac-Digital-Prod`, sin el `exp://*`.

### Como se comprueba que quedo bien

Sin abrir el telefono, con
[`scripts/verificar-redireccion-recuperacion.mjs`](../scripts/verificar-redireccion-recuperacion.mjs):

```bash
npm run verificar:redireccion -- <url-del-proyecto> <clave-publicable> <correo> ecopac://recuperar
```

Pide un correo de recuperacion con ese `redirect_to` y dice si el proyecto lo respeta o lo
cambio por el `site_url`. Contra el stack local lee el enlace directo de Mailpit; contra un
proyecto remoto informa que el correo salio y hay que abrirlo para confirmarlo, porque el enlace
solo viaja en el correo.

**Manda un correo de verdad a esa cuenta.** Contra `Ecopac-Digital-Prod`, usar una cuenta de
prueba, nunca la de una persona de la organizacion.

## Endurecimiento de la plataforma (issue #760)

Cinco frentes de OWASP (A03, A05, A06, A08 y cabeceras/cifrado) que nadie habia revisado antes de
produccion. Dos de los seis puntos que se investigaron ya estaban resueltos por trabajo anterior
a esta revision (inyeccion de CSV, auditoria de SQL dinamico); el resto se corrigio aqui.

### Cabeceras de seguridad HTTP

Ninguno de los tres lugares que sirven la SPA declaraba cabeceras de seguridad. Las mismas seis
cabeceras viven ahora en tres archivos -[`vercel.json`](../vercel.json) (raiz),
[`apps/web/vercel.json`](../apps/web/vercel.json) y [`apps/web/nginx.conf`](../apps/web/nginx.conf)-,
verificadas cruzadamente por `npm run verificar:cabeceras-http`
([`scripts/verificar-cabeceras-http.mjs`](../scripts/verificar-cabeceras-http.mjs)) en cada PR,
mismo patron que `verificar:rewrite-vercel` (issue #59).

| Cabecera | Valor | Por que |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Fuerza HTTPS en el navegador durante dos anos, incluidos subdominios |
| `X-Content-Type-Options` | `nosniff` | El navegador no reinterpreta el tipo de un archivo servido |
| `X-Frame-Options` | `DENY` | Retrocompatibilidad de `frame-ancestors 'none'` para navegadores viejos |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Las rutas llevan el UUID del paciente (`/pacientes/:id`); con esta politica un origen externo solo recibe el origen en `Referer`, nunca el path con el UUID |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=()` | Deniega APIs del navegador que la app no usa |
| `Content-Security-Policy` | ver el archivo | `style-src` necesita `'unsafe-inline'` porque `apps/web` usa `style={{}}` de React en varias paginas; `connect-src` permite `*.supabase.co` (REST) y `wss://*.supabase.co` (Realtime) con wildcard de segundo nivel porque `VITE_SUPABASE_URL` se inyecta en build time y cambia por ambiente; no hay Google Fonts ni scripts de terceros, asi que el resto de directivas queda en `'self'` |

Hay que mantener sincronizados los tres archivos a mano: Vercel usa JSON y nginx usa
`add_header`, sintaxis irreconciliables sin un paso de build adicional que seria sobre-ingenieria
para seis lineas. La guarda de CI es lo que impide que diverjan en silencio.

### `search_path` fijo en funciones de Postgres

Supabase Advisor marca `function_search_path_mutable` en toda funcion de `public` sin
`search_path` fijo -y **`supabase db lint` no lo detecta**, porque revisa sintaxis/`plpgsql_check`,
no las heuristicas del Advisor-. El patron del repo (`rol_actual()`, 00004) es
`SET search_path = ''` (vacio, no `public, pg_temp`) combinado con toda referencia a tabla o
funcion calificada (`public.tabla`, `esquema.funcion`): con `search_path` vacio solo se busca
`pg_catalog` de forma implicita.

Quedaban 11 funciones sin la clausula (la investigacion inicial conto 14 por texto; 4 ya se habian
corregido en `00106`/`00107`/`00112` antes de escribir la migracion `00131`). Ninguna cambia de
firma, asi que `CREATE OR REPLACE FUNCTION` bastaba: conserva los `GRANT`/`REVOKE` y los
`COMMENT ON` existentes.

**El detalle no obvio:** dos de las once (`fn_registrar_paciente`, `fn_registrar_medicamento`)
ademas de tener `INSERT INTO` sin calificar, declaran variables PL/pgSQL con el tipo fila de una
tabla (`DECLARE v_x nombre_tabla;`). Ese `DECLARE` tambien se resuelve con el `search_path` de la
funcion en tiempo de ejecucion: sin calificarlo (`public.pacientes`, `public.medicamentos`), la
funcion compila pero revienta en su primera llamada real, no en el `CREATE`. Facil de pasar por
alto porque no es una consulta.

**Un quinto candidato que no era: `fn_gastos_updated_at()` (00025) ya no existe.** La lista
inicial la incluyo porque un analisis por texto sobre los `.sql` la encuentra ahi -pero la `00089`
(issue #412) la elimino: duplicaba, literalmente igual, a `actualizar_timestamp_updated_at()`, y
paso el trigger de `gastos` a la funcion compartida. Un `CREATE OR REPLACE FUNCTION` sobre un
nombre borrado no falla, **la resucita**: la primera version de la migracion `00131` la incluia y
`supabase test db` lo cazo, porque `desacoplar_gastos_de_inventario.sql` (pgTAP) ya afirmaba
`to_regprocedure('fn_gastos_updated_at()') IS NULL`. Es el ejemplo real de por que la guarda de
este punto lee `pg_proc` despues de aplicar todo en vez de una lista armada leyendo los `.sql`: a
esa lista se le escapo precisamente este caso.

La guarda que impide que esto se repita es
[`supabase/tests/database/funciones_search_path_fijo.sql`](../supabase/tests/database/funciones_search_path_fijo.sql)
(pgTAP), que corre dentro del job requerido "Validar migraciones y funciones" de
`supabase.yml`. Lee `pg_proc.proconfig` del esquema `public` despues de aplicar todas las
migraciones: detecta sola cualquier funcion nueva sin la clausula, sin mantener una lista, y no
le puede pasar por alto una funcion corregida en una migracion posterior a la que la creo -que es
justo lo que le paso al conteo de la issue original-. No se agrego un script Node estatico
adicional: seria redundante con esto.

### CORS de las Edge Functions

`invitar-usuario` respondia con `Access-Control-Allow-Origin: "*"` (issue #691: la autenticacion
va por header `Authorization`, no por cookie, asi que un origen abierto no habilitaba CSRF, pero
no habia razon para no acotarlo). Ahora
[`supabase/functions/_shared/cors.ts`](../supabase/functions/_shared/cors.ts) expone
`corsHeadersPara(req)`, que refleja el `Origin` de la peticion solo si esta en `ALLOWED_ORIGINS`
(secret de la Edge Function, lista separada por comas -no vive en `supabase/config.toml`, que
solo aplica al stack local-).

**La aplicacion todavia no esta desplegada**, asi que no hay dominio real que fijar hoy: mientras
`ALLOWED_ORIGINS` no se configure en un ambiente, ningun origen se refleja y las llamadas desde el
navegador quedan bloqueadas por CORS -fail-closed, no fail-open-. Antes de o al desplegar por
primera vez a cada ambiente:

```
supabase secrets set ALLOWED_ORIGINS=https://dominio-real-de-ese-ambiente --project-ref <ref>
```

Pruebas en
[`supabase/functions/_shared/cors_test.ts`](../supabase/functions/_shared/cors_test.ts), mismo
criterio que `index_test.ts` (issue #691): no corren en CI todavia, es responsabilidad de quien
toque `cors.ts` o `invitar-usuario` correrlas a mano con
`deno test --config supabase/functions/deno.json --allow-env supabase/functions`.

### SQL dinamico — auditoria confirmada segura

De 62 migraciones que contienen la palabra `EXECUTE`, casi todas son `EXECUTE FUNCTION` (sintaxis
de trigger) o `GRANT EXECUTE ON FUNCTION`, no SQL dinamico. Solo dos ejecutan SQL dinamico real,
y ambas usan `format(...)` con `%I` (identificador seguro) sobre nombres leidos del catalogo
(`pg_extension`, `pg_tables`), nunca de input de usuario:

- [`00005_corregir_schema_de_extensiones.sql`](../supabase/migrations/00005_corregir_schema_de_extensiones.sql):44
- [`00030_rls_denegacion_por_defecto.sql`](../supabase/migrations/00030_rls_denegacion_por_defecto.sql):20

No hay superficie de inyeccion SQL en las migraciones.

### Inyeccion de formulas en CSV — ya resuelta

`packages/shared/reportes/csv.js` ya neutraliza `=`, `+`, `-`, `@`, tabulador y `\r` con un
apostrofo antepuesto desde la issue #698 (cerrada), y `csv.test.js` cubre los cinco caracteres.
Sin trabajo nuevo aqui.

## Limitacion de peticiones y SSRF (issue #761)

### Limitacion de peticiones a Edge Functions y RPCs propias

`[auth.rate_limit]` de `config.toml` (seccion 4 de este documento) solo cubre los endpoints
nativos de GoTrue -login, registro, refresh- y ademas solo aplica al stack local/CI: el
despliegue nunca corre `supabase config push`. Ni `invitar-usuario` (Edge Function propia) ni
`fn_buscar_pacientes` (RPC llamada directo por PostgREST) pasan por ahi. Tampoco hay ninguna
configuracion de Kong versionada en este repo -Supabase lo gestiona internamente, no expuesto-,
ni Redis ni un KV store accesible desde las Edge Functions (`policy = "oneshot"` en
`[edge_runtime]`: sin estado en memoria garantizado entre invocaciones). **Postgres es el unico
lugar que ven las dos rutas y que persiste entre llamadas**, asi que el contador vive ahi.

**Diseno** (migracion `00134`): una tabla generica `limites_de_uso (recurso, actor_id, contador,
ventana_inicio)` en vez de una tabla por recurso -un tercer limite futuro solo necesita una
funcion companera nueva, no otra migracion de esquema-, mas una funcion nucleo
`fn_verificar_y_contar_limite()` que hace el incremento atomico (`INSERT ... ON CONFLICT DO
UPDATE`, no `SELECT`-then-`UPDATE`: la fila queda bloqueada durante el `UPDATE`, asi que dos
llamadas concurrentes del mismo actor se serializan) y falla con SQLSTATE `53400`
(`configuration_limit_exceeded`, una condicion estandar de Postgres, no inventada) si se supera
el umbral dentro de la ventana. Dos funciones companeras fijan el recurso, el actor y el umbral:

| Recurso | Umbral | Quien es el actor | Por que |
| --- | --- | --- | --- |
| `invitar_usuario` | 20 cada hora | El administrador que invita (`user.id`, pasado explicito: la Edge Function llama con la llave de servicio, sin JWT de quien invita dentro de Postgres) | El onboarding real ocurre en rafagas chicas; incluso dar de alta a un equipo nuevo de golpe cabe holgado |
| `buscar_pacientes` | 60 cada minuto | `auth.uid()` (la funcion es `SECURITY INVOKER`, con el JWT real de quien busca) | El buscador ya tiene debounce de 300 ms (`RETARDO_DE_BUSQUEDA_MS`, [`packages/shared/hooks/useBusquedaPacientes.js`](../packages/shared/hooks/useBusquedaPacientes.js)); un uso intenso real ronda 20-30 llamadas/minuto, esto deja el doble de margen |

`fn_buscar_pacientes()` (00077) conecta el limite con una CTE `_limite` referenciada con
`CROSS JOIN` dentro de `coincidencias`. El `CROSS JOIN` no es cosmetico: una CTE sin referenciar
en el `FROM` se elimina del plan (dead CTE elimination, PG12+) y el limite dejaria de
comprobarse **en silencio** -el peor tipo de bug posible para un control de seguridad-. Como
`_limite` no esta correlacionada con `pacientes`, el `CROSS JOIN` la evalua una sola vez por
ejecucion, no una vez por fila. La funcion deja de ser `STABLE` (pasa al default, `VOLATILE`):
ahora escribe en `limites_de_uso`. Verificado que esto no rompe nada: el unico caller
(`packages/shared/pacientes/api.js`, `supabase.rpc("fn_buscar_pacientes", ...)`) ya invoca por
POST, que es como PostgREST expone siempre una funcion `VOLATILE`.

La guarda de que esto sigue funcionando es
[`supabase/tests/database/limites_de_uso.sql`](../supabase/tests/database/limites_de_uso.sql)
(pgTAP): el caso mas importante de la suite llama a `fn_buscar_pacientes()` con el contador
sembrado en el umbral y confirma que la llamada siguiente falla -es la prueba que demuestra que
el `CROSS JOIN` de verdad fuerza la evaluacion, no solo que el nucleo aislado funcione-.

**Por que no se suma limite por IP todavia**: `fn_buscar_pacientes` via PostgREST no ve la IP
del cliente sin configuracion adicional fuera de alcance de una migracion. `invitar-usuario` si
podria leer `x-forwarded-for` de la peticion, pero el actor ya es un administrador autenticado e
identificable -limitar por usuario cubre el vector relevante-. Sumar IP ahi solo protegeria
contra un administrador comprometido operando desde varias IPs a la vez, un escenario de umbral
bajo prioridad. Queda anotado aqui como mejora futura, no implementado ahora.

**En el cliente**: `packages/shared/api/errores-de-supabase.js` clasifica el SQLSTATE `53400`
como `LIMITE_EXCEDIDO`, con el mensaje "Se hicieron demasiadas peticiones en poco tiempo. Espera
un momento e intenta de nuevo." No se marca reintentable: reintentar de inmediato solo vuelve a
fallar hasta que expire la ventana.

### Peticiones del lado del servidor (SSRF)

Revisado, sin superficie de SSRF hoy y sin cambios de codigo:

- [`supabase/functions/alertas-vencimiento/index.ts`](../supabase/functions/alertas-vencimiento/index.ts)
  -el que mas importaba revisar, por la notificacion de alertas-: sin `fetch()`, solo llama a
  `fn_generar_alertas_caducidad()` via PostgREST. El envio de correo, si lo hay, lo hace GoTrue
  internamente, no codigo propio de esta funcion.
- [`supabase/functions/invitar-usuario/index.ts`](../supabase/functions/invitar-usuario/index.ts)
  y [`_shared/cors.ts`](../supabase/functions/_shared/cors.ts): sin I/O de red propia, solo
  llamadas a `supabase-js`.
- Todas las migraciones de `supabase/migrations/`: sin `pg_net` ni la extension `http`.

**Vigilancia futura**: si alguna vez una Edge Function necesita hacer una peticion saliente (por
ejemplo, a un proveedor de correo transaccional propio en vez de dejar el envio a GoTrue), validar
el destino contra una lista explicita de dominios permitidos antes de invocar `fetch()`, nunca
construir la URL a partir de un campo que edite un usuario.

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

### Lo que quedaba abierto, y ya no (issue #529)

Cuando se cerro #512 quedaba un hueco distinto y mas serio: **desactivar una cuenta era un control
de cliente**. `iniciarSesion()` cierra la sesion, pero lo hace *despues* de que GoTrue emitio un
JWT valido, y quien llamara a `/auth/v1/token` directamente con la llave anonima obtenia uno sin
pasar por la aplicacion. La base no lo frenaba: `rol_actual()` (`00004`) resolvia el rol sin mirar
`activo`, y de esa funcion cuelgan 77 de las 104 politicas del esquema. Comprobado contra el stack
local: una cuenta dada de baja leyo la tabla `pacientes`.

**La migracion `00079` lo cerro.** Un perfil desactivado ya no tiene rol efectivo, no lee ni
escribe, y -lo que anulaba el arreglo hasta descubrirlo- **no puede reactivarse a si mismo**. El
detalle esta en `docs/PERMISOS.md`, "Un perfil desactivado no tiene rol efectivo".

Lo unico que conserva es leer su propia fila de `perfiles`, a proposito: es lo que permite
distinguir "tu cuenta esta desactivada" de un "permiso denegado" que no explica nada.

**Lo que sigue sin resolverse** es que el token ya emitido no se revoca: deja de servir para leer
o escribir, pero existe hasta que expire (`jwt_expiry = 3600`). Invalidarlo de verdad exige la
Admin API de GoTrue y es otra decision.
