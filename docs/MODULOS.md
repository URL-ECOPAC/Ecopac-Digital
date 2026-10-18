# Modulos y pantallas - Ecopac Digital

Catalogo de lo que existe construido: que pantalla hay, en que app, que hook de
`packages/shared` la sirve, y contra que tablas trabaja.

Sirve para dos cosas: **encontrar donde vive una pantalla** sin recorrer carpetas, y **ver de un
vistazo que esta conectado y que no**.

Estado al 13 de octubre de 2026, sobre `develop` (esquema hasta la migracion `00188`). Lo que
consulta cada pantalla, tabla por tabla, esta en [PANTALLAS.md](./PANTALLAS.md), que es generado:
si este documento y aquel no coinciden en una ruta, manda aquel.

## Como leer la columna Estado

| Estado        | Significa                                                                            |
| ------------- | ------------------------------------------------------------------------------------ |
| **Conectada** | La pantalla existe y toma sus datos de un hook de `packages/shared` que consulta Supabase |
| **Parcial**   | Existe y funciona en parte: le falta una pieza, o no cubre todo lo que el modulo promete |
| **Local**     | Existe pero resuelve su logica dentro del componente, sin pasar por `packages/shared`. Es una desviacion de la regla de arquitectura |
| **Pendiente** | Es un marcador de posicion (`PaginaPendiente` / `ScreenPlaceholder`)                  |

