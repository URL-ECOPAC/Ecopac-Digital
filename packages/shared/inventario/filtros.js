// Filtros de las pantallas de listado del modulo de inventario: catalogo de
// medicamentos, lotes, movimientos (incluida la bandeja de validacion, que es el
// mismo listado filtrado por estado = 'pendiente'), existencias y alertas.
//
// Los valores de select que vienen de un enum de la base de datos NO se escriben aqui: se
// derivan de enums.js, que es donde cada enum esta declarado una sola vez y con la migracion
// que lo define (issue #397). Antes se repetian literales -las siete presentaciones y los dos
// tipos de movimiento estaban byte a byte en campos.js y otra vez aqui-, y nada obligaba a que
// las dos copias coincidieran.

import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "../descriptores.js";
import {
  ESTADOS_ALERTA,
  ESTADOS_MOVIMIENTO,
  ETIQUETAS_ESTADO_ALERTA,
  ETIQUETAS_ESTADO_MOVIMIENTO,
  ETIQUETAS_TIPO_MOVIMIENTO,
  TIPOS_DE_MOVIMIENTO,
  opcionesDe,
} from "../enums.js";

export const FILTROS_PRINCIPIOS_ACTIVOS = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar principio activo",
    placeholder: "Nombre del principio activo",
  },
];

/** Mismo patron que FILTROS_PRINCIPIOS_ACTIVOS (presentaciones, 00144). */
export const FILTROS_PRESENTACIONES = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar presentación",
    placeholder: "Nombre de la presentación",
  },
];

export const FILTROS_MEDICAMENTOS = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar medicamento",
    placeholder: "Nombre, marca, concentración o principio activo",
  },
  // presentacion_id (00144): ya no es un enum fijo -- opcionesDesde carga el catalogo real.
  {
    id: "presentacionId",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Presentación",
    opcionesDesde: "presentaciones",
  },
  // Valores como texto ('true'/'false'), igual que el resto de filtros SELECT del modulo: el
  // hook de pantalla los convierte al tipo real antes de llamar listarMedicamentos({ esPediatrico }).
  {
    id: "esPediatrico",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Población",
    opciones: [
      { value: "true", label: "Pediatrico" },
      { value: "false", label: "Adulto" },
    ],
  },
];

export const FILTROS_LOTES = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar lote",
    placeholder: "Número de lote",
  },
  {
    id: "medicamento",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Medicamento",
    opcionesDesde: "medicamentos",
  },
  {
    id: "proveedor",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Proveedor",
    opcionesDesde: "proveedores",
  },
  {
    id: "fechaVencimiento",
    tipo: TIPOS_DE_FILTRO.RANGO,
    subtipo: SUBTIPOS_DE_RANGO.FECHA,
    label: "Vence entre",
  },
];

// La bandeja de validacion es este mismo listado con el filtro estado fijado en
// 'pendiente' desde el hook de pantalla (use<Pantalla>.js), no un descriptor aparte.
export const FILTROS_MOVIMIENTOS = [
  {
    id: "tipo",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Tipo",
    opciones: opcionesDe(TIPOS_DE_MOVIMIENTO, ETIQUETAS_TIPO_MOVIMIENTO),
  },
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opciones: opcionesDe(ESTADOS_MOVIMIENTO, ETIQUETAS_ESTADO_MOVIMIENTO),
  },
  { id: "bodega", tipo: TIPOS_DE_FILTRO.SELECT, label: "Bodega", opcionesDesde: "bodegas" },
];

// "Mis movimientos" (issue #756). `alcance` solo tiene sentido para quien puede ver movimientos
// ajenos (puedeAprobarMovimiento) -MisMovimientosPage.jsx/MisMovimientosScreen.js lo quitan del
// arreglo para todos los demas roles, que siempre ven solo lo propio sin poder elegir.
export const FILTROS_MIS_MOVIMIENTOS = [
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opciones: opcionesDe(ESTADOS_MOVIMIENTO, ETIQUETAS_ESTADO_MOVIMIENTO),
  },
  {
    id: "alcance",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Ver",
    opciones: [
      { value: "mios", label: "Mis movimientos" },
      { value: "todos", label: "Todos los movimientos" },
    ],
  },
];

export const FILTROS_MIS_MOVIMIENTOS_VACIOS = {
  estado: "",
  alcance: "mios",
};

export const FILTROS_EXISTENCIAS = [
  {
    id: "medicamento",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Medicamento",
    opcionesDesde: "medicamentos",
  },
  { id: "bodega", tipo: TIPOS_DE_FILTRO.SELECT, label: "Bodega", opcionesDesde: "bodegas" },
];

export const FILTROS_ALERTAS = [
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opciones: opcionesDe(ESTADOS_ALERTA, ETIQUETAS_ESTADO_ALERTA),
  },
];
