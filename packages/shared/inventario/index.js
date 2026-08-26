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
// campos.js, columnas.js y filtros.js estan escritos (issue #285). api.js y permisos.js de
// principios activos tambien (issue "API del catalogo de principios activos"), los de
// medicamentos igual (issue #142), los de lotes tambien (issue "API de lotes de medicamentos
// en shared", RF-14), y los de bodegas y proveedores tambien (issue #143). El resto de inventario
// (movimientos...), las validaciones de principios activos, medicamentos y lotes, y los hooks de
// pantalla los construyen sus propias issues.
//
// bodegas y proveedores comparten bodegas.permisos.js: las politicas de las dos tablas son
// identicas (00062) y se administran desde la misma pantalla.

export * from './campos.js';
export * from './columnas.js';
export * from './filtros.js';
export * from './principios-activos.api.js';
export * from './principios-activos.permisos.js';
export * from './medicamentos.api.js';
export * from './medicamentos.permisos.js';
export * from './lotes.api.js';
export * from './existencias.api.js';
export * from './lotes.permisos.js';
export * from './bodegas.api.js';
export * from './proveedores.api.js';
export * from './bodegas.permisos.js';
