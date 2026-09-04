# Modulos y pantallas - Ecopac Digital

Catalogo de lo que existe construido: que pantalla hay, en que app, que hook de
`packages/shared` la sirve, y contra que tablas trabaja.

Sirve para dos cosas: **encontrar donde vive una pantalla** sin recorrer carpetas, y **ver de un
vistazo que esta conectado y que no**.

Estado al 4 de septiembre de 2026, sobre `develop`.

## Como leer la columna Estado

| Estado        | Significa                                                                            |
| ------------- | ------------------------------------------------------------------------------------ |
| **Conectada** | La pantalla existe y toma sus datos de un hook de `packages/shared` que consulta Supabase |
| **Parcial**   | Existe y funciona en parte: le falta una pieza, o no cubre todo lo que el modulo promete |
| **Local**     | Existe pero resuelve su logica dentro del componente, sin pasar por `packages/shared`. Es una desviacion de la regla de arquitectura |
| **Pendiente** | Es un marcador de posicion (`PaginaPendiente` / `ScreenPlaceholder`)                  |

> Este documento describe **como esta cableada** cada pantalla, no si su comportamiento es
> correcto. Una pantalla marcada "Conectada" aqui puede tener una issue de bug abierta: hay
> pantallas que muestran datos de ejemplo como si fueran reales (#687, #688, #689), formularios
> que no guardan nada (#709, #635) y reportes con dos implementaciones donde la pantalla usa la
> que no esta probada (#693). Consultar las issues abiertas del modulo antes de darlo por bueno.

## Los nueve modulos

Definidos una sola vez, en `packages/shared/navegacion.js`. Un modulo nuevo se agrega ahi y
aparece solo en el sidebar de la web y en la tab bar del movil.

| Modulo       | Ruta web       | Movil | Roles que lo ven                                |
| ------------ | -------------- | ----- | ----------------------------------------------- |
| Inicio       | `/`            | Tab   | Todos                                           |
| Pacientes    | `/pacientes`   | Tab   | Administrador, medico, voluntario               |
| Donaciones   | `/donaciones`  | Si    | Administrador, junta directiva, socio fundador  |
| Inventario   | `/inventario`  | Tab   | Administrador, consultivos, medico, voluntario  |
| Presupuestos | `/presupuestos`| Si    | Administrador, junta directiva, socio fundador  |
| Proyectos    | `/proyectos`   | Si    | Administrador, junta directiva, socio fundador  |
| Reportes     | `/reportes`    | **No**| Administrador, junta directiva, socio fundador  |
| Jornadas     | `/jornadas`    | Tab   | Administrador, consultivos, medico, voluntario  |
| Voluntarios  | `/voluntarios` | Si    | Solo administrador                              |

Los roles consultivos (junta directiva, socio fundador) ven casi todo **de solo lectura**, y por
decision de la organizacion **no ven informacion clinica ni pacientes identificables**, solo
agregados. Por eso `navegacion.js` distingue dos grupos operativos y no uno.

Ocultar una opcion del menu **no es control de acceso**: la restriccion real esta en RLS y en el
guard de rutas. Ver [PERMISOS.md](./PERMISOS.md).

---

## 1. Pacientes

El expediente que sigue al paciente entre jornadas y comunidades. Es el modulo mas grande del
sistema: 38 archivos en `packages/shared/pacientes/`.

### Web

| Pantalla                                                              | Hook                      | Estado    |
| --------------------------------------------------------------------- | ------------------------- | --------- |
| [PacientesPage.jsx](../apps/web/src/pages/PacientesPage.jsx) `/pacientes` | `usePacientesListado`  | Conectada |
| [FichaPacientePage.jsx](../apps/web/src/pages/FichaPacientePage.jsx) `/pacientes/:id` | `usePaciente` | Conectada |
| [PacientesCronicosPage.jsx](../apps/web/src/pages/PacientesCronicosPage.jsx) `/pacientes/cronicos` | `usePacientesCronicos` | Conectada |
| [PestaniaHistorialPaciente.jsx](../apps/web/src/pages/PestaniaHistorialPaciente.jsx) | `useHistorialPaciente` | Conectada |
| [PestaniaRecetasPaciente.jsx](../apps/web/src/pages/PestaniaRecetasPaciente.jsx) | `useRecetasPaciente` | Conectada |
| [PestaniaSignosPaciente.jsx](../apps/web/src/pages/PestaniaSignosPaciente.jsx) | `useEvolucionSignos` | Conectada |
| [ModalAltaPaciente.jsx](../apps/web/src/pages/ModalAltaPaciente.jsx) | `useRegistroPaciente` | Conectada |
| [ModalEdicionPaciente.jsx](../apps/web/src/pages/ModalEdicionPaciente.jsx) | `useEdicionPaciente` | Conectada |
| [ModalCondicionesPaciente.jsx](../apps/web/src/pages/ModalCondicionesPaciente.jsx) | `useCondicionesPaciente` | Conectada |
| [RecetaImprimible.jsx](../apps/web/src/pages/RecetaImprimible.jsx) | `datosDeRecetaImprimible` | Conectada |

### Movil

| Pantalla                                                                       | Hook                  | Estado    |
| ------------------------------------------------------------------------------ | --------------------- | --------- |
| [BusquedaPacienteScreen.js](../apps/mobile/src/screens/BusquedaPacienteScreen.js) | `usePacientesListado` | Conectada |
| [FichaPacienteScreen.js](../apps/mobile/src/screens/FichaPacienteScreen.js)     | `usePaciente`         | Conectada |
| [HistorialPacienteScreen.js](../apps/mobile/src/screens/HistorialPacienteScreen.js) | `useHistorialPaciente` | Conectada |
| [RegistroPacienteScreen.js](../apps/mobile/src/screens/RegistroPacienteScreen.js) | `useRegistroPaciente` | Conectada |
| [TriajeScreen.js](../apps/mobile/src/screens/TriajeScreen.js)                   | `useRegistroTriaje`   | Conectada |
| [ConsultaScreen.js](../apps/mobile/src/screens/ConsultaScreen.js)               | `useRegistroConsulta` | Conectada |
| [RecetaScreen.js](../apps/mobile/src/screens/RecetaScreen.js)                   | `useGeneracionReceta` | Conectada |

### Contra que trabaja

`pacientes`, `expedientes`, `idiomas`, `condiciones_cronicas`, `padecimientos_cronicos`,
`fusiones_pacientes`, `atenciones`, `triajes`, `consultas`, `diagnosticos`, `recetas`,
`receta_detalle`.

Funciones de base: `fn_registrar_paciente`, `fn_buscar_pacientes`, `fn_generar_receta`,
`fn_detectar_pacientes_duplicados`, `fn_fusionar_pacientes`.

### Notas

- El registro es **por pasos** (`registro.pasos.js`), con borrador local: en campo se interrumpe.
- El triaje calcula el IMC para previsualizarlo, pero **el valor que se guarda lo calcula
  Postgres** (columna generada).
- La deduplicacion de pacientes existe en base y en `duplicados.api.js`; **no tiene pantalla**.

---

## 2. Jornadas

La unidad de operacion. Casi todo lo clinico exige una jornada `en curso`.

### Web

| Pantalla                                                                | Hook                                            | Estado    |
| ----------------------------------------------------------------------- | ----------------------------------------------- | --------- |
| [JornadasPage.jsx](../apps/web/src/pages/JornadasPage.jsx) `/jornadas`   | `useJornadasKanban`, `useResumenCierreJornada`   | Conectada |
| [DetalleJornadaPage.jsx](../apps/web/src/pages/DetalleJornadaPage.jsx) `/jornadas/:id` | `useDetalleJornada`, `useAsignacionPersonal`, `useCuadroTurnos`, `useEdicionTurno` | Conectada |
| [ModalJornada.jsx](../apps/web/src/pages/ModalJornada.jsx)               | `useFormularioJornada`                          | Conectada |
| [ModalAsignarPersonal.jsx](../apps/web/src/pages/ModalAsignarPersonal.jsx) | `useAsignacionPersonal`                       | Conectada |
| [ModalEdicionTurno.jsx](../apps/web/src/pages/ModalEdicionTurno.jsx)     | `useEdicionTurno`                               | Conectada |
| [ModalConfirmarDesasignacion.jsx](../apps/web/src/pages/ModalConfirmarDesasignacion.jsx) | `useDesasignacionPersonal`      | Conectada |
| [CuadroTurnosImprimible.jsx](../apps/web/src/pages/CuadroTurnosImprimible.jsx) | `datosDeCuadroTurnosImprimible`           | Conectada |

### Movil

| Pantalla                                                                     | Hook                                    | Estado    |
| ---------------------------------------------------------------------------- | --------------------------------------- | --------- |
| [JornadasAsignadasScreen.js](../apps/mobile/src/screens/JornadasAsignadasScreen.js) | `useJornadasAsignadas`           | Conectada |
| [SeleccionJornadaScreen.js](../apps/mobile/src/screens/SeleccionJornadaScreen.js) | `useJornadaActiva`                 | Conectada |
| [JornadaEnCursoScreen.js](../apps/mobile/src/screens/JornadaEnCursoScreen.js) | `usePanelJornada`                       | Conectada |

### Contra que trabaja

`jornadas`, `jornada_personal`, `jornada_estado_historial`, `atenciones`, `comunidades`,
`proyectos`.

### Notas

- La jornada activa es **estado compartido del movil** (`useJornadaActivaCompartida`): la eligen
  una vez y todas las pantallas de campo la heredan.
- El cierre de jornada tiene un resumen con advertencias (`resumenCierre.js`) porque una jornada
  no se puede finalizar con atenciones abiertas: eso lo hace cumplir la base
  (`fn_contar_atenciones_incompletas`).
- Las transiciones validas viven en `TRANSICIONES_JORNADA` y las revalida un trigger en Postgres.

---

## 3. Inventario

El modulo con mas superficie despues de pacientes: 30 archivos en `packages/shared/inventario/`.

### Web

| Pantalla                                                                              | Hook                            | Estado    |
| ------------------------------------------------------------------------------------- | ------------------------------- | --------- |
| [InventarioPage.jsx](../apps/web/src/pages/InventarioPage.jsx) `/inventario`           | Compone las cinco de abajo      | Conectada |
| [VistaExistenciasPage.jsx](../apps/web/src/pages/VistaExistenciasPage.jsx)             | `useVistaExistencias`           | Conectada |
| [KardexMovimientosPage.jsx](../apps/web/src/pages/KardexMovimientosPage.jsx)           | `useKardexMovimientos`          | Conectada |
| [PanelAlertasVencimiento.jsx](../apps/web/src/pages/PanelAlertasVencimiento.jsx)       | `useAlertasVencimiento`         | Conectada |
| [AdministracionBodegasProveedoresPage.jsx](../apps/web/src/pages/AdministracionBodegasProveedoresPage.jsx) | `useAdministracionBodegasProveedores` | Conectada |
| [BandejaValidacionPage.jsx](../apps/web/src/pages/BandejaValidacionPage.jsx)           | `usePendientesValidacion` (via InventarioPage) | Conectada |
| [ModalRegistroIngreso.jsx](../apps/web/src/pages/ModalRegistroIngreso.jsx)             | `useRegistroIngreso`            | Conectada |
| [ModalSalidaMedicamento.jsx](../apps/web/src/pages/ModalSalidaMedicamento.jsx)         | `useRegistroSalida`             | Conectada |
| [ModalMedicamento.jsx](../apps/web/src/pages/ModalMedicamento.jsx)                     | `useCatalogoMedicamentos` (via InventarioPage) | Conectada |
| [ModalAltaLote.jsx](../apps/web/src/pages/ModalAltaLote.jsx)                           | `useGestionLotes` (via InventarioPage) | Conectada |
| [ModalAtenderAlerta.jsx](../apps/web/src/pages/ModalAtenderAlerta.jsx)                 | `useAlertasVencimiento` (via panel) | Conectada |

### Movil

| Pantalla                                                                             | Hook                     | Estado    |
| ------------------------------------------------------------------------------------ | ------------------------ | --------- |
| [CatalogoMedicamentosScreen.js](../apps/mobile/src/screens/CatalogoMedicamentosScreen.js) | `useCatalogoMedicamentos` | Conectada |
| [StockScreen.js](../apps/mobile/src/screens/StockScreen.js)                           | -                        | Alias: reexporta `CatalogoMedicamentosScreen` |

### Contra que trabaja

`medicamentos`, `principios_activos`, `medicamento_principio`, `proveedores`, `bodegas`, `lotes`,
`existencias`, `movimientos_inventario`, `alertas_caducidad`.

Funciones de base: `fn_existencias_disponibles`, `fn_registrar_medicamento`,
`fn_aplicar_ajuste_existencias`, `fn_generar_alertas_caducidad`, `fn_medicamento_tiene_existencias`.

### Notas

- **Aprobacion en dos pasos**: medico y voluntario registran movimientos `pendiente`; el
  administrador aprueba o rechaza. Solo la aprobacion toca el stock.
- **Lotes provisionales**: en campo se puede proponer un lote sin esperar al administrador
  (`confirmado = FALSE`, migracion `00107`).
- El movil no tiene pantalla propia de existencias por bodega: `StockScreen` reexporta el catalogo.
  Es un hueco conocido, no un alias intencional del diseno.

---

## 4. Presupuestos

### Web

| Pantalla                                                                        | Hook                              | Estado    |
| ------------------------------------------------------------------------------- | --------------------------------- | --------- |
| [PresupuestosPage.jsx](../apps/web/src/pages/PresupuestosPage.jsx) `/presupuestos` | `useEjecucionPresupuestal`      | Conectada |
| [PanelEjecucionPresupuestal.jsx](../apps/web/src/pages/PanelEjecucionPresupuestal.jsx) | `useDetalleProyectoPresupuesto` | Conectada |
| [BandejaAprobacionGastos.jsx](../apps/web/src/pages/BandejaAprobacionGastos.jsx) | `usePendientesAprobacionGastos`   | Conectada |
| [TablaGastos.jsx](../apps/web/src/pages/TablaGastos.jsx)                         | `useEjecucionPresupuestal`        | Conectada |
| [ModalGasto.jsx](../apps/web/src/pages/ModalGasto.jsx)                           | `useFormularioGasto`              | Conectada |

### Movil

| Pantalla                                                                | Hook | Estado        |
| ----------------------------------------------------------------------- | ---- | ------------- |
| [PresupuestosScreen.js](../apps/mobile/src/screens/PresupuestosScreen.js) | -   | **Pendiente** (`ScreenPlaceholder`) |

### Contra que trabaja

`gastos`, `jornadas`, `proyectos`. Funciones: `presupuesto_de_jornada`, `presupuesto_de_proyecto`,
`presupuesto_del_sistema`.

### Notas

- Los totales **no se guardan en ninguna columna**: los calculan las tres funciones de `00040`. Es
  deliberado: un total guardado se desincroniza.
- Mismo patron de aprobacion que inventario, con autoaprobacion para el administrador (`00109`).
- El modulo aparece en la navegacion movil, pero la pantalla es un marcador de posicion. La logica
  compartida ya existe: portarla es trabajo de componente, no de logica.

---

## 5. Proyectos

### Web

| Pantalla                                                                          | Hook                    | Estado    |
| --------------------------------------------------------------------------------- | ----------------------- | --------- |
| [ProyectosPage.jsx](../apps/web/src/pages/ProyectosPage.jsx) `/proyectos`          | -                       | **Local** |
| [ProyectosSocialesPage.jsx](../apps/web/src/pages/ProyectosSocialesPage.jsx) `/proyectos/sociales` | `useProyectosSociales` | Conectada |
| [SeguimientoProyectoPage.jsx](../apps/web/src/pages/SeguimientoProyectoPage.jsx) `/proyectos/:id/seguimiento` | `useSeguimientoProyecto` | Conectada |

### Movil

| Pantalla                                                          | Hook                   | Estado    |
| ----------------------------------------------------------------- | ---------------------- | --------- |
| [ProyectosScreen.js](../apps/mobile/src/screens/ProyectosScreen.js) | `useProyectosSociales` | Conectada |

### Contra que trabaja

`proyectos`, `proyecto_hitos`, `proyecto_seguimiento`, `proyecto_estado_historial`, `jornadas`,
`donaciones`.

### Notas

- **Hay dos tableros de proyectos**: `ProyectosPage` (`/proyectos`) y `ProyectosSocialesPage`
  (`/proyectos/sociales`). El primero define su propia tabla `TRANSICIONES_PERMITIDAS` dentro del
  componente, en vez de usar `TRANSICIONES_PROYECTO` y `esTransicionDeProyectoValida` de
  `packages/shared/proyectos/`. Es una desviacion de la regla de arquitectura y una segunda
  implementacion de una regla que ya existia (issue #710).
- El porcentaje de avance no se edita a mano sin dejar rastro: un trigger escribe en
  `proyecto_seguimiento` cada cambio.

---

## 6. Donaciones

### Web

| Pantalla                                                                              | Hook                    | Estado    |
| ------------------------------------------------------------------------------------- | ----------------------- | --------- |
| [DonacionesPage.jsx](../apps/web/src/pages/DonacionesPage.jsx) `/donaciones`           | -                       | Indice del modulo |
| [RegistroDonacionPage.jsx](../apps/web/src/pages/RegistroDonacionPage.jsx) `/donaciones/registro` | `useRegistroDonacion` | Conectada |
| [HistorialDonacionesPage.jsx](../apps/web/src/pages/HistorialDonacionesPage.jsx) `/donaciones/historial` | `useHistorialDonaciones` | Conectada |
| [ConstanciaDonacionPage.jsx](../apps/web/src/pages/ConstanciaDonacionPage.jsx) `/donaciones/:id/constancia` | `useConstanciaDonacion` | Conectada |
| [DonantesPage.jsx](../apps/web/src/pages/DonantesPage.jsx) `/donantes`                 | `useDonantesPage`       | Conectada |

### Movil

| Pantalla                                                              | Hook                     | Estado  |
| --------------------------------------------------------------------- | ------------------------ | ------- |
| [DonacionesScreen.js](../apps/mobile/src/screens/DonacionesScreen.js)  | `useHistorialDonaciones` | Parcial: solo consulta el historial |

### Contra que trabaja

`donantes`, `donaciones`, `donacion_detalle`, `lotes`, `proyectos`.

### Notas

- Una donacion de medicamentos **genera el lote en inventario**
  (`generarIngresoDesdeDonacion`), y `donacion_detalle.lote_id` es UNIQUE para que dos donaciones
  no reclamen el mismo lote.
- Una donacion no se borra: se anula, con motivo y responsable.

---

## 7. Reportes

Solo web (`soloWeb: true`).

| Pantalla                                                                                 | Hook                   | Estado    |
| ---------------------------------------------------------------------------------------- | ---------------------- | --------- |
| [ReportesPage.jsx](../apps/web/src/pages/ReportesPage.jsx) `/reportes`                    | -                      | Indice del modulo |
| [DashboardMetricasPage.jsx](../apps/web/src/pages/DashboardMetricasPage.jsx) `/reportes/dashboard` | `useDashboardMetricas` | Conectada |
| [ReportePacientesPage.jsx](../apps/web/src/pages/ReportePacientesPage.jsx) `/reportes/pacientes-atendidos` | `useReportePacientes` | Conectada |
| [ReporteInventarioPage.jsx](../apps/web/src/pages/ReporteInventarioPage.jsx) `/reportes/inventario-actual` | `useReporteInventario` | Conectada |
| [ReporteJornada.jsx](../apps/web/src/pages/ReporteJornada.jsx) `/reportes/jornada/:id`    | `useReporteJornada`    | Conectada |
| [BarraFiltrosReporte.jsx](../apps/web/src/pages/BarraFiltrosReporte.jsx)                  | `useFiltrosReportes`   | Conectada |

### Contra que trabaja

Vistas `vista_reporte_impacto` y `pacientes_reporte`; funcion `fn_reporte_pacientes_atendidos`.
Exportacion a CSV con `exportarFilasACSV` (`reportes/csv.js`).

### Notas

- Los roles consultivos leen **agregados**, no filas clinicas: es la razon de que estos reportes
  salgan de vistas y funciones y no de `SELECT` sobre las tablas (`00054`).
- `/reportes/dashboard` **queda fuera del guard de roles** en
  [App.jsx](../apps/web/src/App.jsx#L157): esta declarada fuera del bloque `RutaProtegida` que
  cubre al resto del modulo (issue #697).
- `ReportesPage.jsx` escribe colores y espaciados a mano en vez de usar `@ecopac/ui-tokens`.

---

## 8. Voluntarios y usuarios

### Web

| Pantalla                                                                            | Hook                                        | Estado    |
| ----------------------------------------------------------------------------------- | ------------------------------------------- | --------- |
| [VoluntariosPage.jsx](../apps/web/src/pages/VoluntariosPage.jsx) `/voluntarios`      | `useUsuariosListado`, `useHistorialDePersona` | Conectada |
| [PerfilPage.jsx](../apps/web/src/pages/PerfilPage.jsx) `/perfil`                     | `usePerfilPropio`                           | Conectada |
| [ModalAltaUsuario.jsx](../apps/web/src/pages/ModalAltaUsuario.jsx)                   | `useAltaUsuario`                            | Conectada |
| [ModalEdicionUsuario.jsx](../apps/web/src/pages/ModalEdicionUsuario.jsx)             | `useEdicionUsuario`                         | Conectada |
| [ModalPermisosUsuario.jsx](../apps/web/src/pages/ModalPermisosUsuario.jsx)           | `useGestionPermisos`                        | Conectada |
| [ModalConfirmarDesactivacion.jsx](../apps/web/src/pages/ModalConfirmarDesactivacion.jsx) | `useDesactivacionUsuario`               | Conectada |

### Movil

| Pantalla                                                                    | Hook                                          | Estado    |
| --------------------------------------------------------------------------- | --------------------------------------------- | --------- |
| [VoluntariosScreen.js](../apps/mobile/src/screens/VoluntariosScreen.js)      | `useUsuariosListado`                          | Conectada |
| [FichaVoluntarioScreen.js](../apps/mobile/src/screens/FichaVoluntarioScreen.js) | `useFichaVoluntario`, `useGestionPermisos`, `useHistorialDePersona` | Conectada |

### Contra que trabaja

`perfiles`, `perfil_especialidad`, `permisos`, `rol_permiso`, `usuario_permiso`,
`eventos_auditoria`, `jornada_personal`. Edge Function `invitar-usuario`; funcion
`fn_crear_usuario_administrativo` (`00074`).

### Notas

- El alta **no pasa por la Admin API**: `crearUsuario()` llama a la Edge Function, que valida quien
  llama y reutiliza `fn_crear_usuario_administrativo` con la llave de servicio.
- Los permisos finos son excepciones por persona sobre lo que da el rol, con motivo y auditoria.
- Cuatro reglas las hace cumplir la base y no el formulario: no cambiarse el rol, no desactivarse a
  si mismo, no dejar al sistema sin administrador activo, no dar escritura a un rol consultivo.

---

## 9. Autenticacion, sesion e inicio

| Pantalla                                                                          | Hook                     | Estado    |
| --------------------------------------------------------------------------------- | ------------------------ | --------- |
| [LoginPage.jsx](../apps/web/src/pages/LoginPage.jsx) `/login`                      | `useInicioSesion`        | Conectada |
| [RestablecerContrasenaPage.jsx](../apps/web/src/pages/RestablecerContrasenaPage.jsx) | `useRestablecerContrasena` | Conectada |
| [NuevaContrasenaPage.jsx](../apps/web/src/pages/NuevaContrasenaPage.jsx)           | `useNuevaContrasena`     | Conectada |
| [AccesoDenegadoPage.jsx](../apps/web/src/pages/AccesoDenegadoPage.jsx)             | -                        | Conectada |
| [NotFoundPage.jsx](../apps/web/src/pages/NotFoundPage.jsx)                         | -                        | Conectada |
| [HomePage.jsx](../apps/web/src/pages/HomePage.jsx) `/`                             | -                        | **Pendiente** (issue #209) |
| [LoginScreen.js](../apps/mobile/src/screens/LoginScreen.js)                        | `useInicioSesion`        | Conectada |
| [InicioScreen.js](../apps/mobile/src/screens/InicioScreen.js)                      | -                        | Conectada |
| [AjustesScreen.js](../apps/mobile/src/screens/AjustesScreen.js)                    | -                        | Conectada |
| [RestaurandoSesionScreen.js](../apps/mobile/src/screens/RestaurandoSesionScreen.js) | -                       | Conectada |
| [AccesoDenegadoScreen.js](../apps/mobile/src/screens/AccesoDenegadoScreen.js)      | -                        | Conectada |

La sesion se expira por inactividad (`useExpiracionPorInactividad`), y el almacenamiento de
credenciales difiere por plataforma a proposito: ver [SEGURIDAD.md](./SEGURIDAD.md) y
[PROTECCION-DE-DATOS.md](./PROTECCION-DE-DATOS.md).

**La pantalla de inicio de la web es un marcador de posicion.** Es la primera que ve cualquier
usuario tras entrar.

---

## Catalogo de componentes

Las dos apps implementan **el mismo catalogo con las mismas props**. Portar una pantalla de web a
movil es cambiar el import, no reescribir la logica.

| Componente        | Web  | Movil | Para que                                     |
| ----------------- | ---- | ----- | -------------------------------------------- |
| `Card`            | Si   | Si    | Contenedor de contenido                      |
| `DataList`        | Si   | Si    | Tabla en web, lista de tarjetas en movil     |
| `FilterBar`       | Si   | Si    | Barra de filtros desde `filtros.js`          |
| `TextField`       | Si   | Si    | Campo de texto                               |
| `NumberField`     | Si   | Si    | Campo numerico                               |
| `DateField`       | Si   | Si    | Campo de fecha                               |
| `Selector`        | Si   | Si    | Seleccion de opciones                        |
| `StatusChip`      | Si   | Si    | Estado con color de `@ecopac/ui-tokens`      |
| `Modal`           | Si   | Si    | Dialogo                                      |
| `Tabs`            | Si   | Si    | Pestanas                                     |
| `KanbanBoard`     | Si   | Si    | Tablero de jornadas y proyectos              |
| `PageHeader`      | Si   | Si    | Encabezado de pantalla                       |
| `ScreenContainer` | Si   | Si    | Contenedor de pantalla                       |
| `PrimaryButton`   | Si   | Si    | Accion principal                             |
| `SecondaryButton` | Si   | Si    | Accion secundaria                            |
| `EmptyState`      | Si   | Si    | Sin resultados                               |
| `ErrorState`      | Si   | Si    | Error                                        |
| `LoadingState`    | Si   | Si    | Cargando                                     |
| `RutaProtegida`   | Si   | Si    | Guard de rol                                 |
| `MainLayout`      | Si   | -     | Sidebar y layout de la web                   |
| `MenuDrawer`      | -    | Si    | Menu lateral del movil                       |
| `UsuarioHeaderBar`, `UsuarioActivo`, `JornadaActivaBadge` | - | Si | Contexto de sesion y jornada en campo |

**Ningun color, espaciado o tamano de fuente se escribe a mano**: todo sale de
`@ecopac/ui-tokens`. En la web se consumen como `var(--color-*)`, publicadas por
`apps/web/src/theme.js`.

---

## Resumen del estado

| Estado        | Pantallas | Cuales                                                                   |
| ------------- | --------- | ------------------------------------------------------------------------ |
| **Pendiente** | 2         | `HomePage` (web, inicio), `PresupuestosScreen` (movil)                    |
| **Local**     | 1         | `ProyectosPage` (duplica las transiciones de estado)                     |
| **Parcial**   | 2         | `DonacionesScreen` (solo historial), `StockScreen` (alias del catalogo)  |
| **Conectada** | El resto  |                                                                          |

Huecos de cobertura entre plataformas, mas alla del caso de Reportes, que es intencional:

| Modulo       | Falta en movil                                             |
| ------------ | ---------------------------------------------------------- |
| Presupuestos | Todo: la pantalla es un marcador de posicion               |
| Inventario   | Existencias por bodega y registro de movimientos           |
| Donaciones   | Registro de donacion y gestion de donantes                 |
| Jornadas     | Creacion y edicion de jornada (en campo solo se opera)     |

Los tres primeros ya tienen la logica compartida escrita y probada: lo que falta es el componente.
