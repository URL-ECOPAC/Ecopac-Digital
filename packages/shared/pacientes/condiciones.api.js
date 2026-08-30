// Consultas de Supabase de las condiciones cronicas del paciente (issue #122).
//
// Este archivo es el unico del monorepo que escribe padecimientos_cronicos, la tabla que
// pacientes/api.js declara ajena en su cabecera: alli solo se lee para armar la ficha.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.
//
// Ninguna funcion valida aqui quien puede leer o escribir: esa regla la aplican las politicas de
// 00010_condiciones_cronicas.sql (administrador y medico leen, registran y actualizan; solo
// administrador borra), y un intento sin permiso vuelve como 42501, que normalizarError() ya
// traduce. El cliente pregunta para dibujar -condiciones.permisos.js-, el servidor decide.
//
// SOBRE DAR DE BAJA UNA CONDICION
//
// Hay dos operaciones distintas y no son intercambiables:
//   - desasociarCondicion() pasa el estado a 'resuelta'. Es la baja normal: el paciente ya no
//     padece la condicion, pero el registro se queda. Lo puede hacer el medico.
//   - quitarCondicion() borra la fila. Es para corregir un alta equivocada, y RLS la reserva al
//     administrador.
// docs/PERMISOS.md:82 lo dice para todas las tablas clinicas: la baja es logica, no fisica.
// Borrar el diagnostico de un paciente cronico perderia justo lo que HU06 quiere seguir.

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
} from "./condiciones.validaciones.js";

const COLUMNAS_DEL_CATALOGO = ["id", "nombre"].join(", ");

// El listado de cronicos se arma desde padecimientos_cronicos y no desde pacientes, porque cada
// fila es una condicion de un paciente. El paciente se pide embebido con !inner para que la fila
// desaparezca si el filtro de comunidad no casa: sin el, PostgREST devolveria la condicion con
// `paciente` en null en vez de omitirla.
const COLUMNAS_DEL_PACIENTE_CRONICO = [
  "id",
  "condicionId:condicion_id",
  "fechaDiagnostico:fecha_diagnostico",
  "estado",
  "notas",
  "condicion:condiciones_cronicas(nombre)",
  "paciente:pacientes!inner(id, nombres, apellidos, comunidadId:comunidad_id, comunidad:comunidades(nombre))",
].join(", ");

/**
 * Mapa de los campos editables de una condicion a su columna en padecimientos_cronicos.
 *
 * updated_at no esta aqui a proposito: lo escribe el trigger trg_padecimientos_cronicos_updated_at
 * de la 00010. Enviarlo desde el cliente lo pisaria con la hora del dispositivo.
 */
const MAPA_COLUMNAS_DE_LA_CONDICION = {
  fechaDiagnostico: "fecha_diagnostico",
  estado: "estado",
  notas: "notas",
};

/** Traduce del camelCase de las pantallas al snake_case de la tabla, omitiendo lo no enviado. */
function aColumnasDeTabla(datos = {}) {
  const fila = {};
  for (const [campo, columna] of Object.entries(MAPA_COLUMNAS_DE_LA_CONDICION)) {
    // Solo se envia lo que venga en el objeto: un update parcial no debe borrar lo que no toca.
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Aplana el paciente embebido para que la pantalla no tenga que navegar el anidamiento.
 *
 * Deja `nombreCompleto` y `comunidad` en la raiz, que es lo que declara
 * COLUMNAS_PACIENTE_CRONICO en condiciones.columnas.js.
 */
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
 * Lee el catalogo de condiciones cronicas.
 *
 * Lo puede leer cualquier autenticado: la politica de condiciones_cronicas es
 * `FOR SELECT USING (true)`. El catalogo no dice nada de ningun paciente, y las pantallas lo
 * necesitan para llenar el select del formulario.
 *
 * @returns {Promise<{ condiciones: Array<object>, error: object|null }>}
 */
export async function obtenerCatalogoDeCondiciones() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("condiciones_cronicas")
      .select(COLUMNAS_DEL_CATALOGO)
      .order("nombre", { ascending: true });

    if (error) return { condiciones: [], error: normalizarError(error) };

    return { condiciones: data ?? [], error: null };
  } catch (error) {
    return { condiciones: [], error: normalizarError(error) };
  }
}

