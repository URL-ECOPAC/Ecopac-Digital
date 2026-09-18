// EJEMPLAR DE REFERENCIA de la arquitectura compartida (ver docs/ARQUITECTURA-FRONTEND.md).
//
// Esquema declarativo de los formularios del modulo de pacientes: registro, triaje,
// consulta y receta. Los campos y sus reglas de validacion reflejan las columnas y los
// CHECK de las tablas reales (pacientes/expedientes en 00009 y 00035, triajes en
// 00013, consultas en 00018, recetas/receta_detalle en 00019). Cuando el diccionario
// de datos del entregable y la migracion aplicada no coinciden, manda la migracion
// (ver AGENTS.md, "Fuente de verdad").

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { TIPOS_SANGUINEOS, opcionesDe } from "../enums.js";

/** Valores de idioma_preferido (supabase/migrations/00001_initial_schema.sql). */
/** Valores de tipo_sanguineo (supabase/migrations/00035_pacientes_tipo_sangre_responsable.sql). */
export const OPCIONES_TIPO_SANGRE = opcionesDe(TIPOS_SANGUINEOS, {});

/**
 * Formulario de registro de un paciente nuevo. Cubre pacientes (00009, 00035). El numero de
 * ficha del expediente (00009) no es un campo del formulario: fn_registrar_paciente (00057,
 * 00081) lo genera del lado del servidor, la persona que registra no lo escribe.
 */
export const CAMPOS_REGISTRO_PACIENTE = [
  {
    id: "nombres",
    label: "Nombres",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
  {
    id: "apellidos",
    label: "Apellidos",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
  {
    id: "fechaNacimiento",
    label: "Fecha de nacimiento",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: true },
  },
  {
    id: "sexo",
    label: "Sexo",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "sexo",
    validacion: { requerido: true, maxLongitud: 20 },
  },
  {
    id: "comunidad",
    label: "Comunidad",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "comunidades",
    // Opcional desde la #657: en jornada no siempre se sabe de que comunidad viene la persona, y
    // exigirla llevaba a inventar una o a no registrarla. La columna admite NULL desde la 00111.
    validacion: { requerido: false },
  },
  {
    id: "telefonoContacto",
    label: "Teléfono de contacto",
    tipo: TIPOS_DE_CAMPO.TELEFONO,
    // Opcional desde la #838, por el mismo motivo que la comunidad en la #657: en muchas
    // comunidades no hay ningun numero al que llamar, y exigirlo llevaba a inventar uno -que
    // ademas queda en la ficha clinica como si fuera real- o a no registrar al paciente. La
    // columna admite NULL desde la 00130, y su COMMENT explica que ese telefono muchas veces ni
    // siquiera es del paciente.
    validacion: { requerido: false, maxLongitud: 20 },
  },
  {
    id: "idioma",
    label: "Idioma",
    tipo: TIPOS_DE_CAMPO.SELECT,
    // Desde la 00110 el idioma es un catalogo en la base, no un enum: la lista ya no se puede
    // escribir aqui porque el objetivo es poder agregar idiomas sin desplegar (issue #663).
    opcionesDesde: "idiomas",
    validacion: { requerido: true },
  },
  {
    id: "dpi",
    label: "DPI",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: false, maxLongitud: 20 },
  },
  {
    id: "tipoSangre",
    label: "Tipo sanguineo",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_TIPO_SANGRE,
    validacion: { requerido: false },
  },
  {
    id: "nombreResponsable",
    label: "Nombre del responsable",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: false, maxLongitud: 150 },
  },
  {
    id: "parentescoResponsable",
    label: "Parentesco del responsable",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: false, maxLongitud: 50 },
  },
];

/**
 * El formulario de paciente, agrupado.
 *
 * Once campos en una sola columna obligan a desplazar el modal entero para verlo, y no dicen
 * nada sobre que datos van juntos. Agrupados se leen de una vez y en el mismo orden que la ficha
 * de papel que se sigue usando en jornada: primero quien es, despues donde vive y como se le
 * contacta, despues lo clinico, y al final el responsable -que solo se llena cuando el paciente
 * es menor o no puede responder por si mismo-.
 *
 * Mismo patron que SECCIONES_CONSULTA en consultas.secciones.js: el agrupamiento es una decision
 * de negocio, asi que vive aqui y lo comparten web y movil, no lo decide cada pantalla.
 *
 * Los ids se resuelven contra CAMPOS_REGISTRO_PACIENTE con seccionesConCampos(): repetir aqui la
 * etiqueta o el tipo seria una segunda copia que se desincroniza.
 */
