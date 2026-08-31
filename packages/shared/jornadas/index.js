// Modulo de jornadas de la logica compartida.
//
// Estructura estandar de un modulo (ver docs/ARQUITECTURA-FRONTEND.md):
//   api.js           llamadas a Supabase y normalizacion de errores
//   validaciones.js  reglas de negocio
//   campos.js        esquema declarativo de los formularios
//   columnas.js      columnas de tabla y campos de tarjeta
//   filtros.js       filtros de las pantallas de listado
//   permisos.js      que puede hacer cada rol en el modulo
//   use<Pantalla>.js view model de una pantalla: datos, estado y handlers
//
// campos.js, columnas.js y filtros.js estan escritos (issue #286); validaciones.js
// (reglas), api.js (CRUD) y permisos.js tambien. useJornadasKanban.js (issue #178),
// useJornadaActiva.js (issue #177), useFormularioJornada.js (issue #179, alta y edicion),
// useDetalleJornada.js (issue #181, pantalla de detalle), useAsignacionPersonal.js (issue #182,
// buscar/asignar/desasignar personal, montado sobre la pestaña Equipo de la pantalla de #181),
// useCuadroTurnos.js (issue #185, advertencias de horario del cuadro de turnos),
// useEdicionTurno.js (issue #185, edicion de horario y responsabilidad de una fila ya asignada),
// useSeleccionJornada.js (issue #186, mensaje de "sin jornada" de la seleccion movil),
// usePanelJornada.js (issue #187, contadores del panel de jornada en curso movil) y
// useJornadasAsignadas.js (issue #188, listado movil de jornadas asignadas separado en proximas
// y pasadas) son los hooks de pantalla del modulo; el resto los construyen sus issues.

export * from "./api.js";
export * from "./campos.js";
export * from "./columnas.js";
export * from "./filtros.js";
export * from "./permisos.js";
export * from "./turnos.imprimible.js";
export * from "./useAsignacionPersonal.js";
export * from "./useCuadroTurnos.js";
export * from "./useDetalleJornada.js";
export * from "./useEdicionTurno.js";
export * from "./useFormularioJornada.js";
export * from "./useJornadaActiva.js";
export * from "./useJornadasAsignadas.js";
export * from "./useJornadasKanban.js";
export * from "./usePanelJornada.js";
export * from "./useSeleccionJornada.js";
export * from "./validaciones.js";
