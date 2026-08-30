// Consultas de Supabase del modulo de jornadas.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, como indica el encabezado de api/index.js. Este archivo es el unico
// lugar del monorepo que lee y escribe las tablas jornadas, jornada_personal,
// jornada_estado_historial y vista_reporte_impacto. jornada_estado_historial se suma aqui en la
// issue #181: a diferencia de consultas/atenciones (propiedad de otros modulos, ver el
// comentario de abajo), es una tabla propia del dominio de jornadas que ningun otro archivo
// declara suya, y solo la escribe el trigger SECURITY DEFINER de la 00012 -- este archivo nunca
// hace INSERT/UPDATE/DELETE sobre ella, solo lee.
//
// desasignarPersonal() necesita saber si la persona ya registro una consulta o un triaje en la
// jornada (issue #174, criterio 4), pero esas tablas no son propiedad de este archivo. En vez
// de leerlas aqui, la comprobacion vive en personal_registro_atenciones(), una funcion SQL
// (migracion 00044) que este archivo solo invoca por RPC: la propiedad de tabla declarada
// arriba se mantiene intacta. obtenerJornadasDePersona() sigue el mismo patron para contar
// consultas y triajes por jornada (issue #175, criterio 4): invoca por RPC a
// fn_atenciones_de_persona_por_jornada() (migracion 00059) en vez de leer esas tablas aqui.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js:
// quien las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el
// render.
//
// Los ids de los campos van en camelCase para coincidir con los descriptores (CAMPOS_JORNADA
// de campos.js) y con las columnas (COLUMNAS_JORNADA de columnas.js). El mapeo a snake_case se
// hace aqui, en aColumnasDeTabla() y aColumnasDePersonal(), y solo se envia lo que venga en el
// objeto.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { esAdministrador } from "../usuarios/roles.js";
import { puedeVerHistorialJornada } from "./permisos.js";
import { ESTADOS_JORNADA } from "../enums.js";
import {
  advertirChoqueDeHorario,
  advertirTraslapeDeHorario,
  puedeRegistrarEnJornada,
  validarCambioDeEstadoJornada,
} from "./validaciones.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva en jornadas no
// empiece a viajar sola hasta el cliente.
//
// comunidad y responsable se piden embebidos (comunidades.nombre, perfiles.nombres y
// apellidos) para que la pantalla pinte el nombre sin una segunda consulta. Si RLS no deja
// ver el perfil o la comunidad, el objeto embebido llega en null y la pantalla cae a su
// respaldo; el id propio (comunidadId, responsableId) siempre viaja.
const COLUMNAS_DE_JORNADA = [
  "id",
  "nombre",
  "codigo",
  "fecha",
  "estado",
  "comunidadId:comunidad_id",
  "responsableId:responsable_id",
  "proyectoId:proyecto_id",
  "presupuestoAsignado:presupuesto_asignado",
  "cupoEstimado:cupo_estimado",
  "botiquinBodegaId:botiquin_bodega_id",
  "ordenKanban:orden_kanban",
  "fechaInicioReal:fecha_inicio_real",
  "fechaFinReal:fecha_fin_real",
  "createdAt:created_at",
  "updatedAt:updated_at",
  "comunidad:comunidades(nombre)",
  "responsable:perfiles(nombres, apellidos)",
].join(", ");

// Personal asignado a una jornada, con el nombre del perfil embebido para el detalle.
const COLUMNAS_DE_PERSONAL = [
  "id",
  "perfilId:perfil_id",
  "rolEnJornada:rol_en_jornada",
  "horaInicio:hora_inicio",
  "horaFin:hora_fin",
  "responsabilidad",
  "asistio",
  "perfil:perfiles(nombres, apellidos)",
].join(", ");

// Contadores de atenciones de la jornada, desde vista_reporte_impacto (00027).
const COLUMNAS_DE_CONTADORES = [
  "pacientesAtendidos:pacientes_atendidos",
  "consultasRealizadas:consultas_realizadas",
  "tratamientosEntregados:tratamientos_entregados",
  "medicamentosUtilizados:medicamentos_utilizados",
].join(", ");

// Historial de cambios de estado de la jornada (issue #181, criterio 3), con quien lo hizo
// embebido para no pedirlo aparte.
const COLUMNAS_DE_HISTORIAL = [
  "id",
  "estadoAnterior:estado_anterior",
  "estadoNuevo:estado_nuevo",
  "createdAt:created_at",
  "cambiadoPor:perfiles(nombres, apellidos)",
].join(", ");

/**
 * Traduce del camelCase de las pantallas al snake_case de la tabla, omitiendo lo no enviado.
 *
 * Las claves coinciden con los ids de CAMPOS_JORNADA (comunidad, responsable, proyecto, sin el
 * sufijo Id). Un update parcial no debe borrar lo que no toca.
 */