export const SECCIONES_PACIENTE = Object.freeze([
  {
    id: "identificacion",
    titulo: "Identificación",
    descripcion: "Quién es la persona.",
    campos: ["nombres", "apellidos", "fechaNacimiento", "sexo", "dpi"],
  },
  {
    id: "contacto",
    titulo: "Ubicación y contacto",
    descripcion: "Dónde vive y cómo se le localiza.",
    campos: ["comunidad", "telefonoContacto", "idioma"],
  },
  {
    id: "clinicos",
    titulo: "Datos clínicos",
    campos: ["tipoSangre"],
  },
  {
    id: "responsable",
    titulo: "Responsable",
    descripcion: "Solo si la persona es menor de edad o no puede responder por sí misma.",
    campos: ["nombreResponsable", "parentescoResponsable"],
  },
]);

/**
 * Las secciones con su descriptor de campo completo, listas para dibujar.
 *
 * Un id que no exista en CAMPOS_REGISTRO_PACIENTE se descarta en vez de dejar un hueco: es lo
 * que pasaria si alguien renombrara un campo y olvidara esta lista.
 */
export function seccionesDePaciente() {
  return SECCIONES_PACIENTE.map((seccion) => ({
    ...seccion,
    campos: seccion.campos
      .map((id) => CAMPOS_REGISTRO_PACIENTE.find((campo) => campo.id === id))
      .filter(Boolean),
  }));
}

/**
 * Formulario de triaje (triajes, 00013). min/max reproducen los CHECK de la tabla:
 * cambiar un rango aqui sin cambiar la migracion desalinea la validacion del cliente
 * con la de la base de datos.
 */
export const CAMPOS_TRIAJE = [
  {
    id: "presionSistolica",
    label: "Presión sistólica",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "mmHg",
    validacion: { requerido: true, min: 40, max: 300 },
  },
  {
    id: "presionDiastolica",
    label: "Presión diastólica",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "mmHg",
    validacion: { requerido: true, min: 20, max: 200 },
  },
  {
    id: "frecuenciaCardiaca",
    label: "Frecuencia cardiaca",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "lpm",
    validacion: { requerido: true, min: 20, max: 250 },
  },
  {
    id: "glucosa",
    label: "Glucosa",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "mg/dL",
    validacion: { requerido: false, min: 20, max: 800 },
  },
  {
    id: "peso",
    label: "Peso",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "kg",
    validacion: { requerido: false, min: 1, max: 400 },
  },
  {
    id: "talla",
    label: "Talla",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "cm",
    validacion: { requerido: false, min: 30, max: 250 },
  },
  {
    id: "temperatura",
    label: "Temperatura",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "°C",
    validacion: { requerido: false, min: 25, max: 45 },
  },
];

/**
 * Formulario de consulta medica (consultas, 00018). diagnosticos es multi-select
 * sobre el catalogo de diagnosticos (consulta_diagnostico es la tabla de union).
 */
export const CAMPOS_CONSULTA = [
  {
    id: "motivoConsulta",
    label: "Motivo de consulta",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: true },
  },
  {
    id: "antecedentes",
    label: "Antecedentes",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "sintomas",
    label: "Síntomas",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "exploracion",
    label: "Exploración",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "diagnosticos",
    label: "Diagnósticos",
    tipo: TIPOS_DE_CAMPO.MULTI_SELECT,
    opcionesDesde: "diagnosticos",
    validacion: { requerido: false },
  },
  {
    id: "tratamiento",
    label: "Tratamiento",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "observaciones",
    label: "Observaciones",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "planSeguimiento",
    label: "Plan de seguimiento",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
];

