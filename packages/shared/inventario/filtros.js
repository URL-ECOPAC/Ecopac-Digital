// Filtros de las pantallas de listado del modulo de inventario: catalogo de
// medicamentos, lotes, movimientos (incluida la bandeja de validacion, que es el
// mismo listado filtrado por estado = 'pendiente'), existencias y alertas.
//
// Los valores de select que vienen de un enum de la base de datos se escriben
// literales, tal como estan en la migracion vigente (ver campos.js para el detalle de
// que migracion define cada uno): no se inventan valores nuevos ni se reusan los del
// diccionario de datos original cuando la migracion aplicada los cambio.

import { TIPOS_DE_FILTRO } from '../descriptores.js';

export const FILTROS_PRINCIPIOS_ACTIVOS = [
  { id: 'busqueda', tipo: TIPOS_DE_FILTRO.BUSQUEDA, label: 'Buscar principio activo', placeholder: 'Nombre del principio activo' },
];

export const FILTROS_MEDICAMENTOS = [
  { id: 'busqueda', tipo: TIPOS_DE_FILTRO.BUSQUEDA, label: 'Buscar medicamento', placeholder: 'Nombre, marca, concentracion o principio activo' },
  {
    id: 'presentacion',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Presentacion',
    opciones: [
      { value: 'tableta', label: 'Tableta' },
      { value: 'jarabe', label: 'Jarabe' },
      { value: 'capsula', label: 'Capsula' },
      { value: 'inyectable', label: 'Inyectable' },
      { value: 'pomada', label: 'Pomada' },
      { value: 'gotas ophthalmic', label: 'Gotas oftalmicas' },
      { value: 'gotas otic', label: 'Gotas oticas' },
    ],
  },
  // Valores como texto ('true'/'false'), igual que el resto de filtros SELECT del modulo: el
  // hook de pantalla los convierte al tipo real antes de llamar listarMedicamentos({ esPediatrico }).
  {
    id: 'esPediatrico',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Poblacion',
    opciones: [
      { value: 'true', label: 'Pediatrico' },
      { value: 'false', label: 'Adulto' },
    ],
  },
];

export const FILTROS_LOTES = [
  { id: 'busqueda', tipo: TIPOS_DE_FILTRO.BUSQUEDA, label: 'Buscar lote', placeholder: 'Numero de lote' },
  { id: 'medicamento', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Medicamento', opcionesDesde: 'medicamentos' },
  { id: 'proveedor', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Proveedor', opcionesDesde: 'proveedores' },
  { id: 'fechaVencimiento', tipo: TIPOS_DE_FILTRO.RANGO, label: 'Vence entre' },
];

// La bandeja de validacion es este mismo listado con el filtro estado fijado en
// 'pendiente' desde el hook de pantalla (use<Pantalla>.js), no un descriptor aparte.
export const FILTROS_MOVIMIENTOS = [
  {
    id: 'tipo',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Tipo',
    opciones: [
      { value: 'ingreso', label: 'Ingreso' },
      { value: 'salida', label: 'Salida' },
    ],
  },
  {
    id: 'estado',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Estado',
    opciones: [
      { value: 'pendiente', label: 'Pendiente' },
      { value: 'aprobado', label: 'Aprobado' },
      { value: 'rechazado', label: 'Rechazado' },
    ],
  },
  { id: 'bodega', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Bodega', opcionesDesde: 'bodegas' },
];

export const FILTROS_EXISTENCIAS = [
  { id: 'medicamento', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Medicamento', opcionesDesde: 'medicamentos' },
  { id: 'bodega', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Bodega', opcionesDesde: 'bodegas' },
];

export const FILTROS_ALERTAS = [
  {
    id: 'estado',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Estado',
    opciones: [
      { value: 'pendiente', label: 'Pendiente' },
      { value: 'atendida', label: 'Atendida' },
    ],
  },
];
