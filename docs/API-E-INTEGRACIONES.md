# Documentacion de API e integraciones - Ecopac Digital

Como se comunican las aplicaciones con la base de datos y con los servicios externos: que puntos de entrada hay, quien los llama, como se autentican y que devuelven. Es la referencia para conectar algo nuevo sin duplicar lo que ya existe.

El detalle de cada funcion exportada esta en [API-SHARED.md](./API-SHARED.md), y el de cada tabla, vista y funcion de la base, en [DICCIONARIO-DE-DATOS.md](./DICCIONARIO-DE-DATOS.md). Este documento no los repite: explica las conexiones.

| | |
| --- | --- |
| Version | 2.0 |
| Fecha | 18 de octubre de 2026 |
| Base de referencia | Rama `develop`, migraciones hasta la `00189` |

---

## 1. Panorama

| Origen | Destino | Por donde | Para que |
| --- | --- | --- | --- |
| Web y app movil | Base de datos | `packages/shared` -> supabase-js -> API REST de Supabase (PostgREST), protegida por RLS | Leer y escribir los datos de cada modulo |
| Web y app movil | Funciones de la base (RPC) | `packages/shared` -> `supabase.rpc()` | Operaciones que tocan varias tablas a la vez (registrar un paciente, generar una receta, trasladar entre bodegas) |
| Web y app movil | Autenticacion | `packages/shared/api/sesion.js` -> Supabase Auth | Iniciar y cerrar sesion, recuperar la contrasena |
| Web y app movil | Edge Function `invitar-usuario` | `packages/shared/usuarios/api.js` -> `functions.invoke()` | Dar de alta a una persona y mandarle el correo de bienvenida |
| Web y app movil | Cambios en tiempo real | `packages/shared/hooks/useCambiosEnTiempoReal.js` -> Supabase Realtime | Recargar una pantalla cuando otra persona cambia sus datos |
| Base de datos | Edge Function `enviar-notificaciones` | Trigger + `pg_net`, con la URL y la llave guardadas en Supabase Vault | Mandar por correo las notificaciones a la administracion |
| Edge Functions y Supabase Auth | Correo | SMTP de Gmail de la organizacion | Bienvenida, recuperacion de contrasena y notificaciones |
| GitHub Actions (programado) | Edge Function `alertas-vencimiento` | `curl` con la llave de servicio | Generar cada dia las alertas de vencimiento y reintentar los correos pendientes |
| GitHub Actions (programado) | Base de datos | API REST, CLI de Supabase y `pg_dump` | Mantener activa la base, verificar el despliegue y respaldarla |
| Web | Mapa de comunidades | Teselas de OpenStreetMap (Leaflet) | Marcar la ubicacion de una comunidad |
| Web, movil y Edge Functions | Sentry (opcional) | `packages/shared/observabilidad` | Reportar errores inesperados, sin datos sensibles |

## 2. El cliente compartido

Ninguna pantalla habla con Supabase directamente. Todo pasa por `packages/shared`, que cada aplicacion inicializa al arrancar con su URL, su llave publica y su almacenamiento de sesion:

| Archivo | Exporta | Para que |
| --- | --- | --- |
| `api/cliente.js` | `inicializarSupabase`, `obtenerSupabase`, `haySupabase`, `reiniciarSupabase` | Crear y obtener la unica instancia del cliente |
| `api/sesion.js` | `iniciarSesion`, `cerrarSesion`, `obtenerSesion`, `evaluarPerfilDeSesion`, `requiereCerrarSesion`, `intercambiarSesionDeRecuperacion`, `establecerSesionDeRecuperacion` | Sesion y recuperacion de contrasena. Cierra la sesion si el perfil fue desactivado |
| `api/errores-de-supabase.js` | `normalizarError`, `normalizarErrorConReglas`, `construirError`, `esErrorDeRed`, `esErrorDeCancelacion`, `sanearDetalle`, `CODIGOS_DE_ERROR_DE_SUPABASE` | Convertir cualquier error de Supabase en un error con codigo y mensaje para la persona, sin datos sensibles |
| `api/errores.js` | `ErrorDeCliente`, `CODIGOS_DE_ERROR_DE_CLIENTE` | Errores que nacen en el cliente (validacion, contrato) |
| `api/paginacion.js` | `obtenerTodasLasFilas` | Leer una consulta completa por paginas, sin el tope de filas de PostgREST |
| `api/almacenamiento.js` | `validarAlmacenamiento`, `crearAlmacenamientoEnMemoria` | Validar el almacenamiento de sesion que inyecta cada app (`localStorage` en web, almacenamiento seguro en movil) |

