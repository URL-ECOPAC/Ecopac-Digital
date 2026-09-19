// Modulo de territorio: departamentos, municipios y comunidades (catalogo geografico).
//
// Excepcion de alcance autorizada para el issue #179 (ver PLAN.md, seccion 7, decision 6): hasta
// la #662 era de solo lectura, sin campos.js/columnas.js/filtros.js/use<Pantalla>.js, porque no
// tenia pantalla propia -el resto de modulos solo lo consumian para resolver
// `opcionesDesde: 'comunidades'` (y, en jornadas, tambien 'departamentos'/'municipios' para su
// cascada). La #756 le agrego la pantalla que le faltaba (catalogo de comunidades: alta, edicion
// y el mapa de las columnas geo que la 00008 dejo sin usar), asi que ahora si sigue la
// estructura estandar completa de un modulo de dominio.

export * from "./api.js";
export * from "./campos.js";
export * from "./columnas.js";
export * from "./comunidades.validaciones.js";
export * from "./filtros.js";
export * from "./permisos.js";
export * from "./useAltaDeComunidadEnLinea.js";
export * from "./useCascadaTerritorial.js";
export * from "./useCatalogoComunidades.js";
export * from "./useFormularioComunidad.js";
