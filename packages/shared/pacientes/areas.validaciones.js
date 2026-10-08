// Validaciones del catalogo de areas de atencion (issue #927, 00182).

import { esTextoVacio, normalizarTexto } from "../validations/index.js";

/** Largo de areas_atencion.nombre (VARCHAR(100), 00182). */
export const LARGO_MAXIMO_NOMBRE_DE_AREA = 100;

/**
 * Valida el nombre al crear o editar un area. La unicidad la decide la base (indice normalizado);
 * aqui solo lo que se puede saber sin preguntarle.
 *
 * @param {{ nombre?: string }} [datos]
 * @returns {Record<string, string>}
 */
export function validarAreaCatalogo(datos = {}) {
  const errores = {};
  const nombre = normalizarTexto(datos.nombre);

  if (esTextoVacio(nombre)) {
    errores.nombre = "El nombre del área es requerido.";
  } else if (nombre.length > LARGO_MAXIMO_NOMBRE_DE_AREA) {
    errores.nombre = `El nombre no puede pasar de ${LARGO_MAXIMO_NOMBRE_DE_AREA} caracteres.`;
  }

  return errores;
}
