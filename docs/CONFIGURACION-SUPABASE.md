# Configuracion de Supabase por ambiente

Lista de verificacion de todo lo que hay que configurar **a mano en el Dashboard de Supabase** y
que no viaja con el repositorio. Se recorre entera al aprovisionar un ambiente nuevo.

## Por que existe este documento

`.github/workflows/supabase.yml` corre `supabase db push` (esquema) y `supabase functions deploy`
(codigo de las funciones). **Nunca corre `supabase config push`.**

De ahi sale la regla que explica todo lo demas:

> `supabase/config.toml` gobierna el stack local y el CI. En `ecopac-dev` y `ecopac-prod` manda el
> Dashboard.

Asi que `enable_signup`, `site_url`, `additional_redirect_urls`, `jwt_expiry`, `[auth.rate_limit]`
y las plantillas de correo estan escritos dos veces: en `config.toml` para desarrollo, y en el
Dashboard de cada proyecto para lo que de verdad usa la gente. Cuando no coinciden, gana el
Dashboard y nadie se entera.

Desplegar el codigo de una Edge Function tampoco la configura: las variables que lee en tiempo de
ejecucion viven en **Edge Function Secrets** de cada proyecto.

## Como se usa

Son dos tablas emparejadas por un identificador estable (`CFG-NN`):

- **Que configurar** dice donde se toca, que valor lleva y **como se comprueba**.
- **Registro por ambiente** dice cuando se hizo, quien lo hizo y si esta comprobado.

Una fila se marca cuando se **comprueba**, no cuando se toca. Tocar un ajuste y no verificarlo es
como no haberlo tocado: media docena de los defectos que encontro la issue #879 eran ajustes que
alguien habia puesto y nadie habia probado.

**Ningun valor secreto se escribe aqui.** Este documento dice *que* configurar y *donde*, nunca el
valor. Las llaves se copian del Dashboard al destino sin pasar por el repositorio, ni por un PR, ni
por un chat, ni por una captura de pantalla.

## Antes de nada: que llave de servicio se usa

Esto se descubrio en la #879 y es la causa mas facil de perder horas, asi que va primero.

Un proyecto de Supabase puede tener **dos sistemas de llaves conviviendo**:

| Sistema | Llave publica | Llave de servicio |
| --- | --- | --- |
| Nuevo | `sb_publishable_...` | `sb_secret_...` |
| Legacy (marcado DEPRECATED) | `anon`, un JWT `eyJ...` | `service_role`, un JWT `eyJ...` |

**La que hay que usar es la del sistema nuevo, `sb_secret_...`**, en los dos sitios donde hace falta
mandarla como `Authorization: Bearer`:

- el secret `SUPABASE_SERVICE_ROLE_KEY_DEV` de GitHub Actions (CFG-21);
- la entrada de Vault `notificaciones_llave` (CFG-19).

El motivo: `alertas-vencimiento/index.ts` y `enviar-notificaciones/index.ts` comparan el header
**literalmente** contra la `SUPABASE_SERVICE_ROLE_KEY` que Supabase inyecta en la funcion, y lo que
inyecta hoy es la del sistema nuevo. Comprobado contra dev el 24-09-2026:

| Llave enviada | `GET /rest/v1/perfiles` | `POST /functions/v1/alertas-vencimiento` |
| --- | --- | --- |
| legacy `service_role` | 200 | **401** `{"error":"No autorizado."}` |
| nueva `sb_secret_` | 200 | **200** |

Lo traicionero es la primera columna: **la REST API acepta las dos**, asi que una llave equivocada
pasa todas las pruebas faciles y solo falla en las funciones. Y en el caso de Vault ni siquiera
falla a la vista: `fn_disparar_correo_de_notificaciones` (migracion 00138) llama con `pg_net`, que
es asincrono, asi que el 401 llega despues de que la transaccion termino y no queda en ningun log.
El sintoma es "los correos de notificacion no salen en el momento", sin ningun error que lo explique.

