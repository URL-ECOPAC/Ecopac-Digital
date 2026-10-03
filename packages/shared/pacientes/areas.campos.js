// Formulario del catalogo de areas y opciones de area para los selectores (issue #927, 00182).

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { LARGO_MAXIMO_NOMBRE_DE_AREA } from "./areas.validaciones.js";

/** Alta y edicion de un area del catalogo. */
export const CAMPOS_AREA_CATALOGO = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: LARGO_MAXIMO_NOMBRE_DE_AREA },
  },
  {
    id: "descripcion",
    label: "Descripción",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
];

/** Como se marca un area retirada donde todavia aparece. */
export const SUFIJO_AREA_RETIRADA = " (inactiva)";

/**
 * El nombre de un area tal como se muestra: una retirada lo dice.
 *
 * @param {{ nombre: string, esVigente?: boolean }} area
 * @returns {string}
 */
export function etiquetaDeArea(area) {
  return area.esVigente === false ? `${area.nombre}${SUFIJO_AREA_RETIRADA}` : area.nombre;
}

/**
 * Opciones para elegir areas: las vigentes, mas las retiradas que ya estan elegidas (para que
 * sigan visibles, marcadas, en vez de desaparecer del campo). Una retirada que no esta elegida no se
 * ofrece.
 *
 * @param {Array<{ id: string, nombre: string, esVigente?: boolean }>} areas Catalogo completo.
 * @param {string[]} [elegidas] Ids ya elegidos.
 * @returns {{ value: string, label: string }[]}
 */
export function opcionesDeAreas(areas = [], elegidas = []) {
  return (areas ?? [])
    .filter((area) => area.esVigente !== false || (elegidas ?? []).includes(area.id))
    .map((area) => ({ value: area.id, label: etiquetaDeArea(area) }));
}

/**
 * Opciones del filtro de la lista de pacientes: todas, tambien las retiradas (marcadas), porque los
 * pacientes que ya las tienen las conservan.
 *
 * @param {Array<{ id: string, nombre: string, esVigente?: boolean }>} areas
 * @returns {{ value: string, label: string }[]}
 */
export function opcionesDeFiltroDeAreas(areas = []) {
  return (areas ?? []).map((area) => ({ value: area.id, label: etiquetaDeArea(area) }));
}
