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
// avance.api.js y tableroProyectosApi.js son entidades propias dentro del mismo modulo -- hitos
// y seguimiento de avance, y el tablero kanban -- con su propia tabla o su propia vista sobre
// proyectos. Mismo patron que pacientes/ usa con triaje.api.js.

export * from "./validaciones.js";
export * from "./api.js";
export * from "./permisos.js";
export * from "./avance.api.js";
export * from "./tableroProyectosApi.js";
export * from "./campos.js";
export * from "./columnas.js";
export * from "./filtros.js";
