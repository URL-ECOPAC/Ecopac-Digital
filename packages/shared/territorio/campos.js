import { labels } from "@ecopac/ui-tokens";
import { TIPOS_DE_CAMPO } from "../descriptores.js";

/**
 * Catalogo cerrado de vigencia (issue #756), mismo patron que ESTADOS_USUARIO
 * (usuarios/campos.js): reutiliza las etiquetas genericas de labels ("Activo"/"Inactivo") en
 * vez de escribir un texto nuevo para un concepto que ya tiene el suyo en ui-tokens.
 */
export const ESTADOS_VIGENCIA = [
  { value: true, clave: "activo", label: labels.activo },
  { value: false, clave: "inactivo", label: labels.inactivo },
];

/**
 * Esquema del formulario de alta/edicion de una comunidad (issue #756: el catalogo territorial
 * no tenia pantalla propia, ver la nota de index.js). `latitud`/`longitud` no llevan campo
 * aqui: se capturan con el mapa de seleccion de ubicacion, no con un input de texto, asi que el
 * componente que arma el formulario los maneja aparte.
 */
export const CAMPOS_COMUNIDAD = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
  {
    id: "municipioId",
    label: "Municipio",
    tipo: TIPOS_DE_CAMPO.SELECT,
    validacion: { requerido: true },
  },
  {
    id: "referenciaAcceso",
    label: "Referencia de acceso",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    placeholder: "Como llegar cuando no hay dirección formal (ej. desvio, punto de referencia)",
  },
  {
    id: "esVigente",
    label: "Vigente",
    tipo: TIPOS_DE_CAMPO.BOOLEANO,
  },
];
