// Filtros de la ventana de notificaciones (issue #755). Se declaran una vez aqui y los dibujan el
// FilterBar de la web y el del movil, igual que FILTROS_PACIENTE (pacientes/filtros.js).
//
// Un valor null en un select es "Todos": sin categoria elegida se ven todas, sin estado elegido
// se ven leidas y sin leer.

import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { DESCRIPTORES_CATEGORIA_NOTIFICACION } from "./categorias.js";

export const ESTADOS_DE_LECTURA = Object.freeze({
  SIN_LEER: "sin-leer",
  LEIDAS: "leidas",
});

export const FILTROS_NOTIFICACIONES = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar",
    placeholder: "Medicamento, lote, concepto...",
  },
  {
    id: "categoria",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Categoría",
    opciones: DESCRIPTORES_CATEGORIA_NOTIFICACION.map((d) => ({
      value: d.categoria,
      label: d.etiqueta,
    })),
  },
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opciones: [
      { value: ESTADOS_DE_LECTURA.SIN_LEER, label: "Sin leer" },
      { value: ESTADOS_DE_LECTURA.LEIDAS, label: "Leídas" },
    ],
  },
];

export const FILTROS_NOTIFICACIONES_VACIOS = Object.freeze({
  busqueda: "",
  categoria: null,
  estado: null,
});

/**
 * Si hay algun filtro activo en la bandeja de notificaciones.
 *
 * @param {{ busqueda?: string, categoria?: string, estado?: string }} filtros
 * @returns {boolean}
 */
export function hayFiltrosDeNotificaciones(filtros) {
  return Boolean(filtros.busqueda?.trim() || filtros.categoria || filtros.estado);
}

/**
 * Aplica los filtros sin cambiar el orden (el de llegada, que trae la API).
 *
 * @param {object[]} notificaciones
 * @param {{ busqueda?: string, categoria?: string|null, estado?: string|null }} filtros
 */
export function filtrarNotificaciones(notificaciones, filtros) {
  const termino = (filtros.busqueda ?? "").trim().toLowerCase();

  return notificaciones.filter((n) => {
    if (filtros.categoria && n.categoria !== filtros.categoria) return false;
    if (filtros.estado === ESTADOS_DE_LECTURA.SIN_LEER && n.leida) return false;
    if (filtros.estado === ESTADOS_DE_LECTURA.LEIDAS && !n.leida) return false;
    if (termino && !`${n.titulo} ${n.cuerpo}`.toLowerCase().includes(termino)) return false;
    return true;
  });
}
