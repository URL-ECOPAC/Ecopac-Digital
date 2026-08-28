// Filtros de las pantallas de reporte (issue #289).
//
// FILTROS_REPORTES es la barra comun que #208/#210 comparten entre las cuatro pantallas de
// reporte: periodo, comunidad, jornada y proyecto. `periodo` sigue exactamente el patron de
// presupuestos/filtros.js (`fecha`, RANGO con desde/hasta) en vez de dos filtros de fecha
// sueltos: es el mismo dato -un rango- para cualquiera de los cuatro reportes.
//
// Los presets ("este mes", "ultimo trimestre", "este anio") que pide #208 no son parte de este
// descriptor: son estado con logica (que preset esta activo, como se resuelve a fechaInicio/
// fechaFin concretas), y eso lo decide el hook de #208, no una declaracion de FilterBar. Este
// archivo solo declara que el filtro `periodo` existe y que forma tiene su valor
// (fechaInicio/fechaFin); resolver "este mes" a esas dos fechas es trabajo de #208.
//
// Ver packages/shared/pacientes/filtros.js, que es el ejemplar de referencia del patron (en su
// version ya corregida por la issue #398, todavia no mergeada a develop en el momento de
// escribir esto -- ver el contexto del plan).

import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { ESTADOS_DE_VENCIMIENTO_REPORTE } from "./campos.js";

export const FILTROS_REPORTES = [
  {
    id: "periodo",
    tipo: TIPOS_DE_FILTRO.RANGO,
    label: "Periodo",
    // obtenerIndicadoresImpacto() y obtenerReportePacientesAtendidos() reciben el rango con
    // nombres distintos (periodo:{fechaInicio,fechaFin} vs. desde/hasta sueltos): homogeneizar
    // eso es trabajo del hook de #208 al llamar a cada API, no de este descriptor.
    desde: "fechaInicio",
    hasta: "fechaFin",
  },
  {
    id: "comunidad",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Comunidad",
    opcionesDesde: "comunidades",
  },
  {
    id: "jornada",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Jornada",
    opcionesDesde: "jornadas",
  },
  {
    id: "proyecto",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Proyecto",
    opcionesDesde: "proyectos",
  },
];

/** Valor inicial de la barra comun, para que las cuatro pantallas arranquen igual. */
export const FILTROS_REPORTES_VACIOS = {
  periodo: { fechaInicio: null, fechaFin: null },
  comunidad: null,
  jornada: null,
  proyecto: null,
};

/**
 * Filtros propios del reporte de inventario (#212), ademas de la barra comun. `estadoVencimiento`
 * reutiliza el catalogo de campos.js directo por `opciones`, igual que
 * presupuestos/filtros.js hace con OPCIONES_ESTADO_GASTO: son valores fijos del dominio, no un
 * catalogo que dependa de una consulta a la base.
 */
export const FILTROS_INVENTARIO_REPORTE = [
  {
    id: "bodega",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Bodega",
    opcionesDesde: "bodegas",
  },
  {
    id: "estadoVencimiento",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado de vencimiento",
    opciones: ESTADOS_DE_VENCIMIENTO_REPORTE,
  },
];

export const FILTROS_INVENTARIO_REPORTE_VACIOS = {
  bodega: null,
  estadoVencimiento: null,
};
