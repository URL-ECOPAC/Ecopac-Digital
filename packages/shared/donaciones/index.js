// Modulo de donaciones de la logica compartida.
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
// Carpeta creada por el issue #278 para dejar montada la estructura del modulo. El
// contenido lo construyen sus issues (ver packages/shared/pacientes/ como ejemplar de
// referencia de filtros.js y columnas.js).

// Proyectos sociales (issue #194). Los archivos van por entidad y no como un api.js unico
// porque esta carpeta la escriben nueve issues repartidas entre cinco personas.
export * from "./proyectos.api.js";
export * from "./proyectos.validaciones.js";
export * from "./proyectos.permisos.js";
export * from "./avance.api.js";

// Donantes y donaciones (issue #189). Los valores de tipo_donante, tipo_donacion y
// estado_donacion nacen aqui: son los del enum de la migracion 00022, no los que declaraba el
// types/donaciones.ts que este archivo reemplaza.
export * from "./validaciones.js";
export * from "./donantes.api.js";
export * from "./inventario/index.js";
export * from "./donaciones/index.js";