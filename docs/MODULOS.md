# Modulos y pantallas - Ecopac Digital

Catalogo de lo que existe construido: que pantalla hay, en que app, que hook de
`packages/shared` la sirve, y contra que tablas trabaja.

Sirve para dos cosas: **encontrar donde vive una pantalla** sin recorrer carpetas, y **ver de un
vistazo que esta conectado y que no**.

Estado al 30 de septiembre de 2026, sobre `develop` (esquema hasta la migracion `00156`). Lo que
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

### Contra que trabaja

`pacientes`, `expedientes`, `idiomas`, `condiciones_cronicas`, `padecimientos_cronicos`,
`fusiones_pacientes`, `atenciones`, `triajes`, `consultas`, `consulta_diagnostico`,
`diagnosticos`, `recetas`, `comunidades`, `municipios`, `departamentos`.

Funciones de base: `fn_registrar_paciente`, `fn_buscar_pacientes`, `fn_generar_receta`,
`fn_ajustar_entrega_receta`, `fn_existencias_disponibles`, `fn_detectar_pacientes_duplicados`,
`fn_fusionar_pacientes`.

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

---

## 2. Jornadas

La unidad de operacion. Casi todo lo clinico exige una jornada `en curso`.

### Web

| Pantalla                                                                | Hook                                            | Estado    |
| ----------------------------------------------------------------------- | ----------------------------------------------- | --------- |
| [JornadasPage.jsx](../apps/web/src/pages/JornadasPage.jsx) `/jornadas`   | `useJornadasKanban`                             | Conectada |
| [DetalleJornadaPage.jsx](../apps/web/src/pages/DetalleJornadaPage.jsx) `/jornadas/:id` | `useDetalleJornada`, `useCuadroTurnos`, `useResumenCierreJornada` | Conectada |
| [InsumosDeJornada.jsx](../apps/web/src/pages/InsumosDeJornada.jsx)       | `useInsumosDeJornada`                           | Conectada |
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
`jornada_presupuesto_origen`, `fuentes_de_presupuesto`, `atenciones`, `comunidades`, `proyectos`,
`donaciones`. Funciones: `fn_contar_atenciones_incompletas`, `personal_registro_atenciones`,
`fn_atenciones_de_persona_por_jornada`, `fn_reporte_jornada`.

### Notas

- La jornada activa es **estado compartido del movil** (`useJornadaActivaCompartida`): la eligen
  una vez y todas las pantallas de campo la heredan.
- El cierre de jornada tiene un resumen con advertencias (`resumenCierre.js`) porque una jornada
  no se puede finalizar con atenciones abiertas: eso lo hace cumplir la base
  (`fn_contar_atenciones_incompletas`).
- Las transiciones validas viven en `TRANSICIONES_JORNADA` y las revalida un trigger en Postgres.
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

### Web

[InventarioPage.jsx](../apps/web/src/pages/InventarioPage.jsx) `/inventario` es una sola ruta con
pestanas. Cuales ve cada rol lo decide `pestanasDeInventario(rol)`: catalogo, lotes, alertas,
kardex, administracion, principios activos y presentaciones para todos los que entran al
modulo; "mis movimientos" para quien registra movimientos y "validacion" para quien tiene
`inventario.aprobar`.

