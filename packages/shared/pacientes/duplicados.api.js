// Deteccion y fusion de expedientes duplicados (issue #140, RF-06).
//
// Las dos consultas de este archivo son RPC hacia funciones de Postgres (migracion 00101), no
// .from()/.select(): la deteccion necesita el indice de trigramas de pacientes (00011) y la
// fusion necesita reasignar filas en varias tablas dentro de una sola transaccion, algo que
// varios .update() sueltos desde el cliente no pueden garantizar (un fallo a mitad de camino
// dejaria un paciente medio fusionado).
//
// fusionarPacientes() queda restringida a solo administrador, mas estrecho que la politica
// UPDATE de pacientes (que tambien alcanza a medico, 00086): por eso fn_fusionar_pacientes es
// SECURITY DEFINER con su propio chequeo de rol, y aqui se adelanta el mismo chequeo en el
// cliente para no gastar un viaje de red en un rechazo que ya se sabe de antemano.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { puedeFusionarPacientes, puedeVerPacientes } from "./permisos.js";

/**
 * Posibles pacientes duplicados: misma fecha de nacimiento y nombre similar, ordenados por
 * similitud descendente. La ve quien ya puede leer pacientes (administrador, medico,
 * voluntario general): el criterio de aceptacion no restringe la lectura, solo la fusion.
 *
 * @param {{ rolUsuario: string }} contexto
 * @returns {Promise<{ duplicados: object[], error: object|null }>}
 */
export async function listarPosiblesDuplicados({ rolUsuario } = {}) {
  if (!puedeVerPacientes(rolUsuario)) {
    return {
      duplicados: [],
      error: { mensaje: "No tienes permisos de lectura para el listado de pacientes." },
    };
  }

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_detectar_pacientes_duplicados");

    if (error) return { duplicados: [], error: normalizarError(error) };

    const duplicados = (data ?? []).map((fila) => ({
      pacienteAId: fila.paciente_a_id,
      nombresA: fila.nombres_a,
      apellidosA: fila.apellidos_a,
      numeroFichaA: fila.numero_ficha_a,
      pacienteBId: fila.paciente_b_id,
      nombresB: fila.nombres_b,
      apellidosB: fila.apellidos_b,
      numeroFichaB: fila.numero_ficha_b,
      fechaNacimiento: fila.fecha_nacimiento,
      similitud: fila.similitud,
    }));

    return { duplicados, error: null };
  } catch (error) {
    return { duplicados: [], error: normalizarError(error) };
  }
}

/**
 * Fusiona dos expedientes: el `absorbidoId` queda dado de baja y su historial se reasigna al
 * `sobrevivienteId` (fn_fusionar_pacientes, migracion 00101). Una fila puntual que chocaria con
 * una restriccion UNIQUE del sobreviviente (misma jornada ya atendida, misma condicion cronica
 * ya registrada) se conserva sin reasignar bajo el absorbido: nada se pierde ni se borra.
 *
 * @param {string} sobrevivienteId Paciente que conserva su identidad.
 * @param {string} absorbidoId Paciente que queda dado de baja y fusionado en el anterior.
 * @param {{ rolUsuario: string }} contexto
 * @returns {Promise<{ fusion: object|null, error: object|null }>}
 */
export async function fusionarPacientes(sobrevivienteId, absorbidoId, { rolUsuario } = {}) {
  if (!puedeFusionarPacientes(rolUsuario)) {
    return {
      fusion: null,
      error: { mensaje: "Solo la administradora puede fusionar expedientes." },
    };
  }

  if (!sobrevivienteId || !absorbidoId || sobrevivienteId === absorbidoId) {
    return {
      fusion: null,
      error: { mensaje: "Se necesitan dos pacientes distintos para fusionar." },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .rpc("fn_fusionar_pacientes", {
        p_sobreviviente_id: sobrevivienteId,
        p_absorbido_id: absorbidoId,
      })
      .single();

    if (error) return { fusion: null, error: normalizarError(error) };

    return {
      fusion: {
        id: data.id,
        pacienteAbsorbidoId: data.paciente_absorbido_id,
        pacienteSobrevivienteId: data.paciente_sobreviviente_id,
        realizadaPor: data.realizada_por,
        realizadaEn: data.realizada_en,
      },
      error: null,
    };
  } catch (error) {
    return { fusion: null, error: normalizarError(error) };
  }
}
