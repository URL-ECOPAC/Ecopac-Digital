# Referencia de `packages/shared`

Que exporta cada modulo de la logica compartida, agrupado por para que sirve.

Sirve para responder dos preguntas antes de escribir codigo nuevo: **"esto ya existe?"** y
**"como se llama?"**. La causa mas repetida de deuda en este repositorio es una segunda
implementacion de algo que ya estaba escrito, hecha aparte y peor.

Estado al 4 de septiembre de 2026, sobre `develop`.

---

## Como se importa

Todo entra por el barril unico:

```js
import { usePacientesListado, CAMPOS_PACIENTE, validarPaciente } from "@ecopac/shared";
```

`packages/shared/index.js` reexporta cada modulo con `export *`. Eso tiene una consecuencia que ya
rompio el proyecto una vez (issue #365): **si dos modulos exportan el mismo nombre, ESM lo excluye
del namespace y el import devuelve `undefined`, sin error**. Por eso el vocabulario comun vive en
un solo sitio:

| Archivo                            | Contiene                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| `descriptores.js`                  | El vocabulario de campos, columnas y filtros                |
| `enums.js`                         | Los valores de enum del dominio, congelados                 |
| `usuarios/roles.js`                | Los cinco roles, congelados                                 |
| `navegacion.js`                    | Los nueve modulos y quien los ve                            |

Un valor de enum o un rol **nace ahi una sola vez**, no en el modulo que lo consume.

## Anatomia de un modulo

| Archivo            | Responsabilidad                                                     |
| ------------------ | ------------------------------------------------------------------- |
| `api.js`           | Las llamadas a Supabase. Unico lugar del modulo que habla con la base |
| `validaciones.js`  | Que es valido y el mensaje exacto cuando no lo es                    |
| `campos.js`        | Descriptores de formulario                                          |
| `columnas.js`      | Columnas de tabla (web) y campos de tarjeta (movil)                 |
| `filtros.js`       | Filtros y su estado vacio                                           |
| `permisos.js`      | Que roles pueden que, del lado del cliente                          |
| `use<Pantalla>.js` | Un hook por pantalla                                                |

Convencion de nombres, sin excepciones:

| Prefijo o forma      | Que es                                                    |
| -------------------- | --------------------------------------------------------- |
| `CAMPOS_*`           | Descriptor de formulario                                   |
| `COLUMNAS_*`         | Descriptor de tabla o tarjeta                              |
| `FILTROS_*`          | Definicion de filtros; `FILTROS_*_VACIOS` es su estado inicial |
| `OPCIONES_*`         | Lista de opciones de un selector                           |
| `validar*`           | Devuelve errores por campo                                 |
| `puede*`             | Decision de permiso, booleana                              |
| `permisosDe*`        | Todas las decisiones de un modulo, en un objeto            |
| `use*`               | Hook de pantalla                                           |

**Los `puede*` esconden botones; no protegen nada.** Quien protege es RLS.

---

## Infraestructura

### `api/` - cliente, sesion y errores

| Export                                            | Que hace                                                     |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `inicializarSupabase`, `obtenerSupabase`, `reiniciarSupabase`, `haySupabase` | Ciclo de vida del cliente         |
| `iniciarSesion`, `cerrarSesion`, `obtenerSesion`  | Sesion. **Los unicos puntos de entrada**: no duplicar en un modulo de dominio (bug #365) |
| `evaluarPerfilDeSesion`, `requiereCerrarSesion`   | Si la sesion sigue siendo valida (perfil desactivado, rol perdido) |
| `normalizarError`, `construirError`, `ErrorDeCliente` | Todo error llega al hook con la misma forma              |
| `esErrorDeRed`, `esErrorDeCancelacion`            | Clasificacion: en campo, la red se cae                       |
| `CODIGOS_DE_ERROR_DE_SUPABASE`, `CODIGOS_DE_ERROR_DE_CLIENTE` | Codigos, no cadenas de texto                     |
| `sanearDetalle`                                   | Quita datos sensibles antes de registrar un error            |
| `crearAlmacenamientoEnMemoria`, `validarAlmacenamiento`, `METODOS_DE_ALMACENAMIENTO` | El almacenamiento lo inyecta cada app |

`packages/shared` **no puede** tocar `localStorage` ni `AsyncStorage`: cada app inyecta su
almacenamiento y este modulo lo valida.

### `entorno/` - configuracion validada al arrancar

`obtenerEntorno`, `resolverEntorno`, `reiniciarEntorno`, `leerFuente`, `ErrorDeEntorno`,
`CODIGOS_DE_ERROR`, `NOMBRES_DE_VARIABLES`, `ARCHIVOS_DE_ENTORNO`, `PLATAFORMAS`.

`reglas.js` **rechaza al arrancar** una `service_role` en el bundle del cliente. No es un aviso: la
app no levanta.

### `formato/` - fechas y dinero

`formatearFechaCorta`, `formatearFechaLarga`, `formatearFechaConHora`, `aFechaLocal`,
`esFechaValida`, `calcularEdad`, `diasHastaVencimiento`, `formatearMoneda`, `MONEDA`, `MESES`,
`DIAS_DE_LA_SEMANA`.

Ninguna pantalla formatea una fecha por su cuenta.

### `hooks/` - hooks transversales

| Hook / helper                    | Que hace                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| `useSesion`                      | Sesion y perfil actual                                            |
| `useBusquedaPacientes`           | Busqueda con retardo y paginacion, compartida entre pantallas     |
| `useExpiracionPorInactividad`    | Cierra la sesion tras `MINUTOS_INACTIVIDAD_POR_DEFECTO`           |
| `esRespuestaVigente`, `debeDescartarseLaRespuesta`, `combinarResultados`, `hayMasResultados` | Descartan respuestas de una busqueda ya superada |

### `territorio/`

`listarDepartamentos`, `listarMunicipios`, `listarComunidades`, `obtenerComunidad`.

---

## Modulos de dominio

### `pacientes/`

El modulo mas grande: 38 archivos. Cubre paciente, expediente, condiciones cronicas, triaje,
consulta y receta.

**Consultas**

`buscarPacientes`, `buscarPacientePorFicha`, `obtenerPaciente`, `obtenerUltimaAtencion`,
`obtenerHistorialMedico`, `obtenerTriajes`, `obtenerConsulta`, `obtenerReceta`, `obtenerRecetas`,
`obtenerPacientesConCondicion`, `obtenerCondicionesDelPaciente`, `obtenerCatalogoDeCondiciones`,
`listarDiagnosticos`, `listarIdiomas`, `listarPacientesAtendidosDeJornada`,
`listarPosiblesDuplicados`, `contarRecetas`, `contarRecetasDeJornada`, `contarConsultasDeJornada`.

**Escrituras**

`registrarPaciente`, `actualizarPaciente`, `registrarTriaje`, `actualizarTriaje`,
`registrarConsulta`, `actualizarConsulta`, `generarReceta`, `anularReceta`, `crearDiagnostico`,
`actualizarDiagnostico`, `asociarCondicion`, `actualizarCondicion`, `desasociarCondicion`,
`quitarCondicion`, `fusionarPacientes`.

**Validaciones**

`validarPaciente`, `validarRegistroPaciente`, `validarTriaje`, `validarCambioDeTriaje`,
`validarCondicionCronica`, `validarCambioDeCondicion`, mas `advertenciasDeTriaje` (rangos que no
bloquean pero avisan) y `advertirPacienteDuplicado`.

**Descriptores**

`CAMPOS_PACIENTE`, `CAMPOS_REGISTRO_PACIENTE`, `CAMPOS_EDICION_PACIENTE`, `CAMPOS_FICHA_PACIENTE`,
`CAMPOS_TRIAJE`, `CAMPOS_CONSULTA`, `CAMPOS_RECETA`, `CAMPOS_CONDICION_CRONICA`,
`COLUMNAS_PACIENTE`, `COLUMNAS_PACIENTE_MOVIL`, `COLUMNAS_PACIENTE_CRONICO`,
`COLUMNAS_CONDICION_DEL_PACIENTE`, `FILTROS_PACIENTE`, `FILTROS_PACIENTE_CRONICO`,
`FILTROS_HISTORIAL`, `OPCIONES_SEXO`, `OPCIONES_TIPO_SANGRE`, `OPCIONES_ESTADO_CONDICION`,
`PASOS_REGISTRO_PACIENTE`, `SECCIONES_CONSULTA`, `PESTANIAS_FICHA_PACIENTE`, `SERIES_DE_SIGNOS`.

`COLUMNAS_PACIENTE` y `COLUMNAS_PACIENTE_MOVIL` son dos vistas del mismo dato: la tabla ancha de la
web y la tarjeta estrecha del movil.

**Permisos**

`puedeVerPacientes`, `puedeRegistrarPaciente`, `puedeEditarPaciente`, `puedeVerExpedientes`,
`puedeCrearExpediente`, `puedeEditarExpediente`, `puedeVerHistorial`, `puedeTomarTriaje`,
`puedeCorregirTriaje`, `puedeAnularReceta`, `puedeFusionarPacientes`, `puedeVerCondiciones`,
`puedeRegistrarCondicion`, `puedeEditarCondicion`, `puedeQuitarCondicion`,
`puedeAdministrarDiagnosticos`, `permisosDePacientes`, `permisosDeFicha`, `permisosDeCondiciones`.

**Hooks**

`usePacientesListado`, `usePaciente`, `useRegistroPaciente`, `useEdicionPaciente`,
`useHistorialPaciente`, `useEvolucionSignos`, `useCondicionesPaciente`, `usePacientesCronicos`,
`useRegistroTriaje`, `useRegistroConsulta`, `useGeneracionReceta`, `useRecetasPaciente`.

**Utilidades reutilizables**

`calcularImc` (previsualizacion; el valor guardado lo calcula Postgres), `nombreCompletoDePaciente`,
`resumenDeUltimaAtencion`, `condicionesDestacadas`, `estaFueraDeRango`, `describirPosologia`,
`describirMedicamento`, `datosDeRecetaImprimible`, `claveDeBorrador` y `hayBorradorConDatos` (el
borrador local del registro por pasos, porque en campo se interrumpe).

### `jornadas/`

**Consultas**: `listarJornadas`, `obtenerJornada`, `obtenerPersonalDeJornada`,
`obtenerJornadasDePersona`, `obtenerAsignacionesDelDia`, `obtenerHistorialDeJornada`,
`obtenerResumenCierre`, `contarPacientesAtendidosPorJornada`, `contarAtencionesIncompletas`,
`contarMovimientosPendientesDelBotiquin`, `contarPersonalPorRol`.

**Escrituras**: `registrarJornada`, `actualizarJornada`, `cambiarEstadoJornada`, `asignarPersonal`,
`actualizarAsignacionPersonal`, `desasignarPersonal`.

**Validaciones y reglas**: `validarJornada`, `validarAsignacionPersonal`, `validarAsignaciones`,
`validarEdicionTurno`, `validarCambioDeEstadoJornada`, `esTransicionDeJornadaValida`,
`transicionesDeJornadaDesde`, `TRANSICIONES_JORNADA`, `esFinalizacionDeJornada`,
`hayAdvertenciasDeCierre`.

**Advertencias de cuadro de turnos**: `advertirChoqueDeHorario`, `advertirTraslapeDeHorario`,
`advertirJornadaDuplicada`, `advertenciasDeCuadroTurnos`. No bloquean: avisan.

**Hooks**: `useJornadasKanban`, `useDetalleJornada`, `useFormularioJornada`,
`useAsignacionPersonal`, `useDesasignacionPersonal`, `useCuadroTurnos`, `useEdicionTurno`,
`useJornadaActiva`, `useJornadasAsignadas`, `usePanelJornada`, `useSeleccionJornada`,
`useResumenCierreJornada`.

`useJornadaActiva` es el estado que el movil comparte entre pantallas: se elige la jornada una vez
y toda la operacion de campo la hereda.

### `atenciones/`

La cola de la jornada. Modulo pequeno y con una sola responsabilidad.

`obtenerCola`, `iniciarAtencion`, `cerrarAtencion`, `contarPacientesDeJornada`,
`minutosEsperando`, `ETAPAS_DE_COLA`, `ORDEN_DE_ETAPAS`, `NOMBRES_DE_ETAPA`,
`puedeVerCola`, `puedeIniciarAtencion`, `puedeCerrarAtencion`.

### `inventario/`

30 archivos. Cubre catalogo, lotes, existencias, movimientos y alertas.

**Consultas**: `listarMedicamentos`, `listarLotes`, `listarLotesDeMedicamento`,
`consultarExistencias`, `consultarExistenciasDeBodega`, `consultarLotesDisponibles`,
`listarMovimientos`, `listarBodegas`, `obtenerBodega`, `listarProveedores`, `obtenerProveedor`,
`listarPrincipiosActivos`, `listarAlertas`, `historialAlertas`.

**Escrituras**: `registrarMedicamento`, `actualizarMedicamento`, `desactivarMedicamento`,
`registrarLote`, `registrarIngreso`, `registrarSalida`, `editarMovimiento`, `aprobarMovimiento`,
`rechazarMovimiento`, `aprobarMovimientosEnLote`, `registrarBodega`, `actualizarBodega`,
`registrarProveedor`, `actualizarProveedor`, `registrarPrincipioActivo`,
`actualizarPrincipioActivo`, `eliminarPrincipioActivo`, `atenderAlerta`.

**Reglas de vencimiento y disponibilidad**: `calcularEstadoVencimiento`, `calcularDiasRestantes`,
`esLoteEntregable`, `motivoLoteNoEntregable`, `hayDisponibilidad`, `motivoSinDisponibilidad`,
`sugerirLote`.

`sugerirLote` implementa primero-en-vencer-primero-en-salir: es la regla que evita que el
medicamento caduque en la bodega.

**Permisos**: `puedeVerMedicamentos`, `puedeAdministrarMedicamentos`, `puedeVerLotes`,
`puedeAdministrarLotes`, `puedeProponerLote`, `puedeVerMovimientos`, `puedeRegistrarMovimiento`,
`puedeAprobarMovimiento`, `puedeRechazarMovimiento`, `puedeVerBodegas`, `puedeAdministrarBodegas`,
`puedeVerProveedores`, `puedeAdministrarProveedores`, `puedeVerPrincipiosActivos`,
`puedeAdministrarPrincipiosActivos`, mas los `permisosDe*` de cada uno.

`puedeProponerLote` es la regla de campo: medico y voluntario proponen un lote provisional que el
administrador confirma despues (migracion `00107`).

**Hooks**: `useInventario`, `useVistaExistencias`, `useCatalogoMedicamentos`, `useGestionLotes`,
`useKardexMovimientos`, `useRegistroIngreso`, `useRegistroSalida`, `usePendientesValidacion`,
`useAlertasVencimiento`, `useAdministracionBodegasProveedores`.

### `donaciones/`

**Consultas**: `listarDonaciones`, `obtenerDonacion`, `listarDonantes`, `obtenerHistoricoDonante`,
`obtenerDonacionDeLote`, `filtrarDonantes`.

**Escrituras**: `registrarDonante`, `actualizarDonante`, `darDeBajaDonante`,
`generarIngresoDesdeDonacion`.

**Validaciones**: `validarDonacion`, `validarDonante`, `validarAnulacionDeDonacion`.

**Hooks**: `useRegistroDonacion`, `useHistorialDonaciones`, `useDonantesPage`,
`useConstanciaDonacion`.

`generarIngresoDesdeDonacion` es la costura entre donaciones e inventario: una donacion de
medicamentos crea el lote correspondiente.

### `presupuestos/`

**Consultas**: `listarGastos`, `listarGastosPendientes`, `obtenerPresupuestoJornada`,
`obtenerPresupuestoProyecto`, `obtenerPresupuestoSistema`.

**Escrituras**: `registrarGasto`, `editarGasto`, `aprobarGasto`, `rechazarGasto`,
`asignarPresupuestoJornada`.

**Calculo**: `calcularPorcentajeEjecutado`, `combinarJornadasConPresupuesto`,
`combinarProyectosConPresupuesto`, `totalizar`.

**Hooks**: `useEjecucionPresupuestal`, `useFormularioGasto`, `usePendientesAprobacionGastos`,
`useDetalleProyectoPresupuesto`.

Los totales salen de las tres funciones SQL de la migracion `00040`. No hay columna de total: un
total guardado se desincroniza.

### `proyectos/`

**Consultas**: `listarProyectos`, `obtenerProyecto`, `obtenerProyectosTablero`, `listarHitos`,
`listarSeguimiento`, `listarJornadasDelProyecto`.

**Escrituras**: `crearProyecto`, `actualizarProyecto`, `cambiarEstadoProyecto`, `cerrarProyecto`,
`moverProyectoAEtapa`, `reordenarProyectosColumna`, `asociarJornadaAProyecto`, `registrarHito`,
`actualizarHito`, `marcarHitoCumplido`, `reabrirHito`, `registrarNota`, `actualizarAvance`.

**Reglas de estado**: `TRANSICIONES_PROYECTO`, `esTransicionDeProyectoValida`,
`transicionesDeProyectoDesde`, `obtenerTransicionesPermitidas`, `validarCambioDeEstadoProyecto`,
`obtenerAdvertenciaDeCierre`, `esPorcentajeDeAvanceValido`.

> Estas son las que `apps/web/src/pages/ProyectosPage.jsx` **no** usa: define su propia tabla de
> transiciones dentro del componente (issue #710). Ver [MODULOS.md](./MODULOS.md).

**Hooks**: `useProyectosSociales`, `useSeguimientoProyecto`.

### `reportes/`

**Consultas**: `obtenerIndicadoresImpacto`, `obtenerReportePacientesAtendidos`,
`obtenerReporteDeInventario`, `obtenerReporteJornada`, `obtenerReporteDeVencimientos`.

**Filtros compartidos**: `FILTROS_REPORTES`, `PRESETS_DE_RANGO`, `resolverRangoDePreset`,
`serializarFiltrosReportes`, `resolverFiltrosReportesDesdeParametros`, `useFiltrosReportes`.

Los filtros se serializan a la URL: un reporte filtrado se puede compartir por enlace.

**Exportacion**: `exportarFilasACSV`, `escaparCampoCSV`.

**Descriptores**: `COLUMNAS_PACIENTES_ATENDIDOS`, `COLUMNAS_INDICADORES_IMPACTO`,
`COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES`, `COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS`,
`COLUMNAS_PERSONAL_PARTICIPANTE`, `COLUMNAS_INVENTARIO_REPORTE`, `CAMPOS_DASHBOARD`,
`CAMPOS_ANALISIS_IMPACTO`, `COLORES_GRAFICAS`, `AGRUPACIONES_DE_IMPACTO`,
`AGRUPACIONES_DE_PACIENTES`.

**Hooks**: `useDashboardMetricas`, `useReportePacientes`, `useReporteInventario`,
`useReporteJornada`.

### `usuarios/`

**Roles** (`roles.js`, congelado): `ROLES`, `ETIQUETAS_ROL`, `TODOS_LOS_ROLES`,
`ROLES_ADMINISTRATIVOS`, `ROLES_CONSULTIVOS`, `ROLES_DE_CAMPO`, `esAdministrador`, `esConsultivo`,
`etiquetaDeRol`.

Los valores son exactamente los del enum `rol_usuario` de la migracion `00001`. Un rol escrito
como string suelto es un error de revision.

**Consultas**: `listarUsuarios`, `obtenerPerfil`, `obtenerEspecialidadesDePerfil`,
`listarCatalogoEspecialidades`, `listarCatalogoPermisos`, `obtenerPermisosEfectivos`,
`contarAdministradoresActivos`, `contarJornadasPorPerfil`.

**Escrituras**: `crearUsuario` (via Edge Function `invitar-usuario`), `actualizarUsuario`,
`desactivarUsuario`, `reactivarUsuario`, `concederPermiso`, `revocarPermiso`, `restablecerPermiso`,
`reverificarContrasena`.

**Validaciones**: `validarPerfil`, `validarCredenciales`, `validarCorreo`, `validarContrasena`,
`validarCambioContrasena`, `validarTelefonoGuatemala`, `REGLAS_DE_CONTRASENA`,
`LONGITUD_MINIMA_CONTRASENA`.

**Guardas de negocio**: `evaluarBloqueoSincronico`, `requiereContarAdministradoresActivos`,
`MENSAJE_ULTIMO_ADMINISTRADOR`, `MENSAJE_AUTODESACTIVACION`, `MENSAJE_SIN_EFECTO`. Anticipan en la
interfaz lo que la base va a rechazar de todos modos, para dar un mensaje util en vez de un error
de Postgres.

**Hooks**: `useInicioSesion`, `useRestablecerContrasena`, `useNuevaContrasena`, `usePerfilPropio`,
`useUsuariosListado`, `useAltaUsuario`, `useEdicionUsuario`, `useDesactivacionUsuario`,
`useGestionPermisos`, `useFichaVoluntario`, `useHistorialDePersona`.

---

## Reglas de la frontera

Lo que `packages/shared` **no puede** hacer:

| Prohibido                                                        | Por que                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| Importar `react-dom`, `react-native` o `react-bootstrap`         | El paquete lo consumen las dos plataformas               |
| Usar `document`, `window`, `localStorage` o `AsyncStorage`        | No existen en las dos                                    |
| Devolver JSX                                                     | La presentacion es de la app                             |

Lo que **las apps** no pueden hacer:

| Prohibido                                          | Donde va en su lugar          |
| -------------------------------------------------- | ----------------------------- |
| Importar `@supabase/supabase-js` directamente      | `packages/shared/<modulo>/api.js` |
| Escribir validaciones en un componente             | `validaciones.js`             |
| Escribir formateo en un componente                 | `formato/`                    |
| Decidir permisos en un componente                  | `permisos.js`                 |
| Escribir un color, espaciado o tamano a mano       | `@ecopac/ui-tokens`           |
| Importar componentes de la otra app                | El catalogo propio            |

Estas reglas las verifica `npm run verificar:shared-esquema` (que todo lo que `packages/shared`
nombra exista de verdad en `supabase/migrations/`) y las pruebas de lint del CI.

> `verificar:shared-esquema` comprueba que los nombres existan, **no** que las pantallas los usen
> bien. Que el lint, las pruebas y esa verificacion esten en verde no significa que el sistema
> haga lo correcto: el andamiaje comprueba lo que hay escrito, no lo que las pantallas muestran.

La regla completa, con ejemplos: [ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md).
