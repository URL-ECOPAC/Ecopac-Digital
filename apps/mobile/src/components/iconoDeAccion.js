import { createElement } from "react";
import { Ionicons } from "@expo/vector-icons";
import { TIPOS_DE_ACCION, tipoDeAccionDeBoton } from "@ecopac/shared";

/**
 * Icono de un boton del catalogo a partir de su rotulo. Espejo de
 * apps/web/src/components/iconosDeAccion.js: que rotulo es un alta y cual un borrado lo decide
 * `tipoDeAccionDeBoton` en packages/shared; aqui solo se elige el glifo de Ionicons.
 *
 * `icon === undefined` -> el icono por tipo de accion. `null` -> sin icono. Otro valor -> tal cual.
 * `enFormulario` -> el boton confirma un formulario (contextoDeFormulario.js): un alta lleva el
 * disquete en vez del "+".
 */
export function iconoDeAccion(rotulo, icon, color, enFormulario = false) {
  if (icon !== undefined) return icon;

  switch (tipoDeAccionDeBoton(rotulo, { enFormulario })) {
    case TIPOS_DE_ACCION.ALTA:
      return createElement(Ionicons, { name: "add", size: 18, color });
    case TIPOS_DE_ACCION.GUARDADO:
      return createElement(Ionicons, { name: "save-outline", size: 18, color });
    case TIPOS_DE_ACCION.CANCELAR:
      return createElement(Ionicons, { name: "close", size: 18, color });
    case TIPOS_DE_ACCION.BORRADO:
      return createElement(Ionicons, { name: "trash-outline", size: 18, color });
    case TIPOS_DE_ACCION.RETORNO:
      return createElement(Ionicons, { name: "arrow-back", size: 18, color });
    case TIPOS_DE_ACCION.EDICION:
      return createElement(Ionicons, { name: "create-outline", size: 18, color });
    case TIPOS_DE_ACCION.DETALLE:
      return createElement(Ionicons, { name: "eye-outline", size: 18, color });
    default:
      return null;
  }
}
