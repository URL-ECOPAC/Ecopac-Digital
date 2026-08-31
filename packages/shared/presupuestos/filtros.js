// Filtros de las pantallas de listado de gastos (issue #288).
//
// Reescrito para que FilterBar los pueda dibujar. La version anterior era un objeto con tipos
// crudos ('select', 'date') y `opcionesOrigen`; FilterBar recorre una LISTA, compara el tipo contra
// TIPOS_DE_FILTRO y resuelve las opciones por `opcionesDesde`
// (apps/web/src/components/FilterBar.jsx), asi que no dibujaba ningun control.
//
// `fecha_inicio` y `fecha_fin` eran dos filtros de tipo 'date' sueltos; aqui van como un solo
// filtro RANGO sobre la columna `fecha`, que es lo que ya acepta listarGastos() en
// presupuestos/api.js.
//
// Ver packages/shared/pacientes/filtros.js, que es el ejemplar de referencia.

import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "../descriptores.js";
import { OPCIONES_CATEGORIA_GASTO, OPCIONES_ESTADO_GASTO } from "./campos.js";

export const FILTROS_GASTO = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar gasto",
    placeholder: "Concepto del gasto",
  },
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    // Las opciones son valores del enum del dominio, asi que viajan con el descriptor en vez de
    // resolverse contra un catalogo de la base.
    opciones: OPCIONES_ESTADO_GASTO,
  },
  {
    id: "categoria",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Categoria",
    opciones: OPCIONES_CATEGORIA_GASTO,
  },
  {
    id: "jornada_id",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Jornada",
    opcionesDesde: "jornadas",
  },
  {
    // No es una columna de gastos: listarGastos() lo resuelve por el join con jornadas
    // (jornadas.proyecto_id).
    id: "proyecto_id",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Proyecto",
    opcionesDesde: "proyectos",
  },
  {
    id: "fecha",
    tipo: TIPOS_DE_FILTRO.RANGO,
    subtipo: SUBTIPOS_DE_RANGO.FECHA,
    label: "Fecha del gasto",
    // listarGastos() recibe el rango como fecha_inicio / fecha_fin y lo aplica sobre la columna
    // `fecha` con gte/lte.
    desde: "fecha_inicio",
    hasta: "fecha_fin",
  },
];
