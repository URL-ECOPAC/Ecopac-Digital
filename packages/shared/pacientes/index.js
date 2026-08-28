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
// api.js (issue #113) y validaciones.js (issue #112) ya estan. Los hooks de pantalla los
// construyen sus propias issues.
//
// El triaje va en archivos propios -- triaje.api.js y triaje.validaciones.js (issue #117) --
// porque es otra entidad dentro del mismo modulo, con su propia tabla. Mismo patron de nombres
// que donaciones/ usa con proyectos.api.js y avance.api.js.
//
// Las condiciones cronicas (issue #122) siguen ese mismo patron y son las primeras del modulo
// que traen el juego completo: api, validaciones, permisos, campos, columnas y filtros. Escriben
// padecimientos_cronicos, la tabla que api.js declara ajena en su cabecera.

export * from './campos.js';
export * from './filtros.js';
export * from './columnas.js';
export * from "./validaciones.js";
export * from "./api.js";
export * from "./permisos.js";
export * from "./triaje.validaciones.js";
export * from "./triaje.api.js";
export * from "./consultas.api.js";
export * from "./recetas.api.js";
export * from "./historial.api.js";
export * from "./condiciones.campos.js";
export * from "./condiciones.columnas.js";
export * from "./condiciones.filtros.js";
export * from "./condiciones.permisos.js";
export * from "./condiciones.validaciones.js";
export * from "./condiciones.api.js";
