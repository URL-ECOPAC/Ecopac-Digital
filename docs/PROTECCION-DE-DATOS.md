# Proteccion de datos sensibles - Ecopac Digital

Revision de como se protegen los datos sensibles en transito, en reposo y en los registros
(OWASP A02, issue #238). Complementa a [SEGURIDAD.md](./SEGURIDAD.md), que cubre autenticacion
(OWASP A07, issue #230) y no toca este tema.

Dato sensible en este proyecto: informacion de pacientes -identificacion (nombres, apellidos,
DPI, telefono, fecha de nacimiento) y clinica (diagnosticos, sintomas, tratamiento, recetas,
condiciones cronicas). La regla de confidencialidad de `AGENTS.md` ("no usar datos reales de
pacientes en pruebas ni en logs") es el punto de partida de esta revision.

## 1. Logs y consola (criterio 1 del DoD)

**Ya se cumple; no hubo que cambiar codigo.**

- [`packages/shared/api/errores-de-supabase.js`](../packages/shared/api/errores-de-supabase.js)
  es el punto unico por el que pasan los errores de Supabase antes de llegar a pantalla o a un
  log, y ya esta disenado para esto: `normalizarError()` arma el `mensaje` que ve la persona
  usuaria siempre desde el diccionario fijo `MENSAJES`, nunca del texto que manda el servidor.
  El detalle tecnico (`construirDetalle()`) pasa por `sanearDetalle()`, que reemplaza con una
  expresion regular todo lo que va entre parentesis y comillas -justo donde Postgres pone el
  valor de la columna en un error de constraint, por ejemplo
  `Key (dpi)=(1234567) already exists`- y ademas descarta `error.hint` por completo, donde
  PostgREST devuelve a veces el SQL literal de una politica. El encabezado del archivo documenta
  esta regla explicitamente.
- Ningun archivo de `packages/shared/pacientes/` tiene un solo `console.*`; todos devuelven el
  error ya normalizado a quien los llama. Tampoco hay ningun `console.*` en las pantallas de
  pacientes de `apps/mobile/src/screens/`.
- No hay ningun servicio externo de logging/monitoreo integrado (Sentry, LogRocket, Bugsnag,
  Datadog o similar) en ningun `package.json` del repositorio, asi que no hay riesgo de que un
  error no manejado mande un payload completo a un tercero.

## 2. Almacenamiento en el dispositivo movil (criterio 2 del DoD)

**Que se guarda:** unicamente la sesion de `supabase-js` (access token, refresh token y
metadata del usuario autenticado). No hay ningun cache adicional de datos de negocio -no se usa
`@tanstack/react-query` ni ninguna libreria de cache persistente en el proyecto, y no hay ningun
uso de almacenamiento persistente fuera del adaptador de sesion
(`apps/mobile/src/almacenamiento.js`). El criterio "se limita a lo imprescindible" ya se
cumplia.

**Que se limpia al cerrar sesion:** `logout()` (`packages/shared/hooks/useSesion.js`) llama a
`cerrarSesion()` (`packages/shared/api/sesion.js`), que ejecuta
`cliente.auth.signOut({ scope: "local" })`. `supabase-js` borra por su cuenta la clave de sesion
del adaptador de almacenamiento. Como no hay ningun otro dato persistido, no queda ningun resto
tras cerrar sesion.

**Lo que si cambio:** la sesion se guardaba con `@react-native-async-storage/async-storage`, que
no esta cifrado por el sistema operativo -en un telefono con root/jailbreak, o en un backup sin
cifrar, el contenido es legible por cualquier app con acceso al almacenamiento del dispositivo.
La sesion es una credencial de larga duracion (`persistSession: true`, `autoRefreshToken: true`
en `packages/shared/api/cliente.js`), asi que guardarla en texto plano es exactamente el tipo de
hallazgo que pide el criterio 2.

`expo-secure-store` por si solo no alcanza: tiene un limite historico de valor de ~2048 bytes en
iOS, y la sesion completa de Supabase (los dos tokens JWT mas la metadata del usuario) lo supera.
La solucion, documentada por el propio Supabase para apps Expo/React Native, es un patron
hibrido: la sesion se cifra con AES-GCM y el blob cifrado se guarda en AsyncStorage (sin limite
de tamano practico); solo la LLAVE de cifrado -pequena, 32 bytes en base64- vive en SecureStore,
protegida por el Keychain de iOS o el Keystore de Android. Sin la llave, el blob en AsyncStorage
es basura ilegible.

A diferencia del patron que documenta el blog de Supabase (que depende de la libreria externa
`aes-js` mas un polyfill de `crypto.getRandomValues`), esta implementacion usa el modulo
`expo-crypto` (`AESEncryptionKey`, `AESSealedData`, `aesEncryptAsync`/`aesDecryptAsync`), nativo
desde el SDK 57, sin dependencias externas de cifrado. Ver
[`apps/mobile/src/almacenamiento.js`](../apps/mobile/src/almacenamiento.js).

**Pendiente:** este cambio se escribio y se verifico contra la documentacion y los tipos reales
del paquete instalado (`node_modules/expo-crypto`), pero no se pudo probar en un dispositivo o
emulador real desde este entorno. Antes de confiar en que el login persiste correctamente entre
sesiones, hay que probarlo a mano: cerrar y volver a abrir la app sin cerrar sesion, y confirmar
que sigue autenticado.

## 3. Cifrado adicional a nivel de columna (criterio 3 del DoD)

**Columnas evaluadas** (PII fuerte en `pacientes`, `supabase/migrations/00009` y `00035`):
`dpi`, `telefono_contacto`, `fecha_nacimiento`, `nombres`, `apellidos`, `nombre_responsable`.
Mas el contenido clinico en texto libre de `consultas` (`sintomas`, `tratamiento`,
`antecedentes`, `observaciones`) y `padecimientos_cronicos.notas`.

**Decision: no se agrega cifrado a nivel de columna (pgcrypto/pgsodium) por ahora.**

Razones:

- **Ya hay dos capas de proteccion real.** RLS restringe cada tabla clinica a los roles que
  necesitan verla (administrador, medico, voluntario segun el modulo; los roles consultivos sin
  ninguna fila, ver `00032`/`00033` y la auditoria de la issue #237), y Supabase exige TLS en
  transito para toda conexion. El cifrado a nivel de columna protegeria contra un escenario
  distinto: alguien con acceso directo a la base (no via la API), que no es el vector que las
  otras dos capas cubren.
- **Rompe funcionalidad real sin un beneficio proporcional.** `dpi` tiene un `UNIQUE` (`00009`)
  que depende de comparar el valor en claro; cifrarlo con IV aleatorio (lo correcto,
  criptograficamente) rompe esa unicidad, y usar cifrado determinista para conservarla debilita
  la proteccion (permite correlacionar registros por el mismo DPI sin descifrar nada). La
  busqueda de pacientes (`fn_buscar_pacientes`, `ILIKE` sin acentos sobre `nombres`/`apellidos`)
  y el ordenamiento alfabetico dejarian de funcionar en la base y tendrian que reimplementarse
  trayendo todas las filas al cliente para descifrar y filtrar ahi -mas lento, y en la practica
  vuelve a exponer el dato completo en memoria del cliente de todas formas.
- **El riesgo que de verdad importa (una llave de service_role filtrada) no lo resuelve el
  cifrado de columna.** Quien tiene esa llave ya puede leer cualquier fila sin que RLS se lo
  impida; si el esquema de cifrado guarda la llave de descifrado en la misma base o en una
  variable de entorno accesible desde el mismo lugar que la `service_role`, cifrar la columna no
  agrega una barrera real contra ese escenario especifico.

Si en el futuro cambia el modelo de amenaza -por ejemplo, si se necesita cumplir un requisito
regulatorio especifico sobre DPI, o si se identifica un vector de acceso directo a la base que
RLS no cubre- esta decision se reevalua. Documentado aqui para que quede constancia de que se
evaluo y no fue un descuido.

## 4. Llaves y secretos (criterio 4 del DoD)

**Ya se cumple; no hubo que cambiar codigo.**

- Sin secretos hardcodeados en el repositorio: `.gitignore` excluye todos los `.env*` reales
  (solo `.env.example`, vacio, esta trackeado), y una busqueda de patrones de llaves conocidos
  (`service_role`, prefijos de tokens comunes) no encontro ninguno.
- [`packages/shared/entorno/reglas.js`](../packages/shared/entorno/reglas.js) valida
  activamente la llave anonima al arrancar la aplicacion (`validarLlaveAnonima()`) y **rechaza
  explicitamente** que sea una llave `service_role` -la detecta por prefijo o decodificando el
  JWT para leer el claim `role`- antes de que la app termine de inicializar. Si algun dia alguien
  pega la llave equivocada en un `.env`, la app falla al arrancar en vez de exponer una llave que
  salta todas las politicas RLS.
- No hay Edge Functions desplegadas todavia (`supabase/functions/` solo tiene `.gitkeep`), asi
  que no hay riesgo de un secreto de funcion filtrado. El unico script que usa una credencial de
  base de datos directa (`scripts/verificar-concurrencia-numero-ficha.mjs`) vive fuera de
  `apps/*/src`, no lo importa ningun archivo de cliente, y no lo empaqueta ni Vite ni Metro.

## Documentos relacionados

- [SEGURIDAD.md](./SEGURIDAD.md) - autenticacion: politica de contrasenas, expiracion de sesion,
  alta de cuentas (OWASP A07).
- [PERMISOS.md](./PERMISOS.md) - matriz de permisos por rol y control de acceso (OWASP A01).
- [../AGENTS.md](../AGENTS.md) - regla de confidencialidad de datos de pacientes.
