// Que se muestra de una clinica (issue #927, 00183).

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { labels } from "@ecopac/ui-tokens";

/** Estado de la clinica: `value` es `es_vigente`, `clave` indexa `statusColors`. */
export const ESTADOS_CLINICA = [
  { value: true, clave: "activo", label: labels.activo },
  { value: false, clave: "inactivo", label: labels.inactivo },
];

/** Una clinica en la pantalla del catalogo. */
export const COLUMNAS_CATALOGO_CLINICAS = [
  { id: "nombre", label: "Clínica", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "salasDisponibles", label: "Salas", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    desde: "esVigente",
    etiquetasDesde: "estadoClinica",
  },
];
