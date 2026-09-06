// Columnas de la pantalla de catalogo de diagnosticos (issue #639).
//
// Mismo patron que usuarios/columnas.js para su columna 'estado' (desde: 'activo',
// etiquetasDesde: 'estadoDiagnostico'): la celda guarda un booleano, no el valor de un enum, asi
// que DataList necesita el catalogo para traducirlo a la clave que indexa StatusChip.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { labels } from "@ecopac/ui-tokens";

/** Catalogo para la columna/filtro de estado: value es el booleano que guarda diagnosticos.activo. */
export const ESTADOS_DIAGNOSTICO = [
  { value: true, clave: "activo", label: labels.activo },
  { value: false, clave: "inactivo", label: labels.inactivo },
];

export const COLUMNAS_CATALOGO_DIAGNOSTICOS = [
  { id: "codigo", label: "Codigo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "descripcion", label: "Notas", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    desde: "activo",
    etiquetasDesde: "estadoDiagnostico",
  },
];