| Pantalla                                                                              | Hook                            | Estado    |
| ------------------------------------------------------------------------------------- | ------------------------------- | --------- |
| [InventarioPage.jsx](../apps/web/src/pages/InventarioPage.jsx) (catalogo y lotes)      | `@ecopac/shared` (`inventario/`) | Conectada |
| [PanelAlertasVencimiento.jsx](../apps/web/src/pages/PanelAlertasVencimiento.jsx)       | `useAlertasVencimiento`         | Conectada |
| [KardexMovimientosPage.jsx](../apps/web/src/pages/KardexMovimientosPage.jsx)           | `useKardexMovimientos`          | Conectada |
| [AdministracionBodegasProveedoresPage.jsx](../apps/web/src/pages/AdministracionBodegasProveedoresPage.jsx) | `useAdministracionBodegasProveedores` | Conectada |
| [CatalogoPrincipiosActivosPage.jsx](../apps/web/src/pages/CatalogoPrincipiosActivosPage.jsx) | `useCatalogoPrincipiosActivos` | Conectada |
| [CatalogoPresentacionesPage.jsx](../apps/web/src/pages/CatalogoPresentacionesPage.jsx) | `useCatalogoPresentaciones`     | Conectada |
| [MisMovimientosPage.jsx](../apps/web/src/pages/MisMovimientosPage.jsx)                 | `useMisMovimientos`             | Conectada |
| [BandejaValidacionPage.jsx](../apps/web/src/pages/BandejaValidacionPage.jsx)           | `usePendientesValidacion`       | Conectada |
| [ModalRegistroIngreso.jsx](../apps/web/src/pages/ModalRegistroIngreso.jsx)             | `useRegistroIngreso`            | Conectada |
| [ModalSalidaMedicamento.jsx](../apps/web/src/pages/ModalSalidaMedicamento.jsx)         | `useRegistroSalida`             | Conectada |
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
| [RegistroSalidaScreen.js](../apps/mobile/src/screens/RegistroSalidaScreen.js)          | `useRegistroSalida`      | Conectada |
| [MisMovimientosScreen.js](../apps/mobile/src/screens/MisMovimientosScreen.js)          | `useMisMovimientos`      | Conectada |
| [ValidacionMovimientosScreen.js](../apps/mobile/src/screens/ValidacionMovimientosScreen.js) | `usePendientesValidacion` | Conectada |

Registrar ingreso, registrar salida y mis movimientos llevan la guarda de
`puedeRegistrarMovimiento`; "Por aprobar", la de `puedeAprobarMovimiento`.

### Contra que trabaja

`medicamentos`, `principios_activos`, `medicamento_principio`, `presentaciones`, `proveedores`,
`bodegas`, `lotes`, `existencias`, `movimientos_inventario`, `alertas_caducidad`, y la vista
`vista_lotes_disponibles`.

Funciones de base: `fn_existencias_disponibles`, `existencias_totales_por_bodega`,
`fn_registrar_medicamento`, `fn_aplicar_ajuste_existencias`, `fn_generar_alertas_caducidad`,
`fn_sincronizar_alertas_caducidad`, `fn_atender_alerta_caducidad`,
`fn_medicamento_tiene_existencias`, `fn_valor_de_inventario_disponible`.

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

### Contra que trabaja

`gastos`, `jornadas`, `proyectos`. Funciones: `presupuestos_de_jornadas`,
`presupuestos_de_proyectos` (y las de un solo elemento, `presupuesto_de_jornada`,
`presupuesto_de_proyecto`, `presupuesto_del_sistema`).

### Notas

- Los totales **no se guardan en ninguna columna**: los calculan funciones de la base. Es
  deliberado: un total guardado se desincroniza.
- Mismo patron de aprobacion que inventario, con autoaprobacion para el administrador (`00109`).
- El personal de campo ve el presupuesto de lo suyo y registra gastos, que entran pendientes;
  aprobar es de quien tiene `presupuestos.aprobar`.

---

## 5. Proyectos

### Web

| Pantalla                                                                          | Hook                    | Estado    |
| --------------------------------------------------------------------------------- | ----------------------- | --------- |
| [ProyectosSocialesPage.jsx](../apps/web/src/pages/ProyectosSocialesPage.jsx) `/proyectos` y `/proyectos/sociales` | `useProyectosSociales` | Conectada |
| [SeguimientoProyectoPage.jsx](../apps/web/src/pages/SeguimientoProyectoPage.jsx) `/proyectos/:id/seguimiento` | `useSeguimientoProyecto` | Conectada |
| [ModalProyecto.jsx](../apps/web/src/pages/ModalProyecto.jsx), [ModalHito.jsx](../apps/web/src/pages/ModalHito.jsx) | via las dos de arriba | Conectada |

### Movil (dentro de la pestana Jornadas)

| Pantalla                                                          | Hook                   | Estado    |
| ----------------------------------------------------------------- | ---------------------- | --------- |
| [ProyectosScreen.js](../apps/mobile/src/screens/ProyectosScreen.js) | `useProyectosSociales` | Conectada |

### Contra que trabaja

