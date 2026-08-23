// EJEMPLAR DE REFERENCIA de la arquitectura compartida (ver docs/ARQUITECTURA-FRONTEND.md).
//
// Esquema declarativo de los formularios del modulo de pacientes: registro, triaje,
// consulta y receta. Los campos y sus reglas de validacion reflejan las columnas y los
// CHECK de las tablas reales (pacientes/expedientes en 00009 y 00035, triajes en
// 00013, consultas en 00018, recetas/receta_detalle en 00019). Cuando el diccionario
// de datos del entregable y la migracion aplicada no coinciden, manda la migracion
// (ver AGENTS.md, "Fuente de verdad").

import { TIPOS_DE_CAMPO } from '../descriptores.js';

/** Valores de idioma_preferido (supabase/migrations/00001_initial_schema.sql). */
export const OPCIONES_IDIOMA = [
  { valor: 'espanol', etiqueta: 'Español' },
  { valor: 'quiche', etiqueta: "K'iche'" },
  { valor: 'mam', etiqueta: 'Mam' },
  { valor: 'otros', etiqueta: 'Otro' },
];

/** Valores de tipo_sanguineo (supabase/migrations/00035_pacientes_tipo_sangre_responsable.sql). */
export const OPCIONES_TIPO_SANGRE = [
  { valor: 'A+', etiqueta: 'A+' },
  { valor: 'A-', etiqueta: 'A-' },
  { valor: 'B+', etiqueta: 'B+' },
  { valor: 'B-', etiqueta: 'B-' },
  { valor: 'AB+', etiqueta: 'AB+' },
  { valor: 'AB-', etiqueta: 'AB-' },
  { valor: 'O+', etiqueta: 'O+' },
  { valor: 'O-', etiqueta: 'O-' },
];

/**
 * Formulario de registro de un paciente nuevo. Cubre pacientes (00009, 00035) y el
 * numero de ficha de expedientes (00009): las dos filas se crean juntas.
 */
export const CAMPOS_REGISTRO_PACIENTE = [
  { id: 'nombres', label: 'Nombres', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
  { id: 'apellidos', label: 'Apellidos', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
  { id: 'fechaNacimiento', label: 'Fecha de nacimiento', tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: true } },
  { id: 'sexo', label: 'Sexo', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 20 } },
  { id: 'comunidad', label: 'Comunidad', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'comunidades', validacion: { requerido: true } },
  { id: 'telefonoContacto', label: 'Telefono de contacto', tipo: TIPOS_DE_CAMPO.TELEFONO, validacion: { requerido: true, maxLongitud: 20 } },
  { id: 'idioma', label: 'Idioma', tipo: TIPOS_DE_CAMPO.SELECT, opciones: OPCIONES_IDIOMA, validacion: { requerido: true } },
  { id: 'dpi', label: 'DPI', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: false, maxLongitud: 20 } },
  { id: 'tipoSangre', label: 'Tipo sanguineo', tipo: TIPOS_DE_CAMPO.SELECT, opciones: OPCIONES_TIPO_SANGRE, validacion: { requerido: false } },
  { id: 'nombreResponsable', label: 'Nombre del responsable', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: false, maxLongitud: 150 } },
  { id: 'parentescoResponsable', label: 'Parentesco del responsable', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: false, maxLongitud: 50 } },
  { id: 'numeroFicha', label: 'Numero de ficha', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 30 } },
];

/**
 * Formulario de triaje (triajes, 00013). min/max reproducen los CHECK de la tabla:
 * cambiar un rango aqui sin cambiar la migracion desalinea la validacion del cliente
 * con la de la base de datos.
 */
export const CAMPOS_TRIAJE = [
  { id: 'presionSistolica', label: 'Presion sistolica', tipo: TIPOS_DE_CAMPO.NUMERO, sufijo: 'mmHg', validacion: { requerido: true, min: 40, max: 300 } },
  { id: 'presionDiastolica', label: 'Presion diastolica', tipo: TIPOS_DE_CAMPO.NUMERO, sufijo: 'mmHg', validacion: { requerido: true, min: 20, max: 200 } },
  { id: 'frecuenciaCardiaca', label: 'Frecuencia cardiaca', tipo: TIPOS_DE_CAMPO.NUMERO, sufijo: 'lpm', validacion: { requerido: true, min: 20, max: 250 } },
  { id: 'glucosa', label: 'Glucosa', tipo: TIPOS_DE_CAMPO.NUMERO, sufijo: 'mg/dL', validacion: { requerido: false, min: 20, max: 800 } },
  { id: 'peso', label: 'Peso', tipo: TIPOS_DE_CAMPO.NUMERO, sufijo: 'kg', validacion: { requerido: false, min: 1, max: 400 } },
  { id: 'talla', label: 'Talla', tipo: TIPOS_DE_CAMPO.NUMERO, sufijo: 'cm', validacion: { requerido: false, min: 30, max: 250 } },
  { id: 'temperatura', label: 'Temperatura', tipo: TIPOS_DE_CAMPO.NUMERO, sufijo: '°C', validacion: { requerido: false, min: 25, max: 45 } },
];

/**
 * Formulario de consulta medica (consultas, 00018). diagnosticos es multi-select
 * sobre el catalogo de diagnosticos (consulta_diagnostico es la tabla de union).
 */
export const CAMPOS_CONSULTA = [
  { id: 'motivoConsulta', label: 'Motivo de consulta', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: true } },
  { id: 'antecedentes', label: 'Antecedentes', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
  { id: 'sintomas', label: 'Sintomas', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
  { id: 'exploracion', label: 'Exploracion', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
  { id: 'diagnosticos', label: 'Diagnosticos', tipo: TIPOS_DE_CAMPO.MULTI_SELECT, opcionesDesde: 'diagnosticos', validacion: { requerido: false } },
  { id: 'tratamiento', label: 'Tratamiento', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
  { id: 'observaciones', label: 'Observaciones', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
  { id: 'planSeguimiento', label: 'Plan de seguimiento', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
];

/**
 * Formulario de receta (recetas + receta_detalle, 00019). medicamentos es una lista
 * repetible: cada fila que el usuario agrega se vuelve un receta_detalle.
 */
export const CAMPOS_RECETA = [
  { id: 'indicacionesGenerales', label: 'Indicaciones generales', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
  {
    id: 'medicamentos',
    label: 'Medicamentos recetados',
    tipo: TIPOS_DE_CAMPO.LISTA_REPETIBLE,
    validacion: { requerido: true, minItems: 1 },
    campos: [
      { id: 'medicamento', label: 'Medicamento', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'medicamentos', validacion: { requerido: true } },
      { id: 'lote', label: 'Lote', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'lotes', validacion: { requerido: false } },
      { id: 'dosis', label: 'Dosis', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
      { id: 'frecuencia', label: 'Frecuencia', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
      { id: 'duracion', label: 'Duracion', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
      { id: 'cantidadEntregada', label: 'Cantidad entregada', tipo: TIPOS_DE_CAMPO.NUMERO, validacion: { requerido: true, min: 1 } },
    ],
  },
];