**El boton que no se toca.** En Project Settings > API Keys, pestana Legacy, hay un
**"Disable JWT-based API keys"**. Las llaves anonimas que usan la web y la app movil
(`VITE_SUPABASE_ANON_KEY_*`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) son legacy todavia, asi que apagarlas
deja las dos aplicaciones sin conectar. Migrar `anon` a `sb_publishable_` es trabajo de codigo -hay
que comprobar que la version de `supabase-js` del repositorio lo acepta- y esta pendiente.

---

## Que configurar

### Auth: URLs

| ID | Ajuste | Donde | Valor | Como se comprueba |
| --- | --- | --- | --- | --- |
| CFG-01 | Site URL | Authentication > URL Configuration | La raiz de la web del ambiente. En dev, `http://localhost:5173`, porque la web de dev no se despliega | Un enlace de recuperacion sin `redirectTo` aterriza ahi |
| CFG-02 | Redirect URLs | Authentication > URL Configuration | Los destinos reales, uno por entrada: la ruta de la web, la misma **con `?origen=invitacion`**, `ecopac://recuperar` y, solo en dev, `exp://*` | El enlace del correo termina en el destino pedido y no en el Site URL |

Dos cosas sobre CFG-02 que cuesta caro aprender sobre la marcha:

- **GoTrue descarta en silencio** un `redirect_to` que no este en la lista y cae al Site URL. No da
  error: la persona aterriza en la raiz, con sesion iniciada y sin haber elegido contrasena
  (`docs/SEGURIDAD.md`).
- **El comodin `*` no cubre esquemas propios.** `ecopac://recuperar` hay que listarlo aparte.
- El destino de la invitacion lleva query string (`WEB_URL/nueva-contrasena?origen=invitacion`,
  `invitar-usuario/index.ts`). Se comprobo en dev que GoTrue **si** respeta el query string cuando
  el destino esta registrado, pero hay que registrarlo: el de sin query string no lo cubre.
- El dialogo de Supabase dice "one per line" pero es un `<input>` de una sola linea. Hay que usar
  **"+ Add URL"**, una entrada por URL, y **contar el total al terminar**: borrar una entrada vacia
  desplaza los indices y puede llevarse otra por delante.

### Auth: registro y contrasenas

| ID | Ajuste | Donde | Valor | Como se comprueba |
| --- | --- | --- | --- | --- |
| CFG-03 | Allow new users to sign up | Authentication > Sign In / Providers | **Desactivado** | `POST /auth/v1/signup` responde `422 signup_disabled` |
| CFG-04 | Enable email provider | Providers > Email | **Activado. No se toca nunca** | `POST /auth/v1/token?grant_type=password` sigue dando 200 |
| CFG-05 | Confirm email | Authentication > Sign In / Providers | **Activado** (diverge de `config.toml`, ver abajo) | Una cuenta invitada entra sin pasar por ninguna confirmacion |
| CFG-06 | Minimum password length | Providers > Email | **8** | `PUT /auth/v1/user` con 7 caracteres responde `422 weak_password` |
| CFG-07 | Password requirements | Providers > Email | **Letters and digits** | `PUT /auth/v1/user` con 8 letras sin numeros responde `422 weak_password` |

**CFG-03 y CFG-04 se parecen y no son lo mismo.** Es el unico cambio de esta lista que puede dejar
a toda la organizacion fuera. Apagar el proveedor de correo responde `422 email_provider_disabled`
y **nadie puede iniciar sesion**. La comprobacion de la columna de la derecha distingue los dos
casos: si el `signup` da `signup_disabled`, se apago el correcto.

Cerrar el registro **no** es la unica defensa, y conviene saberlo para no confiarse: el trigger
`alta_de_cuenta_permitida` de la migracion 00074 rechaza el alta publica en la base, y ese si viaja
con las migraciones. Antes de CFG-03, dev respondia `500 unexpected_failure "Database error saving
new user"` -- o sea, ya estaba cerrado de hecho. CFG-03 cambia **como falla**, no **si falla**; pero
el Dashboard no debe contradecir a la base.

