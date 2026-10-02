# Pantallas y los datos que usan

> **Documento generado.** No se edita a mano: sale de `npm run docs:pantallas` (`scripts/generar-mapa-de-pantallas.mjs`), que lee las rutas de las dos apps y sigue, funcion por funcion, lo que cada pantalla llama hasta llegar a Supabase.

Dice que tablas y vistas (`.from`), funciones de la base (`.rpc`), Edge Functions (`functions.invoke`) y buckets de Storage **puede** usar cada pantalla, incluidas las ramas que solo corren para un rol. Que filas ve cada rol lo decide RLS: ver [PERMISOS.md](PERMISOS.md). Las tablas estan descritas en [DICCIONARIO-DE-DATOS.md](DICCIONARIO-DE-DATOS.md).

## Resumen

| App | Pantallas (rutas) |
| --- | --- |
| Web (`apps/web`) | 36 |
| Movil (`apps/mobile`) | 29 |

Una ruta con parametro (`/pacientes/:id`) cuenta una vez. Los dialogos (modales) no son pantallas: lo que consultan se suma a la pantalla que los abre.

## Web

| Ruta | Modulo | Pantalla | Tablas y vistas | Funciones de la base | Edge Functions y Storage |
| --- | --- | --- | --- | --- | --- |
| `/login` | publica | `apps/web/src/pages/LoginPage.jsx` | `perfiles` | — | — |
| `/restablecer-contrasena` | publica | `apps/web/src/pages/RestablecerContrasenaPage.jsx` | — | — | — |
| `/nueva-contrasena` | publica | `apps/web/src/pages/NuevaContrasenaPage.jsx` | `perfiles` | — | — |
| `/` | `inicio` | `apps/web/src/pages/HomePage.jsx` | `jornadas` | — | — |
| `/pacientes` | `pacientes` | `apps/web/src/pages/PacientesPage.jsx` | `comunidades`, `condiciones_cronicas`, `departamentos`, `expedientes`, `idiomas`, `municipios`, `pacientes` | `fn_buscar_pacientes`, `fn_registrar_paciente` | — |
| `/pacientes/cronicos` | `pacientes` | `apps/web/src/pages/PacientesCronicosPage.jsx` | `comunidades`, `condiciones_cronicas`, `padecimientos_cronicos` | — | — |
| `/pacientes/diagnosticos` | `pacientes` | `apps/web/src/pages/CatalogoDiagnosticosPage.jsx` | `diagnosticos` | — | — |
| `/pacientes/condiciones` | `pacientes` | `apps/web/src/pages/CatalogoCondicionesPage.jsx` | `condiciones_cronicas` | — | — |
| `/pacientes/comunidades` | `pacientes` | `apps/web/src/pages/CatalogoComunidadesPage.jsx` | `comunidades`, `departamentos`, `municipios` | — | — |
| `/pacientes/duplicados` | `pacientes` | `apps/web/src/pages/PosiblesDuplicadosPage.jsx` | `expedientes`, `pacientes`, `padecimientos_cronicos` | `fn_detectar_pacientes_duplicados`, `fn_fusionar_pacientes` | — |
| `/pacientes/:id` | `pacientes` | `apps/web/src/pages/FichaPacientePage.jsx` | `atenciones`, `bodegas`, `comunidades`, `condiciones_cronicas`, `consulta_diagnostico`, `consultas`, `departamentos`, `diagnosticos`, `expedientes`, `fusiones_pacientes`, `idiomas`, `jornadas`, `medicamento_principio`, `medicamentos`, `municipios`, `pacientes`, `padecimientos_cronicos`, `principios_activos`, `recetas`, `triajes`, `vista_lotes_disponibles` | `fn_bodega_de_entrega_de_consulta`, `fn_buscar_pacientes`, `fn_existencias_disponibles`, `fn_generar_receta` | — |
| `/donaciones` | `donaciones` | `apps/web/src/pages/DonacionesPage.jsx` | `donaciones` | — | — |
| `/donaciones/registro` | `donaciones` | `RegistroDonacionConSesion` | `bodegas`, `donacion_detalle`, `donantes`, `jornadas`, `lotes`, `medicamento_principio`, `medicamentos`, `movimientos_inventario`, `presentaciones`, `principios_activos`, `proveedores`, `proyectos` | `existencias_totales_por_bodega`, `fn_registrar_donacion`, `fn_registrar_medicamento` | — |
| `/donaciones/historial` | `donaciones` | `HistorialDonacionesConSesion` | `donaciones`, `proyectos` | — | — |
| `/donaciones/:id/constancia` | `donaciones` | `apps/web/src/pages/ConstanciaDonacionPage.jsx` | `donaciones` | — | — |
| `/donantes` | `donaciones` | `DonantesConSesion` | `donaciones`, `donantes` | — | — |
| `/inventario` | `inventario` | `apps/web/src/pages/InventarioPage.jsx` | `alertas_caducidad`, `bodegas`, `configuracion_alertas_caducidad`, `existencias`, `lotes`, `medicamento_principio`, `medicamentos`, `movimientos_inventario`, `presentaciones`, `principios_activos`, `proveedores`, `vista_lotes_disponibles` | `existencias_totales_por_bodega`, `fn_atender_alerta_caducidad`, `fn_cambiar_principio_de_medicamento`, `fn_medicamento_tiene_existencias`, `fn_registrar_medicamento`, `fn_sincronizar_alertas_caducidad`, `fn_valor_de_inventario_disponible` | — |
| `/inventario/avisos-vencimiento` | `inventario` | `apps/web/src/pages/AvisosVencimientoPage.jsx` | `configuracion_alertas_caducidad` | `fn_sincronizar_alertas_caducidad` | — |
| `/presupuestos` | `presupuestos` | `apps/web/src/pages/PresupuestosPage.jsx` | `categorias_de_gasto`, `gastos`, `jornadas`, `movimientos_de_caja`, `nombres_de_perfiles`, `proyectos` | `presupuestos_de_jornadas`, `presupuestos_de_proyectos`, `saldo_de_caja` | — |
| `/proyectos` | `proyectos` | `ProyectosSocialesConSesion` | `existencias`, `gastos`, `jornada_insumos`, `jornadas`, `perfil_especialidad`, `perfiles`, `perfiles_directorio`, `proyecto_insumos`, `proyecto_personal`, `proyectos` | `equipo_de_proyecto`, `fn_pasar_insumo_de_proyecto_a_jornada` | — |
| `/proyectos/sociales` | `proyectos` | `ProyectosSocialesConSesion` | `existencias`, `gastos`, `jornada_insumos`, `jornadas`, `perfil_especialidad`, `perfiles`, `perfiles_directorio`, `proyecto_insumos`, `proyecto_personal`, `proyectos` | `equipo_de_proyecto`, `fn_pasar_insumo_de_proyecto_a_jornada` | — |
| `/proyectos/:id/seguimiento` | `proyectos` | `apps/web/src/pages/SeguimientoProyectoPage.jsx` | `jornadas`, `proyecto_estado_historial`, `proyecto_hitos`, `proyecto_seguimiento`, `proyectos` | — | — |
| `/reportes` | `reportes` | `apps/web/src/pages/ReportesPage.jsx` | `bodegas`, `comunidades`, `existencias`, `jornadas`, `medicamento_principio`, `medicamentos`, `principios_activos`, `proyectos`, `vista_reporte_impacto_por_comunidad` | `existencias_totales_por_bodega`, `fn_reporte_pacientes_atendidos`, `fn_valor_de_inventario_disponible` | — |
| `/reportes/dashboard` | `reportes` | `apps/web/src/pages/ReportesPage.jsx` | `bodegas`, `comunidades`, `existencias`, `jornadas`, `medicamento_principio`, `medicamentos`, `principios_activos`, `proyectos`, `vista_reporte_impacto_por_comunidad` | `existencias_totales_por_bodega`, `fn_reporte_pacientes_atendidos`, `fn_valor_de_inventario_disponible` | — |
| `/reportes/medicamentos-por-vencer` | `reportes` | `apps/web/src/pages/ReportesPage.jsx` | `bodegas`, `comunidades`, `existencias`, `jornadas`, `medicamento_principio`, `medicamentos`, `principios_activos`, `proyectos`, `vista_reporte_impacto_por_comunidad` | `existencias_totales_por_bodega`, `fn_reporte_pacientes_atendidos`, `fn_valor_de_inventario_disponible` | — |
| `/reportes/pacientes-atendidos` | `reportes` | `apps/web/src/pages/ReportesPage.jsx` | `bodegas`, `comunidades`, `existencias`, `jornadas`, `medicamento_principio`, `medicamentos`, `principios_activos`, `proyectos`, `vista_reporte_impacto_por_comunidad` | `existencias_totales_por_bodega`, `fn_reporte_pacientes_atendidos`, `fn_valor_de_inventario_disponible` | — |
| `/reportes/inventario-actual` | `reportes` | `apps/web/src/pages/ReportesPage.jsx` | `bodegas`, `comunidades`, `existencias`, `jornadas`, `medicamento_principio`, `medicamentos`, `principios_activos`, `proyectos`, `vista_reporte_impacto_por_comunidad` | `existencias_totales_por_bodega`, `fn_reporte_pacientes_atendidos`, `fn_valor_de_inventario_disponible` | — |
| `/reportes/jornada/:id` | `reportes` | `apps/web/src/pages/ReporteJornada.jsx` | — | `fn_reporte_jornada` | — |
| `/jornadas` | `jornadas` | `apps/web/src/pages/JornadasPage.jsx` | `bodegas`, `comunidades`, `departamentos`, `jornada_personal`, `jornadas`, `municipios`, `perfil_especialidad`, `perfiles`, `perfiles_directorio`, `proyectos`, `vista_reporte_impacto` | `existencias_totales_por_bodega` | — |
| `/jornadas/:id` | `jornadas` | `apps/web/src/pages/DetalleJornadaPage.jsx` | `atenciones`, `bodegas`, `categorias_de_gasto`, `comunidades`, `consultas`, `departamentos`, `donaciones`, `existencias`, `fuentes_de_presupuesto`, `gastos`, `jornada_estado_historial`, `jornada_insumos`, `jornada_personal`, `jornada_presupuesto_origen`, `jornadas`, `medicamento_principio`, `medicamentos`, `movimientos_inventario`, `municipios`, `nombres_de_perfiles`, `perfil_especialidad`, `perfiles`, `perfiles_directorio`, `principios_activos`, `proyectos`, `recetas`, `vista_reporte_impacto` | `existencias_totales_por_bodega`, `fn_contar_atenciones_incompletas`, `fn_liquidar_sobrante_de_jornada`, `personal_registro_atenciones`, `saldo_de_caja`, `sobrante_de_jornada` | — |
| `/colaboradores` | `colaboradores` | `apps/web/src/pages/ColaboradoresPage.jsx` | `jornada_personal`, `jornadas`, `perfil_especialidad`, `perfiles`, `perfiles_directorio`, `permisos`, `rol_permiso`, `usuario_permiso` | `fn_atenciones_de_persona_por_jornada` | `invitar-usuario` |
| `/matriz-permisos` | `matriz-permisos` | `apps/web/src/pages/MatrizPermisosPorRolPage.jsx` | `rol_modulo` | — | — |
| `/bitacora-auditoria` | `bitacora-auditoria` | `apps/web/src/pages/BitacoraAuditoriaPage.jsx` | `eventos_auditoria`, `notificaciones`, `perfil_especialidad`, `perfiles`, `perfiles_directorio` | — | — |
| `/perfil` | publica | `apps/web/src/pages/PerfilPage.jsx` | `notificaciones`, `perfil_especialidad`, `perfiles` | — | — |
| `/notificaciones` | publica | `apps/web/src/pages/NotificacionesPage.jsx` | `notificaciones` | — | — |
| `*` | publica | `apps/web/src/pages/NotFoundPage.jsx` | — | — | — |

