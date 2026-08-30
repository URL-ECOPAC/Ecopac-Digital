// Los enums del dominio, una sola vez cada uno (issue #397).
//
// POR QUE EXISTE
//
// Cada enum estaba escrito literal en dos, tres y hasta cinco archivos: el objeto con el que
// compara el codigo, el catalogo con el que se dibuja un select, las claves de statusColors en
// ui-tokens y, a veces, una tercera copia dentro de un filtro. Como son cadenas sueltas, nada
// obligaba a que coincidieran, y ya habia casos donde no coincidian.
//
// Es el mismo razonamiento que descriptores.js: vocabulario que usan todos los modulos y que
// tiene que estar declarado UNA sola vez. Y la misma regla practica de la issue #365: un nombre
// que el barril reciba desde dos archivos queda ambiguo y ESM lo excluye del namespace, asi que
// cada uno de estos nombres nace aqui y en ningun otro sitio.
//
// LA BASE DE DATOS MANDA
//
// Los valores son exactamente los del enum en supabase/migrations/. Cada bloque dice cual
// migracion lo define, y **cuando una posterior lo redefinio, cita la vigente**: la 00001
// declaro estado_movimiento y tipo_movimiento, pero la 00023 los borro con DROP TYPE ... CASCADE
// y los recreo distintos. Escribir aqui un valor que el enum no tiene no rompe nada al importar:
// falla al escribir en la base, lejos de donde se escribio el error.
//
// LOS VALORES SON DE AQUI, EL TEXTO ES DE ui-tokens
//
// Las etiquetas que ya viven en `labels` de @ecopac/ui-tokens se referencian, no se copian: ese
// paquete es la fuente del texto que ve la persona (criterio de la issue #287). Solo se escribe
// texto aqui cuando ui-tokens no lo tiene.
//
// QUE NO ESTA AQUI, A PROPOSITO
//
//   - `rol_usuario`, que vive en usuarios/roles.js. Ya era fuente unica -es el patron que este
//     archivo copia- y lleva helpers propios (esAdministrador, etiquetaDeRol, los grupos de
//     roles). Moverlo seria churn sin ganancia.
//   - `operacion_auditoria` (00026), que ningun archivo de packages/ nombra.
//   - TIPOS_DE_EVENTO y ESTADOS_DE_VENCIMIENTO, que **no son enums de la base**: son vocabularios
//     del cliente. Ponerlos aqui los haria pasar por respaldados por el esquema.

import { labels } from "@ecopac/ui-tokens";

/**
 * Catalogo `{ label, value }` a partir de un enum y su mapa de etiquetas.
 *
 * Es lo que evita que un catalogo vuelva a escribir los valores: se derivan del enum, en el
 * orden en que este los declara, que es el mismo del `CREATE TYPE`.
 */
export function opcionesDe(valores, etiquetas) {
  return Object.values(valores).map((value) => ({ value, label: etiquetas[value] ?? value }));
}

/**
 * Igual, pero agregando `clave`, el tercer campo que lleva un catalogo de estado.
 *
 * `clave` es el valor del enum con el que DataList indexa statusColors, y `value` es lo que
 * guarda la columna. Cuando la columna guarda el enum tal cual, los dos coinciden y esta funcion
 * lo dice explicitamente en un solo sitio, en vez de que cada catalogo repita el valor dos veces
 * -que es como estaban antes, y nada obligaba a que las dos copias fueran iguales-.
 *
 * Los catalogos donde NO coinciden -una columna booleana como donantes.activo, que guarda
 * true/false y colorea por 'activo'/'inactivo'- se escriben a mano y no usan esto.
 */
export function opcionesConClave(valores, etiquetas) {
  return opcionesDe(valores, etiquetas).map((opcion) => ({ ...opcion, clave: opcion.value }));
}

// --- Jornadas -------------------------------------------------------------------------------

/** `estado_jornada` (00001_initial_schema.sql). */
export const ESTADOS_JORNADA = Object.freeze({
  PLANIFICADA: "planificada",
  EN_CURSO: "en curso",
  FINALIZADA: "finalizada",
  CANCELADA: "cancelada",
});