**Por que CFG-05 diverge de `config.toml`** (que tiene `enable_confirmations = false`): la
invitacion no crea la cuenta por el alta publica, la crea `fn_crear_usuario_administrativo()` con la
llave de servicio, **ya confirmada**. Comprobado en `auth.users` despues de invitar:
`email_confirmed_at` no nulo, `confirmation_sent_at` nulo, `recovery_sent_at` no nulo. Confirm email
nunca llega a dispararse para una invitacion, asi que dejarlo activado no bloquea nada y protegeria
si algun dia se reabriera el registro. Es una divergencia justificada por el comportamiento
observado, no por criterio.

### Auth: sesiones, limites y correo

| ID | Ajuste | Donde | Valor | Como se comprueba |
| --- | --- | --- | --- | --- |
| CFG-08 | Access token (JWT) expiry | Authentication > Sessions | **3600 s, provisional** | Coincide con `config.toml` (`jwt_expiry`) |
| CFG-09 | Refresh token rotation / reuse interval | Authentication > Sessions | **Activada / 10 s** | Coinciden con `config.toml` |
| CFG-10 | Rate limits | Authentication > Rate Limits | **30 / 30 / 150** en 5 minutos (sign ups, verificaciones, refrescos) | Coinciden con `[auth.rate_limit]` de `config.toml` |
| CFG-11 | Email OTP expiration | Providers > Email | **3600 s** | Un enlace de mas de una hora ya no sirve |
| CFG-12 | Plantilla de recuperacion | Authentication > Emails > Reset Password | El contenido de `supabase/templates/recovery.html` y el asunto de `config.toml` | Llega el correo con la marca, no el de GoTrue en ingles |
| CFG-13 | SMTP de Auth | Authentication > SMTP Settings | Proveedor propio, puerto 465 o 587 | Llega el correo de "olvide mi contrasena" |

**CFG-08 sigue pendiente de acordar con la organizacion.** 3600 es el valor por defecto de la CLI,
no una decision de nadie (`docs/SEGURIDAD.md`). Se anota el valor que hay y que es provisional; no
se inventa otro.

**CFG-12: el cuerpo del editor es Monaco, no un `<textarea>`.** Pegar con el teclado funciona; si se
automatiza, hay que escribir en el modelo de Monaco o el contenido se pierde al guardar y vuelve
silenciosamente a la plantilla de GoTrue. Del archivo del repositorio se pega **desde `<!doctype
html>`**: el comentario de cabecera es para quien lee el repositorio y no tiene sentido en el correo.

El logotipo del correo sale de `{{ .SiteURL }}/logo-ecopac.png`. En dev, con Site URL en
`localhost`, **no carga**, y eso es lo esperado, no un defecto de la plantilla: el cliente de correo
no puede alcanzar la maquina de quien lo mando. En produccion, con dominio real, si se ve.

### Edge Functions: secrets

| ID | Ajuste | Donde | Valor | Como se comprueba |
| --- | --- | --- | --- | --- |
| CFG-14 | `ALLOWED_ORIGINS` | Edge Functions > Secrets | Los origenes de la web del ambiente, separados por comas | La web puede llamar a `invitar-usuario` sin error de conexion |
| CFG-15 | `WEB_URL` | Edge Functions > Secrets | La raiz de la web del ambiente | El enlace del correo de invitacion apunta ahi |
| CFG-16 | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_PORT` | Edge Functions > Secrets | Los del proveedor. `SMTP_FROM` con la forma `Ecopac Digital <no-responder@dominio>`. **`SMTP_PORT` = 465** | Una invitacion llega con el correo de **bienvenida**, no con el de restablecimiento |

**CFG-14 es fail-closed a proposito** (`_shared/cors.ts`): sin ese secret no se refleja ningun
origen y el navegador bloquea la llamada. No es un ajuste opcional; es lo que impidio probar la
invitacion en el PR #876.

**El puerto tiene que ser 465.** Las Edge Functions de Supabase tienen bloqueada la salida por 25 y
por 587; 465 es el unico de envio que dejan abrir (`_shared/correo.ts`, `crearTransporte`). Es un
canal **distinto** del SMTP de Auth (CFG-13): configurar uno no configura el otro.

**CFG-16 es todo o nada.** `leerConfiguracionSmtp()` exige host, remitente y `WEB_URL`; si falta
uno devuelve `null` y `invitar-usuario` cae al camino anterior (`resetPasswordForEmail`), que usa el
SMTP de Auth. El correo llega igual, pero es el de **restablecimiento**, no el de bienvenida. O sea
que dejarlo a medias no rompe nada de forma visible, y por eso hay que comprobarlo mirando **que
correo** llego, no *si* llego.

### Base de datos

| ID | Ajuste | Donde | Valor | Como se comprueba |
| --- | --- | --- | --- | --- |
| CFG-17 | Extensiones | Database > Extensions | `pg_net` y `supabase_vault` habilitadas (las usa la 00138) | `select extname from pg_extension` |
| CFG-18 | Vault `notificaciones_url` | SQL Editor | `https://<ref>.supabase.co/functions/v1/enviar-notificaciones` | `select name from vault.secrets` |
| CFG-19 | Vault `notificaciones_llave` | SQL Editor | La **`sb_secret_`** del propio proyecto (ver la seccion de llaves) | La prueba de punta a punta de abajo |
| CFG-20 | Respaldos | Database > Backups | Lo que ofrezca el plan; si no ofrece, el volcado propio de `docs/CI-CD.md` es el unico que hay | La tabla "Registro" de `docs/CI-CD.md` |