function aColumnasDeTabla(datos = {}) {
  const mapa = {
    nombre: "nombre",
    codigo: "codigo",
    fecha: "fecha",
    comunidad: "comunidad_id",
    responsable: "responsable_id",
    proyecto: "proyecto_id",
    presupuestoAsignado: "presupuesto_asignado",
    cupoEstimado: "cupo_estimado",
    botiquinBodega: "botiquin_bodega_id",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Traduce del camelCase de CAMPOS_ASIGNACION_PERSONAL al snake_case de jornada_personal, mas
 * `jornada` (el id de la jornada, que no es un campo del formulario sino el parametro de
 * asignarPersonal()).
 */
function aColumnasDePersonal(datos = {}) {
  const mapa = {
    jornada: "jornada_id",
    perfil: "perfil_id",
    rolEnJornada: "rol_en_jornada",
    horaInicio: "hora_inicio",
    horaFin: "hora_fin",
    responsabilidad: "responsabilidad",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Recorta una hora al formato HH:MM.
 *
 * `hora_inicio`/`hora_fin` son TIME en la base (00012), que supabase-js devuelve como cadena
 * "HH:MM:SS". De aca para adentro, el modulo entero (validarHorario(), aMinutos(),
 * advertirTraslapeDeHorario() y el `<input type="time">` de los formularios de asignacion y
 * edicion) solo entiende "HH:MM": es la unica forma que existe una vez que un valor cruza esta
 * frontera. No es una segunda forma de parsear horas -- aMinutos() en validaciones.js sigue
 * siendo la unica que interpreta una hora como minutos, y solo tiene que aceptar HH:MM porque
 * ningun HH:MM:SS llega ya hasta ahi.
 */
function aHoraCorta(hora) {
  return typeof hora === "string" ? hora.slice(0, 5) : hora;
}

/**
 * Normaliza horaInicio/horaFin de una fila de jornada_personal ya traducida a camelCase
 * (COLUMNAS_DE_PERSONAL), en el borde donde esa fila entra al modulo: obtenerJornada() (el
 * personal embebido), obtenerPersonalDeJornada(), asignarPersonal() y
 * actualizarAsignacionPersonal() son los cuatro puntos que seleccionan esas columnas, y los
 * cuatro pasan su resultado por aca antes de devolverlo. Solo toca las claves que la fila ya
 * trae (no las agrega): una fila de prueba u otra consulta que no pida horaInicio/horaFin sigue
 * llegando igual, sin que esta funcion le invente el campo.
 */
function aFilaDePersonalNormalizada(fila) {
  if (!fila) return fila;

  const normalizada = { ...fila };
  if (Object.prototype.hasOwnProperty.call(fila, "horaInicio")) {
    normalizada.horaInicio = aHoraCorta(fila.horaInicio);
  }
  if (Object.prototype.hasOwnProperty.call(fila, "horaFin")) {
    normalizada.horaFin = aHoraCorta(fila.horaFin);
  }
  return normalizada;
}

/**
 * Registra una jornada.
 *
 * Los datos obligatorios en la tabla (nombre, fecha, comunidad_id, responsable_id) los exige la
 * base de datos con NOT NULL; la validacion amable la hace validarJornada() en el hook antes de
 * llegar aqui, igual que crearProyecto() en donaciones.
 *
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_JORNADA.
 * @returns {Promise<{ jornada: object|null, error: object|null }>}
 */
export async function registrarJornada(datos) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("jornadas")
      .insert(aColumnasDeTabla(datos))
      .select(COLUMNAS_DE_JORNADA)
      .single();

    if (error) return { jornada: null, error: normalizarError(error) };
    return { jornada: data ?? null, error: null };
  } catch (error) {
    // Un fallo de red no llega por el campo error sino como excepcion del fetch.
    return { jornada: null, error: normalizarError(error) };
  }
}

/**
 * Lista las jornadas, opcionalmente filtradas.
 *
 * Un filtro ausente o nulo no se aplica, para que la pantalla pueda pasar su estado de filtros
 * tal cual sin ir limpiando claves vacias.
 *
 * @param {{ estado?: string, comunidad?: string, proyecto?: string, fechaInicio?: string,
 *   fechaFin?: string }} [filtros]
 * @returns {Promise<{ jornadas: object[], error: object|null }>}
 */
export async function listarJornadas({ estado, comunidad, proyecto, fechaInicio, fechaFin } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("jornadas")
      .select(COLUMNAS_DE_JORNADA)
      // Por fecha y no por created_at: a quien planifica le importa cuando ocurre la jornada.
      .order("fecha", { ascending: true })
      .order("nombre", { ascending: true });

    if (estado) consulta = consulta.eq("estado", estado);
    if (comunidad) consulta = consulta.eq("comunidad_id", comunidad);
    if (proyecto) consulta = consulta.eq("proyecto_id", proyecto);
    if (fechaInicio) consulta = consulta.gte("fecha", fechaInicio);
    if (fechaFin) consulta = consulta.lte("fecha", fechaFin);

    const { data, error } = await consulta;

    if (error) return { jornadas: [], error: normalizarError(error) };
    // Siempre un arreglo: una lista vacia se dibuja sola, un null obliga a comprobarlo cada vez.
    return { jornadas: data ?? [], error: null };
  } catch (error) {
    return { jornadas: [], error: normalizarError(error) };
  }
}

/**
 * Lee una jornada con su personal asignado y sus contadores de atenciones.
 *
 * El detalle se arma con tres consultas en paralelo: la fila de jornadas, las asignaciones de
 * jornada_personal y los contadores de vista_reporte_impacto. `jornada` llega en null sin error
 * cuando la fila no existe o cuando RLS no deja verla; son casos distintos para la base de
 * datos pero el mismo para el cliente.
 *
 * @param {string} id UUID de la jornada.
 * @returns {Promise<{ jornada: object|null, error: object|null }>} La jornada trae `personal`
 *   (arreglo) y `contadores` (objeto) dentro.
 */
export async function obtenerJornada(id) {
  if (!id) return { jornada: null, error: null };

  try {
    const supabase = obtenerSupabase();
    const [respuestaJornada, respuestaPersonal, respuestaContadores] = await Promise.all([
      supabase.from("jornadas").select(COLUMNAS_DE_JORNADA).eq("id", id).maybeSingle(),
      supabase
        .from("jornada_personal")
        .select(COLUMNAS_DE_PERSONAL)
        .eq("jornada_id", id)
        .order("hora_inicio", { ascending: true }),
      supabase
        .from("vista_reporte_impacto")
        .select(COLUMNAS_DE_CONTADORES)
        .eq("jornada_id", id)
        .maybeSingle(),
    ]);

    if (respuestaJornada.error)
      return { jornada: null, error: normalizarError(respuestaJornada.error) };
    if (respuestaPersonal.error)
      return { jornada: null, error: normalizarError(respuestaPersonal.error) };
    if (respuestaContadores.error)
      return { jornada: null, error: normalizarError(respuestaContadores.error) };

    const fila = respuestaJornada.data;
    if (!fila) return { jornada: null, error: null };

    return {
      jornada: {
        ...fila,
        personal: (respuestaPersonal.data ?? []).map(aFilaDePersonalNormalizada),
        contadores: respuestaContadores.data ?? null,
      },
      error: null,
    };
  } catch (error) {
    return { jornada: null, error: normalizarError(error) };
  }
}

/**
 * Lee unicamente el personal asignado a una jornada, sin la fila de jornadas ni los contadores
 * de vista_reporte_impacto (issue #181, criterio 4).
 *
 * `obtenerJornada()` ya trae `personal` embebido, pero recarga tambien la jornada y los
 * contadores: quien asigna o desasigna a alguien (la #182, sobre esta misma pantalla) solo
 * necesita refrescar la lista de personal, no todo el detalle. Mismo criterio que
 * refrescarPerfil() en usuarios/useSesion.js (issue #102) o el recargar() de las pantallas de
 * listado: una escritura puntual no debe forzar a releer lo que no cambio.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @returns {Promise<{ personal: object[], error: object|null }>}
 */
export async function obtenerPersonalDeJornada(jornadaId) {
  if (!jornadaId) return { personal: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_personal")
      .select(COLUMNAS_DE_PERSONAL)
      .eq("jornada_id", jornadaId)
      .order("hora_inicio", { ascending: true });

    if (error) return { personal: [], error: normalizarError(error) };
    return { personal: (data ?? []).map(aFilaDePersonalNormalizada), error: null };
  } catch (error) {
    return { personal: [], error: normalizarError(error) };
  }
}

/**
 * Lee el historial de cambios de estado de una jornada, del mas reciente al mas antiguo (issue
 * #181, criterio 3: "con quien y cuando").
 *
 * `cambiadoPor` llega embebido como el perfil completo (nombres, apellidos), no solo el id: la
 * pantalla no tiene que resolverlo con una segunda consulta. Puede llegar `null` en la fila de
 * creacion si el trigger corrio sin `auth.uid()` (poblado por una migracion, por ejemplo).
 *
 * El chequeo de `rol` (si se pasa) evita disparar una consulta que la politica de SELECT de
 * jornada_estado_historial (00039:83-85, solo administrador) va a devolver vacia de todas
 * formas para cualquier otro rol -- mismo patron que puedeVerHistorial() en
 * pacientes/historial.api.js. No es la restriccion real: la politica RLS de la base es quien de
 * verdad decide (puedeVerHistorialJornada() en permisos.js es su espejo en el cliente).
 *
 * @param {string} jornadaId UUID de la jornada.
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien consulta, para el chequeo previo.
 * @returns {Promise<{ historial: object[], error: object|null }>}
 */
export async function obtenerHistorialDeJornada(jornadaId, { rol } = {}) {
  if (!jornadaId) return { historial: [], error: null };

  if (rol !== undefined && !puedeVerHistorialJornada(rol)) {
    return {
      historial: [],
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
        mensaje: "Solo la administradora puede ver el historial de cambios de estado.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_estado_historial")
      .select(COLUMNAS_DE_HISTORIAL)
      .eq("jornada_id", jornadaId)
      .order("created_at", { ascending: false });

    if (error) return { historial: [], error: normalizarError(error) };
    return { historial: data ?? [], error: null };
  } catch (error) {
    return { historial: [], error: normalizarError(error) };
  }
}

/**
 * Actualiza los datos de una jornada.
 *
 * No cambia el estado aunque se le pase: el estado lo mueve el kanban y sus acciones, no una
 * edicion manual (mismo criterio que actualizarProyecto()). Ademas cumple la regla del criterio
 * de aceptacion: una jornada finalizada no se edita salvo por la administradora. El RLS (00039)
 * no restringe por estado, asi que esta comprobacion es la unica que la cumple en el cliente.
 *
 * Para saber el estado actual solo se pide la columna `estado`, no obtenerJornada() completa:
 * esta funcion se llama en cada edicion, y no hay razon para traer el personal asignado y los
 * contadores de vista_reporte_impacto solo para leer un campo.
 *
 * @param {string} id UUID de la jornada.
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_JORNADA.
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol del usuario que edita, para la regla de finalizada.
 * @returns {Promise<{ jornada: object|null, error: object|null }>}
 */
export async function actualizarJornada(id, datos, { rol } = {}) {
  const fila = aColumnasDeTabla(datos);
  if (Object.keys(fila).length === 0) return { jornada: null, error: null };

  try {
    const supabase = obtenerSupabase();

    const { data: filaActual, error: errorDeLectura } = await supabase
      .from("jornadas")
      .select("estado")
      .eq("id", id)
      .maybeSingle();

    if (errorDeLectura) return { jornada: null, error: normalizarError(errorDeLectura) };

    if (filaActual?.estado === ESTADOS_JORNADA.FINALIZADA && !esAdministrador(rol)) {
      return {
        jornada: null,
        error: {
          ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
          mensaje:
            "Una jornada finalizada no se puede editar. Solo la administradora puede modificarla.",
        },
      };
    }

    const { data, error } = await supabase
      .from("jornadas")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DE_JORNADA)
      .maybeSingle();

    if (error) return { jornada: null, error: normalizarError(error) };
    return { jornada: data ?? null, error: null };
  } catch (error) {
    return { jornada: null, error: normalizarError(error) };
  }
}

