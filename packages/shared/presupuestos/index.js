// Modulo de presupuestos de la logica compartida.
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
