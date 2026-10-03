// Formulario del catalogo de clinicas (issue #927, 00183).

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { LARGO_MAXIMO_NOMBRE_DE_CLINICA, MAXIMO_DE_SALAS } from "./clinicas.validaciones.js";

/** Alta y edicion de una clinica. */
export const CAMPOS_CLINICA = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: LARGO_MAXIMO_NOMBRE_DE_CLINICA },
  },
  {
    id: "salasDisponibles",
    label: "Salas disponibles",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "salas",
    validacion: { requerido: true, min: 1, max: MAXIMO_DE_SALAS },
  },
];

/**
 * Opciones para elegir clinica: las vigentes, mas la elegida aunque este retirada (marcada), para
 * que una cita vieja no pierda su clinica en el formulario.
 *
 * @param {Array<{ id: string, nombre: string, salasDisponibles: number, esVigente?: boolean }>} clinicas
 * @param {string|null} [elegida]
 * @returns {{ value: string, label: string }[]}
 */
export function opcionesDeClinicas(clinicas = [], elegida = null) {
  return (clinicas ?? [])
    .filter((clinica) => clinica.esVigente !== false || clinica.id === elegida)
    .map((clinica) => ({
      value: clinica.id,
      label:
        clinica.esVigente === false
          ? `${clinica.nombre} (inactiva)`
          : `${clinica.nombre} · ${clinica.salasDisponibles} ${clinica.salasDisponibles === 1 ? "sala" : "salas"}`,
    }));
}
