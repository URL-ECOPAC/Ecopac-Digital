// Errores de uso del cliente de Supabase.
//
// Son errores de programacion y de configuracion: alguien pidio el cliente antes de
// inicializarlo, o entrego un adaptador de almacenamiento incompleto. Se detectan siempre en
// desarrollo y nunca deberian llegar a produccion.
//
// No confundir con los errores que devuelve el servidor (violacion de unicidad, permiso
// denegado por RLS, fallo de red): esos los traduce a mensajes para el usuario final la
// issue #47, en su propia capa.

/** Codigos, para que quien atrape el error distinga el caso sin leer el texto. */
export const CODIGOS_DE_ERROR_DE_CLIENTE = {
  SIN_INICIALIZAR: "sin_inicializar",
  ALMACENAMIENTO_INVALIDO: "almacenamiento_invalido",
};

export class ErrorDeCliente extends Error {
  constructor(mensaje, { codigo } = {}) {
    super(mensaje);
    this.name = "ErrorDeCliente";
    this.codigo = codigo;
  }
}
