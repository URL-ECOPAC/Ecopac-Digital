// Modulo de reportes de la logica compartida.
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
// Carpeta creada por el issue #278 para dejar montada la estructura del modulo. campos.js,
// columnas.js y filtros.js son la issue #289 (ver packages/shared/pacientes/ como ejemplar de
// referencia del patron).

// Indicadores de impacto (issue #205). Este export faltaba: api.js existia desde el 25/08 pero
// no salia por el barril, asi que ninguna de las dos apps podia importarlo.
export * from "./api.js";
export * from "./campos.js";
export * from "./columnas.js";
export * from "./filtros.js";
export * from "./inventario.api.js";
export * from "./pacientes.api.js";
export * from "./jornada.api.js";
export * from "./permisos.js";
export * from "./useFiltrosReportes.js";

// Exportacion de reportes a CSV (issue #207). Funcion pura: no depende de Supabase ni de
// ninguna API web-only, por eso vive junto al resto de utilidades de este modulo.
export * from "./csv.js";
