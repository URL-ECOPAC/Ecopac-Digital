// Modulo de proyectos de la logica compartida.
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
// Modulo separado por la issue #400: proyectos vivia en packages/shared/donaciones/ con los
// nombres prefijados proyectos.api.js, proyectos.permisos.js y proyectos.validaciones.js porque
// esa carpeta convivia con donantes y donaciones (issue #189). Aqui recupera la estructura
// estandar sin prefijo.
//
// avance.api.js, equipo.api.js e insumos.api.js son entidades propias dentro del mismo modulo
// -hitos y seguimiento, equipo, insumos previstos-, cada una con su tabla. Mismo patron que
// pacientes/ usa con triaje.api.js. tableroProyectosApi.js se retiro con la 00149: nadie lo
// llamaba, leia una columna `etapa` que no existe y ordenaba por orden_columna, que ya no esta.

export { vacioANull } from "./normalizacion.js";
export * from "./validaciones.js";
export * from "./api.js";
export * from "./permisos.js";
export * from "./avance.api.js";
export * from "./equipo.api.js";
export * from "./insumos.api.js";
export * from "./campos.js";
export * from "./columnas.js";
export * from "./filtros.js";
export { useProyectosSociales } from "./useProyectosSociales.js";
export { useSeguimientoProyecto } from "./useSeguimientoProyecto.js";