El SQL, con `(valor, nombre)` en ese orden, que es como lo lee la 00138:

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/enviar-notificaciones', 'notificaciones_url');
select vault.create_secret('<la sb_secret_ del proyecto>', 'notificaciones_llave');
```

**El SQL Editor guarda historial.** Esa segunda linea deja la llave de servicio en los snippets del
proyecto, visibles para el resto del equipo. Hay que borrar el snippet o grabarle encima algo
inocuo al terminar, y comprobarlo. Para verificar se usa `select name, created_at, updated_at from
vault.secrets`; **nunca** `vault.decrypted_secrets`, que la muestra en claro.

Prueba de punta a punta de CFG-18 y CFG-19, que replica lo que hace
`fn_disparar_correo_de_notificaciones` sin mostrar ningun valor:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'notificaciones_url'),
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notificaciones_llave')
  ),
  body := '{}'::jsonb
);
-- unos segundos despues:
select status_code, created from net._http_response order by created desc limit 5;
```

`200` quiere decir que la cadena autentica. `401` quiere decir que en `notificaciones_llave` hay una
llave que no es la que Supabase inyecta en la funcion. Ojo: `net._http_response` se purga sola a las
pocas horas, asi que la consulta hay que hacerla **poco despues** del `http_post`.

### GitHub Actions

Se configuran en Settings > Secrets and variables > Actions del repositorio. La lista completa de
secrets esta en `docs/CI-CD.md`; aqui van solo los que dependen del ambiente de Supabase.

| ID | Ajuste | Valor | Como se comprueba |
| --- | --- | --- | --- |
| CFG-21 | `SUPABASE_SERVICE_ROLE_KEY_DEV` | La **`sb_secret_`** del proyecto | Disparar `keep-alive-supabase.yml` eligiendo `develop` como ref: tiene que quedar en verde |
| CFG-22 | `SUPABASE_URL_DEV` y `VITE_SUPABASE_URL_DEV` | La URL del proyecto, **sin barra final y sin ninguna ruta** | La misma corrida. Un valor mal formado da `404 PGRST125 "Invalid path specified in request URL"` |
| CFG-23 | `SUPABASE_ANON_KEY_DEV` y `VITE_SUPABASE_ANON_KEY_DEV` | La llave publica. Hoy la legacy `anon`; migrar a `sb_publishable_` esta pendiente | La web conecta contra el ambiente |

**Sin CFG-21, los workflows no fallan: se saltan el paso y terminan en verde.** Es peor que fallar,
porque el tablero dice que el keep-alive corre a diario cuando en realidad no esta haciendo ningun
ping y el proyecto puede pausarse por inactividad sin que nadie se entere.

