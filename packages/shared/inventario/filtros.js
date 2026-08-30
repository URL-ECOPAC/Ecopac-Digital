// Filtros de las pantallas de listado del modulo de inventario: catalogo de
// medicamentos, lotes, movimientos (incluida la bandeja de validacion, que es el
// mismo listado filtrado por estado = 'pendiente'), existencias y alertas.
//
// Los valores de select que vienen de un enum de la base de datos NO se escriben aqui: se
// derivan de enums.js, que es donde cada enum esta declarado una sola vez y con la migracion
// que lo define (issue #397). Antes se repetian literales -las siete presentaciones y los dos
// tipos de movimiento estaban byte a byte en campos.js y otra vez aqui-, y nada obligaba a que
// las dos copias coincidieran.

import { TIPOS_DE_FILTRO } from "../descriptores.js";
import {
  ESTADOS_ALERTA,
  ESTADOS_MOVIMIENTO,
  ETIQUETAS_ESTADO_ALERTA,
  ETIQUETAS_ESTADO_MOVIMIENTO,
  ETIQUETAS_PRESENTACION,
  ETIQUETAS_TIPO_MOVIMIENTO,
  PRESENTACIONES_DE_MEDICAMENTO,
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

export const FILTROS_MEDICAMENTOS = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar medicamento",
    placeholder: "Nombre, marca, concentracion o principio activo",
  },
  {
    id: "presentacion",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Presentacion",
    opciones: opcionesDe(PRESENTACIONES_DE_MEDICAMENTO, ETIQUETAS_PRESENTACION),
  },
  // Valores como texto ('true'/'false'), igual que el resto de filtros SELECT del modulo: el
  // hook de pantalla los convierte al tipo real antes de llamar listarMedicamentos({ esPediatrico }).
  {
    id: "esPediatrico",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Poblacion",
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
    placeholder: "Numero de lote",
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
  { id: "fechaVencimiento", tipo: TIPOS_DE_FILTRO.RANGO, label: "Vence entre" },
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
