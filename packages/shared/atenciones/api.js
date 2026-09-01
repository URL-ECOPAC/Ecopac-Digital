// Consultas de Supabase del modulo de atenciones.
//
// Este archivo es el unico lugar del monorepo que escribe la tabla atenciones y lee la vista
// vista_cola_jornada. Misma regla de propiedad que declara jornadas/api.js.
//
// LA COLA NO SE ARMA AQUI, SE ARMA EN LA BASE
//
// obtenerCola() lee una vista y no cruza cuatro tablas desde el cliente, por dos motivos que
// pesan igual:
//
// 1. Frontera de propiedad: la etapa depende de triajes, consultas y recetas, que van a ser de
//    las issues #117 y #119. Leerlas desde aqui rompe la regla que jornadas/api.js sostiene con
//    fn_contar_atenciones_incompletas() y personal_registro_atenciones().
// 2. Permisos: un voluntario general no puede leer consultas ni recetas (00033). Si la etapa se
//    calculara con lo que el cliente ve, el voluntario tendria una cola equivocada -- todo
//    paciente ya atendido le apareceria como si siguiera esperando consulta. La vista es
//    SECURITY DEFINER justamente para que la cola sea la misma para todos.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { puedeRegistrarEnJornada } from "../jornadas/validaciones.js";
import { ORDEN_DE_ETAPAS } from "./etapas.js";

// Se enumeran las columnas en vez de pedir "*" para que una columna nueva en la vista no empiece
// a viajar sola hasta el cliente. Los alias dejan los ids en camelCase, como esperan los
// descriptores (misma convencion que jornadas/api.js).
const COLUMNAS_DE_LA_COLA = [
  "atencionId:atencion_id",
  "jornadaId:jornada_id",
  "pacienteId:paciente_id",
  "nombres",
  "apellidos",
  "etapa",
  "esperandoDesde:esperando_desde",
  "iniciadaEn:iniciada_en",
].join(", ");

const COLUMNAS_DE_ATENCION = [
  "id",
  "pacienteId:paciente_id",
  "jornadaId:jornada_id",
  "cerradaEn:cerrada_en",
  "motivoCierre:motivo_cierre",
  "createdAt:created_at",
].join(", ");

/**
 * Registra la llegada de un paciente a una jornada.
 *
 * Antes de gastar una llamada comprueba el estado de la jornada con puedeRegistrarEnJornada()
 * (issue #172): el trigger validar_jornada_en_curso_atenciones() de la 00055 lo va a rechazar
 * igual, pero desde aqui el mensaje explica que hacer para continuar en vez de devolver un error
 * de base de datos.
 *
 * El "falla si ya existe una abierta" del criterio de aceptacion 1 lo cumple el
 * UNIQUE (paciente_id, jornada_id) de la 00013, sin codigo: no hay forma de crear dos atenciones
 * del mismo paciente en la misma jornada. Lo unico que se agrega aqui es traducir esa violacion
 * a un mensaje que se entienda.
 *
 * @param {string} pacienteId UUID del paciente.
 * @param {string} jornadaId UUID de la jornada.
 * @param {object} [opciones]
 * @param {string} [opciones.estadoDeJornada] Estado ya conocido, para no volver a consultarlo.
 * @returns {Promise<{ atencion: object|null, error: object|null }>}
 */
export async function iniciarAtencion(pacienteId, jornadaId, { estadoDeJornada } = {}) {
  if (!pacienteId || !jornadaId) {
    return {
      atencion: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Hace falta el paciente y la jornada para registrar la atencion.",
      },
    };
  }

  try {
    const supabase = obtenerSupabase();

    // La pantalla que ya cargo la jornada pasa su estado y se ahorra esta consulta.
    let estado = estadoDeJornada;
    if (estado === undefined) {
      const { data, error } = await supabase
        .from("jornadas")
        .select("estado")
        .eq("id", jornadaId)
        .maybeSingle();

      if (error) return { atencion: null, error: normalizarError(error) };
      if (!data) {
        return {
          atencion: null,
          error: construirError(
            CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS,
            "jornada no encontrada",
          ),
        };
      }
      estado = data.estado;
    }

    const { puede, motivo } = puedeRegistrarEnJornada(estado);
    if (!puede) {
      return {
        atencion: null,
        error: { ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK), mensaje: motivo },
      };
    }

    const { data, error } = await supabase
      .from("atenciones")
      .insert({ paciente_id: pacienteId, jornada_id: jornadaId })
      .select(COLUMNAS_DE_ATENCION)
      .maybeSingle();

    if (error) {
      const normalizado = normalizarError(error);
      if (normalizado.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD) {
        return {
          atencion: null,
          error: {
            ...normalizado,
            mensaje: "Este paciente ya esta registrado en la jornada; buscalo en la cola.",
          },
        };
      }
      return { atencion: null, error: normalizado };
    }

    return { atencion: data ?? null, error: null };
  } catch (error) {
    return { atencion: null, error: normalizarError(error) };
  }
}

