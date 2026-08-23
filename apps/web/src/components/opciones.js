// Normalizacion de las listas de opciones que consumen FilterBar y DataList.
//
// El contrato del catalogo declara que una opcion es { label, value }, pero los descriptores
// que ya viven en shared publican sus listas en espanol: OPCIONES_ROL y ESTADOS_USUARIO de
// packages/shared/usuarios/campos.js son { etiqueta, valor }.
//
// Se aceptan las dos formas en vez de obligar a cada pantalla a mapear la lista antes de
// pasarla, que es codigo repetido y facil de olvidar. La forma del contrato manda cuando
// vienen las dos.
//
// El dia que shared unifique la nomenclatura, este archivo se borra y no cambia nada mas.

/** Convierte una entrada de catalogo a la forma { label, value } del contrato. */
export function normalizarOpcion(opcion) {
  if (opcion === null || typeof opcion !== 'object') {
    return { label: String(opcion), value: opcion };
  }
  return {
    label: opcion.label ?? opcion.etiqueta ?? String(opcion.value ?? opcion.valor ?? ''),
    value: opcion.value ?? opcion.valor,
    // ESTADOS_USUARIO guarda el valor real (true/false) en `valor` y la clave del enum en
    // `clave`. Esa clave es la que indexa statusColors, asi que se conserva.
    clave: opcion.clave,
  };
}

/** Lista completa ya normalizada. Un catalogo ausente da una lista vacia, no un error. */
export function normalizarOpciones(opciones) {
  return Array.isArray(opciones) ? opciones.map(normalizarOpcion) : [];
}