/**
 * Cambia el estado de una jornada, validando que la transicion sea legal (issue #171).
 *
 * Solo se lee la columna estado (no obtenerJornada() completa): igual que actualizarJornada(),
 * no hay razon para traer el personal asignado ni los contadores de vista_reporte_impacto solo
 * para leer un campo.
 *
 * validarCambioDeEstadoJornada() (validaciones.js) decide si la transicion es legal y, para la
 * reapertura (finalizada -> en curso), si el rol alcanza (criterio de aceptacion: solo
 * administrador reabre). El trigger tr_validar_transicion_estado_jornada (migracion 00051)
 * vuelve a comprobar ambas cosas en el servidor: esta validacion es para dar un mensaje util,
 * no para sustituirla. Quien registra el cambio (quien y cuando) lo sigue haciendo el trigger
 * ya existente registrar_cambio_estado_jornada() (00012) sobre jornada_estado_historial, sin
 * cambios aqui.
 *
 * @param {string} id UUID de la jornada.
 * @param {string} nuevoEstado Uno de ESTADOS_JORNADA.
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien hace el cambio, para la regla de reapertura.
 * @returns {Promise<{ jornada: object|null, error: object|null }>}
 */
export async function cambiarEstadoJornada(id, nuevoEstado, { rol } = {}) {
  try {
    const supabase = obtenerSupabase();

    const { data: filaActual, error: errorDeLectura } = await supabase
      .from("jornadas")
      .select("estado")
      .eq("id", id)
      .maybeSingle();

    if (errorDeLectura) return { jornada: null, error: normalizarError(errorDeLectura) };

    if (!filaActual) {
      return {
        jornada: null,
        error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS, "jornada no encontrada"),
      };
    }

    const errores = validarCambioDeEstadoJornada(filaActual.estado, nuevoEstado, rol);
    if (errores.estado) {
      return {
        jornada: null,
        error: { ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK), mensaje: errores.estado },
      };
    }

    const { data, error } = await supabase
      .from("jornadas")
      .update({ estado: nuevoEstado })
      .eq("id", id)
      .select(COLUMNAS_DE_JORNADA)
      .maybeSingle();

    if (error) return { jornada: null, error: normalizarError(error) };
    return { jornada: data ?? null, error: null };
  } catch (error) {
    return { jornada: null, error: normalizarError(error) };
  }
}