/**
 * Devuelve la cola de la jornada, agrupada por etapa.
 *
 * El criterio de aceptacion 4 -- que la cola refleje lo que hicieron otros dispositivos -- sale
 * solo: cada llamada consulta el servidor y aqui no hay cache. Quien la use vuelve a llamar al
 * refrescar o al volver de otra pantalla.
 *
 * Devuelve SIEMPRE las cuatro claves, aunque alguna venga vacia: un grupo que desaparece cuando
 * se queda sin pacientes hace saltar la pantalla mientras alguien la esta mirando.
 *
 * El orden dentro de cada etapa es por tiempo de espera, del que mas lleva al que menos: es el
 * orden en el que hay que atender.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @returns {Promise<{ cola: Record<string, object[]>, total: number, error: object|null }>}
 */
export async function obtenerCola(jornadaId) {
  const vacia = () => Object.fromEntries(ORDEN_DE_ETAPAS.map((etapa) => [etapa, []]));

  if (!jornadaId) return { cola: vacia(), total: 0, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("vista_cola_jornada")
      .select(COLUMNAS_DE_LA_COLA)
      .eq("jornada_id", jornadaId)
      .order("esperando_desde", { ascending: true });

    if (error) return { cola: vacia(), total: 0, error: normalizarError(error) };

    const cola = vacia();
    for (const fila of data ?? []) {
      // Una etapa que este archivo no conoce se ignora en vez de romper la pantalla: si la vista
      // gana un valor nuevo, la cola sigue mostrando lo que si entiende.
      if (cola[fila.etapa]) cola[fila.etapa].push(fila);
    }

    return { cola, total: (data ?? []).length, error: null };
  } catch (error) {
    return { cola: vacia(), total: 0, error: normalizarError(error) };
  }
}

/**
 * Cuenta los pacientes con atencion registrada en una jornada (issue #187, criterio 5).
 *
 * Cuenta filas de `atenciones` (abiertas y cerradas), no de `vista_cola_jornada` (solo abiertas)
 * ni de `vista_reporte_impacto` (00064, restringida a administrador/junta directiva/socio
 * fundador). `atenciones` tiene SELECT para administrador, medico y voluntario general (00033),
 * asi que este numero si le llega a los tres roles que tienen el panel de #187 abierto en
 * campo. Como `atenciones` tiene UNIQUE(paciente_id, jornada_id) (00013), contar filas equivale
 * a contar pacientes distintos: coincide con `pacientes_atendidos` de vista_reporte_impacto sin
 * necesitar esa vista.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @returns {Promise<{ cantidad: number, error: object|null }>}
 */
export async function contarPacientesDeJornada(jornadaId) {
  if (!jornadaId) return { cantidad: 0, error: null };

  try {
    const { count, error } = await obtenerSupabase()
      .from("atenciones")
      .select("id", { count: "exact", head: true })
      .eq("jornada_id", jornadaId);

    if (error) return { cantidad: 0, error: normalizarError(error) };
    return { cantidad: count ?? 0, error: null };
  } catch (error) {
    return { cantidad: 0, error: normalizarError(error) };
  }
}

/**
 * Retira una atencion de la cola (criterio de aceptacion 5).
 *
 * No borra nada: marca cerrada_en. El historial clinico de la jornada tiene que seguir ahi.
 *
 * Cerrar dos veces no es un error del que haya que avisar -- el resultado es el mismo -- pero
 * tampoco se pisa la marca original: el WHERE exige que siga abierta, asi que la primera hora de
 * cierre es la que queda.
 *
 * @param {string} atencionId UUID de la atencion.
 * @param {string} [motivo] Por que se cierra: entrega completada, el paciente se retiro, etc.
 * @returns {Promise<{ atencion: object|null, error: object|null }>}
 */
export async function cerrarAtencion(atencionId, motivo = "") {
  if (!atencionId) return { atencion: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("atenciones")
      .update({ cerrada_en: new Date().toISOString(), motivo_cierre: motivo || null })
      .eq("id", atencionId)
      .is("cerrada_en", null)
      .select(COLUMNAS_DE_ATENCION)
      .maybeSingle();

    if (error) return { atencion: null, error: normalizarError(error) };

    // Sin fila: o no existe, o RLS la esconde, o ya estaba cerrada. Ninguno amerita un error:
    // en los tres casos la atencion no esta en la cola, que es lo que queria quien llamo.
    return { atencion: data ?? null, error: null };
  } catch (error) {
    return { atencion: null, error: normalizarError(error) };
  }
}
