// Modulo de pacientes de la logica compartida.
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
// De momento solo estan los descriptores (campos, columnas, filtros), como ejemplar
// de referencia. api.js, validaciones.js, permisos.js y los hooks de pantalla los
// construyen sus issues.

export * from './campos.js';
export * from './filtros.js';
export * from './columnas.js';
export * from "./validaciones.js";