/**
 * Asigna una persona a una jornada, con su rol y su horario.
 *
 * El UNIQUE (jornada_id, perfil_id) de la migracion 00012 es quien impide de verdad asignar dos
 * veces a la misma persona en la misma jornada (criterio 2): esta funcion no revalida nada por
 * su cuenta, solo deja que normalizarError() traduzca el 23505 a CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD.
 *
 * Ademas de crear la fila, advierte -sin bloquear- si la persona ya esta asignada a otra
 * jornada el mismo dia (criterio 3): calcula la advertencia aqui mismo, con
 * obtenerAsignacionesDelDia() y advertirChoqueDeHorario() (validaciones.js), para que quien
 * consume esta funcion no tenga que orquestar dos llamadas para cumplir un solo criterio de
 * aceptacion. Si esa segunda consulta falla, la asignacion ya se guardo: se responde sin
 * advertencias en vez de convertir un fallo secundario en un error de toda la operacion.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_ASIGNACION_PERSONAL (perfil,
 *   rolEnJornada, horaInicio, horaFin, responsabilidad). horaInicio y horaFin son NOT NULL en
 *   jornada_personal (00012): omitirlas hace fallar el INSERT con CAMPO_REQUERIDO aunque el
 *   criterio de aceptacion no las mencione.
 * @returns {Promise<{ asignacion: object|null, advertencias: string[], error: object|null }>}
 */