export const ETIQUETAS_ESTADO_JORNADA = Object.freeze({
  [ESTADOS_JORNADA.PLANIFICADA]: labels.jornadaPlanificada,
  [ESTADOS_JORNADA.EN_CURSO]: labels.jornadaEnCurso,
  [ESTADOS_JORNADA.FINALIZADA]: labels.jornadaFinalizada,
  [ESTADOS_JORNADA.CANCELADA]: labels.jornadaCancelada,
});

// --- Proyectos ------------------------------------------------------------------------------

/**
 * `estado_proyecto` (00007_proyectos.sql).
 *
 * Gemelo masculino de estado_jornada: mismos cuatro estados, distinto genero gramatical. Son
 * dos enums distintos en la base y no se pueden compartir, aunque 'en curso' coincida.
 */
export const ESTADOS_PROYECTO = Object.freeze({
  PLANIFICADO: "planificado",
  EN_CURSO: "en curso",
  FINALIZADO: "finalizado",
  CANCELADO: "cancelado",
});

export const ETIQUETAS_ESTADO_PROYECTO = Object.freeze({
  [ESTADOS_PROYECTO.PLANIFICADO]: labels.proyectoPlanificado,
  // Mismo texto exacto que la jornada: ui-tokens no duplica la entrada.
  [ESTADOS_PROYECTO.EN_CURSO]: labels.jornadaEnCurso,
  [ESTADOS_PROYECTO.FINALIZADO]: labels.proyectoFinalizado,
  [ESTADOS_PROYECTO.CANCELADO]: labels.proyectoCancelado,
});

// --- Inventario -----------------------------------------------------------------------------

/**
 * `estado_movimiento` **vigente**, el de la 00023_movimientos_inventario.sql.
 *
 * La 00001 lo declaro con 'pendiente de validacion'; la 00023 lo borro con DROP TYPE ... CASCADE
 * y lo recreo con 'pendiente'. Ese valor viejo dejo rastros que esta issue retira.
 */
export const ESTADOS_MOVIMIENTO = Object.freeze({
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
});

export const ETIQUETAS_ESTADO_MOVIMIENTO = Object.freeze({
  [ESTADOS_MOVIMIENTO.PENDIENTE]: "Pendiente",
  [ESTADOS_MOVIMIENTO.APROBADO]: labels.aprobado,
  [ESTADOS_MOVIMIENTO.RECHAZADO]: labels.rechazado,
});

/**
 * `tipo_movimiento` **vigente**, el de la 00023_movimientos_inventario.sql.
 *
 * La 00001 lo declaro con cinco valores ('ingreso compra', 'ingreso donacion',
 * 'salida dispensacion', 'salida ajuste', 'traslado'); la 00023 lo redujo a dos.
 */
export const TIPOS_DE_MOVIMIENTO = Object.freeze({
  INGRESO: "ingreso",
  SALIDA: "salida",
});

export const ETIQUETAS_TIPO_MOVIMIENTO = Object.freeze({
  [TIPOS_DE_MOVIMIENTO.INGRESO]: "Ingreso",
  [TIPOS_DE_MOVIMIENTO.SALIDA]: "Salida",
});

/** `estado_alerta` (00021_alertas_caducidad.sql). */
export const ESTADOS_ALERTA = Object.freeze({
  PENDIENTE: "pendiente",
  ATENDIDA: "atendida",
});

export const ETIQUETAS_ESTADO_ALERTA = Object.freeze({
  [ESTADOS_ALERTA.PENDIENTE]: "Pendiente",
  [ESTADOS_ALERTA.ATENDIDA]: "Atendida",
});

/** `accion_alerta` (00021_alertas_caducidad.sql). */
export const ACCIONES_DE_ALERTA = Object.freeze({
  DONADO: "donado",
  REUBICADO: "reubicado",
  DESCARTADO: "descartado",
});

export const ETIQUETAS_ACCION_ALERTA = Object.freeze({
  [ACCIONES_DE_ALERTA.DONADO]: "Donado",
  [ACCIONES_DE_ALERTA.REUBICADO]: "Reubicado",
  [ACCIONES_DE_ALERTA.DESCARTADO]: "Descartado",
});