**CFG-22 tiene dos nombres para la misma URL a proposito**: el keep-alive de `main` lee
`SUPABASE_URL_DEV` y el de `develop` lee `VITE_SUPABASE_URL_DEV`. Unificarlos mientras las dos ramas
no esten al dia deja un workflow sin secret. `VITE_SUPABASE_URL_DEV` estuvo mal formado sin que
nadie lo notara porque su otro uso es el build de la web en CI, cuyo artefacto no se ejecuta nunca
(Vercel usa sus propias variables).

**`alertas-vencimiento.yml` no se puede disparar a mano** mientras no exista en la rama por defecto:
GitHub solo ofrece `workflow_dispatch` para archivos que esten ahi. Se verifica invocando la funcion
directamente con la misma llave que guarda el secret, y se espera un `200` con
`{"alertasGeneradas":n,...}`.

---

## Registro por ambiente

`fecha / quien / comprobado`. Una fila se marca cuando se **verifico**, no cuando se toco.

| ID | Ajuste | Ecopac-Digital-Dev | Ecopac-Digital-Prod |
| --- | --- | --- | --- |
| CFG-01 | Site URL | 23-09-2026 / WilderL / si (`http://localhost:5173`) | pendiente |
| CFG-02 | Redirect URLs | 23-09-2026 / WilderL / si (4 entradas) | pendiente |
| CFG-03 | Registro cerrado | 23-09-2026 / WilderL / si (`422 signup_disabled`) | pendiente |
| CFG-04 | Email provider activado | 23-09-2026 / WilderL / si (login 200) | pendiente |
| CFG-05 | Confirm email | 23-09-2026 / WilderL / si (activado, divergencia justificada) | pendiente |
| CFG-06 | Longitud minima 8 | 23-09-2026 / WilderL / si (`422 weak_password`) | pendiente |
| CFG-07 | Letras y numeros | 23-09-2026 / WilderL / si (`422 weak_password`) | pendiente |
| CFG-08 | JWT expiry | 23-09-2026 / WilderL / si (3600, provisional) | pendiente |
| CFG-09 | Rotacion / reuse | 23-09-2026 / WilderL / si | pendiente |
| CFG-10 | Rate limits | 23-09-2026 / WilderL / si | pendiente |
| CFG-11 | Email OTP expiration | 24-09-2026 / WilderL / si (3600) | pendiente |
| CFG-12 | Plantilla de recuperacion | 24-09-2026 / WilderL / si (correo real recibido) | pendiente |
| CFG-13 | SMTP de Auth | 23-09-2026 / WilderL / si (ya estaba; Gmail, 465) | pendiente |
| CFG-14 | `ALLOWED_ORIGINS` | 23-09-2026 / WilderL / si (invitacion desde el navegador) | pendiente |
| CFG-15 | `WEB_URL` | 23-09-2026 / WilderL / si (enlace del correo correcto) | pendiente |
| CFG-16 | `SMTP_*` de las funciones | **no configurado**, por decision: se llena al pasar a produccion | pendiente |
| CFG-17 | Extensiones | 23-09-2026 / WilderL / si (`pg_net`, `supabase_vault`) | pendiente |
| CFG-18 | Vault `notificaciones_url` | 23-09-2026 / WilderL / si | pendiente |
| CFG-19 | Vault `notificaciones_llave` | 24-09-2026 / WilderL / si (`pg_net` responde 200) | pendiente |
| CFG-20 | Respaldos | 24-09-2026 / WilderL / si (plan Free: **ninguno**). Restauracion **sin probar** | pendiente |
| CFG-21 | `SUPABASE_SERVICE_ROLE_KEY_DEV` | 24-09-2026 / WilderL / si (corrida en verde) | pendiente |
| CFG-22 | URLs del proyecto en Actions | 24-09-2026 / WilderL / si (corrida en verde) | pendiente |
| CFG-23 | Llaves anonimas en Actions | 24-09-2026 / WilderL / si (legacy; migracion pendiente) | pendiente |

Lo que en dev quedo sin cerrar, dicho aqui para que no se pierda:

- **CFG-16**: los `SMTP_*` de las funciones no se configuraron. Mientras no esten, la invitacion
  manda el correo de **restablecimiento** en vez del de **bienvenida**. Funciona, pero no es lo que
  la #864 quiso.