export async function asignarPersonal(jornadaId, datos) {
  if (!jornadaId) return { asignacion: null, advertencias: [], error: null };

  try {
    const { data: asignacion, error } = await obtenerSupabase()
      .from("jornada_personal")
      .insert(aColumnasDePersonal({ jornada: jornadaId, ...datos }))
      .select(COLUMNAS_DE_PERSONAL)
      .single();

    if (error) return { asignacion: null, advertencias: [], error: normalizarError(error) };

    const advertencias = await advertenciasDeChoqueAlAsignar(jornadaId, datos);

    return {
      asignacion: aFilaDePersonalNormalizada(asignacion) ?? null,
      advertencias,
      error: null,
    };
  } catch (error) {
    return { asignacion: null, advertencias: [], error: normalizarError(error) };
  }
}

/**
 * Traduce a snake_case unicamente los tres campos que useEdicionTurno.js edita, omitiendo lo no
 * enviado. A diferencia de aColumnasDePersonal(), que aColumnasDePersonal() de proposito general
 * para el alta, esta funcion NO reconoce `perfil` ni `jornada`: aunque alguien los mande por
 * error, no hay forma de que actualizarAsignacionPersonal() reasigne de perfil o de jornada la
 * fila que edita, que ya llega fijada por sus dos parametros, no por `datos`.
 */
