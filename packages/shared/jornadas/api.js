// Consultas de Supabase del modulo de jornadas.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, como indica el encabezado de api/index.js. Este archivo es el unico
// lugar del monorepo que lee y escribe las tablas jornadas, jornada_personal y
// vista_reporte_impacto.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js:
// quien las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el
// render.
//
// Los ids de los campos van en camelCase para coincidir con los descriptores (CAMPOS_JORNADA
// de campos.js) y con las columnas (COLUMNAS_JORNADA de columnas.js). El mapeo a snake_case se
// hace aqui, en aColumnasDeTabla(), y solo se envia lo que venga en el objeto.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { esAdministrador } from "../usuarios/roles.js";
import { ESTADOS_JORNADA } from "./permisos.js";

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