## Movil

| Pantalla (ruta) | Pestana y guarda | Archivo | Tablas y vistas | Funciones de la base | Edge Functions y Storage |
| --- | --- | --- | --- | --- | --- |
| Inicio (`InicioPanel`) | inicio, modulo `inicio` | `apps/mobile/src/screens/InicioScreen.js` | `jornadas` | — | — |
| Pacientes (`BusquedaPaciente`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/BusquedaPacienteScreen.js` | `comunidades`, `condiciones_cronicas`, `expedientes`, `pacientes` | `fn_buscar_pacientes` | — |
| Ficha del paciente (`FichaPaciente`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/FichaPacienteScreen.js` | `atenciones`, `comunidades`, `condiciones_cronicas`, `departamentos`, `expedientes`, `idiomas`, `municipios`, `pacientes`, `padecimientos_cronicos`, `recetas` | — | — |
| Registro de paciente (`RegistroPaciente`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/RegistroPacienteScreen.js` | `comunidades`, `departamentos`, `expedientes`, `idiomas`, `municipios`, `pacientes` | `fn_buscar_pacientes`, `fn_registrar_paciente` | — |
| Historial (`HistorialPaciente`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/HistorialPacienteScreen.js` | `atenciones`, `recetas` | — | — |
| Consulta (`Consulta`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/ConsultaScreen.js` | `atenciones`, `consulta_diagnostico`, `consultas`, `diagnosticos`, `expedientes`, `jornadas`, `pacientes`, `padecimientos_cronicos`, `triajes` | — | — |
| Receta (`Receta`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/RecetaScreen.js` | `atenciones`, `bodegas`, `expedientes`, `medicamento_principio`, `medicamentos`, `pacientes`, `padecimientos_cronicos`, `principios_activos`, `recetas`, `vista_lotes_disponibles` | `fn_bodega_de_entrega_de_consulta`, `fn_existencias_disponibles`, `fn_generar_receta` | — |
| Entrega de medicamentos (`EntregaMedicamentos`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/EntregaMedicamentosScreen.js` | `existencias`, `recetas` | `fn_ajustar_entrega_receta` | — |
| Pacientes cronicos (`PacientesCronicos`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/PacientesCronicosScreen.js` | `comunidades`, `condiciones_cronicas`, `padecimientos_cronicos` | — | — |
| Condiciones cronicas (`CatalogoCondiciones`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/CatalogoCondicionesScreen.js` | `condiciones_cronicas` | — | — |
| Diagnosticos (`CatalogoDiagnosticos`) | pacientes, modulo `pacientes` | `apps/mobile/src/screens/CatalogoDiagnosticosScreen.js` | `diagnosticos` | — | — |
| Jornadas (`SeleccionJornada`) | jornadas, modulo `jornadas` | `apps/mobile/src/screens/SeleccionJornadaScreen.js` | — | — | — |
| Jornada en curso (`JornadaEnCurso`) | jornadas, modulo `jornadas` | `apps/mobile/src/screens/JornadaEnCursoScreen.js` | `atenciones`, `consultas`, `recetas` | `fn_reporte_jornada` | — |
| Mis jornadas (`JornadasAsignadas`) | jornadas, modulo `jornadas` | `apps/mobile/src/screens/JornadasAsignadasScreen.js` | `jornada_personal`, `jornadas` | `fn_atenciones_de_persona_por_jornada` | — |
| Tablero de Jornadas (`KanbanJornadas`) | jornadas, modulo `jornadas` | `apps/mobile/src/screens/KanbanJornadasScreen.js` | `jornadas`, `vista_reporte_impacto` | — | — |
| Proyectos (`Proyectos`) | jornadas, modulo `proyectos` | `apps/mobile/src/screens/ProyectosScreen.js` | `existencias`, `gastos`, `jornada_insumos`, `jornadas`, `perfil_especialidad`, `perfiles`, `perfiles_directorio`, `proyecto_insumos`, `proyecto_personal`, `proyectos` | `equipo_de_proyecto`, `fn_pasar_insumo_de_proyecto_a_jornada` | — |
| Inventario (`Stock`) | inventario, modulo `inventario` | `apps/mobile/src/screens/StockScreen.js` | `bodegas`, `configuracion_alertas_caducidad`, `medicamento_principio`, `medicamentos`, `principios_activos`, `vista_lotes_disponibles` | `existencias_totales_por_bodega` | — |
| Registrar ingreso (`RegistroIngreso`) | inventario, por roles | `apps/mobile/src/screens/RegistroIngresoScreen.js` | `bodegas`, `lotes`, `medicamento_principio`, `medicamentos`, `movimientos_inventario`, `presentaciones`, `principios_activos`, `proveedores` | `existencias_totales_por_bodega`, `fn_registrar_medicamento` | — |
| Existencias (`ExistenciasInventario`) | inventario, modulo `inventario` | `apps/mobile/src/screens/ExistenciasInventarioScreen.js` | `bodegas`, `configuracion_alertas_caducidad`, `lotes`, `vista_lotes_disponibles` | `existencias_totales_por_bodega` | — |
| Resumen y alertas (`ResumenAlertasInventario`) | inventario, modulo `inventario` | `apps/mobile/src/screens/InventarioResumenAlertasScreen.js` | `alertas_caducidad`, `bodegas`, `configuracion_alertas_caducidad`, `lotes`, `medicamento_principio`, `medicamentos`, `principios_activos` | `existencias_totales_por_bodega`, `fn_atender_alerta_caducidad`, `fn_sincronizar_alertas_caducidad` | — |
| Mis movimientos (`MisMovimientos`) | inventario, por roles | `apps/mobile/src/screens/MisMovimientosScreen.js` | `movimientos_inventario` | — | — |
| Detalle del lote (`DetalleLote`) | inventario, modulo `inventario` | `apps/mobile/src/screens/DetalleLoteScreen.js` | `lotes`, `movimientos_inventario` | — | — |
| Principios activos (`PrincipiosActivos`) | inventario, modulo `inventario` | `apps/mobile/src/screens/PrincipiosActivosScreen.js` | `medicamento_principio`, `principios_activos` | — | — |
| Registrar salida (`RegistroSalida`) | inventario, por roles | `apps/mobile/src/screens/RegistroSalidaScreen.js` | `existencias`, `lotes`, `medicamento_principio`, `medicamentos`, `movimientos_inventario`, `principios_activos`, `vista_lotes_disponibles` | — | — |
| Por aprobar (`ValidacionMovimientos`) | inventario, por roles | `apps/mobile/src/screens/ValidacionMovimientosScreen.js` | `existencias`, `movimientos_inventario` | — | — |
| Notificaciones (`Notificaciones`) | del_root, por roles | `apps/mobile/src/screens/NotificacionesScreen.js` | `notificaciones` | — | — |
| `AccesoDenegado` | root | `apps/mobile/src/screens/AccesoDenegadoScreen.js` | — | — | — |
| `RestablecerContrasena` | auth | `apps/mobile/src/screens/RestablecerContrasenaScreen.js` | — | — | — |
| `Login` | auth | `apps/mobile/src/screens/LoginScreen.js` | `perfiles` | — | — |

## Que pantallas usan cada tabla, vista o funcion

| Objeto de la base | Web | Movil |
| --- | --- | --- |
| `alertas_caducidad` | `/inventario` | `ResumenAlertasInventario` |
| `atenciones` | `/jornadas/:id`, `/pacientes/:id` | `Consulta`, `FichaPaciente`, `HistorialPaciente`, `JornadaEnCurso`, `Receta` |
| `bodegas` | `/donaciones/registro`, `/inventario`, `/jornadas`, `/jornadas/:id`, `/pacientes/:id`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `ExistenciasInventario`, `Receta`, `RegistroIngreso`, `ResumenAlertasInventario`, `Stock` |
| `categorias_de_gasto` | `/jornadas/:id`, `/presupuestos` | — |
| `comunidades` | `/jornadas`, `/jornadas/:id`, `/pacientes`, `/pacientes/:id`, `/pacientes/comunidades`, `/pacientes/cronicos`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `BusquedaPaciente`, `FichaPaciente`, `PacientesCronicos`, `RegistroPaciente` |
| `condiciones_cronicas` | `/pacientes`, `/pacientes/:id`, `/pacientes/condiciones`, `/pacientes/cronicos` | `BusquedaPaciente`, `CatalogoCondiciones`, `FichaPaciente`, `PacientesCronicos` |
| `configuracion_alertas_caducidad` | `/inventario`, `/inventario/avisos-vencimiento` | `ExistenciasInventario`, `ResumenAlertasInventario`, `Stock` |
| `consulta_diagnostico` | `/pacientes/:id` | `Consulta` |
| `consultas` | `/jornadas/:id`, `/pacientes/:id` | `Consulta`, `JornadaEnCurso` |
| `departamentos` | `/jornadas`, `/jornadas/:id`, `/pacientes`, `/pacientes/:id`, `/pacientes/comunidades` | `FichaPaciente`, `RegistroPaciente` |
| `diagnosticos` | `/pacientes/:id`, `/pacientes/diagnosticos` | `CatalogoDiagnosticos`, `Consulta` |
| `donacion_detalle` | `/donaciones/registro` | — |
| `donaciones` | `/donaciones`, `/donaciones/:id/constancia`, `/donaciones/historial`, `/donantes`, `/jornadas/:id` | — |
| `donantes` | `/donaciones/registro`, `/donantes` | — |
| `equipo_de_proyecto` | `/proyectos`, `/proyectos/sociales` | `Proyectos` |
| `eventos_auditoria` | `/bitacora-auditoria` | — |
| `existencias` | `/inventario`, `/jornadas/:id`, `/proyectos`, `/proyectos/sociales`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `EntregaMedicamentos`, `Proyectos`, `RegistroSalida`, `ValidacionMovimientos` |
| `existencias_totales_por_bodega` | `/donaciones/registro`, `/inventario`, `/jornadas`, `/jornadas/:id`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `ExistenciasInventario`, `RegistroIngreso`, `ResumenAlertasInventario`, `Stock` |
| `expedientes` | `/pacientes`, `/pacientes/:id`, `/pacientes/duplicados` | `BusquedaPaciente`, `Consulta`, `FichaPaciente`, `Receta`, `RegistroPaciente` |
| `fn_ajustar_entrega_receta` | — | `EntregaMedicamentos` |
| `fn_atenciones_de_persona_por_jornada` | `/colaboradores` | `JornadasAsignadas` |
| `fn_atender_alerta_caducidad` | `/inventario` | `ResumenAlertasInventario` |
| `fn_bodega_de_entrega_de_consulta` | `/pacientes/:id` | `Receta` |
| `fn_buscar_pacientes` | `/pacientes`, `/pacientes/:id` | `BusquedaPaciente`, `RegistroPaciente` |
| `fn_cambiar_principio_de_medicamento` | `/inventario` | — |
| `fn_contar_atenciones_incompletas` | `/jornadas/:id` | — |
| `fn_detectar_pacientes_duplicados` | `/pacientes/duplicados` | — |
| `fn_existencias_disponibles` | `/pacientes/:id` | `Receta` |
| `fn_fusionar_pacientes` | `/pacientes/duplicados` | — |
| `fn_generar_receta` | `/pacientes/:id` | `Receta` |
| `fn_liquidar_sobrante_de_jornada` | `/jornadas/:id` | — |
| `fn_medicamento_tiene_existencias` | `/inventario` | — |
| `fn_pasar_insumo_de_proyecto_a_jornada` | `/proyectos`, `/proyectos/sociales` | `Proyectos` |
| `fn_registrar_donacion` | `/donaciones/registro` | — |
| `fn_registrar_medicamento` | `/donaciones/registro`, `/inventario` | `RegistroIngreso` |
| `fn_registrar_paciente` | `/pacientes` | `RegistroPaciente` |
| `fn_reporte_jornada` | `/reportes/jornada/:id` | `JornadaEnCurso` |
| `fn_reporte_pacientes_atendidos` | `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | — |
| `fn_sincronizar_alertas_caducidad` | `/inventario`, `/inventario/avisos-vencimiento` | `ResumenAlertasInventario` |
| `fn_valor_de_inventario_disponible` | `/inventario`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | — |
| `fuentes_de_presupuesto` | `/jornadas/:id` | — |
| `fusiones_pacientes` | `/pacientes/:id` | — |
| `gastos` | `/jornadas/:id`, `/presupuestos`, `/proyectos`, `/proyectos/sociales` | `Proyectos` |
| `idiomas` | `/pacientes`, `/pacientes/:id` | `FichaPaciente`, `RegistroPaciente` |
| `jornada_estado_historial` | `/jornadas/:id` | — |
| `jornada_insumos` | `/jornadas/:id`, `/proyectos`, `/proyectos/sociales` | `Proyectos` |
| `jornada_personal` | `/colaboradores`, `/jornadas`, `/jornadas/:id` | `JornadasAsignadas` |
| `jornada_presupuesto_origen` | `/jornadas/:id` | — |
| `jornadas` | `/`, `/colaboradores`, `/donaciones/registro`, `/jornadas`, `/jornadas/:id`, `/pacientes/:id`, `/presupuestos`, `/proyectos`, `/proyectos/:id/seguimiento`, `/proyectos/sociales`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `Consulta`, `InicioPanel`, `JornadasAsignadas`, `KanbanJornadas`, `Proyectos` |
| `lotes` | `/donaciones/registro`, `/inventario` | `DetalleLote`, `ExistenciasInventario`, `RegistroIngreso`, `RegistroSalida`, `ResumenAlertasInventario` |
| `medicamento_principio` | `/donaciones/registro`, `/inventario`, `/jornadas/:id`, `/pacientes/:id`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `PrincipiosActivos`, `Receta`, `RegistroIngreso`, `RegistroSalida`, `ResumenAlertasInventario`, `Stock` |
| `medicamentos` | `/donaciones/registro`, `/inventario`, `/jornadas/:id`, `/pacientes/:id`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `Receta`, `RegistroIngreso`, `RegistroSalida`, `ResumenAlertasInventario`, `Stock` |
| `movimientos_de_caja` | `/presupuestos` | — |
| `movimientos_inventario` | `/donaciones/registro`, `/inventario`, `/jornadas/:id` | `DetalleLote`, `MisMovimientos`, `RegistroIngreso`, `RegistroSalida`, `ValidacionMovimientos` |
| `municipios` | `/jornadas`, `/jornadas/:id`, `/pacientes`, `/pacientes/:id`, `/pacientes/comunidades` | `FichaPaciente`, `RegistroPaciente` |
| `nombres_de_perfiles` | `/jornadas/:id`, `/presupuestos` | — |
| `notificaciones` | `/bitacora-auditoria`, `/notificaciones`, `/perfil` | `Notificaciones` |
| `pacientes` | `/pacientes`, `/pacientes/:id`, `/pacientes/duplicados` | `BusquedaPaciente`, `Consulta`, `FichaPaciente`, `Receta`, `RegistroPaciente` |
| `padecimientos_cronicos` | `/pacientes/:id`, `/pacientes/cronicos`, `/pacientes/duplicados` | `Consulta`, `FichaPaciente`, `PacientesCronicos`, `Receta` |
| `perfil_especialidad` | `/bitacora-auditoria`, `/colaboradores`, `/jornadas`, `/jornadas/:id`, `/perfil`, `/proyectos`, `/proyectos/sociales` | `Proyectos` |
| `perfiles` | `/bitacora-auditoria`, `/colaboradores`, `/jornadas`, `/jornadas/:id`, `/login`, `/nueva-contrasena`, `/perfil`, `/proyectos`, `/proyectos/sociales` | `Login`, `Proyectos` |
| `perfiles_directorio` | `/bitacora-auditoria`, `/colaboradores`, `/jornadas`, `/jornadas/:id`, `/proyectos`, `/proyectos/sociales` | `Proyectos` |
| `permisos` | `/colaboradores` | — |
| `personal_registro_atenciones` | `/jornadas/:id` | — |
| `presentaciones` | `/donaciones/registro`, `/inventario` | `RegistroIngreso` |
| `presupuestos_de_jornadas` | `/presupuestos` | — |
| `presupuestos_de_proyectos` | `/presupuestos` | — |
| `principios_activos` | `/donaciones/registro`, `/inventario`, `/jornadas/:id`, `/pacientes/:id`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `PrincipiosActivos`, `Receta`, `RegistroIngreso`, `RegistroSalida`, `ResumenAlertasInventario`, `Stock` |
| `proveedores` | `/donaciones/registro`, `/inventario` | `RegistroIngreso` |
| `proyecto_estado_historial` | `/proyectos/:id/seguimiento` | — |
| `proyecto_hitos` | `/proyectos/:id/seguimiento` | — |
| `proyecto_insumos` | `/proyectos`, `/proyectos/sociales` | `Proyectos` |
| `proyecto_personal` | `/proyectos`, `/proyectos/sociales` | `Proyectos` |
| `proyecto_seguimiento` | `/proyectos/:id/seguimiento` | — |
| `proyectos` | `/donaciones/historial`, `/donaciones/registro`, `/jornadas`, `/jornadas/:id`, `/presupuestos`, `/proyectos`, `/proyectos/:id/seguimiento`, `/proyectos/sociales`, `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | `Proyectos` |
| `recetas` | `/jornadas/:id`, `/pacientes/:id` | `EntregaMedicamentos`, `FichaPaciente`, `HistorialPaciente`, `JornadaEnCurso`, `Receta` |
| `rol_modulo` | `/matriz-permisos` | — |
| `rol_permiso` | `/colaboradores` | — |
| `saldo_de_caja` | `/jornadas/:id`, `/presupuestos` | — |
| `sobrante_de_jornada` | `/jornadas/:id` | — |
| `triajes` | `/pacientes/:id` | `Consulta` |
| `usuario_permiso` | `/colaboradores` | — |
| `vista_lotes_disponibles` | `/inventario`, `/pacientes/:id` | `ExistenciasInventario`, `Receta`, `RegistroSalida`, `Stock` |
| `vista_reporte_impacto` | `/jornadas`, `/jornadas/:id` | `KanbanJornadas` |
| `vista_reporte_impacto_por_comunidad` | `/reportes`, `/reportes/dashboard`, `/reportes/inventario-actual`, `/reportes/medicamentos-por-vencer`, `/reportes/pacientes-atendidos` | — |

## Llamadas con nombre dinamico

Estas llamadas arman el nombre de la tabla o funcion en tiempo de ejecucion y el analisis no las puede resolver; lo que tocan hay que leerlo en el archivo:

- packages/shared/presupuestos/api.js, en consultar() (.rpc)

