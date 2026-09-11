// Consultas de Supabase de las condiciones cronicas del paciente (issue #122 y #641).

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { COLUMNAS_DE_CONDICION_CRONICA } from "./api.js";
import { ESTADOS_CONDICION_CRONICA } from "../enums.js";
import {
  normalizarDatosCondicion,
  validarCambioDeCondicion,
  validarCondicionCronica,
  validarCondicionCatalogo,
} from "./condiciones.validaciones.js";
import { esTextoVacio, normalizarTexto } from "../validations/index.js";

const COLUMNAS_DEL_CATALOGO = ["id", "nombre", "es_vigente"].join(", ");

const COLUMNAS_DEL_PACIENTE_CRONICO = [
  "id",
  "condicionId:condicion_id",
  "fechaDiagnostico:fecha_diagnostico",
  "estado",
  "notas",
  "condicion:condiciones_cronicas(nombre)",
  "paciente:pacientes!inner(id, nombres, apellidos, comunidadId:comunidad_id, comunidad:comunidades(nombre))",
].join(", ");

const MAPA_COLUMNAS_DE_LA_CONDICION = {
  fechaDiagnostico: "fecha_diagnostico",
  estado: "estado",
  notas: "notas",
};

function aColumnasDeTabla(datos = {}) {
  const fila = {};
  for (const [campo, columna] of Object.entries(MAPA_COLUMNAS_DE_LA_CONDICION)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

function aCondicionDelPaciente(fila) {
  if (!fila) return null;

  const { condicion, ...padecimiento } = fila;
  return { ...padecimiento, condicion: condicion?.nombre ?? null };
}

function aPacienteCronico(fila) {
  if (!fila) return null;

  const { paciente, condicion, ...padecimiento } = fila;

  return {
    ...padecimiento,
    condicion: condicion?.nombre ?? null,
    pacienteId: paciente?.id ?? null,
    nombreCompleto: [paciente?.nombres, paciente?.apellidos].filter(Boolean).join(" "),
    comunidadId: paciente?.comunidadId ?? null,
    comunidad: paciente?.comunidad?.nombre ?? null,
  };
}

/**
 * Lee el catalogo de condiciones cronicas con opciones de filtrado (issue #641).
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.soloVigentes=false]
 * @param {string} [opciones.busqueda=""]
 * @returns {Promise<{ condiciones: Array<object>, error: object|null }>}
 */
export async function obtenerCatalogoDeCondiciones({ soloVigentes = false, busqueda = "" } = {}) {
  try {
    let consulta = obtenerSupabase().from("condiciones_cronicas").select(COLUMNAS_DEL_CATALOGO);

    if (soloVigentes) {
      consulta = consulta.eq("es_vigente", true);
    }

    if (!esTextoVacio(busqueda)) {
      consulta = consulta.ilike("nombre", `%${busqueda.trim()}%`);
    }

    const { data, error } = await consulta.order("nombre", { ascending: true });

    if (error) return { condiciones: [], error: normalizarError(error) };

    const condiciones = (data ?? []).map((item) => ({
      id: item.id,
      nombre: item.nombre,
      esVigente: item.es_vigente ?? true,
    }));

    return { condiciones, error: null };
  } catch (error) {
    return { condiciones: [], error: normalizarError(error) };
  }
}

/**
 * Registra una nueva condicion en el catalogo de condiciones cronicas (issue #641).
 *
 * @param {object} datos
 * @param {string} datos.nombre
 * @returns {Promise<{ condicion: object|null, errores: Record<string,string>, error: object|null }>}
 */
export async function crearCondicionCatalogo(datos = {}) {
  const errores = validarCondicionCatalogo(datos);
  if (Object.keys(errores).length > 0) return { condicion: null, errores, error: null };

  const nombreLimpio = normalizarTexto(datos.nombre);

  try {
    const { data, error } = await obtenerSupabase()
      .from("condiciones_cronicas")
      .insert({ nombre: nombreLimpio })
      .select(COLUMNAS_DEL_CATALOGO)
      .maybeSingle();

    if (error) {
      const normalizado = normalizarError(error);
      if (normalizado.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD) {
        return {
          condicion: null,
          errores: { nombre: "Ya existe una condicion con este nombre en el catalogo." },
          error: null,
        };
      }
      return { condicion: null, errores: {}, error: normalizado };
    }

    return {
      condicion: data
        ? { id: data.id, nombre: data.nombre, esVigente: data.es_vigente ?? true }
        : null,
      errores: {},
      error: null,
    };
  } catch (error) {
    return { condicion: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Edita una condicion existente en el catalogo (issue #641).
 *
 * Permite cambiar el nombre o la vigencia (`esVigente`).
 *
 * @param {string} id UUID de la condicion.
 * @param {object} cambios
 * @param {string} [cambios.nombre]
 * @param {boolean} [cambios.esVigente]
 * @returns {Promise<{ condicion: object|null, errores: Record<string,string>, error: object|null }>}
 */
export async function actualizarCondicionCatalogo(id, cambios = {}) {
  if (!id) {
    return {
      condicion: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Hace falta el id para actualizar la condicion del catalogo.",
      },
    };
  }

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(cambios, "nombre")) {
    const errores = validarCondicionCatalogo({ nombre: cambios.nombre });
    if (Object.keys(errores).length > 0) return { condicion: null, errores, error: null };
    payload.nombre = normalizarTexto(cambios.nombre);
  }

  if (Object.prototype.hasOwnProperty.call(cambios, "esVigente")) {
    payload.es_vigente = Boolean(cambios.esVigente);
  }

  if (Object.keys(payload).length === 0) {
    return {
      condicion: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "No hay cambios para guardar en el catalogo.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("condiciones_cronicas")
      .update(payload)
      .eq("id", id)
      .select(COLUMNAS_DEL_CATALOGO)
      .maybeSingle();

    if (error) {
      const normalizado = normalizarError(error);
      if (normalizado.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD) {
        return {
          condicion: null,
          errores: { nombre: "Ya existe otra condicion con este nombre en el catalogo." },
          error: null,
        };
      }
      return { condicion: null, errores: {}, error: normalizado };
    }

    if (!data) {
      return {
        condicion: null,
        errores: {},
        error: {
          ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
          mensaje: "No se pudo actualizar la condicion. Revisa los permisos de administrador.",
        },
      };
    }

    return {
      condicion: { id: data.id, nombre: data.nombre, esVigente: data.es_vigente ?? true },
      errores: {},
      error: null,
    };
  } catch (error) {
    return { condicion: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Los padecimientos cronicos de un paciente, del mas reciente al mas antiguo.
 *
 * `soloVigentes` excluye los que ya estan en `resuelta`. Es lo que quiere la ficha cuando pinta
 * "condiciones a tener en cuenta al atender"; el historial completo se pide sin la bandera.
 *
 * Sin `pacienteId` devuelve vacio y `error: null`: no hay a quien consultarle, no es un fallo.
 *
 * @param {string} pacienteId UUID del paciente.
 * @param {{ soloVigentes?: boolean }} [opciones]
 * @returns {Promise<{ condiciones: object[], error: object|null }>} Cada condicion trae el
 *   `nombre` del catalogo ya resuelto, no solo el `condicion_id`.
 */
export async function obtenerCondicionesDelPaciente(pacienteId, { soloVigentes = false } = {}) {
  if (!pacienteId) return { condiciones: [], error: null };

  try {
    let consulta = obtenerSupabase()
      .from("padecimientos_cronicos")
      .select(COLUMNAS_DE_CONDICION_CRONICA)
      .eq("paciente_id", pacienteId);

    if (soloVigentes) consulta = consulta.neq("estado", ESTADOS_CONDICION_CRONICA.RESUELTA);

    const { data, error } = await consulta.order("fecha_diagnostico", { ascending: false });

    if (error) return { condiciones: [], error: normalizarError(error) };

    return { condiciones: (data ?? []).map(aCondicionDelPaciente), error: null };
  } catch (error) {
    return { condiciones: [], error: normalizarError(error) };
  }
}

/**
 * Registra que un paciente padece una condicion del catalogo.
 *
 * Escribe en `padecimientos_cronicos`, no en el catalogo: lo que se crea es el vinculo entre este
 * paciente y una condicion que ya existe.
 *
 * @param {{ pacienteId: string, condicion: string, fechaDiagnostico?: string, estado?: string, notas?: string }} datos
 * @param {Date} [hoy] Fecha con la que se valida que el diagnostico no sea futuro. Es parametro
 *   para que las pruebas puedan fijarla.
 * @returns {Promise<{ condicion: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function asociarCondicion(datos = {}, hoy = new Date()) {
  const { pacienteId } = datos;

  if (!pacienteId) {
    return {
      condicion: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Hace falta el paciente para registrar la condicion.",
      },
    };
  }

  const errores = validarCondicionCronica(datos, hoy);
  if (Object.keys(errores).length > 0) return { condicion: null, errores, error: null };

  const normalizados = normalizarDatosCondicion(datos);

  try {
    const { data, error } = await obtenerSupabase()
      .from("padecimientos_cronicos")
      .insert({
        ...aColumnasDeTabla(normalizados),
        paciente_id: pacienteId,
        condicion_id: normalizados.condicion,
      })
      .select(COLUMNAS_DE_CONDICION_CRONICA)
      .maybeSingle();

    if (error) {
      const normalizado = normalizarError(error);
      if (normalizado.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD) {
        return {
          condicion: null,
          errores: {},
          error: {
            ...normalizado,
            mensaje:
              "Este paciente ya tiene registrada esa condicion. Si cambio de estado, editala " +
              "en vez de agregarla otra vez.",
          },
        };
      }
      return { condicion: null, errores: {}, error: normalizado };
    }

    return { condicion: aCondicionDelPaciente(data), errores: {}, error: null };
  } catch (error) {
    return { condicion: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Corrige un padecimiento ya registrado: su estado, la fecha de diagnostico o las notas.
 *
 * Una actualizacion que no encuentra la fila no se reporta como "no existe" sino como permiso
 * denegado, porque es lo que suele ser: RLS deja pasar el UPDATE pero no devuelve ninguna fila
 * cuando la politica no cubre ese registro, y las dos situaciones son indistinguibles desde aqui.
 *
 * @param {string} id UUID del padecimiento (no del catalogo).
 * @param {{ estado?: string, fechaDiagnostico?: string, notas?: string }} cambios
 * @param {Date} [hoy] Fecha con la que se valida. Es parametro para poder fijarla en pruebas.
 * @returns {Promise<{ condicion: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function actualizarCondicion(id, cambios = {}, hoy = new Date()) {
  if (!id) {
    return {
      condicion: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Hace falta saber que condicion se va a corregir.",
      },
    };
  }

  const errores = validarCambioDeCondicion(cambios, hoy);
  if (Object.keys(errores).length > 0) return { condicion: null, errores, error: null };

  const fila = aColumnasDeTabla(normalizarDatosCondicion(cambios));
  if (Object.keys(fila).length === 0) {
    return {
      condicion: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "No hay ningun cambio que guardar.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("padecimientos_cronicos")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DE_CONDICION_CRONICA)
      .maybeSingle();

    if (error) return { condicion: null, errores: {}, error: normalizarError(error) };

    if (!data) {
      return {
        condicion: null,
        errores: {},
        error: {
          ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
          mensaje: "No se pudo guardar el cambio. Revisa que la condicion siga registrada.",
        },
      };
    }

    return { condicion: aCondicionDelPaciente(data), errores: {}, error: null };
  } catch (error) {
    return { condicion: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Da de alta al paciente de una condicion: la marca `resuelta`, no la borra.
 *
 * Es la operacion que hace cualquiera que atienda. Borrar de verdad es `quitarCondicion()`, y esa
 * solo la puede la administradora: el historial clinico se conserva.
 *
 * @param {string} id UUID del padecimiento.
 * @returns {Promise<{ condicion: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function desasociarCondicion(id) {
  return actualizarCondicion(id, { estado: ESTADOS_CONDICION_CRONICA.RESUELTA });
}

/**
 * Borra el padecimiento de verdad, para deshacer un registro equivocado.
 *
 * No es la forma de dar de alta a un paciente -eso es `desasociarCondicion()`, que lo marca
 * resuelto y conserva el historial-. Esto existe solo para corregir un error de captura.
 *
 * Solo la administradora tiene DELETE sobre `padecimientos_cronicos`. Para el resto la fila
 * simplemente no vuelve, y eso se reporta como permiso denegado con un mensaje que dice cual es
 * la alternativa.
 *
 * @param {string} id UUID del padecimiento.
 * @returns {Promise<{ quitada: boolean, error: object|null }>}
 */
export async function quitarCondicion(id) {
  if (!id) {
    return {
      quitada: false,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Hace falta saber que condicion se va a quitar.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("padecimientos_cronicos")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return { quitada: false, error: normalizarError(error) };

    if (!data || data.length === 0) {
      return {
        quitada: false,
        error: {
          ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
          mensaje:
            "No se pudo quitar la condicion. Solo la administradora puede borrar un registro; " +
            "para dar de alta al paciente, marcala como resuelta.",
        },
      };
    }

    return { quitada: true, error: null };
  } catch (error) {
    return { quitada: false, error: normalizarError(error) };
  }
}

/**
 * Pacientes que padecen una condicion, para planificar una jornada por comunidad.
 *
 * Va al reves que `obtenerCondicionesDelPaciente()`: alli se parte del paciente, aqui de la
 * condicion. Excluye siempre a los pacientes dados de baja (`fecha_baja`).
 *
 * `estado` manda sobre `incluirResueltas`: si se pide un estado concreto, se devuelve ese y ya.
 * Sin `estado`, por omision se excluyen las resueltas, que es lo util para planificar.
 *
 * @param {{ comunidadId?: string, condicionId?: string, estado?: string, incluirResueltas?: boolean }} [filtros]
 * @returns {Promise<{ pacientes: object[], error: object|null }>}
 */
export async function obtenerPacientesConCondicion({
  comunidadId,
  condicionId,
  estado,
  incluirResueltas = false,
} = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("padecimientos_cronicos")
      .select(COLUMNAS_DEL_PACIENTE_CRONICO)
      .is("pacientes.fecha_baja", null);

    if (comunidadId) consulta = consulta.eq("pacientes.comunidad_id", comunidadId);
    if (condicionId) consulta = consulta.eq("condicion_id", condicionId);

    if (estado) {
      consulta = consulta.eq("estado", estado);
    } else if (!incluirResueltas) {
      consulta = consulta.neq("estado", ESTADOS_CONDICION_CRONICA.RESUELTA);
    }

    const { data, error } = await consulta.order("fecha_diagnostico", { ascending: false });

    if (error) return { pacientes: [], error: normalizarError(error) };

    return { pacientes: (data ?? []).map(aPacienteCronico), error: null };
  } catch (error) {
    return { pacientes: [], error: normalizarError(error) };
  }
}
