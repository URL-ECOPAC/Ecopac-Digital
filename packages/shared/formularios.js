// Un solo juego de campos para dar de alta y para editar (issue #840, regla B1).
//
// La regla la pidio el usuario: "el formulario para crear o editar algo debe ser igual [...] y a
// lo mucho campos sin acceso de escritura si no deberian editarse". Hasta la #840 no se cumplia:
// la correccion de un movimiento, de una condicion cronica o de un turno se armaba FILTRANDO el
// descriptor del alta, asi que lo que no se podia cambiar desaparecia del formulario y la persona
// corregia a ciegas -que movimiento era, de que lote, a quien se asigno-.
//
// Ahora la edicion es el mismo descriptor, y lo que no se edita lleva `soloLectura: true`: se
// dibuja, deshabilitado, y la validacion lo salta (lo que no viaja al servidor no se valida).
// Que alta y edicion no se vuelvan a separar lo comprueba formularios.test.js.

import { TIPOS_DE_CAMPO } from "./descriptores.js";
import { formatearFechaCorta } from "./formato/fechas.js";

/**
 * Los campos del alta, con los que no se pueden cambiar despues marcados como solo lectura.
 *
 * @param {Array<object>} campos Descriptores del alta, en su orden.
 * @param {Array<string>} idsEditables Los que la edicion si deja cambiar.
 * @returns {ReadonlyArray<object>} El mismo juego de campos, en el mismo orden.
 */
export function camposDeEdicion(campos, idsEditables) {
  const editables = new Set(idsEditables);

  return Object.freeze(
    campos.map((campo) => (editables.has(campo.id) ? campo : { ...campo, soloLectura: true })),
  );
}

/** Los ids de un juego de campos que la edicion deja escribir. */
export function idsEditables(campos) {
  return campos.filter((campo) => !campo.soloLectura).map((campo) => campo.id);
}

/**
 * Lo que se lee en un campo de solo lectura.
 *
 * Un select deshabilitado sin su catalogo cargado sale vacio: la correccion de un movimiento no
 * carga todos los lotes solo para mostrar el suyo. Por eso un campo de solo lectura se dibuja
 * como texto, y el texto sale de aqui: la etiqueta de la opcion si el catalogo esta, el valor tal
 * cual si no (el hook de la pantalla ya lo trae legible, por ejemplo el nombre del medicamento).
 *
 * @param {object} campo Descriptor.
 * @param {unknown} valor
 * @param {Record<string, Array<{ value: unknown, label: string }>>} [catalogos]
 * @returns {string}
 */
export function textoDeCampoSoloLectura(campo, valor, catalogos = {}) {
  if (valor === null || valor === undefined || valor === "") return "";

  if (campo?.tipo === TIPOS_DE_CAMPO.BOOLEANO) return valor ? "Sí" : "No";
  if (campo?.tipo === TIPOS_DE_CAMPO.FECHA) return formatearFechaCorta(valor);

  const opciones =
    campo?.opciones ?? (campo?.opcionesDesde ? (catalogos[campo.opcionesDesde] ?? []) : []);
  const valores = Array.isArray(valor) ? valor : [valor];
  const textos = valores.map(
    (uno) => opciones.find((opcion) => opcion.value === uno)?.label ?? String(uno),
  );

  return textos.join(", ");
}
