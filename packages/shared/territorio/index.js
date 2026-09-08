// Modulo de territorio: departamentos, municipios y comunidades (catalogo geografico).
//
// Excepcion de alcance autorizada para el issue #179 (ver PLAN.md, seccion 7, decision 6): no
// sigue la estructura estandar de un modulo de dominio (sin campos.js, columnas.js, filtros.js
// ni use<Pantalla>.js) porque no tiene pantalla propia. Desde la #662 ya no es de solo lectura:
// un administrador puede crear comunidades, asi que tiene validaciones.js y permisos.js. El
// resto de modulos lo siguen consumiendo para resolver
// `opcionesDesde: 'comunidades'` (y, en jornadas, tambien 'departamentos'/'municipios' para la
// cascada).

export * from "./api.js";
export * from "./comunidades.validaciones.js";
export * from "./permisos.js";
