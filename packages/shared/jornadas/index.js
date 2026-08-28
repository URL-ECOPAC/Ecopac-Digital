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
// useJornadaActiva.js (issue #177) y useFormularioJornada.js (issue #179, alta y edicion) son
// los hooks de pantalla del modulo; el resto los construyen sus issues.

export * from './api.js';
export * from './campos.js';
export * from './columnas.js';
export * from './filtros.js';
export * from './permisos.js';
export * from './useFormularioJornada.js';
export * from './useJornadaActiva.js';
export * from './useJornadasKanban.js';
export * from './validaciones.js';