function aColumnasDeEdicionDeTurno(datos = {}) {
  const mapa = {
    horaInicio: "hora_inicio",
    horaFin: "hora_fin",
    responsabilidad: "responsabilidad",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Edita el horario y la responsabilidad de alguien que YA esta asignado a una jornada (issue
 * #185, criterio 2). No crea ni borra filas: el alta sigue siendo asignarPersonal() (#182) y la
 * baja desasignarPersonal() (#174); esta funcion solo hace UPDATE sobre la fila que ya existe.
 *
 * `jornadaId` y `perfilId` fijan CUAL fila se edita (en el WHERE); `datos` no puede cambiar esas
 * dos columnas ni `rolEnJornada` (ver aColumnasDeEdicionDeTurno()): el criterio de aceptacion
 * solo pide editar horario y responsabilidad.
 *
 * La politica RLS de UPDATE de jornada_personal (00039) exige unicamente es_administrador(), sin
 * la excepcion de permiso fino que si tiene la tabla jornadas: quien no sea administrador recibe
 * `asignacion: null` sin fila que actualizar, no un error, porque RLS filtra el UPDATE en vez de
 * lanzar.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @param {string} perfilId UUID del perfil cuya fila se edita.
 * @param {object} datos Campos en camelCase a actualizar (horaInicio, horaFin, responsabilidad).
 *   Un campo ausente no se toca, mismo criterio que actualizarJornada().
 * @returns {Promise<{ asignacion: object|null, error: object|null }>}
 */
export async function actualizarAsignacionPersonal(jornadaId, perfilId, datos) {
  if (!jornadaId || !perfilId) return { asignacion: null, error: null };

  const fila = aColumnasDeEdicionDeTurno(datos);
  if (Object.keys(fila).length === 0) return { asignacion: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_personal")
      .update(fila)
      .eq("jornada_id", jornadaId)
      .eq("perfil_id", perfilId)
      .select(COLUMNAS_DE_PERSONAL)
      .maybeSingle();

    if (error) return { asignacion: null, error: normalizarError(error) };
    return { asignacion: aFilaDePersonalNormalizada(data) ?? null, error: null };
  } catch (error) {
    return { asignacion: null, error: normalizarError(error) };
  }
}

/**
 * Calcula la advertencia del criterio 3 para una asignacion recien creada.
 *
 * Lee la fecha de la jornada, trae las asignaciones de ese mismo dia en cualquier otra jornada
 * (obtenerAsignacionesDelDia()) y deja que advertirChoqueDeHorario() decida el texto. Cualquier
 * fallo en esta parte se traga en silencio: es una mejora informativa sobre una escritura que
 * ya tuvo exito, no una segunda operacion que deba poder hacer fallar a la primera.
 */
async function advertenciasDeChoqueAlAsignar(jornadaId, datos) {
  const perfilId = datos?.perfil;
  if (!perfilId) return [];

  const { data: filaJornada } = await obtenerSupabase()
    .from("jornadas")
    .select("fecha")
    .eq("id", jornadaId)
    .maybeSingle();

  if (!filaJornada?.fecha) return [];

  const { asignaciones } = await obtenerAsignacionesDelDia(filaJornada.fecha, {
    excluirJornada: jornadaId,
  });

  // Las dos advertencias de horario conviven (issue #185): el choque de dia completo de #182,
  // sin comparar horas, y el traslape real de #185, que si las compara. Una asignacion recien
  // creada puede disparar una, la otra, las dos o ninguna.
  return [
    advertirChoqueDeHorario({
      perfil: perfilId,
      jornadaActualId: jornadaId,
      asignacionesDelDia: asignaciones,
    }),
    advertirTraslapeDeHorario({
      perfil: perfilId,
      horaInicio: datos?.horaInicio,
      horaFin: datos?.horaFin,
      jornadaActualId: jornadaId,
      asignacionesDelDia: asignaciones,
    }),
  ].filter(Boolean);
}

/**
 * Personal asignado a cualquier jornada en una fecha dada.
 *
 * Es la fuente de datos que advertirChoqueDeHorario() (validaciones.js) necesita para el
 * criterio 3. asignarPersonal() ya la invoca por su cuenta al asignar; queda publica ademas para
 * quien necesite recalcular la advertencia sin guardar todavia (por ejemplo, el formulario de la
 * issue #182 mientras la persona elige a quien asignar, antes de enviar el formulario).
 *
 * `horaInicio`/`horaFin` viajan desde la issue #185: la #182 original solo pedia perfil,
 * jornadaId y el nombre de la jornada, suficiente para advertirChoqueDeHorario() (que no compara
 * horas). advertirTraslapeDeHorario() (issue #185) si las necesita, y es aditivo: nadie que ya
 * leia el resultado sin esperar estas dos claves se rompe por que ahora tambien lleguen. Vienen
 * recortadas a HH:MM con aHoraCorta(): la base las devuelve como TIME ("HH:MM:SS"), y de esta
 * funcion para adentro del modulo solo existe HH:MM (ver aFilaDePersonalNormalizada()).
 *
 * @param {string} fecha Fecha AAAA-MM-DD.
 * @param {{ excluirJornada?: string }} [opciones] Jornada a excluir del resultado (normalmente
 *   la propia jornada donde se esta asignando, que no cuenta como choque contra si misma).
 * @returns {Promise<{ asignaciones: Array<{ jornadaId: string, jornadaNombre: string, perfil: string, horaInicio: string, horaFin: string }>, error: object|null }>}
 */
export async function obtenerAsignacionesDelDia(fecha, { excluirJornada } = {}) {
  if (!fecha) return { asignaciones: [], error: null };

  try {
    let consulta = obtenerSupabase()
      .from("jornada_personal")
      .select(
        "perfil:perfil_id, jornadaId:jornada_id, horaInicio:hora_inicio, horaFin:hora_fin, " +
          "jornada:jornadas!inner(nombre, fecha)",
      )
      .eq("jornada.fecha", fecha);

    if (excluirJornada) consulta = consulta.neq("jornada_id", excluirJornada);

    const { data, error } = await consulta;

    if (error) return { asignaciones: [], error: normalizarError(error) };

    const asignaciones = (data ?? []).map((fila) => ({
      jornadaId: fila.jornadaId,
      jornadaNombre: fila.jornada?.nombre ?? "",
      perfil: fila.perfil,
      horaInicio: aHoraCorta(fila.horaInicio) ?? null,
      horaFin: aHoraCorta(fila.horaFin) ?? null,
    }));

    return { asignaciones, error: null };
  } catch (error) {
    return { asignaciones: [], error: normalizarError(error) };
  }
}

/**
 * Jornadas donde participa un perfil, como personal asignado (criterio 5), con cuantos
 * pacientes atendio en cada una (issue #175, criterio 4), mas el papel y la responsabilidad de
 * esa persona en cada una.
 *
 * No filtra por quien pregunta: RLS de jornada_personal (00039) ya decide si la respuesta trae
 * filas (administrador y junta directiva ven cualquier perfil; el resto solo se ve a si mismo).
 * Devuelve la misma forma de fila que listarJornadas() y obtenerJornada(), mas tres campos
 * nuevos (aditivo: una pantalla que ya reusaba COLUMNAS_JORNADA sin traducir nada sigue
 * funcionando igual).
 *
 * `rolEnJornada` y `responsabilidad` salen de la misma fila de jornada_personal que ya se
 * consulta para resolver la jornada embebida, asi que no cuestan una segunda consulta. Son el
 * papel y la responsabilidad de ESTA persona en ESA jornada puntual, no el responsable de la
 * jornada completa (que ya viaja aparte, embebido en la jornada como `responsable`): dos
 * columnas de dos tablas distintas que solo se parecen en el nombre.
 *
 * `atencionesPersona` sale de fn_atenciones_de_persona_por_jornada() (RPC, migracion 00059):
 * consultas y triajes no son propiedad de este archivo (ver el encabezado), mismo motivo por el
 * que desasignarPersonal() y contarAtencionesIncompletas() ya invocan funciones SQL en vez de
 * leer esas tablas aqui. Las dos consultas corren en paralelo (Promise.all, igual que
 * obtenerJornada()); si cualquiera de las dos falla, la funcion entera falla cerrado -
 * devuelve `{ jornadas: [], error }`, nunca una lista con contadores en cero o ausentes -
 * porque nada en la respuesta permitiria distinguir "no atendio a nadie" de "fallo la
 * consulta". Una jornada sin fila en el resultado de la RPC (sin actividad clinica visible
 * para quien pregunta) recibe `{ consultas: 0, triajes: 0, pacientes: 0 }` aqui mismo: junta
 * directiva y socio fundador, que no tienen SELECT sobre consultas/triajes/atenciones, ven
 * todas sus jornadas en cero aunque haya actividad real (documentado en la migracion 00059) -
 * no es un caso que esta funcion pueda corregir sin decidir permisos por su cuenta, que es lo
 * que prohibe el criterio de aceptacion 6. Quien consuma este campo no puede asumir que un cero
 * sea siempre real.
 *
 * @param {string} perfilId UUID del perfil.
 * @returns {Promise<{ jornadas: object[], error: object|null }>} Cada jornada trae
 *   `rolEnJornada: string`, `responsabilidad: string|null` y
 *   `atencionesPersona: { consultas: number, triajes: number, pacientes: number }`.
 */
export async function obtenerJornadasDePersona(perfilId) {
  if (!perfilId) return { jornadas: [], error: null };

  try {
    const supabase = obtenerSupabase();
    const [respuestaPersonal, respuestaAtenciones] = await Promise.all([
      supabase
        .from("jornada_personal")
        .select(
          `rolEnJornada:rol_en_jornada, responsabilidad, jornada:jornadas(${COLUMNAS_DE_JORNADA})`,
        )
        .eq("perfil_id", perfilId),
      supabase.rpc("fn_atenciones_de_persona_por_jornada", { p_perfil_id: perfilId }),
    ]);

    if (respuestaPersonal.error) {
      return { jornadas: [], error: normalizarError(respuestaPersonal.error) };
    }
    if (respuestaAtenciones.error) {
      return { jornadas: [], error: normalizarError(respuestaAtenciones.error) };
    }

    const atencionesPorJornada = new Map(
      (respuestaAtenciones.data ?? []).map((fila) => [
        fila.jornada_id,
        { consultas: fila.consultas, triajes: fila.triajes, pacientes: fila.pacientes },
      ]),
    );

    const jornadas = (respuestaPersonal.data ?? [])
      .filter((fila) => fila.jornada)
      .map((fila) => ({
        ...fila.jornada,
        rolEnJornada: fila.rolEnJornada,
        responsabilidad: fila.responsabilidad,
        atencionesPersona: atencionesPorJornada.get(fila.jornada.id) ?? {
          consultas: 0,
          triajes: 0,
          pacientes: 0,
        },
      }));

    return { jornadas, error: null };
  } catch (error) {
    return { jornadas: [], error: normalizarError(error) };
  }
}

/**
 * Quita a una persona de una jornada.
 *
 * Antes de borrar, comprueba con personal_registro_atenciones() (funcion SQL de la migracion
 * 00044, invocada por RPC) si esa persona ya registro una consulta o un triaje en esta jornada.
 * Si es asi, ni siquiera intenta el DELETE: devuelve un error de negocio explicando por que
 * (criterio 4). Quien de verdad impide el borrado a cualquiera que no sea administrador es la
 * politica RLS "Solo administrador desasigna personal de jornadas" de esa misma migracion; esta
 * comprobacion cubre la regla que RLS no puede expresar por si sola.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @param {string} perfilId UUID del perfil a desasignar.
 * @returns {Promise<{ desasignado: boolean, error: object|null }>}
 */
export async function desasignarPersonal(jornadaId, perfilId) {
  if (!jornadaId || !perfilId) return { desasignado: false, error: null };

  try {
    const supabase = obtenerSupabase();

    const { data: yaRegistroAtenciones, error: errorDeChequeo } = await supabase.rpc(
      "personal_registro_atenciones",
      { p_jornada_id: jornadaId, p_perfil_id: perfilId },
    );

    if (errorDeChequeo) return { desasignado: false, error: normalizarError(errorDeChequeo) };

    if (yaRegistroAtenciones) {
      return {
        desasignado: false,
        error: {
          ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK),
          mensaje: "No se puede desasignar a alguien que ya registro atenciones en esta jornada.",
        },
      };
    }

    const { error } = await supabase
      .from("jornada_personal")
      .delete()
      .eq("jornada_id", jornadaId)
      .eq("perfil_id", perfilId);

    if (error) return { desasignado: false, error: normalizarError(error) };
    return { desasignado: true, error: null };
  } catch (error) {
    return { desasignado: false, error: normalizarError(error) };
  }
}

/**
 * Cuenta las atenciones de una jornada que todavia no tienen consulta (issue #171, criterio de
 * aceptacion 4: advertir antes de finalizar si hay atenciones incompletas).
 *
 * Es una funcion SQL por RPC (fn_contar_atenciones_incompletas, migracion 00051) y no una
 * consulta directa a atenciones y consultas: ninguna de esas dos tablas es propiedad de este
 * archivo, mismo motivo por el que personal_registro_atenciones existe como funcion para
 * desasignarPersonal().
 *
 * No bloquea nada por su cuenta: el criterio de aceptacion dice "advierte", no "impide". Quien
 * construya la pantalla de finalizar llama esta funcion antes de cambiarEstadoJornada() y
 * decide si muestra una confirmacion, igual que advertirChoqueDeHorario()/asignarPersonal() ya
 * hacen para el choque de horario.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @returns {Promise<{ cantidad: number, error: object|null }>}
 */
export async function contarAtencionesIncompletas(jornadaId) {
  if (!jornadaId) return { cantidad: 0, error: null };

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_contar_atenciones_incompletas", {
      p_jornada_id: jornadaId,
    });

    if (error) return { cantidad: 0, error: normalizarError(error) };
    return { cantidad: data ?? 0, error: null };
  } catch (error) {
    return { cantidad: 0, error: normalizarError(error) };
  }
}