/** `presentacion_medicamento` (00001_initial_schema.sql). */
export const PRESENTACIONES_DE_MEDICAMENTO = Object.freeze({
  TABLETA: "tableta",
  JARABE: "jarabe",
  CAPSULA: "capsula",
  INYECTABLE: "inyectable",
  POMADA: "pomada",
  GOTAS_OFTALMICAS: "gotas ophthalmic",
  GOTAS_OTICAS: "gotas otic",
});

export const ETIQUETAS_PRESENTACION = Object.freeze({
  [PRESENTACIONES_DE_MEDICAMENTO.TABLETA]: "Tableta",
  [PRESENTACIONES_DE_MEDICAMENTO.JARABE]: "Jarabe",
  [PRESENTACIONES_DE_MEDICAMENTO.CAPSULA]: "Capsula",
  [PRESENTACIONES_DE_MEDICAMENTO.INYECTABLE]: "Inyectable",
  [PRESENTACIONES_DE_MEDICAMENTO.POMADA]: "Pomada",
  // El valor del enum esta en ingles y la etiqueta en espanol: no se corrige el enum, se traduce.
  [PRESENTACIONES_DE_MEDICAMENTO.GOTAS_OFTALMICAS]: "Gotas oftalmicas",
  [PRESENTACIONES_DE_MEDICAMENTO.GOTAS_OTICAS]: "Gotas oticas",
});

/** `origen_lote` (00020_lotes_existencias.sql). */
export const ORIGENES_DE_LOTE = Object.freeze({
  COMPRA: "compra",
  DONACION: "donacion",
});

export const ETIQUETAS_ORIGEN_LOTE = Object.freeze({
  [ORIGENES_DE_LOTE.COMPRA]: "Compra",
  [ORIGENES_DE_LOTE.DONACION]: "Donacion",
});

/** `tipo_proveedor` (00017_proveedores_bodegas.sql). */
export const TIPOS_DE_PROVEEDOR = Object.freeze({
  COMERCIAL: "comercial",
  DONANTE: "donante",
});

export const ETIQUETAS_TIPO_PROVEEDOR = Object.freeze({
  [TIPOS_DE_PROVEEDOR.COMERCIAL]: "Comercial",
  [TIPOS_DE_PROVEEDOR.DONANTE]: "Donante",
});

// --- Donaciones -----------------------------------------------------------------------------

/** `tipo_donante` (00022_donantes_donaciones.sql). */
export const TIPOS_DE_DONANTE = Object.freeze({
  PERSONA: "persona",
  ORGANIZACION: "organizacion",
});

export const ETIQUETAS_TIPO_DONANTE = Object.freeze({
  [TIPOS_DE_DONANTE.PERSONA]: "Persona",
  [TIPOS_DE_DONANTE.ORGANIZACION]: "Organizacion",
});

/** `tipo_donacion` (00022_donantes_donaciones.sql). */
export const TIPOS_DE_DONACION = Object.freeze({
  MEDICAMENTOS: "medicamentos",
  INSUMOS: "insumos",
  DINERO: "dinero",
  SERVICIOS: "servicios",
});

export const ETIQUETAS_TIPO_DONACION = Object.freeze({
  [TIPOS_DE_DONACION.MEDICAMENTOS]: "Medicamentos",
  [TIPOS_DE_DONACION.INSUMOS]: "Insumos",
  [TIPOS_DE_DONACION.DINERO]: "Dinero",
  [TIPOS_DE_DONACION.SERVICIOS]: "Servicios",
});

/** `estado_donacion` (00022_donantes_donaciones.sql). */
export const ESTADOS_DE_DONACION = Object.freeze({
  REGISTRADA: "registrada",
  ANULADA: "anulada",
});

export const ETIQUETAS_ESTADO_DONACION = Object.freeze({
  [ESTADOS_DE_DONACION.REGISTRADA]: labels.donacionRegistrada,
  [ESTADOS_DE_DONACION.ANULADA]: labels.donacionAnulada,
});

// --- Presupuestos ---------------------------------------------------------------------------

