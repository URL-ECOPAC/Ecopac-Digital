# Casos de prueba vinculados a requerimientos

Cada caso de prueba del sistema, trazado contra el requerimiento que cubre. Complementa
[PLAN-DE-PRUEBAS.md](./PLAN-DE-PRUEBAS.md), que explica que tipo de prueba es cada uno, con que
herramienta se ejecuta y cual es su criterio de aprobacion (issue #758).

## De donde salen los requerimientos

La fuente es la **Matriz de Trazabilidad de Requerimientos** del Entregable Semana 5 (paginas
14-17), que define **7 requerimientos funcionales** con su historia de usuario, y la lista de
**15 requerimientos no funcionales** del Entregable Semana 3-4 (paginas 30-31). Los dos PDF estan en
`docs/entregables/`.

**Cuidado con la numeracion de las issues.** Las issues del tablero usan otra numeracion, la de un
backlog mas granular que llega hasta `RF-34`. No coincide con la de la matriz: la #126, por
ejemplo, es `RF-04` en el backlog y `RF-02 / HU04` en la matriz oficial. De las 155 issues que
declaran un requerimiento, **solo 51 citan tambien la matriz oficial**; las otras 104 solo tienen
el numero del backlog. Este documento usa siempre la numeracion de la matriz.

## Como leer las tablas

- **Ejecucion**: donde vive el caso. Si es una ruta, el caso esta automatizado y corre en el CI o
  con `npm test`. `Manual` significa que hay que ejecutarlo a mano siguiendo los pasos.
- **Precondiciones comunes** de todo caso automatizado contra base real: stack local levantado con
  la CLI de Supabase 2.115.0 y `supabase db reset`, que carga `supabase/seed-demo.sql` (datos
  ficticios, ningun paciente real).
- El numero entre parentesis despues de un archivo pgTAP es su cantidad de aserciones.

## Requerimientos funcionales

### RF-01: roles y permisos por usuario

> El sistema debera permitir asignar roles y permisos a cada usuario (Administrador, Junta
> Directiva, Socios Fundadores, Medicos y Voluntarios), restringiendo el acceso segun su perfil.
> HU01 - Prioridad alta - RNF-7, RNF-9

| ID | Caso | Resultado esperado | Ejecucion |
| --- | --- | --- | --- |
| CP-RF01-01 | Cada rol lee y escribe solo las tablas que le corresponden | Las politicas RLS permiten o niegan segun la matriz de `docs/PERMISOS.md` | `supabase/tests/database/politicas_rls_*.sql` (10 suites, 304) |
| CP-RF01-02 | Un usuario desactivado pierde todo privilegio | Ninguna lectura ni escritura con sesion de un perfil inactivo | `perfil_inactivo_sin_privilegios.sql` (12) |
| CP-RF01-03 | No se puede dejar el sistema sin administrador | Borrar o desactivar al ultimo administrador falla | `impedir_borrar_ultimo_administrador.sql` (5) |
| CP-RF01-04 | Nadie se da de alta por su cuenta | El registro publico esta cerrado | `registro_publico_cerrado.sql` (11) |
| CP-RF01-05 | Un visitante sin sesion no ejecuta ninguna funcion ni lee tablas | `anon` sin privilegios en `public` | `privilegios_anon.sql` (9) |
| CP-RF01-06 | Cambiar los permisos de un usuario deja rastro | Cada alta y baja en `usuario_permiso` queda auditada | `auditoria_usuario_permiso.sql` (8) |
| CP-RF01-07 | Un medico ve la bandeja de validacion pero no puede aprobar | La aprobacion la rechaza la base | `pruebas/e2e/inventario-validacion.e2e.test.js`, caso 4 |
| CP-RF01-08 | Una ruta protegida no se abre sin el rol que la exige | Sin sesion va a `/login`; con un rol no permitido muestra acceso denegado | `apps/web/src/components/RutaProtegida.test.jsx`, `App.rutas.test.jsx` |
| CP-RF01-09 | El menu movil solo ofrece lo que el rol puede abrir, y ninguna pantalla se alcanza sin el | Las pestanias se filtran por rol; toda pantalla registrada pasa por la guarda y una lista de roles vacia deniega | `apps/mobile/src/navigation/navegacionPorRol.test.js`, `navigation/guardaDeRol.test.js`, `navigation/AppNavigator.test.js`, `components/RutaProtegida.test.jsx` |
| CP-RF01-10 | La administradora asigna y edita permisos | El formulario refleja y guarda los permisos | `apps/web/src/pages/ModalPermisosUsuario.test.jsx`, `ModalEdicionUsuario.test.jsx` |

### RF-02: expediente clinico unico, signos vitales y consultas

> El sistema debera crear y mantener un expediente clinico unico para los pacientes, permitiendo
> registrar signos vitales y consultas medicas (motivo, diagnostico, tratamiento).
> HU04 - Prioridad alta - RNF-3

| ID | Caso | Resultado esperado | Ejecucion |
| --- | --- | --- | --- |
| CP-RF02-01 | Registrar un paciente le asigna numero de ficha | La base genera el numero, sin colisiones | `atencion-clinica.e2e.test.js`, caso 1; `generar_numero_ficha.sql` (5) |
| CP-RF02-02 | Poner al paciente en la cola de la jornada en curso | Queda en la cola, una sola vez | `atencion-clinica.e2e.test.js`, casos 2 y 3; `cola_de_jornada.sql` (13) |
| CP-RF02-03 | Registrar la consulta con un diagnostico del catalogo | La consulta queda en el expediente | `atencion-clinica.e2e.test.js`, casos 4 y 5 |
| CP-RF02-04 | Registrar signos vitales | El IMC se calcula en la base, y una combinacion de peso y talla imposible se rechaza con un error con nombre en vez de un desborde | `triaje_imc_generado.sql` (12); `packages/shared/pacientes/triaje.validaciones.test.js`; `apps/mobile/src/screens/TriajeScreen.test.js` |
| CP-RF02-05 | Fusionar dos expedientes duplicados | Atenciones, consultas y condiciones del absorbido pasan al sobreviviente, sin perderse ni duplicarse | `fusion_pacientes_duplicados.sql` (11) |
| CP-RF02-06 | Alta de paciente en web | Valida los campos y registra | `apps/web/src/pages/ModalAltaPaciente.test.jsx`, `ModalAltaPaciente.regresion.test.jsx` |
| CP-RF02-07 | Alta de paciente y consulta en movil | Valida y registra desde el telefono | `apps/mobile/src/screens/RegistroPacienteScreen.test.js`, `ConsultaScreen.test.js` |
| CP-RF02-08 | Corregir una consulta o un triaje ya registrado | La correccion se guarda | `apps/web/src/pages/ModalCorreccionConsulta.test.jsx`, `ModalCorreccionTriaje.test.jsx` |
| CP-RF02-09 | El formulario incluye todos los campos de la ficha clinica fisica | Nombre, edad, razon de consulta, antecedentes, sintomas, diagnostico, tratamiento y seguimiento | **Manual**: ver CP-RNF03-01 |
| CP-RF02-10 | El modelo del paciente no admite basura | `sexo` solo acepta los dos valores del enum y el DPI exige 13 digitos exactos; el cliente lo dice antes que la base | `modelo_de_paciente_699.sql` (13); `packages/shared/pacientes/validaciones.test.js` |

### RF-03: inventario en tiempo real, bloqueando medicamentos vencidos

> El sistema debera permitir consultar el inventario de medicamentos disponible en tiempo real,
> bloqueando la entrega de medicamentos vencidos.
> HU05 - Prioridad alta - RNF-6

| ID | Caso | Resultado esperado | Ejecucion |
| --- | --- | --- | --- |
| CP-RF03-01 | Registrar la salida de un lote vencido | El cliente se niega | `medicamento-vencido.e2e.test.js`, caso 1 |
| CP-RF03-02 | Recetar de un lote vencido | El medico no puede | `medicamento-vencido.e2e.test.js`, caso 2 |
| CP-RF03-03 | Aprobar una salida vencida que llego a pendiente | La base la bloquea | `medicamento-vencido.e2e.test.js`, caso 3 |
| CP-RF03-04 | Autoaprobacion de la administradora sobre un vencido | Tampoco se salta el vencimiento | `medicamento-vencido.e2e.test.js`, caso 4 |
| CP-RF03-05 | El puesto de entrega ve la existencia real despues de recetar | Muestra la cantidad ya descontada | `atencion-clinica.e2e.test.js`, caso 11 |
| CP-RF03-06 | Existencias totales por bodega | Una fila por bodega con la suma de sus existencias; una bodega vacia no genera fila | `existencias_totales_por_bodega.sql` (5) |
| CP-RF03-07 | Valorizacion del inventario | Valor igual a cantidad por costo unitario; un lote sin costo queda en NULL y se cuenta aparte, no suma cero | `valorizacion_de_inventario.sql` (9) |
| CP-RF03-08 | La receta y su salida de inventario son atomicas | Si un renglon no tiene existencia, no queda ni receta ni ningun movimiento | `receta_y_salida_atomicas.sql` (9) |
| CP-RF03-09 | Ajustar la cantidad entregada de una receta | El ajuste genera solo el movimiento por la diferencia | `ajuste_de_entrega_de_receta.sql` (19) |
| CP-RF03-10 | Consultar stock y existencias en movil | Lista lo disponible por lote | `apps/mobile/src/screens/StockScreen.test.js`, `ExistenciasInventarioScreen.test.js`, `DetalleLoteScreen.test.js` |
| CP-RF03-11 | Entregar medicamentos en campo | Registra la entrega contra la receta | `apps/mobile/src/screens/EntregaMedicamentosScreen.test.js`, `ModalAjusteEntrega.test.js` |

### RF-04: movimientos pendientes hasta la aprobacion del administrador

> El sistema debera mantener los movimientos de inventario en estado pendiente hasta que sean
> aprobados por el administrador antes de afectar el inventario oficial.
> HU02 - Prioridad media - RNF-1, RNF-7

| ID | Caso | Resultado esperado | Ejecucion |
| --- | --- | --- | --- |
| CP-RF04-01 | Un voluntario registra un ingreso | Queda pendiente y no mueve existencias | `inventario-validacion.e2e.test.js`, casos 1 y 2 |
| CP-RF04-02 | El ingreso pendiente aparece en la bandeja | Se lista para validar | `inventario-validacion.e2e.test.js`, caso 3; `apps/web/src/pages/BandejaValidacionPage.test.jsx` |
| CP-RF04-03 | La administradora aprueba | Las existencias suben | `inventario-validacion.e2e.test.js`, caso 5 |
| CP-RF04-04 | Un movimiento aprobado no se vuelve a tocar | Cualquier cambio posterior falla | `inventario-validacion.e2e.test.js`, caso 6 |
| CP-RF04-05 | Rechazar sin motivo | Se exige motivo y no mueve existencias | `inventario-validacion.e2e.test.js`, caso 7 |
| CP-RF04-06 | Lotes provisionales | Un lote de voluntario nace provisional y no se dispensa hasta aprobarse | `inventario-validacion.e2e.test.js`, casos 8 a 11 |
| CP-RF04-07 | Una salida tambien espera aprobacion | El stock baja solo al aprobar | `inventario-validacion.e2e.test.js`, salidas 1 a 3; `atencion-clinica.e2e.test.js`, casos 7 a 9 |
| CP-RF04-08 | Reglas de aprobacion en la base | Solo la administradora aprueba | `aprobacion_movimientos_inventario.sql` (11) |
| CP-RF04-09 | Registrar ingresos en web y en movil | El formulario crea el movimiento pendiente | `apps/web/src/pages/ModalRegistroIngreso.test.jsx`, `ModalAltaLote.test.jsx`; `apps/mobile/src/screens/RegistroIngresoScreen.test.js` |

### RF-05: alertas de vencimiento con un mes de anticipacion

> El sistema debera generar alertas automaticas cuando un medicamento se encuentre proximo a
> vencer, con un mes de anticipacion.
> HU03 - Prioridad media - RNF-4

| ID | Caso | Resultado esperado | Ejecucion |
| --- | --- | --- | --- |
| CP-RF05-01 | Lote con stock que vence en 10 dias | Genera alerta | `generar_alertas_caducidad.sql` (9) |
| CP-RF05-02 | Lote que vence en 45 dias | No genera alerta: esta fuera de los 30 dias | `generar_alertas_caducidad.sql` |
| CP-RF05-03 | Lote sin stock que vence pronto | No genera alerta | `generar_alertas_caducidad.sql` |
| CP-RF05-04 | Lote ya alertado | No duplica la alerta | `generar_alertas_caducidad.sql` |
| CP-RF05-05 | Panel de alertas en web y resumen en movil | Muestra las alertas pendientes | `apps/web/src/pages/PanelAlertasVencimiento.test.jsx`; `apps/mobile/src/screens/InventarioResumenAlertasScreen.test.js` |
| CP-RF05-06 | Reporte de medicamentos por vencer | Clasifica los lotes por horizonte | `reportes.e2e.test.js`, casos de `obtenerReporteDeVencimientos` |

### RF-06: busqueda de pacientes e historial medico completo

> El sistema debera permitir buscar pacientes por nombre, comunidad o numero de ficha para
> consultar el historial medico completo.
> HU06 - Prioridad media - RNF-6

| ID | Caso | Resultado esperado | Ejecucion |
| --- | --- | --- | --- |
| CP-RF06-01 | Buscar por nombre con y sin acentos o errores de tipeo, por comunidad y por ficha | Devuelve al paciente, paginado | `busqueda_pacientes.sql` (15) |
| CP-RF06-02 | La pestana de Recetas encuentra la receta recien emitida | Lista la receta sin error | `atencion-clinica.e2e.test.js`, caso 10 |
| CP-RF06-03 | Una lista de mas de 1000 filas no se corta en silencio | Se trae completa paginando | `paginacion-max-rows.e2e.test.js` |
| CP-RF06-04 | Linea de tiempo del historial en web | Consultas, diagnosticos y medicamentos previos | `apps/web/src/pages/PestaniaHistorialPaciente.test.jsx`, `PestaniaRecetasPaciente.test.jsx`, `FichaPacientePage.test.jsx` |
| CP-RF06-05 | Historial y ficha en movil | Mismo historial desde el telefono | `apps/mobile/src/screens/HistorialPacienteScreen.test.js`, `FichaPacienteScreen.test.js`, `ficha-paciente/__tests__/*` |

### RF-07: reportes e indicadores de impacto

> El sistema debera generar reportes e indicadores de impacto (pacientes atendidos, comunidades
> beneficiadas, medicamentos utilizados).
> HU07 - Prioridad baja - RNF-4

| ID | Caso | Resultado esperado | Ejecucion |
| --- | --- | --- | --- |
| CP-RF07-01 | Reporte de jornada con datos | Agrega consulta, diagnostico y medicamento | `reportes.e2e.test.js` |
| CP-RF07-02 | Reportes con la base vacia | Devuelven ceros, no revientan ni pierden los totales | `reportes.e2e.test.js`, los cinco casos "con la base vacia" |
| CP-RF07-03 | Indicadores del sistema por periodo | Trae los cuatro indicadores | `reportes.e2e.test.js` |
| CP-RF07-04 | Pacientes agrupados por jornada | El paciente registrado entra en el agrupado | `reportes.e2e.test.js` |
| CP-RF07-05 | Los roles consultivos ven agregados, no filas clinicas | Las vistas agregadas no exponen datos de pacientes | `politicas_rls_vistas_agregadas.sql` (32) |
| CP-RF07-06 | Dashboard y pantallas de reportes en web | Muestran los indicadores y el error cuando la consulta falla | `apps/web/src/pages/DashboardMetricasPage.test.jsx`, `ReportesPage.test.jsx`, `ReportePacientesPage.test.jsx`, `ReporteInventarioPage.test.jsx`, `ReporteJornada.test.jsx` |
| CP-RF07-07 | Resumen de jornada en movil | Muestra el cierre de la jornada | `apps/mobile/src/screens/ResumenJornadaScreen.test.js` |

## Requerimientos no funcionales

| ID | Requerimiento | Caso | Resultado esperado | Ejecucion |
| --- | --- | --- | --- | --- |
| CP-RNF01-01 | RNF-1: interfaz intuitiva | Personal de la organizacion completa las tareas de HU01 a HU07 sin ayuda | Criterio en el plan, seccion Usabilidad | **Manual**, pendiente con la organizacion |
| CP-RNF02-01 | RNF-2: registro agil en movil | Cronometrar el registro de un paciente y su consulta en una jornada real | No retrasa la atencion; umbral a fijar con la organizacion | **Manual**, pendiente |
| CP-RNF03-01 | RNF-3: formularios fieles a la ficha fisica | Poner la ficha clinica fisica al lado del formulario de alta y de consulta, en web y movil, y comparar campo por campo | Mismos campos y mismo orden, o mejora justificada | **Manual**, sin ejecutar |
| CP-RNF04-01 | RNF-4: dashboard claro | El dashboard muestra los indicadores con graficas | Renderiza los indicadores y el estado de error | `apps/web/src/pages/DashboardMetricasPage.test.jsx`; claridad: manual, con la organizacion |
| CP-RNF05-01 | RNF-5: 50 pacientes por jornada | Registrar, tomar triaje, consultar y recetar a 50 pacientes | Ningun maximo crece con el indice del paciente | `scripts/prueba-de-carga-jornada-50-pacientes.mjs` |
| CP-RNF06-01 | RNF-6: crecimiento de la base | Consultas sobre mas de 1000 filas | No se truncan en silencio | `paginacion-max-rows.e2e.test.js`; volumen de anos: sin caso |
| CP-RNF07-01 | RNF-7: confidencialidad e integridad | Mismas suites que CP-RF01-01 a 06 | Solo el personal autorizado accede | pgTAP de politicas y privilegios |
| CP-RNF08-01 | RNF-8: HTTPS | Abrir la web por `http://` y revisar la URL de Supabase que usan las apps | Redirige a HTTPS; ninguna llamada viaja en claro | **Manual** |
| CP-RNF09-01 | RNF-9: historiales solo para medicos y administrador | Un rol sin permiso intenta leer consultas, recetas e historial | La base lo niega | `politicas_rls_atenciones_consultas_recetas.sql` (33), `politicas_rls_pacientes_expedientes.sql` (25) |
| CP-RNF10-01 | RNF-10: autenticacion segura | Reglas de contrasena y restablecimiento | Rechaza contrasenas que no cumplen la politica | `packages/shared/usuarios/validaciones.test.js`, `useNuevaContrasena.test.js`. Solo del lado del cliente: `supabase/config.toml` no fija una longitud minima en el servidor |
| CP-RNF10-02 | RNF-10: las cuentas pueden iniciar sesion | Ninguna cuenta queda con columnas de token nulas que GoTrue no sabe leer | Las siete cuentas de demostracion inician sesion | `tokens_auth_users.sql` (3) |
| CP-RNF11-01 | RNF-11: confiabilidad en jornada | Los flujos criticos de una jornada funcionan de punta a punta | 41 de 41 pruebas e2e en verde en cada PR que toca la base | `pruebas/e2e/` en el CI |
| CP-RNF12-01 | RNF-12: respaldos | Restaurar la base desde un respaldo | La informacion vuelve integra | **No ejecutable hoy**: el plan Free no tiene respaldos |
| CP-RNF13-01 | RNF-13: codigo mantenible | Lint, formato y guarda de esquema | Cero errores | `npm run lint`, `npm run format:check`, `scripts/verificar-shared-vs-esquema.mjs` |
| CP-RNF14-01 | RNF-14: herramientas abiertas y capas gratuitas | Revisar el costo de cada servicio | Todo en capa gratuita o con justificacion | Verificacion documental en `docs/COSTOS-Y-LIMITES.md` |
| CP-RNF15-01 | RNF-15: responsiva y compatible | Recorrer las pantallas principales en Chrome, Firefox y Safari, a 1366, 768 y 375 px | Sin desbordes ni controles inaccesibles | **Manual**, sin ejecutar |
| CP-ACC-01 | Accesibilidad web (sin RNF oficial) | Navegar las pantallas principales solo con teclado y revisarlas con Lighthouse | Todo control es alcanzable; sin fallos criticos de contraste o etiquetas | **Manual**, sin ejecutar |

## Requerimientos sin ningun caso que los cubra

Lo que hoy no se puede afirmar que este probado:

| Requerimiento | Situacion | Que falta |
| --- | --- | --- |
| **RNF-12** respaldos | **No se cumple**, no es solo falta de prueba: el plan Free de Supabase no incluye respaldos (`docs/COSTOS-Y-LIMITES.md`, seccion 6.2) | Issue #762 abierta. Sin respaldo no hay restauracion que probar |
| **RNF-1** interfaz intuitiva | Caso definido, nunca ejecutado | Sesion de usabilidad con el personal de la organizacion |
| **RNF-2** registro agil | Solo existe el piso de la prueba de carga (5.8 ms por registro contra el stack local), que no mide el tiempo de una persona | Cronometraje en una jornada real |
| **RNF-3** fidelidad con la ficha fisica | Caso manual definido, nunca ejecutado. La prueba de regresion del alta solo comprueba que el formulario monte, no el orden de los campos | Comparacion campo por campo con la ficha fisica |
| **RNF-8** HTTPS | Sin caso ejecutado | Revision manual de la web desplegada |
| **RNF-15** responsiva y navegadores | Sin caso ejecutado | Recorrido manual en la matriz de navegadores y anchos |
| **RNF-6** crecimiento de la base | Cubierto solo el limite de 1000 filas de PostgREST | Una prueba con volumen de varios anos de jornadas |
| **Aceptacion** de HU01 a HU07 | Ningun criterio de aceptacion validado con la organizacion | Sesion de aceptacion antes de pasar a produccion |

Los siete requerimientos funcionales tienen al menos un caso automatizado contra base real.