`packages/shared` no usa `localStorage`, `AsyncStorage`, `window` ni `document`: cada aplicacion le inyecta lo que necesita.

## 3. Como responde cada modulo

Cada modulo de dominio tiene sus archivos `*.api.js` (por ejemplo `pacientes/api.js`, `pacientes/triaje.api.js`, `inventario/movimientos.api.js`). Son el unico lugar del modulo que hace llamadas.

**La forma de la respuesta no es unica.** Conviven `{ datos, error }`, `{ triajes, error }`, `{ recetas, error }` y otras: cada funcion documenta en JSDoc la clave que devuelve. Antes de usar una funcion se lee su `api.js` y se usa esa clave; equivocarse de clave no lanza error, devuelve una lista vacia. Lo comprueban `npm run verificar:contratos` y la regla de lint correspondiente.

Los errores siempre llegan normalizados por `normalizarError()`, con un codigo comparable (no se comparan textos).

## 4. API de datos y seguridad

- Las tablas y vistas se leen y escriben con la API REST de Supabase a traves de supabase-js. La aplicacion usa la **llave publica**; la llave de servicio nunca llega al cliente.
- **Quien protege los datos es la base**, con politicas RLS en todas las tablas. Las funciones `puede...()` de cada `permisos.js` solo ocultan o deshabilitan botones. La matriz completa esta en [PERMISOS.md](./PERMISOS.md).
- El registro publico de cuentas esta cerrado: las cuentas solo se crean por la Edge Function `invitar-usuario`.

## 5. Funciones de la base que llama el cliente (RPC)

Las operaciones que tocan varias tablas o que deben ser atomicas viven en funciones de PostgreSQL. Las que llama `packages/shared`:

| Modulo | Funciones |
| --- | --- |
| `pacientes/` | `fn_buscar_pacientes`, `fn_registrar_paciente`, `fn_detectar_pacientes_duplicados`, `fn_fusionar_pacientes`, `fn_generar_receta`, `fn_bodega_de_entrega_de_consulta` |
| `inventario/` | `fn_existencias_disponibles`, `existencias_totales_por_bodega`, `fn_registrar_medicamento`, `fn_cambiar_principio_de_medicamento`, `fn_trasladar_entre_bodegas`, `fn_ajustar_entrega_receta`, `fn_atender_alerta_caducidad`, `fn_sincronizar_alertas_caducidad`, `fn_valor_de_inventario_disponible` |
| `jornadas/` | `fn_cargar_insumo_a_bodega_de_jornada`, `fn_devolver_de_bodega_de_jornada`, `fn_consumo_de_insumos_de_jornada`, `fn_insumos_de_proyecto`, `fn_atenciones_de_persona_por_jornada`, `fn_contar_atenciones_incompletas` |
| `proyectos/` | `equipo_de_proyecto`, `fn_pasar_insumo_de_proyecto_a_jornada` |
| `presupuestos/` | `presupuestos_de_jornadas`, `presupuestos_de_proyectos`, `sobrante_de_jornada`, `fn_liquidar_sobrante_de_jornada`, `saldo_de_caja` |
| `donaciones/` | `fn_registrar_donacion` |
| `citas/` | `fn_eliminar_clinica` |
| `reportes/` | `fn_reporte_pacientes_atendidos`, `fn_reporte_jornada`, `fn_reporte_enfermedades`, `fn_opciones_reporte_enfermedades` |
| `usuarios/` | `mis_accesos` (modulos y permisos de la sesion, al iniciar) |

Su descripcion, parametros, seguridad (`INVOKER` o `DEFINER`) y quien puede ejecutarlas estan en el diccionario de datos, seccion de funciones.

## 6. Edge Functions

Tres funciones en `supabase/functions/`, desplegadas por el workflow **Supabase** junto con las migraciones. El runtime exige un JWT valido en todas.

### `invitar-usuario`

