// Validaciones del catalogo de clinicas (issue #927, 00183).

import { esTextoVacio, normalizarTexto } from "../validations/index.js";

/** Largo de clinicas.nombre (VARCHAR(100), 00183). */
export const LARGO_MAXIMO_NOMBRE_DE_CLINICA = 100;

/** Tope razonable de salas: evita un 1000 por un cero de mas, no es una regla de la base. */
export const MAXIMO_DE_SALAS = 50;

/**
 * Valida una clinica al crearla o editarla. La unicidad la decide la base (indice normalizado).
 * Valida solo los campos que trae `datos`, para poder editar uno sin el otro.
 *
 * @param {{ nombre?: string, salasDisponibles?: number|string }} [datos]
 * @param {{ completo?: boolean }} [opciones] `completo` exige los dos campos (alta).
 * @returns {Record<string, string>}
 */
export function validarClinica(datos = {}, { completo = true } = {}) {
  const errores = {};

  if (completo || Object.prototype.hasOwnProperty.call(datos, "nombre")) {
    const nombre = normalizarTexto(datos.nombre);
    if (esTextoVacio(nombre)) {
      errores.nombre = "El nombre de la clínica es requerido.";
    } else if (nombre.length > LARGO_MAXIMO_NOMBRE_DE_CLINICA) {
      errores.nombre = `El nombre no puede pasar de ${LARGO_MAXIMO_NOMBRE_DE_CLINICA} caracteres.`;
    }
  }

  if (completo || Object.prototype.hasOwnProperty.call(datos, "salasDisponibles")) {
    const salas = Number(datos.salasDisponibles);
    if (
      datos.salasDisponibles === "" ||
      datos.salasDisponibles == null ||
      !Number.isInteger(salas)
    ) {
      errores.salasDisponibles = "Indica cuántas salas tiene la clínica.";
    } else if (salas < 1) {
      errores.salasDisponibles = "Una clínica tiene al menos una sala.";
    } else if (salas > MAXIMO_DE_SALAS) {
      errores.salasDisponibles = `No más de ${MAXIMO_DE_SALAS} salas.`;
    }
  }

  return errores;
}