- **CFG-20**: el plan Free no da respaldos y la prueba de restauracion no se hizo, porque
  `supabase db dump --linked` pide la contrasena de la base. El procedimiento esta en
  `docs/CI-CD.md`.

---

## Limitaciones del plan Free

No son tareas pendientes. Si se anotan como pendientes, alguien las va a buscar para siempre.

| Que | Que dice el Dashboard |
| --- | --- |
| Respaldos automaticos | "Free Plan does not include project backups. Upgrade to the Pro Plan for up to 7 days of scheduled backups" |
| Configuracion de sesiones (time-box, inactividad) | "only available on the Pro Plan and above" |
| Prevent use of leaked passwords (HaveIBeenPwned) | "Only available on Pro plan and above" |

De las tres, la ultima es la que **cambiaria de verdad la postura de seguridad** si se subiera de
plan: es el unico control que rechaza una contrasena que ya aparecio en una filtracion. Conviene
tenerlo a la vista cuando se decida el plan de produccion.

Dos ajustes mas que estan en OFF y que **la issue #879 no pidio**, anotados para que se decidan a
proposito y no por descuido: **Secure password change** y **Require current password when
updating**. La aplicacion si reverifica la contrasena actual (`usePerfilPropio`), asi que por la web
no hay hueco; lo habria para quien llame a la API directamente con un token robado.

---

## Lo que cambia en produccion

`ecopac-prod` no es dev con otro nombre. Lo que cambia:

| Ajuste | En dev | En produccion |
| --- | --- | --- |
| CFG-01 Site URL | `http://localhost:5173` | El dominio real de la web |
| CFG-02 Redirect URLs | incluye `exp://*` | **sin `exp://*` ni ningun comodin.** Un comodin en produccion es una redireccion abierta |
| CFG-14 `ALLOWED_ORIGINS` | `http://localhost:5173` | El dominio real |
| CFG-15 `WEB_URL` | `http://localhost:5173` | El dominio real |
| CFG-16 `SMTP_*` | sin configurar | Proveedor propio y remitente de la organizacion |
| CFG-13 SMTP de Auth | una cuenta personal de prueba | Remitente de la organizacion |
| Cuenta de prueba | una direccion de prueba | una direccion de prueba, **nunca la de una persona de la organizacion** |
| Llaves | legacy `anon` + `sb_secret_` | nace con `sb_publishable_` / `sb_secret_`: no habra legacy que copiar por error |

### Orden de aprovisionamiento

`ecopac-prod` esta **pausado**, y su configuracion no se puede leer sin reanudarlo. El orden importa:

1. Reanudar el proyecto.
2. **Cerrar el registro (CFG-03) antes que nada.** El valor por defecto de Supabase es abierto, y
   entre reanudar y cerrarlo hay una ventana en la que cualquiera con la llave publica -que viaja
   en el bundle del navegador- puede darse de alta. El rol por defecto de `perfiles` es voluntario
   general, que escribe pacientes, expedientes, atenciones y triajes (migraciones 00032 y 00033).
3. CFG-01 y CFG-02, para que ningun correo salga con un destino equivocado.
4. El resto de la lista.
5. Volver a recorrerla entera comprobando, y llenar la columna de Prod.

**Un volcado de produccion contiene expedientes clinicos reales.** Todo lo que diga
`docs/CI-CD.md` sobre respaldos aplica con mas fuerza aqui: lo genera solo la persona responsable
de la base, se guarda cifrado fuera del repositorio y de equipos personales, y se borra al terminar.

---

## Documentacion relacionada

- `docs/SEGURIDAD.md` - por que cada uno de estos ajustes importa, y el estado de cada ambiente.
- `docs/CI-CD.md` - la lista completa de secrets de GitHub Actions y el procedimiento de respaldo.
- `docs/QUICKSTART.md` - como aprovisionar un ambiente desde cero.
- `docs/PERMISOS.md` - que puede hacer cada rol, que es lo que el registro cerrado protege.
- `supabase/config.toml` - los mismos valores para el stack local y el CI.