/**
 * Cuenta los pacientes atendidos de cada jornada, en lote (issue #178, criterio 1).
 *
 * Consulta vista_reporte_impacto (00027/00054/00064) con `.in('jornada_id', ids)`, mismo patron
 * que contarJornadasPorPerfil() en usuarios/api.js: una sola consulta para todas las tarjetas del
 * tablero en vez de una por jornada.
 *
 * La vista restringe sus filas a administrador, junta directiva y socio fundador (00064:71-72):
 * medico y voluntario no tienen SELECT sobre ella en absoluto, asi que para esos roles esta
 * funcion no falla, simplemente no recibe ninguna fila. El objeto que devuelve solo trae una
 * clave por cada jornada que SI vino en la respuesta: una jornada ausente del resultado no
 * significa "cero pacientes", significa "sin permiso para leerlo", y quien consuma este mapa
 * tiene que distinguir los dos casos (id ausente vs. id presente con 0) en vez de asumir 0 por
 * defecto.
 *
 * @param {string[]} jornadaIds
 * @returns {Promise<{ conteos: Record<string, number>, error: object|null }>}
 */
export async function contarPacientesAtendidosPorJornada(jornadaIds = []) {
  if (!Array.isArray(jornadaIds) || jornadaIds.length === 0) {
    return { conteos: {}, error: null };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("vista_reporte_impacto")
      .select("jornadaId:jornada_id, pacientesAtendidos:pacientes_atendidos")
      .in("jornada_id", jornadaIds);

    if (error) return { conteos: {}, error: normalizarError(error) };

    const conteos = {};
    for (const fila of data ?? []) {
      conteos[fila.jornadaId] = fila.pacientesAtendidos;
    }
    return { conteos, error: null };
  } catch (error) {
    return { conteos: {}, error: normalizarError(error) };
  }
}

