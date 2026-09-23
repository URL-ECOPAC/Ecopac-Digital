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

import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "../descriptores.js";
import { ESTADOS_DE_VENCIMIENTO_REPORTE, HORIZONTES_DISPONIBLES } from "./campos.js";
import { HORIZONTE_POR_DEFECTO_EN_DIAS } from "./vencimientos.api.js";

export const FILTROS_REPORTES = [
  {
    id: "periodo",
    tipo: TIPOS_DE_FILTRO.RANGO,
    subtipo: SUBTIPOS_DE_RANGO.FECHA,
    label: "Período",
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

/**
 * Valor inicial de la barra comun, para que las cuatro pantallas arranquen igual.
 *
 * `periodo` usa `{ min, max }` y no `{ fechaInicio, fechaFin }` -pese a que el descriptor de
 * arriba documenta esos nombres como destino de traduccion- porque es el contrato real, ya en
 * produccion, que FilterBar (apps/web/src/components/FilterBar.jsx y su equivalente movil)
 * espera leer y escribir para cualquier filtro `TIPOS_DE_FILTRO.RANGO`: mismo patron que
 * `rangoEdad` en pacientes/filtros.js. Corregido en la issue #208 al construir
 * useFiltrosReportes.js y notar que esta constante, tal como estaba, no coincidia con lo que
 * FilterBar de verdad ata -un valor que nunca se habia probado contra el componente real-.
 */
export const FILTROS_REPORTES_VACIOS = {
  periodo: { min: null, max: null },
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
    // ISSUE #862: obtenerReporteDeInventario acepta `medicamento` desde que se escribio, y el
    // descriptor no lo declaraba, asi que no habia forma de filtrar por uno. Con cientos de
    // medicamentos era el filtro que mas falta hacia.
    id: "medicamento",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Medicamento",
    opcionesDesde: "medicamentos",
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
  medicamento: null,
  estadoVencimiento: null,
};

/**
 * Filtros del reporte de medicamentos proximos a vencer (issue #862).
 *
 * No existian: esa pestana dibujaba dos <select> a mano en ReportesPage.jsx, fuera de FilterBar y
 * fuera de todo descriptor, y era la unica del modulo que lo hacia.
 *
 * Los cuatro son exactamente los parametros que acepta obtenerReporteDeVencimientos. Se leyo esa
 * funcion antes de declararlos; ninguno esta adivinado. Nota: NO hay filtro por comunidad, aunque
 * el hook anterior tuviera un `comunidadId` con su setter. No se puede: `bodegas` no tiene
 * `comunidad_id` y `existencias` se agrupa por lote y bodega, asi que el stock no tiene dimension
 * de comunidad. Aquel filtro nunca llego a entrar en la consulta.
 */
export const FILTROS_VENCIMIENTOS = [
  {
    id: "horizonteDias",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Horizonte",
    opciones: HORIZONTES_DISPONIBLES,
  },
  {
    id: "bodega",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Bodega",
    opcionesDesde: "bodegas",
  },
  {
    id: "medicamento",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Medicamento",
    opcionesDesde: "medicamentos",
  },
  {
    id: "estadoVencimiento",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado de vencimiento",
    opciones: ESTADOS_DE_VENCIMIENTO_REPORTE,
  },
];

/**
 * El horizonte arranca en el valor por defecto y no en null: a diferencia de los demas, "sin
 * horizonte" no es un estado valido de este reporte -seria traer el inventario entero-, asi que
 * limpiar los filtros lo devuelve al mes, que es la alerta operativa de RF-33.
 */
export const FILTROS_VENCIMIENTOS_VACIOS = {
  horizonteDias: HORIZONTE_POR_DEFECTO_EN_DIAS,
  bodega: null,
  medicamento: null,
  estadoVencimiento: null,
};
