// Modulo de inventario de la logica compartida.
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
// campos.js, columnas.js y filtros.js estan escritos (issue #285). api.js de
// principios activos y sus permisos tambien (issue "API del catalogo de principios
// activos"). El resto de inventario (medicamentos, lotes, movimientos...), las
// validaciones de principios activos y los hooks de pantalla los construyen sus
// propias issues.

export * from './campos.js';
export * from './columnas.js';
export * from './filtros.js';
export * from './principios-activos.api.js';
export * from './principios-activos.permisos.js';
