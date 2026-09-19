// EJEMPLAR DE REFERENCIA de la arquitectura compartida (ver docs/ARQUITECTURA-FRONTEND.md).
//
// Esquema declarativo de los formularios del modulo de pacientes: registro, triaje,
// consulta y receta. Los campos y sus reglas de validacion reflejan las columnas y los
// CHECK de las tablas reales (pacientes/expedientes en 00009 y 00035, triajes en
// 00013, consultas en 00018, recetas/receta_detalle en 00019). Cuando el diccionario
// de datos del entregable y la migracion aplicada no coinciden, manda la migracion
// (ver AGENTS.md, "Fuente de verdad").

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { ETIQUETAS_SEXO, SEXOS, TIPOS_SANGUINEOS, opcionesDe } from "../enums.js";

/** Valores de idioma_preferido (supabase/migrations/00001_initial_schema.sql). */
/** Valores de tipo_sanguineo (supabase/migrations/00035_pacientes_tipo_sangre_responsable.sql). */
export const OPCIONES_TIPO_SANGRE = opcionesDe(TIPOS_SANGUINEOS, {});

/**
 * Valores de sexo_paciente (supabase/migrations/00132_sexo_de_paciente_como_enum.sql, issue #699).
 *
 * Vivia escrita a mano dentro de usePacientesListado.js -- un hook, que es el ultimo sitio donde
 * buscarla-, y era el unico vocabulario que tenia la columna: la base no lo hacia cumplir. Ahora sale
 * del enum, como OPCIONES_TIPO_SANGRE de arriba, y nace en un solo archivo (regla del bug #365).
 */
export const OPCIONES_SEXO = opcionesDe(SEXOS, ETIQUETAS_SEXO);

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
    // 13, no 20 (issue #699). Habia tres longitudes a la vez: la columna VARCHAR(20) sin CHECK,
    // este descriptor con 20 y REGEX_DPI con 13. La correcta es 13 -es lo que tiene un DPI
    // guatemalteco- y desde la 00132 la base tambien lo exige (chk_pacientes_dpi_13_digitos).
    validacion: { requerido: false, maxLongitud: 13 },
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
 * Formulario de signos vitales (triajes, 00013). min/max reproducen los CHECK de la tabla:
 * cambiar un rango aqui sin cambiar la migracion desalinea la validacion del cliente
 * con la de la base de datos. Son el limite de lo POSIBLE, no de lo normal: lo alarmante vive
 * en signos.referencias.js.
 *
 * Ninguno es obligatorio desde la 00135 (issue #840): en jornada muchas veces no hay tensiometro,
 * ni glucometro, ni bascula. Lo que si se exige -al menos un signo, y la presion completa- lo
 * valida validarTriaje(), porque es una regla entre campos que un descriptor no expresa.
 *
 * `paso` es el incremento del control numerico: sin el, 36.5 grados no se podia escribir.
 */
export const CAMPOS_TRIAJE = [
  {
    id: "presionSistolica",
    label: "Presión sistólica",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "mmHg",
    validacion: { requerido: false, min: 40, max: 300 },
  },
  {
    id: "presionDiastolica",
    label: "Presión diastólica",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "mmHg",
    validacion: { requerido: false, min: 20, max: 200 },
  },
  {
    id: "frecuenciaCardiaca",
    label: "Frecuencia cardiaca",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "lpm",
    validacion: { requerido: false, min: 20, max: 250 },
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
    paso: 0.1,
    validacion: { requerido: false, min: 1, max: 400 },
  },
  {
    id: "talla",
    label: "Talla",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "cm",
    paso: 0.1,
    validacion: { requerido: false, min: 30, max: 250 },
  },
  {
    id: "temperatura",
    label: "Temperatura",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "°C",
    paso: 0.1,
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

// CAMPOS_CORRECCION_CONSULTA y CAMPOS_AGREGAR_DIAGNOSTICO se retiraron con la #840 (regla B1):
// corregir una consulta usa ahora el mismo formulario que registrarla, CAMPOS_CONSULTA completo,
// y los diagnosticos se agregan o se quitan en la misma lista (useConsulta.js calcula la
// diferencia con cambiosDeDiagnosticos()).

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

// CAMPOS_PACIENTE se borro en la #699. Era un segundo descriptor de la misma entidad, con cinco
// campos de los once, y ya no lo montaba ninguna pantalla: la edicion usa CAMPOS_REGISTRO_PACIENTE
// desde useEdicionPaciente.js y actualizarPaciente() valida con validarRegistroPaciente(). Lo unico
// que seguia vivo eran sus propias pruebas. Con el se van sus dos incoherencias: un maxLongitud de
// 100 sobre lo que es un UUID (comunidad) y un DPI de 13 frente al de 20 del otro descriptor.
