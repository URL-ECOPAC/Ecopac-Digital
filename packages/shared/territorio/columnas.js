import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

/**
 * Columnas del catalogo de comunidades (issue #756). `ubicacion` es booleana (tiene o no
 * coordenadas capturadas) y no las coordenadas mismas: dos numeros de seis decimales no le
 * dicen nada a quien administra el catalogo, y el punto exacto ya se ve -y se corrige- en el
 * mapa del formulario.
 */
export const COLUMNAS_COMUNIDAD = [
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "municipioNombre", label: "Municipio", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "departamentoNombre", label: "Departamento", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "ubicacion", label: "Ubicación en mapa", tipo: TIPOS_DE_PRESENTACION.BOOLEANO },
  {
    id: "esVigente",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadosVigencia",
  },
];