| | |
| --- | --- |
| Quien la llama | `crearUsuario()` de `packages/shared/usuarios/api.js`, desde la pantalla Colaboradores |
| Autenticacion | El JWT de la sesion. La funcion comprueba que quien llama sea **administrador activo** |
| Entrada (JSON) | `nombres`, `apellidos`, `email`, `rol` (obligatorios) y `telefono` (opcional) |
| Que hace | Crea la cuenta con `fn_crear_usuario_administrativo()` y manda el correo de bienvenida con el enlace para elegir la contrasena |
| Respuesta | El perfil creado (`id`, `nombres`, `apellidos`, `email`, `telefono`, `rol`, `activo`, `fechaIngreso`) y `correoEnviado` |
| Errores | Siempre `{ code, message }`, con `code` un SQLSTATE, para que `normalizarError()` lo clasifique (por ejemplo, correo ya registrado) |

### `enviar-notificaciones`

| | |
| --- | --- |
| Quien la llama | El trigger `trg_notificaciones_disparar_correo` (migracion 00138), con `pg_net`, cada vez que se registra una notificacion. Ademas, `alertas-vencimiento` repite el barrido cada dia como reintento |
| Autenticacion | Exactamente la llave de servicio, guardada en Supabase Vault (`notificaciones_llave`) junto con la URL (`notificaciones_url`) |
| Entrada | Ninguna: barre todos los correos pendientes. `fn_reclamar_correos_de_notificaciones()` reparte las filas para que ninguna salga dos veces |
| Respuesta | `correo` (`enviado`, `sin configurar` o `error`), `correosEnviados` y `correosFallidos` |

### `alertas-vencimiento`

| | |
| --- | --- |
| Quien la llama | El workflow **Alertas de vencimiento**, todos los dias a las 06:00 UTC (el plan gratuito de Supabase no incluye `pg_cron`) |
| Autenticacion | Exactamente la llave de servicio |
| Que hace | Llama a `fn_generar_alertas_caducidad()`, que crea las alertas de los lotes por vencer o vencidos sin duplicar, y reintenta los correos pendientes |
| Respuesta | `alertasGeneradas` y el resultado del correo (`correo`, `correosEnviados`, `correosFallidos`) |
| Si falla | El workflow falla en rojo y abre una issue |

### Variables de entorno de las funciones

| Variable | Para que |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Las inyecta Supabase; no se configuran a mano |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correo de la organizacion |
| `WEB_URL` | Direccion de la web, para los enlaces de los correos |
| `ALLOWED_ORIGINS` | Origenes que pueden llamar a las funciones desde el navegador (CORS) |
| `AMBIENTE`, `SENTRY_DSN` | Etiqueta del ambiente y destino de errores (opcional) |

Donde se configura cada una: [MANUAL-DE-INSTALACION.md](./MANUAL-DE-INSTALACION.md) y [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md).

## 7. Tiempo real

`useCambiosEnTiempoReal()` y `suscribirACambios()` (`packages/shared/hooks/`) se suscriben con Supabase Realtime a las tablas de una pantalla y la recargan cuando cambian, con una espera corta para agrupar cambios seguidos. Realtime respeta RLS: cada persona solo recibe avisos de las filas que puede ver.

## 8. Integraciones programadas

| Workflow | Cuando | Que llama |
| --- | --- | --- |
| Alertas de vencimiento | Diario, 06:00 UTC | Edge Function `alertas-vencimiento`, en produccion y desarrollo |
| Mantener Supabase activo | Cada 3 dias, 12:00 UTC | Una lectura de la API REST, para que el plan gratuito no pause la base |
| Verificar despliegue | Diario, 13:00 UTC | `supabase db push --dry-run`: abre una issue si a la base le falta una migracion |
| Respaldo de la base | Diario, 07:00 UTC | `pg_dump` de produccion, cifrado con GPG y subido a Google Drive con `rclone` ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md)) |

Los secrets de cada uno estan en [CI-CD.md](./CI-CD.md).

## 9. Reglas de la frontera

Lo que `packages/shared` no puede hacer:

| Prohibido | Por que |
| --- | --- |
| Importar `react-dom`, `react-native` o `react-bootstrap`, o devolver JSX | Lo usan dos plataformas distintas |
| Usar `window`, `document`, `localStorage` o `AsyncStorage` | Cada aplicacion inyecta lo suyo |

Lo que las aplicaciones no pueden hacer:

| Prohibido | Donde va |
| --- | --- |
| Importar `@supabase/supabase-js` directamente | `packages/shared/api/` |
| Escribir validaciones, formato o reglas de negocio en un componente | El modulo correspondiente de `packages/shared` |
| Decidir un permiso solo en el cliente | `permisos.js` del modulo, respaldado por RLS en la base |
| Comparar mensajes de error por texto | Los codigos de `normalizarError()` |

La guia completa, con ejemplos: [ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md).
