import { createElement } from "react";
import { ArrowLeft, Eye, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { TIPOS_DE_ACCION, rotuloSinSigno, tipoDeAccionDeBoton } from "@ecopac/shared";

export { rotuloSinSigno };

/**
 * Icono de un boton del catalogo a partir de su rotulo. Que rotulo es un alta y cual un borrado lo
 * decide `tipoDeAccionDeBoton` en packages/shared/formato/acciones.js, igual para web y movil; aqui
 * solo se elige el dibujo.
 *
 * `icon === undefined` (no se paso) -> el icono por tipo de accion, si lo hay.
 * `icon === null` -> sin icono, explicito.
 * Cualquier otro valor -> ese icono, tal cual.
 *
 * `enFormulario`: el boton esta dentro de un formulario (contextoDeFormulario.js). Ahi un alta es
 * la accion que guarda, y se dibuja con el disquete; "Cancelar" lleva la X en cualquier sitio.
 *
 * createElement y no JSX: este archivo es .js, no un componente, y asi no rompe el refresco en
 * caliente de los botones que lo importan.
 */
export function iconoDeAccion(rotulo, icon, enFormulario = false) {
  if (icon !== undefined) return icon;

  switch (tipoDeAccionDeBoton(rotulo, { enFormulario })) {
    case TIPOS_DE_ACCION.ALTA:
      return createElement(Plus, { size: 16, "aria-hidden": "true" });
    case TIPOS_DE_ACCION.GUARDADO:
      return createElement(Save, { size: 16, "aria-hidden": "true" });
    case TIPOS_DE_ACCION.CANCELAR:
      return createElement(X, { size: 16, "aria-hidden": "true" });
    case TIPOS_DE_ACCION.BORRADO:
      return createElement(Trash2, { size: 16, "aria-hidden": "true" });
    case TIPOS_DE_ACCION.RETORNO:
      return createElement(ArrowLeft, { size: 16, "aria-hidden": "true" });
    case TIPOS_DE_ACCION.EDICION:
      return createElement(Pencil, { size: 16, "aria-hidden": "true" });
    case TIPOS_DE_ACCION.DETALLE:
      return createElement(Eye, { size: 16, "aria-hidden": "true" });
    default:
      return null;
  }
}
