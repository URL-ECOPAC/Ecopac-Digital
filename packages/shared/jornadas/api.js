// Consultas de Supabase del modulo de jornadas.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, como indica el encabezado de api/index.js. Este archivo es el unico
// lugar del monorepo que lee y escribe las tablas jornadas, jornada_personal y
// vista_reporte_impacto.
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
import { ESTADOS_JORNADA } from "./permisos.js";
import {
  advertirChoqueDeHorario,
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
export async function listarJornadas({
  estado,
  comunidad,
  proyecto,
  fechaInicio,
  fechaFin,
} = {}) {
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

    if (respuestaJornada.error) return { jornada: null, error: normalizarError(respuestaJornada.error) };
    if (respuestaPersonal.error) return { jornada: null, error: normalizarError(respuestaPersonal.error) };
    if (respuestaContadores.error) return { jornada: null, error: normalizarError(respuestaContadores.error) };

    const fila = respuestaJornada.data;
    if (!fila) return { jornada: null, error: null };

    return {
      jornada: {
        ...fila,
        personal: respuestaPersonal.data ?? [],
        contadores: respuestaContadores.data ?? null,
      },
      error: null,
    };
  } catch (error) {
    return { jornada: null, error: normalizarError(error) };
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

    const advertencias = await advertenciasDeChoqueAlAsignar(jornadaId, datos?.perfil);

    return { asignacion: asignacion ?? null, advertencias, error: null };
  } catch (error) {
    return { asignacion: null, advertencias: [], error: normalizarError(error) };
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
async function advertenciasDeChoqueAlAsignar(jornadaId, perfilId) {
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

  const advertencia = advertirChoqueDeHorario({
    perfil: perfilId,
    jornadaActualId: jornadaId,
    asignacionesDelDia: asignaciones,
  });

  return advertencia ? [advertencia] : [];
}

/**
 * Personal asignado a cualquier jornada en una fecha dada.
 *
 * Es la fuente de datos que advertirChoqueDeHorario() (validaciones.js) necesita para el
 * criterio 3. asignarPersonal() ya la invoca por su cuenta al asignar; queda publica ademas para
 * quien necesite recalcular la advertencia sin guardar todavia (por ejemplo, el formulario de la
 * issue #182 mientras la persona elige a quien asignar, antes de enviar el formulario).
 *
 * @param {string} fecha Fecha AAAA-MM-DD.
 * @param {{ excluirJornada?: string }} [opciones] Jornada a excluir del resultado (normalmente
 *   la propia jornada donde se esta asignando, que no cuenta como choque contra si misma).
 * @returns {Promise<{ asignaciones: Array<{ jornadaId: string, jornadaNombre: string, perfil: string }>, error: object|null }>}
 */
export async function obtenerAsignacionesDelDia(fecha, { excluirJornada } = {}) {
  if (!fecha) return { asignaciones: [], error: null };

  try {
    let consulta = obtenerSupabase()
      .from("jornada_personal")
      .select("perfil:perfil_id, jornadaId:jornada_id, jornada:jornadas!inner(nombre, fecha)")
      .eq("jornada.fecha", fecha);

    if (excluirJornada) consulta = consulta.neq("jornada_id", excluirJornada);

    const { data, error } = await consulta;

    if (error) return { asignaciones: [], error: normalizarError(error) };

    const asignaciones = (data ?? []).map((fila) => ({
      jornadaId: fila.jornadaId,
      jornadaNombre: fila.jornada?.nombre ?? "",
      perfil: fila.perfil,
    }));

    return { asignaciones, error: null };
  } catch (error) {
    return { asignaciones: [], error: normalizarError(error) };
  }
}

/**
 * Jornadas donde participa un perfil, como personal asignado (criterio 5), con cuantos
 * pacientes atendio en cada una (issue #175, criterio 4).
 *
 * No filtra por quien pregunta: RLS de jornada_personal (00039) ya decide si la respuesta trae
 * filas (administrador y junta directiva ven cualquier perfil; el resto solo se ve a si mismo).
 * Devuelve la misma forma de fila que listarJornadas() y obtenerJornada(), mas el campo nuevo
 * `atencionesPersona` (aditivo: una pantalla que ya reusaba COLUMNAS_JORNADA sin traducir nada
 * sigue funcionando igual).
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
 * que prohibe el criterio de aceptacion 6.
 *
 * @param {string} perfilId UUID del perfil.
 * @returns {Promise<{ jornadas: object[], error: object|null }>} Cada jornada trae
 *   `atencionesPersona: { consultas: number, triajes: number, pacientes: number }`.
 */
export async function obtenerJornadasDePersona(perfilId) {
  if (!perfilId) return { jornadas: [], error: null };

  try {
    const supabase = obtenerSupabase();
    const [respuestaPersonal, respuestaAtenciones] = await Promise.all([
      supabase
        .from("jornada_personal")
        .select(`jornada:jornadas(${COLUMNAS_DE_JORNADA})`)
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
      .map((fila) => fila.jornada)
      .filter(Boolean)
      .map((jornada) => ({
        ...jornada,
        atencionesPersona: atencionesPorJornada.get(jornada.id) ?? {
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
          mensaje:
            "No se puede desasignar a alguien que ya registro atenciones en esta jornada.",
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
