// Que se muestra de un area de atencion (issue #927, 00182).

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { labels } from "@ecopac/ui-tokens";

/**
 * Catalogo de la columna de estado: `value` es el booleano de `areas_atencion.es_vigente` y
 * `clave` lo que indexa `statusColors`. Mismo patron que ESTADOS_CONDICION_CATALOGO.
 */
export const ESTADOS_AREA_CATALOGO = [
  { value: true, clave: "activo", label: labels.activo },
  { value: false, clave: "inactivo", label: labels.inactivo },
];

/** Un area en la pantalla de mantenimiento del catalogo. */
export const COLUMNAS_CATALOGO_AREAS = [
  { id: "nombre", label: "Área", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "descripcion", label: "Descripción", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    desde: "esVigente",
    etiquetasDesde: "estadoAreaCatalogo",
  },
];
