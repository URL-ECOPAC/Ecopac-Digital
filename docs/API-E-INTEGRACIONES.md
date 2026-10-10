# Referencia de Integraciones y API

Puntos de conexión entre las aplicaciones, la capa compartida y los servicios externos. Sirve para responder antes de escribir código: ****"¿cómo se comunican?"****, ****"¿qué flujo debo seguir?"**** y ****"¿ya está resuelto?"****. La causa más repetida de duplicidad es implementar una integración que ya existe, hecha aparte y peor.

Estado al 28 de septiembre de 2026, sobre `develop`. Cada función expuesta documenta su entrada y salida en JSDoc: `@param` y `@returns` están presentes en todo lo exportado, y `npm run verificar:jsdoc -- --estricto` lo comprueba en CI.

## Cómo se conecta

Toda llamada hacia fuera entra por un punto único:

js

Run

const { data, error } = await obtenerPaciente(pacienteId);  
const { data: resultado, error } = await invitarUsuario({ correo, rol });  

No se instancia `supabase` directamente en componentes ni en pantallas. El cliente se obtiene a través de `@ecopac/shared/api`: centraliza el ciclo de vida, la detección de errores y el cierre de sesión. Romper esto ya causó la fuga de credenciales `service_role` en el bundle del cliente (issue #365). Por eso el acceso vive en un solo sitio:



| Archivo        | Propósito                                                        |
| -------------- | ---------------------------------------------------------------- |
| api/cliente.js | Crear, recuperar y reiniciar la instancia de Supabase            |
| api/sesion.js  | Inicio, cierre y verificación de sesión activa                   |
| api/errores.js | Normalización de todos los errores a una forma común             |
| edge/          | Llamadas a funciones desplegadas en Supabase                     |
| formato/       | Preparación de fechas, montos y textos antes de enviar o mostrar |

Una petición ****nace y se maneja en**** **`**api.js**`** ****de cada módulo****, nunca se escribe desde un componente.

## Anatomía de una integración

Cada módulo sigue esta estructura cuando habla hacia afuera:



| Archivo         | Responsabilidad                                                         |
| --------------- | ----------------------------------------------------------------------- |
| api.js          | Único lugar que hace llamadas: Supabase o Edge Functions                |
| transformar.js  | Convierte lo que responde el servicio al formato que espera la pantalla |
| validaciones.js | Valida entrada antes de enviar y salida antes de usar                   |
| hooks.js        | Expone el estado de carga, datos y error a la interfaz                  |
| descriptores.js | Etiquetas, mensajes y rutas que acompañan la llamada                    |

Convención sin excepciones:



| Forma               | Qué es                                              |
| ------------------- | --------------------------------------------------- |
| obtener*            | Lectura por identificador; devuelve registro o null |
| listar*             | Consulta con filtros, orden y paginación            |
| registrar*          | Creación; devuelve el registro completo guardado    |
| actualizar*         | Modificación; recibe solo los campos a cambiar      |
| eliminar* / anular* | Borrado lógico o físico; retorna confirmación       |
| invitar* / enviar*  | Llamada a Edge Function o servicio externo          |
| use*                | Hook React que gestiona estado de petición          |

> ****Regla de seguridad:**** los permisos del lado del cliente (`puede*`) ocultan o deshabilitan controles; ****no protegen los datos****. Quien autoriza de verdad es RLS en la base.

## Infraestructura

### `api/` — Cliente, sesión y manejo de errores



| Export                                                               | Qué hace                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| inicializarSupabase, obtenerSupabase, reiniciarSupabase, haySupabase | Ciclo de vida del cliente compartido                                  |
| iniciarSesion, cerrarSesion, obtenerSesion                           | Autenticación. Únicos puntos de entrada — no duplicar                 |
| evaluarPerfilDeSesion, requiereCerrarSesion                          | Valida si el perfil sigue activo y con rol vigente                    |
| normalizarError, construirError, ErrorDeCliente                      | Todo error llega con la misma estructura: { mensaje, codigo, campo? } |
| esErrorDeRed, esErrorDeCancelacion                                   | Distingue fallo transitorio de error definitivo                       |
| CODIGOS_DE_ERROR_SUPABASE, CODIGOS_DE_ERROR_CLIENTE                  | Códigos estandarizados, no cadenas comparadas a mano                  |
| sanearDetalle                                                        | Elimina datos sensibles antes de registrar o mostrar un error         |

`packages/shared` ****no puede**** tocar `localStorage` ni `AsyncStorage`: cada aplicación inyecta su propio almacenamiento y este módulo solo lo valida.

### `edge/` — Funciones del lado del servidor



| Función               | Qué hace                                     | Protegida con                         |
| --------------------- | -------------------------------------------- | ------------------------------------- |
| invitar-usuario       | Crea cuenta, envía enlace de recuperación    | service_role — nunca llega al cliente |
| enviar-notificaciones | Entrega correos mediante SMTP configurado    | service_role                          |
| alertas-vencimiento   | Recalcula fechas y genera avisos programados | JWT de sesión                         |

Las funciones se llaman desde `api.js` mediante `.rpc()` o `fetch` autenticado con el token de sesión. La clave de servicio vive ****solo**** en variables de entorno del proyecto Supabase, nunca en el código.

### `formato/` — Preparación de datos de entrada y salida



| Función                                    | Qué hace                                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| formatearFechaConHora, formatearFechaCorta | Fechas consistentes entre web y móvil                              |
| formatearMoneda                            | Montos con separadores y moneda configurada                        |
| fechaLocalISO                              | Fecha sin desfase UTC — evita el error de "mañana desde las 18:00" |
| textoComparable                            | Normaliza texto para búsquedas sin distinguir mayúsculas ni tildes |
| construirFiltro                            | Convierte objeto de filtros a cláusula de consulta                 |

Ninguna pantalla da formato por su cuenta. Todo valor que llega de la base o se envía pasa por aquí.

### `hooks/` — Patrones comunes de petición



| Hook                                     | Qué resuelve                                              |
| ---------------------------------------- | --------------------------------------------------------- |
| useConsulta({ fn, parametros })          | Carga, datos y error en un solo objeto; maneja recarga    |
| useEscritura({ fn, exito, error })       | Estado de envío, deshabilitado mientras procesa, mensajes |
| usePaginacion({ pagina, tamano, total }) | Cálculo de rango y navegación reutilizable                |
| useTiempoReal({ tablas, alCambiar })     | Recarga automática cuando cambian datos en la base        |

`useConsulta` evita repetir el patrón `cargando → datos → error` en cada pantalla. `useEscritura` estandariza el mensaje de confirmación y el bloqueo mientras se envía.

### `validaciones/` — Antes de enviar y después de recibir



| Grupo                            | Qué valida                                                            |
| -------------------------------- | --------------------------------------------------------------------- |
| validarCorreo, validarContrasena | Formato y complejidad antes de crear cuenta                           |
| validarFechas                    | Rango lógico, fechas futuras prohibidas según contexto                |
| validarRangoCantidad             | Valores negativos o cero donde no corresponde                         |
| validarRespuesta(fn, datos)      | Verifica que lo que devolvió el servicio tenga la estructura esperada |

La validación ocurre ****antes**** de llamar a la API: muestra mensaje claro sin consumir ancho de banda. También después: detecta si la respuesta cambió de estructura sin previo aviso.

## Módulos de integración

### `pacientes/api.js`

****Consultas:**** `buscarPacientes`, `obtenerPaciente`, `obtenerHistorialMedico`, `obtenerTriajes`, `obtenerConsultas`, `obtenerRecetas`  
****Escrituras:**** `registrarPaciente`, `actualizarPaciente`, `registrarAtencion`, `anularReceta`, `fusionarPacientes`  
****Estructura de respuesta:**** `{ data, error }` — `data` es `null` si no hay resultado, `error` lleva el mensaje para el usuario.

### `usuarios/api.js`

****Consultas:**** `listarUsuarios`, `obtenerPerfil`, `contarAdministradoresActivos`  
****Escrituras:**** `crearUsuario` → llama a `invitar-usuario`, `actualizarUsuario`, `desactivarUsuario`, `restablecerContrasena`  
****Regla crítica:**** no se puede desactivar al último administrador activo; la validación se ejecuta en cliente ****y**** en base.

### `inventario/api.js`

****Consultas:**** `listarMedicamentos`, `listarLotes`, `consultarExistencias`, `listarMovimientos`, `listarAlertas`  
****Escrituras:**** `registrarIngreso`, `registrarSalida`, `ajustarLote`, `atenderAlerta`  
****Lote:**** se crea automáticamente al registrar ingreso; no existe `registrarLote` independiente (retirado en #846 por dejar existencias en cero).

### `bitacora/api.js`

****Consultas:**** `obtenerEventos`, `detalleEvento`  
****Estructura:**** cada evento guarda `tabla`, `operacion`, `usuario`, `valoresAnteriores`, `valoresNuevos`. La comparación de cambios se hace en el cliente para no sobrecargar la base.

### `notificaciones/api.js`

****Consultas:**** `listarNoLeidas`, `listarPorCategoria`  
****Escrituras:**** `marcarLeida`, `marcarTodasLeidas`  
****Tiempo real:**** se suscribe a la tabla de notificaciones; el contador se actualiza sin recargar la página.

### `reportes/api.js`

****Consultas:**** `obtenerIndicadores`, `obtenerReportePorFechas`, `exportarCSV`  
****Filtros:**** se serializan en la URL para compartir el reporte por enlace. Rango "este mes" cubre desde el primer día hasta el último completo.

## Reglas de la frontera

Lo que `packages/shared` ****no puede**** hacer:



| Prohibido                                                  | Motivo                                        |
| ---------------------------------------------------------- | --------------------------------------------- |
| Importar react-dom, react-native o componentes de interfaz | Lo consumen dos plataformas distintas         |
| Usar window, document, localStorage directamente           | No existe igual en web y móvil                |
| Devolver JSX o clases de estilos                           | La presentación corresponde a cada aplicación |

Lo que ****las aplicaciones no pueden**** hacer:



| Prohibido                               | Lugar correcto                     |
| --------------------------------------- | ---------------------------------- |
| Instanciar supabase directamente        | packages/shared/api/cliente.js     |
| Escribir validaciones en componente     | validaciones.js del módulo         |
| Dar formato a fecha o monto en pantalla | formato/                           |
| Decidir permiso sin RLS                 | permisos.js + política en base     |
| Comparar mensajes de error por texto    | Usar códigos de CODIGOS_DE_ERROR_* |

Estas reglas se verifican con `npm run verificar:shared-esquema` y con lint en CI. Pasar la verificación ****no garantiza**** que todo funcione bien: comprueba que lo que está escrito exista, no que se use correctamente.

La guía completa con ejemplos: [ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md).