/**
 * Lee las condiciones cronicas de un paciente.
 *
 * Un rol sin la politica de SELECT no recibe un error: recibe cero filas. Es como funciona RLS y
 * por eso la pantalla pregunta antes a puedeVerCondiciones() en vez de deducirlo de la respuesta.
 *
 * @param {string} pacienteId UUID del paciente.
 * @param {object} opciones
 * @param {boolean} opciones.soloVigentes Excluye las que ya estan 'resuelta'.
 * @returns {Promise<{ condiciones: Array<object>, error: object|null }>}
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

    return { condiciones: data ?? [], error: null };
  } catch (error) {
    return { condiciones: [], error: normalizarError(error) };
  }
}

/**
 * Asocia una condicion cronica a un paciente.
 *
 * El duplicado no se comprueba con un SELECT previo: entre la lectura y la escritura cabe otra
 * sesion haciendo lo mismo. Lo impide UNIQUE (paciente_id, condicion_id) de la 00010, y aqui se
 * traduce el 23505 que devuelve, igual que registrarTriaje() con su propio UNIQUE.
 *
 * @param {object} datos
 * @param {string} datos.pacienteId UUID del paciente.
 * @param {string} datos.condicion UUID de la condicion del catalogo.
 * @param {string} datos.fechaDiagnostico Fecha en formato ISO.
 * @param {string} [datos.estado] Uno de ESTADOS_CONDICION_CRONICA; por defecto 'activa'.
 * @param {string} [datos.notas]
 * @param {Date} hoy Fecha de referencia para la validacion.
 * @returns {Promise<{ condicion: object|null, errores: Record<string,string>, error: object|null }>}
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

    return { condicion: data ?? null, errores: {}, error: null };
  } catch (error) {
    return { condicion: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Corrige una condicion ya registrada.
 *
 * Update parcial: solo viaja lo que venga en `cambios`. La condicion en si no se puede cambiar
 * -no esta en MAPA_COLUMNAS_DE_LA_CONDICION-: cambiarla convertiria el registro en otro
 * diagnostico distinto conservando su fecha y sus notas. Para eso se quita y se agrega.
 *
 * @param {string} id UUID de la fila de padecimientos_cronicos.
 * @param {object} cambios Campos a modificar: fechaDiagnostico, estado y/o notas.
 * @param {Date} hoy Fecha de referencia para la validacion.
 * @returns {Promise<{ condicion: object|null, errores: Record<string,string>, error: object|null }>}
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

    // Sin fila de vuelta la politica de UPDATE no dejo pasar el cambio, o el id no existe. RLS
    // no lanza en UPDATE: deja correr la sentencia sin afectar filas (regla de la issue #221).
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

    return { condicion: data, errores: {}, error: null };
  } catch (error) {
    return { condicion: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Da de baja una condicion: la marca como resuelta.
 *
 * Es la baja normal y la que responde al criterio "desasociar" de la issue #122. No borra nada:
 * el diagnostico ocurrio y el historial del paciente lo conserva, que es lo que HU06 quiere
 * seguir. La puede hacer el medico, porque para la base de datos es un UPDATE.
 *
 * @param {string} id UUID de la fila de padecimientos_cronicos.
 * @returns {Promise<{ condicion: object|null, errores: Record<string,string>, error: object|null }>}
 */
export async function desasociarCondicion(id) {
  return actualizarCondicion(id, { estado: ESTADOS_CONDICION_CRONICA.RESUELTA });
}

/**
 * Borra el registro de una condicion.
 *
 * Solo para corregir un alta equivocada. RLS lo reserva al administrador (unica politica de
 * DELETE del esquema clinico, 00010), asi que a un medico la sentencia le corre sin afectar
 * filas y esta funcion devuelve `quitada: false`.
 *
 * Desde la migracion 00070 la operacion queda registrada en eventos_auditoria.
 *
 * @param {string} id UUID de la fila de padecimientos_cronicos.
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

    // Igual que en el UPDATE: un DELETE que la politica no deja pasar no lanza, borra cero filas.
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
 * Lista los pacientes de una comunidad que tienen una condicion determinada.
 *
 * Es el criterio de #122 que permite planificar la siguiente jornada a esa comunidad (HU06).
 *
 * La consulta va contra padecimientos_cronicos con el paciente embebido y no al reves, porque
 * PostgREST solo sabe filtrar por una columna de la tabla embebida si el embed es `!inner`; de
 * paso, cada fila ya es el par paciente-condicion que la pantalla dibuja.
 *
 * Los dos filtros son opcionales: sin ninguno devuelve todos los cronicos, que es lo que la
 * pantalla pide al abrirse antes de que nadie elija nada.
 *
 * @param {object} filtros
 * @param {string} [filtros.comunidadId] UUID de la comunidad.
 * @param {string} [filtros.condicionId] UUID de la condicion del catalogo.
 * @param {string} [filtros.estado] Uno de ESTADOS_CONDICION_CRONICA.
 * @param {boolean} [filtros.incluirResueltas] Por defecto false: las resueltas ya no interesan
 *   para planificar. Se ignora si se pidio un `estado` concreto.
 * @returns {Promise<{ pacientes: Array<object>, error: object|null }>}
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
      // Un paciente dado de baja no se planifica. Mismo criterio que fn_buscar_pacientes (00068).
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