Hoy no hay ninguna pantalla **Local** ni **Pendiente**: `ProyectosPage.jsx` (que duplicaba las
transiciones de proyecto, #710) y los marcadores de Presupuestos y Donaciones del movil se
retiraron.

> Este documento describe **como esta cableada** cada pantalla, no si su comportamiento es
> correcto. Consultar las issues abiertas del modulo antes de darlo por bueno.

## Los once modulos

Definidos una sola vez, en `packages/shared/navegacion.js`. Un modulo nuevo se agrega ahi y
aparece solo en el sidebar de la web, en la rejilla de inicio y, si lleva `tabMovil`, en la tab
bar del movil.

| Modulo                | Ruta web              | Movil                                | Roles por defecto                  |
| --------------------- | --------------------- | ------------------------------------ | ---------------------------------- |
| Inicio                | `/`                   | Pestana                              | Todos                              |
| Proyectos             | `/proyectos`          | Pantalla dentro de la pestana Jornadas | Administrador, medico, voluntario  |
| Jornadas              | `/jornadas`           | Pestana                              | Administrador, medico, voluntario  |
| Presupuestos          | `/presupuestos`       | No                                   | Administrador, medico, voluntario  |
| Donaciones            | `/donaciones`         | No                                   | Solo administrador                 |
| Inventario            | `/inventario`         | Pestana                              | Administrador, medico, voluntario  |
| Pacientes             | `/pacientes`          | Pestana                              | Administrador, medico, voluntario  |
| Reportes              | `/reportes`           | **No**                               | Administrador, junta directiva, socio fundador |
| Colaboradores         | `/colaboradores`      | No                                   | Solo administrador                 |
| Matriz de permisos    | `/matriz-permisos`    | No                                   | Solo administrador                 |
| Bitacora de auditoria | `/bitacora-auditoria` | No                                   | Solo administrador                 |

- **Roles consultivos** (junta directiva, socio fundador): desde la `00141` (issue #864) su unica
  pantalla es Reportes, y los datos les llegan agregados. No usan la app movil: al iniciar sesion
  ven `AppSoloParaCampoScreen`, que los remite a la web (`puedeUsarAppMovil`).
- **Personal de campo** (medico, voluntario): en Jornadas y Proyectos ve solo lo suyo; en
  Proyectos y Presupuestos, en consulta y sin aprobar (`00141`, `00148`).
- **Mas alla de lo que da el rol**: la matriz de acceso abre un modulo adicional en solo lectura y
  las funciones delegadas dan una funcion concreta a una persona (`00148`). `puedeVerModulo()` lo
  resuelve con los accesos efectivos de la sesion.
- El movil agrega siempre la pestana **Ajustes** (perfil, notificaciones, cerrar sesion), que no es
  un modulo.

Ocultar una opcion del menu **no es control de acceso**: la restriccion real esta en RLS. Ver
[PERMISOS.md](./PERMISOS.md).

---

## 1. Pacientes

El expediente que sigue al paciente entre jornadas y comunidades. Es el modulo mas grande del
sistema.

### Web

| Pantalla                                                              | Hook                      | Estado    |
| --------------------------------------------------------------------- | ------------------------- | --------- |
| [PacientesPage.jsx](../apps/web/src/pages/PacientesPage.jsx) `/pacientes` | `usePacientesListado`  | Conectada |
| [FichaPacientePage.jsx](../apps/web/src/pages/FichaPacientePage.jsx) `/pacientes/:id` | `usePaciente`, `useFusionesDelPaciente` | Conectada |
| [PacientesCronicosPage.jsx](../apps/web/src/pages/PacientesCronicosPage.jsx) `/pacientes/cronicos` | `usePacientesCronicos` | Conectada |
| [CatalogoDiagnosticosPage.jsx](../apps/web/src/pages/CatalogoDiagnosticosPage.jsx) `/pacientes/diagnosticos` | `useCatalogoDiagnosticos` | Conectada |
| [CatalogoCondicionesPage.jsx](../apps/web/src/pages/CatalogoCondicionesPage.jsx) `/pacientes/condiciones` | `useCatalogoCondiciones` | Conectada |
| [CatalogoComunidadesPage.jsx](../apps/web/src/pages/CatalogoComunidadesPage.jsx) `/pacientes/comunidades` | `useCatalogoComunidades` | Conectada |
| [CatalogoAreasPage.jsx](../apps/web/src/pages/CatalogoAreasPage.jsx) `/pacientes/areas` | `useCatalogoAreas` | Conectada |
| [CatalogoClinicasPage.jsx](../apps/web/src/pages/CatalogoClinicasPage.jsx) `/pacientes/clinicas` | `useCatalogoClinicas` | Conectada |
| [AgendaCitasPage.jsx](../apps/web/src/pages/AgendaCitasPage.jsx) `/pacientes/citas` (con [CalendarioCitas.jsx](../apps/web/src/pages/CalendarioCitas.jsx)) | `useAgendaCitas` | Conectada |
| [PosiblesDuplicadosPage.jsx](../apps/web/src/pages/PosiblesDuplicadosPage.jsx) `/pacientes/duplicados` | `useDuplicadosPacientes` | Conectada |
| [PestaniaHistorialPaciente.jsx](../apps/web/src/pages/PestaniaHistorialPaciente.jsx) | `useVisitasPaciente`, `useRecetasPaciente` | Conectada |
| [PestaniaSignosPaciente.jsx](../apps/web/src/pages/PestaniaSignosPaciente.jsx) | `useEvolucionSignos` | Conectada |
| [ModalConsulta.jsx](../apps/web/src/pages/ModalConsulta.jsx) | `useConsulta`, `useCapturaClinica` | Conectada |
| [ModalGeneracionReceta.jsx](../apps/web/src/pages/ModalGeneracionReceta.jsx) | `useGeneracionReceta`, `useHistorialPaciente` | Conectada |
| [TarjetaReceta.jsx](../apps/web/src/pages/TarjetaReceta.jsx), [RecetaImprimible.jsx](../apps/web/src/pages/RecetaImprimible.jsx) | `datosDeRecetaImprimible` | Conectada |
| [ModalAltaPaciente.jsx](../apps/web/src/pages/ModalAltaPaciente.jsx) | `useRegistroPaciente` | Conectada |
| [ModalEdicionPaciente.jsx](../apps/web/src/pages/ModalEdicionPaciente.jsx) | `useEdicionPaciente` | Conectada |
| [ModalCondicionesPaciente.jsx](../apps/web/src/pages/ModalCondicionesPaciente.jsx) | `useCondicionesPaciente` | Conectada |
| [ModalFusionPacientes.jsx](../apps/web/src/pages/ModalFusionPacientes.jsx) | `useFusionPacientes` | Conectada |
| [ModalDiagnostico.jsx](../apps/web/src/pages/ModalDiagnostico.jsx), [ModalComunidad.jsx](../apps/web/src/pages/ModalComunidad.jsx) | `useFormularioDiagnostico`, `useFormularioComunidad` | Conectada |
| [ModalAreaAtencion.jsx](../apps/web/src/pages/ModalAreaAtencion.jsx), [ModalClinica.jsx](../apps/web/src/pages/ModalClinica.jsx) | via `CatalogoAreasPage` y `CatalogoClinicasPage` | Conectada |
| [ModalCita.jsx](../apps/web/src/pages/ModalCita.jsx), [SelectorDePacienteCita.jsx](../apps/web/src/pages/SelectorDePacienteCita.jsx) | `useFormularioCita`, `useBusquedaPacientes` | Conectada |
| [ModalDetalleCita.jsx](../apps/web/src/pages/ModalDetalleCita.jsx), [FlujoDeCita.jsx](../apps/web/src/pages/FlujoDeCita.jsx) | `useCambioEstadoCita` (Atender abre la consulta con `usePaciente`) | Conectada |
| [CitasDelPaciente.jsx](../apps/web/src/pages/CitasDelPaciente.jsx) (seccion de la ficha) | `useCitasDelPaciente` | Conectada |

### Movil (pestana Pacientes)

| Pantalla                                                                       | Hook                  | Estado    |
| ------------------------------------------------------------------------------ | --------------------- | --------- |
| [BusquedaPacienteScreen.js](../apps/mobile/src/screens/BusquedaPacienteScreen.js) | `usePacientesListado` | Conectada |
| [FichaPacienteScreen.js](../apps/mobile/src/screens/FichaPacienteScreen.js)     | `usePaciente`         | Conectada |
| [HistorialPacienteScreen.js](../apps/mobile/src/screens/HistorialPacienteScreen.js) | `useVisitasPaciente`, `useRecetasPaciente` (en `ficha-paciente/VisitasPacienteSeccion.js`) | Conectada |
| [RegistroPacienteScreen.js](../apps/mobile/src/screens/RegistroPacienteScreen.js) | `useRegistroPaciente` | Conectada |
| [ConsultaScreen.js](../apps/mobile/src/screens/ConsultaScreen.js)               | `useConsulta`         | Conectada |
| [RecetaScreen.js](../apps/mobile/src/screens/RecetaScreen.js)                   | `useGeneracionReceta` | Conectada |
| [EntregaMedicamentosScreen.js](../apps/mobile/src/screens/EntregaMedicamentosScreen.js) | `useEntregaMedicamentos` | Conectada |
| [PacientesCronicosScreen.js](../apps/mobile/src/screens/PacientesCronicosScreen.js) | `usePacientesCronicos` | Conectada |
| [CatalogoCondicionesScreen.js](../apps/mobile/src/screens/CatalogoCondicionesScreen.js) | `useCatalogoCondiciones` | Conectada |
| [CatalogoDiagnosticosScreen.js](../apps/mobile/src/screens/CatalogoDiagnosticosScreen.js) | `useCatalogoDiagnosticos` | Conectada |
| [AgendaCitasScreen.js](../apps/mobile/src/screens/AgendaCitasScreen.js) (con `agenda-citas/`: calendario de anio y de mes, agenda del dia y detalle) | `useAgendaCitas`, `useCambioEstadoCita` | Conectada |

### Contra que trabaja

`pacientes`, `expedientes`, `idiomas`, `condiciones_cronicas`, `padecimientos_cronicos`,
`fusiones_pacientes`, `areas_atencion`, `paciente_area`, `atenciones`, `triajes`, `consultas`,
`consulta_diagnostico`, `diagnosticos`, `recetas`, `receta_detalle`, `clinicas`, `citas`,
`jornadas`, `jornada_personal`, `comunidades`, `municipios`, `departamentos`, y la vista
`vista_lotes_disponibles` (lo que se puede recetar).

Funciones de base: `fn_registrar_paciente`, `fn_buscar_pacientes` (que cuenta sus llamadas en
`limites_de_uso`), `fn_generar_receta`, `fn_ajustar_entrega_receta`,
`fn_bodega_de_entrega_de_consulta`, `fn_existencias_disponibles`,
`fn_detectar_pacientes_duplicados`, `fn_fusionar_pacientes`, `fn_eliminar_clinica`.

### Notas

- El registro es **por pasos** (`registro.pasos.js`), con borrador local: en campo se interrumpe.
- El triaje calcula el IMC para previsualizarlo, pero **el valor que se guarda lo calcula
  Postgres** (columna generada).
- La entrega de medicamentos (ajustar lo que se entrego de una receta) solo existe en movil.
- La deduplicacion de pacientes tiene pantalla desde #637: `PosiblesDuplicadosPage.jsx` lista los
  pares que sugiere `fn_detectar_pacientes_duplicados` (misma fecha de nacimiento + nombre
  similar) y `ModalFusionPacientes.jsx` compara y fusiona. `fusionarPacientes()` en si acepta
  cualquier par de ids, pero hoy no hay forma de elegir un par que el detector no proponga
  (limitacion conocida, ver el comentario de cabecera de `PosiblesDuplicadosPage.jsx`).
- **Areas de atencion (`00182`)**: un catalogo que mantiene la administradora
  (`/pacientes/areas`) y que se asigna a cada paciente en el alta y en la edicion
  (`paciente_area`). Es tambien un filtro de la busqueda de pacientes.
- **Clinicas y agenda de citas (`00183`, `00184`)**: una cita es de un paciente, en una jornada,
  en una clinica y con un profesional del cuadro de turnos. La agenda de la web agenda, reagenda y
  cancela; **Atender** abre la consulta, y al guardarla la cita queda atendida en la misma
  transaccion. Cupo de la clinica, traslapes y transiciones los valida la base (`fn_validar_cita`);
  `useFormularioCita` solo los anticipa. Agendar es el permiso fino `citas.agendar` (`00185`).
- **Citas en movil**: `AgendaCitasScreen.js` consulta la agenda y cambia el estado de una cita
  (atender, regresar a creada, cancelar). No agenda: crear y reagendar citas solo esta en la web.
- La receta sale de la bodega de la jornada o, si no tiene, de la principal
  (`fn_bodega_de_entrega_de_consulta`, `00176`).

---

## 2. Jornadas

La unidad de operacion. Casi todo lo clinico exige una jornada `en curso`.

### Web

| Pantalla                                                                | Hook                                            | Estado    |
| ----------------------------------------------------------------------- | ----------------------------------------------- | --------- |
| [JornadasPage.jsx](../apps/web/src/pages/JornadasPage.jsx) `/jornadas`   | `useJornadasKanban`                             | Conectada |
| [DetalleJornadaPage.jsx](../apps/web/src/pages/DetalleJornadaPage.jsx) `/jornadas/:id` | `useDetalleJornada`, `useCuadroTurnos`, `useResumenCierreJornada` | Conectada |
| [InsumosDeJornada.jsx](../apps/web/src/pages/InsumosDeJornada.jsx) (pestana Insumos: lo previsto y la bodega de la jornada) | `useInsumosDeJornada` | Conectada |
| [ModalCargaABodega.jsx](../apps/web/src/pages/ModalCargaABodega.jsx), [ModalDevolucionDeBodega.jsx](../apps/web/src/pages/ModalDevolucionDeBodega.jsx) | `useCargaDeBodegaDeJornada`, `useDevolucionDeBodegaDeJornada` | Conectada |
| [ConsumoDeJornada.jsx](../apps/web/src/pages/ConsumoDeJornada.jsx) (pestana Consumo) | `useConsumoDeJornada` | Conectada |
| [GastosDeJornada.jsx](../apps/web/src/pages/GastosDeJornada.jsx) (pestana Gastos) | `useGastosDeJornada` | Conectada |
| [SobranteDeJornada.jsx](../apps/web/src/pages/SobranteDeJornada.jsx) (pestana Cierre) | `useSobranteDeJornada` | Conectada |
| [OrigenesDePresupuesto.jsx](../apps/web/src/pages/OrigenesDePresupuesto.jsx) | `useOrigenesDePresupuesto`                  | Conectada |
| [ModalJornada.jsx](../apps/web/src/pages/ModalJornada.jsx)               | `useFormularioJornada`                          | Conectada |
| [ModalAsignarPersonal.jsx](../apps/web/src/pages/ModalAsignarPersonal.jsx) | `useAsignacionPersonal`                       | Conectada |
| [ModalEdicionTurno.jsx](../apps/web/src/pages/ModalEdicionTurno.jsx)     | `useEdicionTurno`                               | Conectada |
| [ModalConfirmarDesasignacion.jsx](../apps/web/src/pages/ModalConfirmarDesasignacion.jsx) | `useDesasignacionPersonal`      | Conectada |
| [CuadroTurnosImprimible.jsx](../apps/web/src/pages/CuadroTurnosImprimible.jsx) | `datosDeCuadroTurnosImprimible`           | Conectada |

### Movil (pestana Jornadas)

| Pantalla                                                                     | Hook                                    | Estado    |
| ---------------------------------------------------------------------------- | --------------------------------------- | --------- |
| [SeleccionJornadaScreen.js](../apps/mobile/src/screens/SeleccionJornadaScreen.js) | `useJornadaActivaCompartida` (contexto de la app) | Conectada |
| [JornadaEnCursoScreen.js](../apps/mobile/src/screens/JornadaEnCursoScreen.js) | `usePanelJornada`                       | Conectada |
| [ResumenJornadaScreen.js](../apps/mobile/src/screens/ResumenJornadaScreen.js) | `useReporteJornada` (dentro de Jornada en curso) | Conectada |
| [JornadasAsignadasScreen.js](../apps/mobile/src/screens/JornadasAsignadasScreen.js) | `useJornadasAsignadas`           | Conectada |
| [KanbanJornadasScreen.js](../apps/mobile/src/screens/KanbanJornadasScreen.js) | `useJornadasKanban`                     | Conectada |
| [DetalleJornadaScreen.js](../apps/mobile/src/screens/DetalleJornadaScreen.js) (version acotada: Resumen, Insumos, Consumo) | `useDetalleJornada`, `useInsumosDeJornada`, `useConsumoDeJornada` | Conectada |

### Contra que trabaja

`jornadas`, `jornada_personal`, `jornada_estado_historial`, `jornada_insumos`,
`jornada_presupuesto_origen`, `fuentes_de_presupuesto`, `gastos`, `categorias_de_gasto`,
`atenciones`, `consultas`, `recetas`, `citas`, `comunidades`, `proyectos`, `donaciones`, `bodegas`,
`existencias`, `movimientos_inventario`, y las vistas `vista_lotes_disponibles`,
`vista_reporte_impacto` y `nombres_de_perfiles`.

Funciones: `fn_contar_atenciones_incompletas`, `personal_registro_atenciones`,
`fn_atenciones_de_persona_por_jornada`, `fn_reporte_jornada`,
`fn_cargar_insumo_a_bodega_de_jornada`, `fn_devolver_de_bodega_de_jornada`,
`fn_consumo_de_insumos_de_jornada`, `existencias_totales_por_bodega`, `sobrante_de_jornada`,
`fn_liquidar_sobrante_de_jornada`, `saldo_de_caja`.

### Notas

- La jornada activa es **estado compartido del movil** (`useJornadaActivaCompartida`): la eligen
  una vez y todas las pantallas de campo la heredan.
- El cierre de jornada tiene un resumen con advertencias (`resumenCierre.js`) porque una jornada
  no se puede finalizar con atenciones abiertas: eso lo hace cumplir la base
  (`fn_contar_atenciones_incompletas`).
- Las transiciones validas viven en `TRANSICIONES_JORNADA` y las revalida un trigger en Postgres.
- **Toda jornada pertenece a un proyecto (`00169`) y lleva una bodega (`00178`)**: una bodega
  movil o, desde la `00181`, la principal. Las dos cosas las exige la base.
- **Bodega de la jornada**: desde la pestana Insumos se carga la bodega movil
  (`fn_cargar_insumo_a_bodega_de_jornada`, `00178`) y, al terminar, lo que sobra se devuelve a
  una bodega fija (`fn_devolver_de_bodega_de_jornada`, `00179`). La pestana Consumo muestra por
  lote lo cargado, lo entregado en recetas, lo devuelto, lo pendiente de aprobar y lo que le
  queda a la jornada (`fn_consumo_de_insumos_de_jornada`; por jornada desde la `00186`). Con la
  bodega principal solo hay entregas, y la pantalla quita las columnas que no aplican.
- **Gastos y sobrante**: la pestana Gastos registra los gastos de la jornada contra su
  presupuesto (un gasto no lo pasa, `00159`). En Cierre, el sobrante de una jornada finalizada
  se devuelve a su origen o se traspasa a otra jornada (`00160`); lo que no vuelve a una donacion
  entra a la caja (`00168`).
- Las fechas reales de inicio y de cierre no se capturan: las pone la base al cambiar el estado
  (`00174`).
- Cancelar o finalizar una jornada cancela sus citas abiertas (`00184`); el resumen de cierre lo
  avisa antes.
- **Detalle de jornada en movil (issue #925)**: `DetalleJornadaScreen.js` es una version acotada
  de `DetalleJornadaPage.jsx` (web): solo Resumen, Insumos y Consumo, los mismos hooks que la web
  (`useDetalleJornada`, `useInsumosDeJornada`/`useConsumoDeJornada` via `InsumosDeJornada.js`/
  `ConsumoDeJornada.js`, `ModalCargaABodega.js`/`ModalDevolucionDeBodega.js` para cargar/devolver).
  Equipo, Pacientes atendidos, Historial, Presupuesto, Gastos y Cierre siguen siendo exclusivos
  de la web -no tienen pantalla movil-. Se llega ahi desde el tablero (`KanbanJornadasScreen.js`,
  boton "Ver detalle" de cada tarjeta), que antes navegaba a una ruta inexistente y ademas
  dibujaba cada tarjeta vacia (le faltaba `renderTarjeta`, y llamaba a `useJornadasKanban({ rol })`
  con un objeto en vez del rol como string -rompia `permisosDeJornadas()` por dentro-).
- **Proyecto > Insumos en movil**: `ProyectosScreen.js` sigue siendo solo el listado (sin pestanas
  de insumos/gastos por proyecto, que si tiene `ProyectosSocialesPage.jsx` en la web). Queda fuera
  del alcance cubierto por la issue #925 en movil; no es un hueco nuevo, es el mismo estado previo.

---

## 3. Inventario

Catalogo de medicamentos e insumos, lotes, existencias por bodega, movimientos con aprobacion y
alertas de vencimiento.

### Web

[InventarioPage.jsx](../apps/web/src/pages/InventarioPage.jsx) `/inventario` es una sola ruta con
pestanas. Cuales ve cada rol lo decide `pestanasDeInventario(rol)`: catalogo, lotes, alertas,
kardex, administracion, principios activos y presentaciones para todos los que entran al
modulo; "mis movimientos" para quien registra movimientos y "validacion" para quien tiene
`inventario.aprobar`. Catalogo y Lotes se ven de 25 en 25 filas (`useOrdenYPagina` y `Paginacion`,
en cliente sobre lo ya filtrado); el kardex sigue mostrando todos sus movimientos.

| Pantalla                                                                              | Hook                            | Estado    |
| ------------------------------------------------------------------------------------- | ------------------------------- | --------- |
| [InventarioPage.jsx](../apps/web/src/pages/InventarioPage.jsx) (catalogo y lotes)      | `@ecopac/shared` (`inventario/`) | Conectada |
| [PanelAlertasVencimiento.jsx](../apps/web/src/pages/PanelAlertasVencimiento.jsx)       | `useAlertasVencimiento`, `useAtencionAlertaCaducidad` | Conectada |
| [AvisosVencimientoPage.jsx](../apps/web/src/pages/AvisosVencimientoPage.jsx) `/inventario/avisos-vencimiento` | `useConfiguracionAlertasVencimiento` | Conectada |
| [KardexMovimientosPage.jsx](../apps/web/src/pages/KardexMovimientosPage.jsx)           | `useKardexMovimientos`          | Conectada |
| [AdministracionBodegasProveedoresPage.jsx](../apps/web/src/pages/AdministracionBodegasProveedoresPage.jsx) | `useAdministracionBodegasProveedores` | Conectada |
| [CatalogoPrincipiosActivosPage.jsx](../apps/web/src/pages/CatalogoPrincipiosActivosPage.jsx) | `useCatalogoPrincipiosActivos` | Conectada |
| [CatalogoPresentacionesPage.jsx](../apps/web/src/pages/CatalogoPresentacionesPage.jsx) | `useCatalogoPresentaciones`     | Conectada |
| [MisMovimientosPage.jsx](../apps/web/src/pages/MisMovimientosPage.jsx)                 | `useMisMovimientos`             | Conectada |
| [BandejaValidacionPage.jsx](../apps/web/src/pages/BandejaValidacionPage.jsx)           | `usePendientesValidacion`       | Conectada |
| [ModalRegistroIngreso.jsx](../apps/web/src/pages/ModalRegistroIngreso.jsx)             | `useRegistroIngreso`            | Conectada |
| [ModalSalidaMedicamento.jsx](../apps/web/src/pages/ModalSalidaMedicamento.jsx) (salida y traslado entre bodegas) | `useRegistroSalida` | Conectada |
| [ModalMedicamento.jsx](../apps/web/src/pages/ModalMedicamento.jsx), [ModalPrincipioActivo.jsx](../apps/web/src/pages/ModalPrincipioActivo.jsx), [ModalPresentacion.jsx](../apps/web/src/pages/ModalPresentacion.jsx) | via `InventarioPage` | Conectada |

### Movil (pestana Inventario)

| Pantalla                                                                             | Hook                     | Estado    |
| ------------------------------------------------------------------------------------ | ------------------------ | --------- |
| [StockScreen.js](../apps/mobile/src/screens/StockScreen.js)                           | `listarExistenciasDisponibles`, `listarBodegas`, `listarMedicamentos`; dibuja `CatalogoMedicamentosScreen` | Conectada |
| [CatalogoMedicamentosScreen.js](../apps/mobile/src/screens/CatalogoMedicamentosScreen.js) | `useCatalogoMedicamentos` | Conectada |
| [ExistenciasInventarioScreen.js](../apps/mobile/src/screens/ExistenciasInventarioScreen.js) | `useExistenciasPorLote` | Conectada |
| [InventarioResumenAlertasScreen.js](../apps/mobile/src/screens/InventarioResumenAlertasScreen.js) | `useAlertasVencimiento` | Conectada |
| [DetalleLoteScreen.js](../apps/mobile/src/screens/DetalleLoteScreen.js)                | `useDetalleLote`         | Conectada |
| [PrincipiosActivosScreen.js](../apps/mobile/src/screens/PrincipiosActivosScreen.js)    | `useCatalogoPrincipiosActivos` | Conectada |
| [RegistroIngresoScreen.js](../apps/mobile/src/screens/RegistroIngresoScreen.js)        | `useRegistroIngreso`     | Conectada |
| [RegistroSalidaScreen.js](../apps/mobile/src/screens/RegistroSalidaScreen.js) (salida y traslado entre bodegas) | `useRegistroSalida` | Conectada |
| [MisMovimientosScreen.js](../apps/mobile/src/screens/MisMovimientosScreen.js)          | `useMisMovimientos`      | Conectada |
| [ValidacionMovimientosScreen.js](../apps/mobile/src/screens/ValidacionMovimientosScreen.js) | `usePendientesValidacion` | Conectada |

Registrar ingreso, registrar salida y mis movimientos llevan la guarda de
`puedeRegistrarMovimiento`; "Por aprobar", la de `puedeAprobarMovimiento`.

### Contra que trabaja

`medicamentos`, `principios_activos`, `medicamento_principio`, `presentaciones`, `proveedores`,
`bodegas`, `lotes`, `existencias`, `movimientos_inventario`, `alertas_caducidad`,
`alerta_caducidad_detalle`, `configuracion_alertas_caducidad`, `avisos_caducidad`, y la vista
`vista_lotes_disponibles`.

Funciones de base: `fn_existencias_disponibles`, `existencias_totales_por_bodega`,
`fn_registrar_medicamento`, `fn_aplicar_ajuste_existencias`, `fn_generar_alertas_caducidad`,
`fn_sincronizar_alertas_caducidad`, `fn_atender_alerta_caducidad`,
`fn_medicamento_tiene_existencias`, `fn_valor_de_inventario_disponible`,
`fn_trasladar_entre_bodegas`, `fn_cambiar_principio_de_medicamento`.

### Notas

- **Aprobacion en dos pasos**: medico y voluntario registran movimientos `pendiente`; quien tiene
  `inventario.aprobar` aprueba o rechaza. Solo la aprobacion toca el stock.
- **Lotes provisionales**: en campo se puede proponer un lote sin esperar al administrador
  (`confirmado = FALSE`, migracion `00107`).
- **Detalle de lote (issue #791)**: `DetalleLoteScreen.js` muestra el lote (medicamento, numero,
  proveedor, origen, fechas) y su kardex de movimientos, sin el costo unitario: eso sigue gateado
  por `puedeVerValorizacion()` (issue #752).
- **Valorizacion de stock (issue #752)**: `lotes` tiene `costo_unitario` (nullable: un lote
  donado o de compra sin precio capturado no vale cero, vale "no se sabe") y `moneda` desde la
  migracion `00121`. El costo se captura opcional al registrar un ingreso y se corrige despues
  desde la pestana Lotes (`actualizarLote()`, gateado por `puedeCorregirLote()`, espejo de la
  politica RLS de UPDATE de `00107`). El valor del stock disponible se ve en el panel de
  indicadores y en el reporte de inventario, gateado a administracion y a los roles consultivos
  (`puedeVerValorizacion()`, `fn_valor_de_inventario_disponible`, `00122`).
- **Avisos de vencimiento configurables (`00162`, issue #899)**: en
  `/inventario/avisos-vencimiento` la administracion elige con cuantos dias de antelacion se
  avisa (de cero a cuatro antelaciones, en `configuracion_alertas_caducidad`); el aviso del dia
  del vencimiento siempre sale. La rutina deja un registro por etapa en `avisos_caducidad`, que
  ninguna pantalla lee: cada fila dispara su notificacion. Atender una alerta reparte lo que
  queda del lote entre una o varias acciones (`alerta_caducidad_detalle`).
- **Traslados entre bodegas (`00179`)**: el motivo "traslado" de la salida, solo para la
  administradora, llama a `fn_trasladar_entre_bodegas`: ingreso en la destino y salida del
  origen, aprobados en una transaccion. Antes un traslado era solo la salida.
- **Lo pendiente ya esta comprometido (`00186`)**: una salida que espera aprobacion deja de
  contarse como disponible (`vista_lotes_disponibles`). La entrega de una receta se aprueba o se
  rechaza entera, y rechazarla anula la receta.
- Un insumo no lleva principio activo ni concentracion (`00164`) y su lote puede no tener fecha
  de vencimiento (`00171`); el principio activo de un medicamento se puede cambiar (`00166`).

---

## 4. Presupuestos

Solo web.

| Pantalla                                                                        | Hook                              | Estado    |
| ------------------------------------------------------------------------------- | --------------------------------- | --------- |
| [PresupuestosPage.jsx](../apps/web/src/pages/PresupuestosPage.jsx) `/presupuestos` | `useEjecucionPresupuestal`      | Conectada |
| [PanelEjecucionPresupuestal.jsx](../apps/web/src/pages/PanelEjecucionPresupuestal.jsx) | `useDetalleProyectoPresupuesto` | Conectada |
| [MovimientosPresupuesto.jsx](../apps/web/src/pages/MovimientosPresupuesto.jsx)   | `useEjecucionPresupuestal`        | Conectada |
| [TablaGastos.jsx](../apps/web/src/pages/TablaGastos.jsx), [ModalGasto.jsx](../apps/web/src/pages/ModalGasto.jsx) | `useFormularioGasto` | Conectada |
| [BandejaAprobacionGastos.jsx](../apps/web/src/pages/BandejaAprobacionGastos.jsx) | `usePendientesAprobacionGastos`   | Conectada |
| [CajaDePresupuesto.jsx](../apps/web/src/pages/CajaDePresupuesto.jsx) (pestana Caja) | `useCajaDePresupuesto` | Conectada |

### Contra que trabaja

`gastos`, `categorias_de_gasto`, `movimientos_de_caja`, `jornadas`, `proyectos`, y la vista
`nombres_de_perfiles`. Funciones: `presupuestos_de_jornadas`, `presupuestos_de_proyectos` (y las
de un solo elemento, `presupuesto_de_jornada`, `presupuesto_de_proyecto`,
`presupuesto_del_sistema`) y `saldo_de_caja`.

### Notas

- Los totales **no se guardan en ninguna columna**: los calculan funciones de la base. Es
  deliberado: un total guardado se desincroniza.
- Mismo patron de aprobacion que inventario, con autoaprobacion para el administrador (`00109`).
- El personal de campo ve el presupuesto de lo suyo y registra gastos, que entran pendientes;
  aprobar es de quien tiene `presupuestos.aprobar`.
- Las categorias de gasto son un catalogo ampliable (`categorias_de_gasto`, `00158`), no un enum.
- Un gasto no deja lo comprometido (pendiente mas aprobado) por encima del presupuesto de su
  jornada, y una jornada finalizada no admite gastos nuevos (`00159`).
- **Caja (`00167`, `00168`)**: el sobrante de una jornada que no vuelve a una donacion entra a la
  caja (`movimientos_de_caja`), y la caja es un origen mas del presupuesto de otra jornada. La
  pestana Caja muestra el saldo y sus movimientos.
- Los gastos de una jornada tambien se registran desde su detalle (pestana Gastos, seccion 2).

---

## 5. Proyectos

### Web

| Pantalla                                                                          | Hook                    | Estado    |
| --------------------------------------------------------------------------------- | ----------------------- | --------- |
| [ProyectosSocialesPage.jsx](../apps/web/src/pages/ProyectosSocialesPage.jsx) `/proyectos` y `/proyectos/sociales` | `useProyectosSociales` | Conectada |
| [SeguimientoProyectoPage.jsx](../apps/web/src/pages/SeguimientoProyectoPage.jsx) `/proyectos/:id/seguimiento` | `useSeguimientoProyecto` | Conectada |
| [ModalProyecto.jsx](../apps/web/src/pages/ModalProyecto.jsx), [ModalHito.jsx](../apps/web/src/pages/ModalHito.jsx) | via las dos de arriba | Conectada |

Los dos modales se montan solo mientras estan abiertos: es lo que hace que cada "Nuevo proyecto" y
cada "Nuevo hito" empiecen en blanco, en vez de traer lo escrito la vez anterior.

### Movil (dentro de la pestana Jornadas)

| Pantalla                                                          | Hook                   | Estado    |
| ----------------------------------------------------------------- | ---------------------- | --------- |
| [ProyectosScreen.js](../apps/mobile/src/screens/ProyectosScreen.js) | `useProyectosSociales` | Conectada |

### Contra que trabaja

`proyectos`, `proyecto_hitos`, `proyecto_seguimiento`, `proyecto_estado_historial`,
`proyecto_personal`, `proyecto_insumos`, `jornada_insumos`, `jornadas`, `gastos`. Funciones:
`equipo_de_proyecto`, `fn_pasar_insumo_de_proyecto_a_jornada`, `fn_insumos_de_proyecto`,
`fn_consumo_de_insumos_de_jornada`.

### Notas

- Un proyecto agrupa sus jornadas; sus insumos previstos pasan a una jornada con
  `fn_pasar_insumo_de_proyecto_a_jornada`.
- Un proyecto cancelado o finalizado queda en solo consulta: la base rechaza cualquier
  modificacion, de sus datos y de lo que cuelga de el (`00154`, y `00172` para el finalizado).
- La pestana de insumos del proyecto muestra lo que les queda a sus jornadas en sus bodegas
  moviles (`fn_insumos_de_proyecto`, `00186`).
- El porcentaje de avance no se edita a mano sin dejar rastro: un trigger escribe en
  `proyecto_seguimiento` cada cambio.

---

## 6. Donaciones

Solo web, solo administrador.

| Pantalla                                                                              | Hook                    | Estado    |
| ------------------------------------------------------------------------------------- | ----------------------- | --------- |
| [DonacionesPage.jsx](../apps/web/src/pages/DonacionesPage.jsx) `/donaciones`           | `useResumenDonaciones`  | Conectada |
| [RegistroDonacionPage.jsx](../apps/web/src/pages/RegistroDonacionPage.jsx) `/donaciones/registro` | `useRegistroDonacion` | Conectada |
| [HistorialDonacionesPage.jsx](../apps/web/src/pages/HistorialDonacionesPage.jsx) `/donaciones/historial` | `useHistorialDonaciones` | Conectada |
| [ConstanciaDonacionPage.jsx](../apps/web/src/pages/ConstanciaDonacionPage.jsx) `/donaciones/:id/constancia` | `useConstanciaDonacion` | Conectada |
| [DonantesPage.jsx](../apps/web/src/pages/DonantesPage.jsx) `/donantes`                 | `useDonantesPage`       | Conectada |

### Contra que trabaja

`donantes`, `donaciones`, `donacion_detalle`, `lotes`, `movimientos_inventario`, `proyectos`,
`jornadas`, `proveedores`. Funcion: `fn_registrar_donacion`.

### Notas

- Una donacion de medicamentos **genera el lote en inventario**, y `donacion_detalle.lote_id` es
  UNIQUE para que dos donaciones no reclamen el mismo lote.
- Una donacion puede destinarse a un proyecto o a una jornada concreta. Si es de dinero y la
  jornada esta planificada o en curso, entra sola al presupuesto de esa jornada como un aporte
  (`00187`); no hay que volver a asignarla desde la pestana Presupuesto.
- **Una donacion registrada no se borra, no se corrige y ya no se anula.** La `00173` quito la
  politica de UPDATE y la funcion `fn_anular_donacion`, porque no hay proceso para devolver lo
  donado. Las donaciones anuladas antes conservan su estado y se siguen mostrando como anuladas.
- Cada donante tiene su proveedor en inventario (`proveedores.donante_id`, `00175`): lo crea y
  lo mantiene un trigger a partir del donante, y por eso no se edita en Inventario sino en Donantes.
- El renglon de una donacion de insumos elige el articulo del catalogo, igual que el de
  medicamentos (`00170`).

---

## 7. Reportes

Solo web (`movil: false`).

| Pantalla                                                                                 | Hook                   | Estado    |
| ---------------------------------------------------------------------------------------- | ---------------------- | --------- |
| [ReportesPage.jsx](../apps/web/src/pages/ReportesPage.jsx) `/reportes`                    | `useReporteMedicamentosPorVencer` | Hub con cinco pestanas, cada una con su ruta |
| [DashboardMetricasPage.jsx](../apps/web/src/pages/DashboardMetricasPage.jsx) pestana `/reportes` y `/reportes/dashboard` | `useDashboardMetricas` | Conectada |
| Medicamentos por vencer, pestana `/reportes/medicamentos-por-vencer` (dentro de `ReportesPage.jsx`) | `useReporteMedicamentosPorVencer` | Conectada |
| [ReportePacientesPage.jsx](../apps/web/src/pages/ReportePacientesPage.jsx) pestana `/reportes/pacientes-atendidos` | `useReportePacientes` (usa `useFiltrosReportes` por dentro) | Conectada |
| [ReporteInventarioPage.jsx](../apps/web/src/pages/ReporteInventarioPage.jsx) pestana `/reportes/inventario-actual` | `useReporteInventario` | Conectada |
| [ReporteEnfermedadesPage.jsx](../apps/web/src/pages/ReporteEnfermedadesPage.jsx) pestana `/reportes/enfermedades` | `useReporteEnfermedades` | Conectada |
| [ReporteJornada.jsx](../apps/web/src/pages/ReporteJornada.jsx) `/reportes/jornada/:id`    | `useReporteJornada`    | Conectada |

### Contra que trabaja

Vistas `vista_reporte_impacto_por_comunidad` y `vista_reporte_impacto`; funciones
`fn_reporte_pacientes_atendidos`, `fn_reporte_jornada`, `fn_valor_de_inventario_disponible`,
`fn_reporte_enfermedades` y `fn_opciones_reporte_enfermedades`.
Exportacion a CSV con `exportarFilasACSV` (`reportes/csv.js`).

### Notas

- Los roles consultivos leen **agregados**, no filas clinicas: es la razon de que estos reportes
  salgan de vistas y funciones y no de `SELECT` sobre las tablas (`00054`). Desde la `00155` los
  reportes agrupan por la comunidad del paciente.
- Excepcion conocida: el reporte de inventario y el de medicamentos por vencer leen `existencias`
  y `lotes` directamente, por eso los consultivos conservan esa lectura (ver las divergencias de
  [PERMISOS.md](./PERMISOS.md)).
- Las seis rutas de pestana (`/reportes` y `/reportes/dashboard` son la misma) montan
  `ReportesPage`, que elige la pestana por la direccion.
- **Reporte de enfermedades (`00177`, issue #916)**: cuatro vistas sobre `fn_reporte_enfermedades`
  -las mas frecuentes, comparacion entre jornadas, comparacion entre comunidades y evolucion de
  una enfermedad-, con graficas. Devuelve solo conteos agregados, desde la `00180` con el numero
  real de casos. Los selectores salen de `fn_opciones_reporte_enfermedades`, porque los roles
  consultivos no leen `jornadas`, `proyectos` ni `diagnosticos`.
- **El margen del papel lo pone el documento, no la pagina.** Todo lo que se imprime (reportes,
  constancia, kardex, receta, cuadro de turnos) trae su margen como `padding` de `.doc-imprimible`
  o `.turnos-imprimible` (`apps/web/src/index.css`), repetido en cada hoja con
  `box-decoration-break: clone`, y las reglas `@page` lo dejan en cero. Un margen puesto en `@page`
  se pierde en cuanto el dialogo de impresion del navegador tiene "Margenes" en "Ninguno" o
  "Minimo", y el papel sale pegado al borde.

---

## 8. Colaboradores, permisos y auditoria

Solo web, solo administrador.

| Pantalla                                                                            | Hook                                        | Estado    |
| ----------------------------------------------------------------------------------- | ------------------------------------------- | --------- |
| [ColaboradoresPage.jsx](../apps/web/src/pages/ColaboradoresPage.jsx) `/colaboradores` | `useUsuariosListado`, `useHistorialDePersona` | Conectada |
| [ModalAltaUsuario.jsx](../apps/web/src/pages/ModalAltaUsuario.jsx)                   | `useAltaUsuario`                            | Conectada |
| [ModalEdicionUsuario.jsx](../apps/web/src/pages/ModalEdicionUsuario.jsx)             | `useEdicionUsuario`, `useEspecialidadesDePerfil` | Conectada |
| [ModalPermisosUsuario.jsx](../apps/web/src/pages/ModalPermisosUsuario.jsx)           | `useGestionPermisos`                        | Conectada |
| [ModalConfirmarDesactivacion.jsx](../apps/web/src/pages/ModalConfirmarDesactivacion.jsx) | `useDesactivacionUsuario`               | Conectada |
| [MatrizPermisosPorRolPage.jsx](../apps/web/src/pages/MatrizPermisosPorRolPage.jsx) `/matriz-permisos` | `useMatrizDeAccesoPorRol`  | Conectada |
| [BitacoraAuditoriaPage.jsx](../apps/web/src/pages/BitacoraAuditoriaPage.jsx) `/bitacora-auditoria` | `useBitacoraAuditoria`, `useEnviosDeCorreo` | Conectada |

### Contra que trabaja

`perfiles`, `perfiles_directorio`, `perfil_especialidad`, `permisos`, `rol_permiso`,
`usuario_permiso`, `rol_modulo`, `eventos_auditoria`, `notificaciones`, `jornada_personal`. Edge
Function `invitar-usuario`; funcion `fn_crear_usuario_administrativo` (`00074`).

### Notas

- El alta **no pasa por la Admin API**: `crearUsuario()` llama a la Edge Function, que valida quien
  llama y reutiliza `fn_crear_usuario_administrativo` con la llave de servicio.
- Los permisos finos son excepciones por persona sobre lo que da el rol, con motivo y auditoria.
  La matriz de acceso abre un modulo adicional a un rol, en solo lectura (`00148`).
- Cuatro reglas las hace cumplir la base y no el formulario: no cambiarse el rol, no desactivarse a
  si mismo, no dejar al sistema sin administrador activo, no dar escritura a un rol consultivo.

---

## 9. Autenticacion, sesion, inicio y notificaciones

### Web

| Pantalla                                                                          | Hook                     | Estado    |
| --------------------------------------------------------------------------------- | ------------------------ | --------- |
| [LoginPage.jsx](../apps/web/src/pages/LoginPage.jsx) `/login`                      | `useInicioSesion`        | Conectada |
| [RestablecerContrasenaPage.jsx](../apps/web/src/pages/RestablecerContrasenaPage.jsx) `/restablecer-contrasena` | `useRestablecerContrasena` | Conectada |
| [NuevaContrasenaPage.jsx](../apps/web/src/pages/NuevaContrasenaPage.jsx) `/nueva-contrasena` | `useNuevaContrasena` | Conectada |
| [HomePage.jsx](../apps/web/src/pages/HomePage.jsx) `/`                             | `usePanelDeInicio`       | Conectada |
| [PerfilPage.jsx](../apps/web/src/pages/PerfilPage.jsx) `/perfil`                   | `usePerfilPropio`, `useEspecialidadesDePerfil`, `useContadorNotificaciones` | Conectada |
| [NotificacionesPage.jsx](../apps/web/src/pages/NotificacionesPage.jsx) `/notificaciones` | `useBuzonNotificaciones` | Conectada |
| [AccesoDenegadoPage.jsx](../apps/web/src/pages/AccesoDenegadoPage.jsx)             | -                        | Conectada |
| [NotFoundPage.jsx](../apps/web/src/pages/NotFoundPage.jsx) `*`                     | -                        | Conectada |

### Movil

| Pantalla                                                                          | Hook                     | Estado    |
| --------------------------------------------------------------------------------- | ------------------------ | --------- |
| [LoginScreen.js](../apps/mobile/src/screens/LoginScreen.js)                        | `useInicioSesion`        | Conectada |
| [RestablecerContrasenaScreen.js](../apps/mobile/src/screens/RestablecerContrasenaScreen.js) | `useRestablecerContrasena` | Conectada |
| [NuevaContrasenaScreen.js](../apps/mobile/src/screens/NuevaContrasenaScreen.js)    | `useNuevaContrasena` (al volver del enlace de recuperacion) | Conectada |
| [RestaurandoSesionScreen.js](../apps/mobile/src/screens/RestaurandoSesionScreen.js) | -                       | Conectada |
| [AppSoloParaCampoScreen.js](../apps/mobile/src/screens/AppSoloParaCampoScreen.js)  | - (roles sin acceso movil) | Conectada |
| [InicioScreen.js](../apps/mobile/src/screens/InicioScreen.js) (pestana Inicio)     | `usePanelDeInicio`       | Conectada |
| [AjustesScreen.js](../apps/mobile/src/screens/AjustesScreen.js) (pestana Ajustes)  | `usePerfilPropio`        | Conectada |
| [NotificacionesScreen.js](../apps/mobile/src/screens/NotificacionesScreen.js)      | `useBuzonNotificaciones` | Conectada |
| [AccesoDenegadoScreen.js](../apps/mobile/src/screens/AccesoDenegadoScreen.js)      | -                        | Conectada |

La sesion se expira por inactividad (`useExpiracionPorInactividad`): en web avisa un minuto
antes, sobrevive a recargar la pagina y cuenta la actividad de todas las pestanas; en movil cuenta
cada navegacion como actividad. El almacenamiento de credenciales difiere por plataforma a
proposito: ver [SEGURIDAD.md](./SEGURIDAD.md) y [PROTECCION-DE-DATOS.md](./PROTECCION-DE-DATOS.md).

La web ademas captura los errores que antes dejaban la pagina en blanco (`LimiteDeError`), avisa
cuando se queda sin red (`AvisoSinConexion`) y reporta todo por `reportarError`, sin datos de
paciente: ver [SEGURIDAD.md, "Observabilidad"](./SEGURIDAD.md).

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
| `PageHeader`      | Si   | Si    | Encabezado de pantalla: titulo, filete de color del modulo, acciones |
| `SectionHeader`   | Si   | Si    | Encabezado de una seccion o pestana dentro de una pantalla |
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
| **Pendiente** | 0         | -                                                                        |
| **Local**     | 0         | -                                                                        |
| **Parcial**   | 0         | -                                                                        |
| **Conectada** | Todas     | 40 rutas web y 31 pantallas moviles ([PANTALLAS.md](./PANTALLAS.md))      |

Diferencias entre plataformas. La app movil es para el trabajo en campo, asi que lo de
administracion y consulta queda en la web a proposito:

| Solo en web                                                                 | Solo en movil                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Presupuestos, Donaciones, Reportes, Colaboradores, Matriz de permisos, Bitacora | Entrega de medicamentos de una receta            |
| Catalogos de comunidades, areas de atencion y clinicas; deteccion y fusion de duplicados; agendar y reagendar citas (Pacientes) | Seleccion de la jornada activa y panel de jornada en curso |
| Creacion y edicion de jornadas, asignacion de personal y cuadro de turnos; equipo, pacientes atendidos, historial, presupuesto, gastos y cierre del detalle de jornada | Mis jornadas asignadas |
| Seguimiento e hitos de proyecto; administracion de bodegas y proveedores; presentaciones; configuracion de los avisos de vencimiento | - |