/**
 * Indica si se puede registrar una atencion o una consulta en una jornada, y por que no.
 *
 * Es la envoltura de puedeRegistrarEnJornada() (validaciones.js) para cuando solo se tiene el
 * id: lee el estado y delega la decision. La regla vive alla, no aqui, porque este archivo es
 * el de las consultas y no el de las reglas de negocio.
 *
 * Solo pide la columna `estado`, no obtenerJornada() completa: se llama antes de cada registro
 * y no hay razon para traer el personal asignado y los contadores de vista_reporte_impacto para
 * leer un campo. Mismo criterio que actualizarJornada() y cambiarEstadoJornada().
 *
 * **No es la garantia.** Los triggers `validar_jornada_en_curso()` sobre `consultas` (migracion
 * 00018) y `validar_jornada_en_curso_atenciones()` sobre `atenciones` (migracion 00055) son
 * quienes de verdad lo impiden. Esta funcion existe para poder deshabilitar el formulario y
 * explicar el motivo, en vez de dejar que la persona llene todo y reciba un error del servidor.
 *
 * Una jornada que no existe -o que RLS no deja ver- devuelve `puede: false` con el mismo error
 * SIN_RESULTADOS que usa cambiarEstadoJornada(), no una excepcion: quien llama es una pantalla.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @returns {Promise<{ puede: boolean, motivo: string, error: object|null }>}
 */
export async function puedeRegistrarConsulta(jornadaId) {
  if (!jornadaId) {
    return {
      puede: false,
      motivo: "No hay una jornada seleccionada.",
      error: null,
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornadas")
      .select("estado")
      .eq("id", jornadaId)
      .maybeSingle();

    if (error) {
      const normalizado = normalizarError(error);
      return { puede: false, motivo: normalizado.mensaje, error: normalizado };
    }

    if (!data) {
      const noEncontrada = construirError(
        CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS,
        "jornada no encontrada",
      );
      return { puede: false, motivo: noEncontrada.mensaje, error: noEncontrada };
    }

    const { puede, motivo } = puedeRegistrarEnJornada(data.estado);
    return { puede, motivo, error: null };
  } catch (error) {
    const normalizado = normalizarError(error);
    return { puede: false, motivo: normalizado.mensaje, error: normalizado };
  }
}
