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
//
// Proyectos sociales (issue #194) vivio aqui como proyectos.api.js, proyectos.validaciones.js,
// proyectos.permisos.js y avance.api.js. La issue #400 lo movio a su propio modulo,
// packages/shared/proyectos/, para que esta carpeta quede solo para donantes y donaciones.

// Donantes y donaciones (issue #189). Los valores de tipo_donante, tipo_donacion y
// estado_donacion (enum de la migracion 00022) nacen en campos.js (issue #287), no en el
// types/donaciones.ts que validaciones.js reemplazo.
export * from "./validaciones.js";
export * from "./donantes.api.js";
export * from "./ingreso.api.js";
export * from "./campos.js";
export * from "./columnas.js";
export * from "./filtros.js";
export * from "./permisos.js";
export * from "./useRegistroDonacion.js";
export * from "./useHistorialDonaciones.js";
export * from "./useConstanciaDonacion.js";

// useDonantesPage NO se exporta todavia, a proposito (issue #598).
//
// Falta en el barril desde que se agrego con la issue #196, y el primer diagnostico fue que
// bastaba con exportarlo. No basta: el hook llama a `donantesApi.obtenerDonantes(client)` y a
// `donantesApi.obtenerDonantePorId(id, client)`, y donantes.api.js no exporta ningun objeto
// `donantesApi` ni esas dos funciones. Lo que si exporta son listarDonantes(),
// registrarDonante(), actualizarDonante(), darDeBajaDonante() y obtenerHistoricoDonante(), con
// otra firma: reciben `{ rolUsuario }` y resuelven el cliente con obtenerSupabase(), en vez de
// recibirlo por parametro.
//
// Exportarlo tal como esta rompe la compilacion de la web, porque mete el archivo en el grafo
// del bundle y rolldown corta con MISSING_EXPORT. Reescribirlo contra la API real cambia su
// contrato de carga de datos y arrastra a DonantesPage.jsx, asi que va en la parte B de la
// #598, junto con la portacion de las pantallas.