/**
 * `categoria_gasto` (00025_presupuestos_gastos.sql).
 *
 * Los valores van capitalizados en la base, al reves que el resto de los enums del esquema.
 */
export const CATEGORIAS_DE_GASTO = Object.freeze({
  MEDICAMENTOS: "Medicamentos",
  LOGISTICA: "Logistica",
  DIAGNOSTICO: "Diagnostico",
  HONORARIOS: "Honorarios",
  EDUCACION: "Educacion",
  INFRAESTRUCTURA: "Infraestructura",
});

export const ETIQUETAS_CATEGORIA_GASTO = Object.freeze({
  [CATEGORIAS_DE_GASTO.MEDICAMENTOS]: "Medicamentos",
  [CATEGORIAS_DE_GASTO.LOGISTICA]: "Logistica",
  [CATEGORIAS_DE_GASTO.DIAGNOSTICO]: "Diagnostico",
  [CATEGORIAS_DE_GASTO.HONORARIOS]: "Honorarios",
  [CATEGORIAS_DE_GASTO.EDUCACION]: "Educacion",
  [CATEGORIAS_DE_GASTO.INFRAESTRUCTURA]: "Infraestructura",
});

/**
 * `estado_gasto` (00089_desacoplar_gastos_de_inventario.sql).
 *
 * Tipo propio, aunque su vocabulario coincida con el de estado_movimiento: la 00089 lo creo
 * justamente para desacoplar los gastos del inventario. No compartir constante con aquel.
 */
export const ESTADOS_DE_GASTO = Object.freeze({
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
});

export const ETIQUETAS_ESTADO_GASTO = Object.freeze({
  [ESTADOS_DE_GASTO.PENDIENTE]: "Pendiente",
  [ESTADOS_DE_GASTO.APROBADO]: labels.aprobado,
  [ESTADOS_DE_GASTO.RECHAZADO]: labels.rechazado,
});

// --- Pacientes ------------------------------------------------------------------------------

/** `estado_receta` (00066_recetas.sql). */
export const ESTADOS_RECETA = Object.freeze({
  EMITIDA: "emitida",
  ANULADA: "anulada",
});

export const ETIQUETAS_ESTADO_RECETA = Object.freeze({
  [ESTADOS_RECETA.EMITIDA]: "Emitida",
  [ESTADOS_RECETA.ANULADA]: labels.donacionAnulada,
});

/** `estado_condicion_cronica` (00010_condiciones_cronicas.sql). */
export const ESTADOS_CONDICION_CRONICA = Object.freeze({
  ACTIVA: "activa",
  CONTROLADA: "controlada",
  RESUELTA: "resuelta",
});

export const ETIQUETAS_ESTADO_CONDICION = Object.freeze({
  [ESTADOS_CONDICION_CRONICA.ACTIVA]: "Activa",
  [ESTADOS_CONDICION_CRONICA.CONTROLADA]: "Controlada",
  [ESTADOS_CONDICION_CRONICA.RESUELTA]: "Resuelta",
});

/** `idioma_preferido` (00001_initial_schema.sql). */
export const IDIOMAS = Object.freeze({
  ESPANOL: "espanol",
  QUICHE: "quiche",
  MAM: "mam",
  OTROS: "otros",
});

export const ETIQUETAS_IDIOMA = Object.freeze({
  [IDIOMAS.ESPANOL]: "Español",
  [IDIOMAS.QUICHE]: "K'iche'",
  [IDIOMAS.MAM]: "Mam",
  [IDIOMAS.OTROS]: "Otro",
});

/**
 * `tipo_sanguineo` (00035_datos_clinicos_paciente.sql).
 *
 * El valor y la etiqueta coinciden: opcionesDe() cae en su propio valor cuando no hay etiqueta,
 * asi que no hace falta un mapa.
 */
export const TIPOS_SANGUINEOS = Object.freeze({
  A_POSITIVO: "A+",
  A_NEGATIVO: "A-",
  B_POSITIVO: "B+",
  B_NEGATIVO: "B-",
  AB_POSITIVO: "AB+",
  AB_NEGATIVO: "AB-",
  O_POSITIVO: "O+",
  O_NEGATIVO: "O-",
});
