// Modulo de territorio: departamentos, municipios y comunidades (catalogo geografico).
//
// Excepcion de alcance autorizada para el issue #179 (ver PLAN.md, seccion 7, decision 6): no
// sigue la estructura estandar de un modulo de dominio (sin validaciones.js, campos.js,
// columnas.js, filtros.js, permisos.js ni use<Pantalla>.js) porque no tiene pantalla propia, es
// un catalogo de solo lectura que otros modulos consumen para resolver
// `opcionesDesde: 'comunidades'` (y, en jornadas, tambien 'departamentos'/'municipios' para la
// cascada).

export * from "./api.js";