`proyectos`, `proyecto_hitos`, `proyecto_seguimiento`, `proyecto_estado_historial`,
`proyecto_personal`, `proyecto_insumos`, `jornada_insumos`, `jornadas`, `gastos`. Funciones:
`equipo_de_proyecto`, `fn_pasar_insumo_de_proyecto_a_jornada`.

### Notas

- Un proyecto agrupa sus jornadas; sus insumos previstos pasan a una jornada con
  `fn_pasar_insumo_de_proyecto_a_jornada`.
- Un proyecto cancelado queda en solo consulta: la base rechaza cualquier modificacion (`00154`).
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
`jornadas`. Funciones: `fn_registrar_donacion`, `fn_anular_donacion`.

### Notas

- Una donacion de medicamentos **genera el lote en inventario**, y `donacion_detalle.lote_id` es
  UNIQUE para que dos donaciones no reclamen el mismo lote.
- Una donacion puede destinarse a un proyecto o a una jornada concreta.
- Una donacion no se borra: se anula, con motivo y responsable (`fn_anular_donacion`).

---

## 7. Reportes

Solo web (`movil: false`).

| Pantalla                                                                                 | Hook                   | Estado    |
| ---------------------------------------------------------------------------------------- | ---------------------- | --------- |
| [ReportesPage.jsx](../apps/web/src/pages/ReportesPage.jsx) `/reportes`                    | `useReporteMedicamentosPorVencer` | Hub con cuatro pestanas, cada una con su ruta |
| [DashboardMetricasPage.jsx](../apps/web/src/pages/DashboardMetricasPage.jsx) pestana `/reportes` y `/reportes/dashboard` | `useDashboardMetricas` | Conectada |
| Medicamentos por vencer, pestana `/reportes/medicamentos-por-vencer` (dentro de `ReportesPage.jsx`) | `useReporteMedicamentosPorVencer` | Conectada |
| [ReportePacientesPage.jsx](../apps/web/src/pages/ReportePacientesPage.jsx) pestana `/reportes/pacientes-atendidos` | `useReportePacientes` (usa `useFiltrosReportes` por dentro) | Conectada |
| [ReporteInventarioPage.jsx](../apps/web/src/pages/ReporteInventarioPage.jsx) pestana `/reportes/inventario-actual` | `useReporteInventario` | Conectada |
| [ReporteJornada.jsx](../apps/web/src/pages/ReporteJornada.jsx) `/reportes/jornada/:id`    | `useReporteJornada`    | Conectada |

### Contra que trabaja

Vistas `vista_reporte_impacto_por_comunidad` y `vista_reporte_impacto`; funciones
`fn_reporte_pacientes_atendidos`, `fn_reporte_jornada` y `fn_valor_de_inventario_disponible`.
Exportacion a CSV con `exportarFilasACSV` (`reportes/csv.js`).

### Notas

- Los roles consultivos leen **agregados**, no filas clinicas: es la razon de que estos reportes
  salgan de vistas y funciones y no de `SELECT` sobre las tablas (`00054`). Desde la `00155` los
  reportes agrupan por la comunidad del paciente.
- Excepcion conocida: el reporte de inventario y el de medicamentos por vencer leen `existencias`
  y `lotes` directamente, por eso los consultivos conservan esa lectura (ver las divergencias de
  [PERMISOS.md](./PERMISOS.md)).
- Las cuatro rutas de pestana montan `ReportesPage`, que elige la pestana por la direccion.

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
| **Conectada** | Todas     | 35 rutas web y 29 pantallas moviles ([PANTALLAS.md](./PANTALLAS.md))      |

Diferencias entre plataformas. La app movil es para el trabajo en campo, asi que lo de
administracion y consulta queda en la web a proposito:

| Solo en web                                                                 | Solo en movil                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Presupuestos, Donaciones, Reportes, Colaboradores, Matriz de permisos, Bitacora | Entrega de medicamentos de una receta            |
| Catalogo de comunidades y deteccion y fusion de duplicados (Pacientes)      | Seleccion de la jornada activa y panel de jornada en curso |
| Creacion y edicion de jornadas, asignacion de personal y cuadro de turnos   | Mis jornadas asignadas                               |
| Seguimiento e hitos de proyecto; administracion de bodegas y proveedores; presentaciones | -                                      |
