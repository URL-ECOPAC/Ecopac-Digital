# Cumplimiento de requerimientos

Revision final de los 34 requerimientos funcionales y los 15 no funcionales del proyecto (issue
#253): donde esta cada uno, que issues lo construyeron, con que se prueba y en que estado queda.

- **Fuente de los requerimientos:** la lista de la issue #253, que es la del Entregable Semana 3-4.
  La numeracion `RF-xx` coincide con la del backlog de issues, no con la Matriz de Trazabilidad
  del Entregable Semana 5 (7 RF), que es la que usa [CASOS-DE-PRUEBA.md](./CASOS-DE-PRUEBA.md).
  Donde un caso de prueba existe, se cita por su ID (`CP-...`).
- **Revisado contra:** `develop` el 27 de septiembre de 2026, con las migraciones hasta la
  `00153`.
- **Como se reviso:** cada requerimiento contra el codigo (pantalla web, pantalla movil, API de
  `packages/shared`, migracion) y contra las pruebas automaticas que lo ejercitan. Que una issue
  este cerrada no se tomo como prueba de que funciona.
- **Revisado con la organizacion** el 27 de septiembre de 2026: las decisiones sobre RF-1, RF-19,
  RNF-3 y RNF-12 que figuran abajo son suyas.

## Estados

| Estado | Que significa |
| --- | --- |
| **Cumple** | Esta construido en el codigo, en las plataformas que corresponde, y verificado: por una prueba automatica o, cuando no se puede automatizar, por la organizacion |
| **Se verifica en produccion** | Esta construido; lo que falta depende de las cuentas y del ambiente de produccion. Queda en la issue de salida a produccion (#252) |
| **Se verifica en pruebas** | Esta construido; lo que falta es una prueba manual, de volumen o con el personal. Queda en la issue del plan de pruebas (#758) |

Esta issue se cierra con este documento: lo que queda pendiente no es codigo, y esta anotado en
la issue que lo va a ejecutar.

## Resumen

| | Cumple | Se verifica en produccion (#252) | Se verifica en pruebas (#758) | Total |
| --- | :-: | :-: | :-: | :-: |
| Funcionales | 33 | 1 | 0 | 34 |
| No funcionales | 8 | 2 | 5 | 15 |

Lo que queda para produccion y para pruebas esta en [Lo que queda pendiente](#lo-que-queda-pendiente).

## Requerimientos funcionales

### Usuarios, roles y sesion

| RF | Requerimiento | Donde esta | Issues | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | La administradora registra, modifica, desactiva y elimina usuarios | Web: Colaboradores (`ColaboradoresPage.jsx`, alta por invitacion con la Edge Function `invitar-usuario`, edicion y desactivacion) | #103, #105, #106, #107, #508 | `CP-RF01-02`, `CP-RF01-03`, `CP-RF01-13`, `CP-RF01-14` | **Cumple**. "Eliminar" es desactivar, por decision de la organizacion: la cuenta pierde todo acceso y sus registros conservan su autor. Ver abajo |
| 2 | Asignar roles y permisos a cada usuario, restringiendo el acceso por perfil | Web: rol en el formulario del colaborador, Matriz de permisos (modulos por rol) y Permisos por persona. Base: RLS en todas las tablas, `rol_modulo` y `usuario_permiso` (`00148`) | #99, #104, #108, #638, #864, #886 | `CP-RF01-01`, `CP-RF01-08` a `CP-RF01-10`; `acceso_a_modulos_por_rol.sql` | **Cumple** |
| 3 | Inicio y cierre de sesion con credenciales | Web: `LoginPage.jsx`, cierre desde el menu. Movil: `LoginScreen.js`, cierre en Ajustes. Cierre por inactividad en las dos | #97, #98, #100, #109, #110, #230 | `CP-RF01-14`, `CP-RNF10-02`; `LoginPage.test.jsx` | **Cumple** |

### Pacientes y atencion clinica

| RF | Requerimiento | Donde esta | Issues | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| 4 | Registrar pacientes con informacion personal y demografica | Web: `ModalAltaPaciente.jsx`. Movil: `RegistroPacienteScreen.js` | #112, #113, #126, #134 | `CP-RF02-06`, `CP-RF02-07`, `CP-RF02-10` | **Cumple** |
| 5 | Consultar, editar y actualizar pacientes | Web: `PacientesPage.jsx`, `FichaPacientePage.jsx`, `ModalEdicionPaciente.jsx`. Movil: `FichaPacienteScreen.js`, `ModalEdicionPaciente.js` | #113, #123, #125, #127 | `FichaPacientePage.test.jsx`, `FichaPacienteScreen.test.js` | **Cumple** |
| 6 | Expediente clinico unico por paciente | Base: `expedientes` uno a uno con el paciente, `numero_ficha` por secuencia (`00081`). Deteccion y fusion de duplicados (`PosiblesDuplicadosPage.jsx`, `fn_fusionar_pacientes`) | #114, #140 | `CP-RF02-01`, `CP-RF02-05` | **Cumple** |
| 7 | Signos vitales: presion arterial, glucosa, peso y talla | Primer paso de la consulta: web `ModalConsulta.jsx`, movil `ConsultaScreen.js`. IMC calculado en la base | #117, #118, #136, #840 | `CP-RF02-04` | **Cumple** |
| 8 | Consultas con motivo, diagnostico, tratamiento y observaciones | Web: `ModalConsulta.jsx`. Movil: `ConsultaScreen.js`. Diagnosticos del catalogo (`CatalogoDiagnosticosPage.jsx`) | #119, #137, #639 | `CP-RF02-03`, `CP-RF02-08` | **Cumple** |
| 9 | Historial medico completo del paciente | Web: pestana Historial de la ficha (visitas con signos, consulta y receta). Movil: `VisitasPacienteSeccion.js` | #121, #128, #129, #139 | `CP-RF06-04`, `CP-RF06-05` | **Cumple** |
| 10 | Buscar pacientes por nombre, comunidad o numero de ficha | `fn_buscar_pacientes` (`00068`, sin acentos y tolerante a errores de tipeo). Web: `PacientesPage.jsx`. Movil: `BusquedaPacienteScreen.js` | #115, #116, #124, #133 | `CP-RF06-01` | **Cumple** |
| 11 | Recetas digitales asociadas a la consulta | Web: `ModalGeneracionReceta.jsx`. Movil: `RecetaScreen.js`. La receta y su salida de inventario se guardan juntas (`fn_generar_receta`) | #120, #138, #711 | `CP-RF03-08`, `CP-RF06-02` | **Cumple** |
| 12 | Ver las recetas emitidas de cada paciente | Dentro de cada visita del historial, web (`TarjetaReceta.jsx`, imprimible) y movil | #120, #130, #131 | `CP-RF06-02`, `TarjetaReceta.test.jsx` | **Cumple** |

### Inventario

| RF | Requerimiento | Donde esta | Issues | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| 13 | Registrar medicamentos con nombre, componente activo, concentracion, presentacion y marca | Web: `ModalMedicamento.jsx`, catalogos de principios activos y presentaciones. Movil: `CatalogoMedicamentosScreen.js` | #141, #142, #153, #154, #269 | `permisos_por_rol_864.sql`; `medicamentos.api.test.js`; `CatalogoMedicamentosScreen.test.js` | **Cumple** |
| 14 | Registrar lotes con cantidad, fecha de ingreso y fecha de vencimiento | El lote nace con su ingreso (`ModalRegistroIngreso.jsx`, `RegistroIngresoScreen.js`): desde la #846 no se crea un lote sin movimiento. Pestana Lotes para consultarlos y corregir el costo | #144, #155, #846 | `CP-RF04-06`, `CP-RF04-09` | **Cumple** |
| 15 | Registrar ingresos de compras o donaciones | `lotes.origen` (compra o donacion). Una donacion de medicamentos genera su ingreso desde el registro de la donacion | #143, #149, #156, #165, #192 | `CP-RF04-01`, `CP-RF04-09` | **Cumple** |
| 16 | Registrar la salida de medicamentos entregados a pacientes | La receta registra la salida; entrega y ajuste en `EntregaMedicamentosScreen.js`. Salida manual: web `ModalSalidaMedicamento.jsx`, movil `RegistroSalidaScreen.js` | #147, #148, #157, #164, #764 | `CP-RF03-09`, `CP-RF03-11`, `CP-RF04-07` | **Cumple** |
| 17 | Movimientos pendientes hasta que la administradora los apruebe | `movimientos_inventario.estado`; `existencias` solo se mueve al aprobar. Web: pestana Validacion (`BandejaValidacionPage.jsx`). Movil: `ValidacionMovimientosScreen.js` | #149, #150, #152, #158 | `CP-RF04-01` a `CP-RF04-08` | **Cumple** |
| 18 | Inventario disponible en tiempo real | `existencias` por lote y bodega, leida en cada consulta. Web: Catalogo, Lotes, reporte de inventario. Movil: `StockScreen.js`, `ExistenciasInventarioScreen.js` | #145, #159, #163 | `CP-RF03-05`, `CP-RF03-06`, `CP-RF03-10` | **Cumple** |
| 19 | Alertas automaticas un mes antes del vencimiento | `fn_generar_alertas_caducidad` (30 dias, tambien los ya vencidos), Edge Function `alertas-vencimiento`, workflow diario `alertas-vencimiento.yml`, notificacion y correo a la administracion (`00138`) | #151, #160, #166, #167, #755, #838 | `CP-RF05-01` a `CP-RF05-12` | **Se verifica en produccion**: la logica, la notificacion y el correo estan probados; la corrida diaria se activa al salir a produccion (#252) |
| 20 | No permitir entregar medicamentos vencidos | Se bloquea en el cliente, en la receta y al aprobar la salida, incluida la autoaprobacion | #146, #157, #164 | `CP-RF03-01` a `CP-RF03-04` | **Cumple** |

### Jornadas y personal

| RF | Requerimiento | Donde esta | Issues | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| 21 | Registrar jornadas con nombre, fecha, ubicacion y responsable | Web: `ModalJornada.jsx` (comunidad con departamento y municipio). Codigo de jornada generado por la base | #169, #170, #178, #179 | `ModalJornada.test.jsx` | **Cumple** |
| 22 | Tablero Kanban con Planificada, En curso y Finalizada | Web: `JornadasPage.jsx`. Movil: `KanbanJornadasScreen.js`. Transiciones validadas por trigger | #171, #180, #183 | `JornadasPage.test.jsx`, `useJornadasKanban.test.js` | **Cumple** |
| 23 | Asignar medicos y voluntarios a cada jornada | Web: `ModalAsignarPersonal.jsx` en el detalle, con aviso de choque de horario | #174, #182 | `ModalAsignarPersonal.test.jsx` | **Cumple** |
| 24 | Consultas solo durante jornadas activas | La base rechaza una atencion o consulta fuera de una jornada en curso (`00055`, politica de consultas). Movil: seleccion de jornada activa | #172, #173, #186, #187 | `CP-RF02-02`; `cola_de_jornada.sql` | **Cumple** |
| 25 | Registrar y administrar la informacion de los voluntarios | Web: Colaboradores (datos, especialidades, historial de jornadas) | #105, #175, #184 | `ColaboradoresPage.test.jsx` | **Cumple** |
| 26 | Asignar horarios y responsabilidades a los voluntarios | `jornada_personal` (hora de inicio y fin, responsabilidad, asistencia). Web: `ModalEdicionTurno.jsx`. Movil: `JornadasAsignadasScreen.js` | #176, #185, #188 | `ModalEdicionTurno.test.jsx` | **Cumple** |

### Donaciones y proyectos

| RF | Requerimiento | Donde esta | Issues | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| 27 | Registrar donaciones con donante, tipo, fecha y recursos | Web: `RegistroDonacionPage.jsx`, `DonantesPage.jsx`. Constancia imprimible | #189, #190, #191, #197, #199 | `politicas_rls_donaciones.sql`; `useRegistroDonacion.test.js`, `registro.api.test.js` | **Cumple** |
| 28 | Consultar el historial de donaciones | Web: `HistorialDonacionesPage.jsx`, con filtros y totales. Movil: consulta | #193, #198 | `HistorialDonacionesPage.test.jsx` | **Cumple** |
| 29 | Registrar proyectos sociales | Web: `ProyectosSocialesPage.jsx`, `ModalProyecto.jsx`. Movil: `ProyectosScreen.js` | #194, #200 | `proyecto_personal.sql`; `useProyectosSociales.test.js` | **Cumple** |
| 30 | Administrar y dar seguimiento al avance de los proyectos | Web: `SeguimientoProyectoPage.jsx` (avance, bitacora, hitos, historial y cambio de estado), equipo e insumos en el detalle | #195, #201, #888 | `useSeguimientoProyecto.test.js`, `avance.api.test.js` | **Cumple** |

### Reportes

| RF | Requerimiento | Donde esta | Issues | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| 31 | Pacientes atendidos por jornada, comunidad y fecha | Web: `ReportePacientesPage.jsx` (`fn_reporte_pacientes_atendidos`), CSV y PDF | #202, #208, #211 | `CP-RF07-04` | **Cumple** |
| 32 | Inventario actual de medicamentos | Web: `ReporteInventarioPage.jsx`, con valorizacion | #203, #212 | `CP-RF03-07`, `CP-RF07-06` | **Cumple** |
| 33 | Medicamentos proximos a vencer | Web: `ReportesPage.jsx` (vencimientos), CSV y PDF | #204, #213 | `CP-RF05-06` | **Cumple** |
| 34 | Indicadores de impacto: pacientes, comunidades, tratamientos y medicamentos | Web: `DashboardMetricasPage.jsx` con los cuatro indicadores y consultas realizadas, grafica y comparacion; reporte por jornada (`fn_reporte_jornada`) | #205, #209, #214, #215 | `CP-RF07-01` a `CP-RF07-06` | **Cumple** |

## Requerimientos no funcionales

| RNF | Requerimiento | Como se atiende | Issues | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Interfaz intuitiva, limpia y facil de navegar | Un solo catalogo de componentes para web y movil, tokens de diseno, menu por rol con solo lo que cada quien usa | #100, #865, #886, #888 | `CP-RNF01-01` | **Se verifica en pruebas**: sesion de usabilidad con el personal (#758) |
| 2 | Registro de pacientes y consultas agil en movil | Registro por pasos, busqueda con retardo, signos opcionales dentro de la consulta | #109, #133, #134, #840 | `CP-RNF02-01`. La prueba de carga da 5.8 ms por registro en local, que no mide a una persona | **Se verifica en pruebas**: cronometrar una jornada real (#758) |
| 3 | Formularios fieles a la ficha clinica fisica | El alta de paciente y la consulta siguen la ficha (issue #134) | #119, #126, #134 | `CP-RNF03-01`: comparacion con la ficha fisica hecha por la organizacion el 27 de septiembre de 2026 | **Cumple** |
| 4 | Dashboard web con graficas de impacto | `DashboardMetricasPage.jsx`: tarjetas con meta y grafica de barras accesible | #160, #209, #214 | `CP-RNF04-01` | **Cumple** |
| 5 | 50 pacientes por jornada sin degradacion | Prueba de carga: registro, triaje, consulta y receta de 50 pacientes, sin crecimiento de tiempos | #774 | `CP-RNF05-01`; [PLAN-DE-PRUEBAS.md](./PLAN-DE-PRUEBAS.md), seccion de carga | **Cumple** |
| 6 | Crecimiento de la base sin degradacion severa | Paginacion en todos los listados largos, lectura completa de mas de 1000 filas, indices en las busquedas | #115, #759 | `CP-RNF06-01` | **Se verifica en pruebas**: prueba con volumen de varios anos de jornadas (#758) |
| 7 | Confidencialidad e integridad de los datos | RLS en todas las tablas, `anon` sin privilegios, bitacora de auditoria de todas las tablas de negocio (`00152`), monitoreo de errores que no envia datos de pacientes | #52, #529, #643, #762 | `CP-RNF07-01`; 52 archivos pgTAP | **Cumple** |
| 8 | Comunicacion cifrada por HTTPS | Supabase y Vercel solo sirven por HTTPS; las URL configuradas son `https://` | #252 | `CP-RNF08-01` | **Se verifica en produccion**: revisar la web desplegada (#252) |
| 9 | Diagnosticos e historiales restringidos a medicos, administracion "y segun se defina" | Por RLS. La organizacion definio (issue #886) que el colaborador tambien lee el historial completo, sin escribir consultas ni recetas; los roles consultivos no lo leen salvo que la administradora les abra Pacientes | #52, #121, #125, #886 | `CP-RNF09-01`; `acceso_a_modulos_por_rol.sql` | **Cumple**, con la definicion de la organizacion documentada en [PERMISOS.md](./PERMISOS.md) |
| 10 | Autenticacion con credenciales seguras | Supabase Auth (contrasenas con hash bcrypt), registro publico cerrado, politica de contrasena en el cliente, expiracion de sesion y cierre por inactividad | #96, #230, #508 | `CP-RNF10-01`, `CP-RNF10-02`; `registro_publico_cerrado.sql` | **Se verifica en pruebas** (#758); la longitud minima del servidor se fija en el Dashboard de produccion (#252) |
| 11 | Confiable, sin errores ni caidas en jornada | Errores centralizados y limpios de datos, aviso sin conexion, pruebas e2e de los flujos de la jornada en cada PR, monitoreo listo para Sentry | #762, #759 | `CP-RNF11-01` | **Cumple**. El DSN de Sentry se carga con la #252 |
| 12 | Respaldo de la base central | Procedimiento de respaldo y restauracion ensayado en local; en produccion, un workflow de GitHub Actions que saca el respaldo y lo guarda en Google Drive | #762, #879, #252 | `CP-RNF12-01` | **Se verifica en produccion**: se implementa en la #252 |
| 13 | Codigo con buenas practicas, modular y documentado | Monorepo con logica compartida, reglas de arquitectura verificadas en CI, JSDoc en todo lo exportado, documentacion en `docs/` | todas | `CP-RNF13-01`; `verificar:contratos`, `verificar:jsdoc`, `verificar:shared-esquema` | **Cumple** |
| 14 | Herramientas abiertas y capas gratuitas | Supabase, Vercel, Expo, GitHub y Sentry en capa gratuita; costos del siguiente escalon documentados | #216, #761 | `CP-RNF14-01`; [COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md) | **Cumple** |
| 15 | Web responsiva y compatible con Chrome, Firefox y Safari | Tablas que pasan a fichas en pantalla angosta, sin desplazamiento horizontal | #865 | `CP-RNF15-01` | **Se verifica en pruebas**: recorrer la matriz de navegadores y anchos (#758) |

## Decisiones de la organizacion

### RF-1: eliminar un usuario es desactivarlo

Un usuario no se borra: se **desactiva**. Desactivar le retira todo acceso de verdad
(`rol_actual()` devuelve NULL, `CP-RF01-02`), y la cuenta y su perfil siguen existiendo. Borrarla
dejaria sin autor todo lo que registro (`registrado_por`, `aprobado_por`, el `medico_id` de sus
consultas y recetas, la bitacora), y en los registros clinicos eso no es aceptable. La organizacion
lo acepto asi el 27 de septiembre de 2026.

### RNF-3: formularios fieles a la ficha fisica

La organizacion comparo los formularios de alta de paciente y de consulta con la ficha clinica en
papel y los dio por buenos el 27 de septiembre de 2026.

### RNF-12: respaldos con GitHub Actions a Google Drive

El plan Free de Supabase no incluye respaldos, y no se contrata Pro. El respaldo sera un workflow
de GitHub Actions que saca el volcado de la base de produccion y lo guarda en Google Drive, en la
cuenta dedicada al proyecto que se va a crear. El procedimiento de volcado y restauracion ya esta
ensayado en local ([CI-CD.md](./CI-CD.md#respaldos-y-restauracion)); el plan para produccion esta
en [CI-CD.md](./CI-CD.md#plan-para-produccion-se-implementa-en-la-252).

## Lo que queda pendiente

Nada de esto es codigo pendiente de la #253: cada cosa esta anotada en la issue que la va a
ejecutar.

### En la salida a produccion (#252)

| Que | Requerimiento |
| --- | --- |
| Activar la corrida diaria de alertas de vencimiento (secret de la llave de servicio y el workflow en `main`) | RF-19 |
| Crear la cuenta dedicada del proyecto en Google Drive y el workflow que guarda ahi el respaldo; hacer la primera restauracion real | RNF-12 |
| Abrir la web desplegada por `http://` y comprobar que redirige a `https://` | RNF-8 |
| Fijar la longitud minima de contrasena en el Dashboard de produccion | RNF-10 |
| Cargar el DSN de Sentry | RNF-11 |
| Recorrer los requerimientos funcionando en produccion | Todos |

### En las pruebas (#758)

Si alguna de estas pruebas encuentra un error, se corrige como parte de la misma issue.

| Que | Requerimiento |
| --- | --- |
| Sesion de usabilidad: el personal completa las tareas de HU01 a HU07 sin ayuda | RNF-1 |
| Cronometrar el registro de un paciente y su consulta en una jornada real | RNF-2 |
| Prueba con volumen de varios anos de jornadas | RNF-6 |
| Politica de contrasena y restablecimiento contra el servidor | RNF-10 |
| Recorrer las pantallas principales en Chrome, Firefox y Safari a 1366, 768 y 375 px | RNF-15 |

## Definicion de terminado de la #253

| Criterio | Estado |
| --- | --- |
| Tabla que mapea cada RF y RNF con sus issues y su estado | **Hecho**: este documento |
| Los requerimientos no cubiertos se declaran con su justificacion | **Hecho**: "Decisiones de la organizacion" y "Lo que queda pendiente" |
| La organizacion revisa y valida el resultado | **Hecho** el 27 de septiembre de 2026 |
| El documento queda en `docs/` | **Hecho** |
| Cada requerimiento cubierto se verifica funcionando en produccion | **Pasa a la #252**, que es donde existe produccion |