/**
 * Subconjunto de CAMPOS_CONSULTA para corregir una consulta ya guardada (issue #756, auditoria
 * campo-a-vista): actualizarConsulta() ya existia y aceptaba estos siete campos, pero ninguna
 * pantalla los pedia.
 *
 * Sin `diagnosticos`: esa columna no es de `consultas` sino de `consulta_diagnostico` (tabla de
 * union), y no es un campo plano de este formulario -es una lista repetible con su propia accion
 * de agregar/quitar, mismo tratamiento que CAMPOS_HITO o CAMPOS_CONDICION_CRONICA frente a sus
 * pantallas de lista. La migracion 00127 le agrego DELETE (antes solo tenia SELECT e INSERT, sin
 * ninguna forma de corregir un diagnostico mal elegido); ModalCorreccionConsulta.jsx la maneja
 * aparte con CAMPOS_AGREGAR_DIAGNOSTICO, no metiendola aqui.
 */
const IDS_CAMPOS_CORRECCION_CONSULTA = [
  "motivoConsulta",
  "antecedentes",
  "sintomas",
  "exploracion",
  "tratamiento",
  "observaciones",
  "planSeguimiento",
];

export const CAMPOS_CORRECCION_CONSULTA = CAMPOS_CONSULTA.filter((campo) =>
  IDS_CAMPOS_CORRECCION_CONSULTA.includes(campo.id),
);

/**
 * Formulario de una sola opcion para agregar un diagnostico a una consulta ya registrada (issue
 * #756, migracion 00127): agregar el correcto despues de quitar uno mal elegido con
 * quitarDiagnosticoDeConsulta() (consultas.api.js). Sin `esPrincipal`: cual diagnostico es el
 * principal se sigue infiriendo del orden de seleccion, mismo criterio que CAMPOS_CONSULTA ya
 * aplicaba al registrar la consulta por primera vez.
 */
export const CAMPOS_AGREGAR_DIAGNOSTICO = [
  {
    id: "diagnostico",
    label: "Diagnóstico",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "diagnosticos",
    validacion: { requerido: true },
  },
];

/**
 * Formulario de receta (recetas + receta_detalle, 00019). medicamentos es una lista
 * repetible: cada fila que el usuario agrega se vuelve un receta_detalle.
 */
export const CAMPOS_RECETA = [
  {
    id: "indicacionesGenerales",
    label: "Indicaciones generales",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "medicamentos",
    label: "Medicamentos recetados",
    tipo: TIPOS_DE_CAMPO.LISTA_REPETIBLE,
    validacion: { requerido: true, minItems: 1 },
    campos: [
      {
        id: "medicamento",
        label: "Medicamento",
        tipo: TIPOS_DE_CAMPO.SELECT,
        opcionesDesde: "medicamentos",
        validacion: { requerido: true },
      },
      {
        id: "lote",
        label: "Lote",
        tipo: TIPOS_DE_CAMPO.SELECT,
        opcionesDesde: "lotes",
        validacion: { requerido: false },
      },
      {
        id: "dosis",
        label: "Dosis",
        tipo: TIPOS_DE_CAMPO.TEXTO,
        validacion: { requerido: true, maxLongitud: 100 },
      },
      {
        id: "frecuencia",
        label: "Frecuencia",
        tipo: TIPOS_DE_CAMPO.TEXTO,
        validacion: { requerido: true, maxLongitud: 100 },
      },
      {
        id: "duracion",
        label: "Duración",
        tipo: TIPOS_DE_CAMPO.TEXTO,
        validacion: { requerido: true, maxLongitud: 100 },
      },
      {
        id: "cantidadEntregada",
        label: "Cantidad entregada",
        tipo: TIPOS_DE_CAMPO.NUMERO,
        validacion: { requerido: true, min: 1 },
      },
    ],
  },
];

export const CAMPOS_PACIENTE = Object.freeze([
  {
    id: "nombres",
    label: "Nombres",
    validacion: {
      requerido: true,
      maxLongitud: 100,
    },
  },
  {
    id: "apellidos",
    label: "Apellidos",
    validacion: {
      requerido: true,
      maxLongitud: 100,
    },
  },
  {
    id: "fechaNacimiento",
    label: "Fecha de nacimiento",
    validacion: {
      requerido: true,
    },
  },
  {
    id: "dpi",
    label: "DPI",
    validacion: {
      requerido: false,
      maxLongitud: 13,
    },
  },
  {
    id: "comunidad",
    label: "Comunidad",
    validacion: {
      // Tambien opcional al editar (#657): si se pudo registrar sin comunidad, obligar a ponerla
      // para corregir cualquier otro dato dejaria la ficha bloqueada.
      requerido: false,
      maxLongitud: 100,
    },
  },
]);
