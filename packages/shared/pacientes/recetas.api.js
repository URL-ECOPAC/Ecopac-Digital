import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { motivoSinDisponibilidad } from "../inventario/existencias.validaciones.js";
import { ESTADOS_RECETA } from "../enums.js";

const COLUMNAS_DE_LA_RECETA = [
  "id",
  "folio",
  "estado",
  "medicoId:medico_id",
  "indicacionesGenerales:indicaciones_generales",
  "motivoAnulacion:motivo_anulacion",
  "anuladaPor:anulada_por",
  "anuladaEn:anulada_en",
  "createdAt:created_at",
  "medico:perfiles!recetas_medico_id_fkey(nombres, apellidos)",
  "consulta:consultas!inner(id, jornadaId:jornada_id, expedienteId:expediente_id, jornada:jornadas(nombre, fecha))",
  "detalle:receta_detalle(id, medicamentoId:medicamento_id, loteId:lote_id, dosis, frecuencia, duracion, cantidadEntregada:cantidad_entregada, medicamento:medicamentos(nombre, concentracion, presentacion))",
].join(", ");

function aReceta(fila) {
  if (!fila) return null;

  const medico = fila.medico ?? {};
  const consulta = fila.consulta ?? {};

  return {
    id: fila.id,
    folio: fila.folio,
    estado: fila.estado,
    anulada: fila.estado === ESTADOS_RECETA.ANULADA,
    medicoId: fila.medicoId,
    medico: [medico.nombres, medico.apellidos].filter(Boolean).join(" ") || null,
    consultaId: consulta.id ?? null,
    expedienteId: consulta.expedienteId ?? null,
    jornadaId: consulta.jornadaId ?? null,
    jornada: consulta.jornada?.nombre ?? null,
    fechaDeJornada: consulta.jornada?.fecha ?? null,
    indicacionesGenerales: fila.indicacionesGenerales ?? null,
    motivoAnulacion: fila.motivoAnulacion ?? null,
    anuladaPor: fila.anuladaPor ?? null,
    anuladaEn: fila.anuladaEn ?? null,
    detalle: (fila.detalle ?? []).map((renglon) => ({
      id: renglon.id,
      medicamentoId: renglon.medicamentoId,
      medicamento: renglon.medicamento?.nombre ?? null,
      concentracion: renglon.medicamento?.concentracion ?? null,
      presentacion: renglon.medicamento?.presentacion ?? null,
      loteId: renglon.loteId ?? null,
      dosis: renglon.dosis,
      frecuencia: renglon.frecuencia,
      duracion: renglon.duracion,
      cantidadEntregada: renglon.cantidadEntregada,
    })),
    createdAt: fila.createdAt,
  };
}

const CAMPOS_DEL_RENGLON = ["medicamento", "dosis", "frecuencia", "duracion", "cantidadEntregada"];

function primerRenglonInvalido(detalle, hoy) {
  for (const renglon of detalle) {
    const faltante = CAMPOS_DEL_RENGLON.find((campo) => {
      const valor = renglon[campo];
      return valor === undefined || valor === null || valor === "";
    });
    if (faltante) return `Falta ${faltante} en uno de los medicamentos de la receta.`;

    // Solo se comprueba lo que la pantalla ya sabe. Si no paso el lote y su existencia, la
    // comprobacion de verdad ocurre en fn_generar_receta (00066), que lee la base.
    if (renglon.lote && renglon.cantidadDisponible !== undefined) {
      const motivo = motivoSinDisponibilidad(
        {
          lote: renglon.lote,
          cantidadDisponible: renglon.cantidadDisponible,
          cantidadSolicitada: renglon.cantidadEntregada,
        },
        hoy,
      );
      if (motivo) return motivo;
    }
  }
  return null;
}

function aRenglonesDeLaBase(detalle) {
  return detalle.map((renglon) => ({
    medicamento_id: renglon.medicamento,
    lote_id: renglon.loteId ?? renglon.lote?.id ?? null,
    dosis: renglon.dosis,
    frecuencia: renglon.frecuencia,
    duracion: renglon.duracion,
    cantidad_entregada: renglon.cantidadEntregada,
  }));
}

/**
 * Genera la receta de una consulta con todo su detalle, en una sola operacion.
 *
 * Llama por RPC a fn_generar_receta (00066), que inserta la receta y sus renglones dentro de la
 * misma transaccion: si un renglon falla, la receta tampoco queda. Hacerlo con dos llamadas
 * desde aqui dejaria recetas vacias cuando el detalle fallara, que es justo lo que el criterio
 * de aceptacion prohibe.
 *
 * Antes de llamar comprueba lo que la pantalla ya tiene en la mano, reusando
 * motivoSinDisponibilidad() de la #147: asi un lote vencido o sin existencia se explica sin
 * gastar el viaje. La comprobacion de verdad esta dentro de la funcion, que lee la base.
 *
 * @param {object} datos
 * @param {string} datos.consulta UUID de la consulta.
 * @param {string} datos.medico UUID del perfil que emite.
 * @param {string} [datos.indicacionesGenerales]
 * @param {object[]} datos.detalle Renglones con medicamento, dosis, frecuencia, duracion,
 *   cantidadEntregada y, opcionalmente, lote y cantidadDisponible.
 * @param {Date} [hoy] Fecha de referencia; se inyecta en las pruebas.
 * @returns {Promise<{ receta: object|null, error: object|null }>}
 */
export async function generarReceta(datos = {}, hoy = new Date()) {
  const { consulta, medico, indicacionesGenerales = null, detalle = [] } = datos;

  if (!consulta || !medico) {
    return {
      receta: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Hacen falta la consulta y el medico que emite la receta.",
      },
    };
  }

  if (!Array.isArray(detalle) || detalle.length === 0) {
    return {
      receta: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Una receta necesita al menos un medicamento.",
      },
    };
  }

  const problema = primerRenglonInvalido(detalle, hoy);
  if (problema) {
    return {
      receta: null,
      error: { ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK), mensaje: problema },
    };
  }

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_generar_receta", {
      p_consulta_id: consulta,
      p_medico_id: medico,
      p_indicaciones_generales: indicacionesGenerales,
      p_detalle: aRenglonesDeLaBase(detalle),
    });

    if (error) return { receta: null, error: normalizarError(error) };

    return await obtenerReceta(data);
  } catch (error) {
    return { receta: null, error: normalizarError(error) };
  }
}

/**
 * Devuelve una receta con su detalle, el medico que la emitio y su jornada.
 *
 * @param {string} id UUID de la receta.
 * @returns {Promise<{ receta: object|null, error: object|null }>}
 */
export async function obtenerReceta(id) {
  if (!id) {
    return { receta: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("recetas")
      .select(COLUMNAS_DE_LA_RECETA)
      .eq("id", id)
      .maybeSingle();

    if (error) return { receta: null, error: normalizarError(error) };
    if (!data) {
      return { receta: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS) };
    }

    return { receta: aReceta(data), error: null };
  } catch (error) {
    return { receta: null, error: normalizarError(error) };
  }
}

/**
 * Recetas emitidas para un paciente, de la mas reciente a la mas antigua.
 *
 * El paciente no es una columna de recetas: se llega por consultas y expedientes, asi que el
 * filtro viaja al embebido con !inner. Incluye las anuladas, marcadas como tales, porque el
 * historial clinico no puede perder de vista que una receta existio.
 *
 * @param {string} pacienteId UUID del paciente.
 * @param {{ soloEmitidas?: boolean }} [opciones]
 * @returns {Promise<{ recetas: object[], error: object|null }>}
 */
export async function obtenerRecetas(pacienteId, { soloEmitidas = false } = {}) {
  if (!pacienteId) return { recetas: [], error: null };

  try {
    let consulta = obtenerSupabase()
      .from("recetas")
      .select(COLUMNAS_DE_LA_RECETA)
      .eq("consultas.expedientes.paciente_id", pacienteId)
      .order("created_at", { ascending: false });

    if (soloEmitidas) consulta = consulta.eq("estado", ESTADOS_RECETA.EMITIDA);

    const { data, error } = await consulta;

    if (error) return { recetas: [], error: normalizarError(error) };
    return { recetas: (data ?? []).map(aReceta), error: null };
  } catch (error) {
    return { recetas: [], error: normalizarError(error) };
  }
}

/**
 * Anula una receta emitida, dejando constancia del motivo y de quien la anulo.
 *
 * Es la unica forma de deshacer una receta: no hay funcion para editarla, porque una receta
 * emitida es un documento clinico entregado al paciente. El CHECK
 * chk_recetas_anulacion_coherente (00066) impide dejarla anulada sin motivo aunque alguien
 * llame a la tabla directamente.
 *
 * QUIEN PUEDE, Y COMO SE VE CUANDO NO PUEDE
 *
 * La politica de UPDATE de la 00075 deja anular al medico que firmo la receta -y solo mientras
 * siga emitida-, y a la administradora siempre. Las dos mitades de esa politica fallan distinto,
 * y por eso aqui se tratan por separado (regla de la issue #221):
 *
 *   - Receta ajena, o ya anulada: la clausula USING excluye la fila. El UPDATE **no lanza**,
 *     corre afectando cero filas. Sin el .select() de abajo esto devolveria exito y la pantalla
 *     diria "anulada" con la receta intacta.
 *   - anulada_por que no es quien ejecuta: lo rechaza el WITH CHECK, que si lanza 42501 y
 *     normalizarError() ya traduce a permiso denegado.
 *
 * @param {string} id UUID de la receta.
 * @param {{ motivo: string, anuladaPor: string }} datos `anuladaPor` tiene que ser el perfil de
 *   la sesion: el servidor lo exige salvo que quien anule sea la administradora.
 * @returns {Promise<{ receta: object|null, error: object|null }>}
 */
export async function anularReceta(id, { motivo, anuladaPor } = {}) {
  if (!id || !anuladaPor) {
    return { receta: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  if (typeof motivo !== "string" || motivo.trim() === "") {
    return {
      receta: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Para anular una receta hay que indicar el motivo.",
      },
    };
  }

  try {
    // El .select("id") no es para leer: es para saber si el UPDATE alcanzo alguna fila.
    const { data, error } = await obtenerSupabase()
      .from("recetas")
      .update({
        estado: ESTADOS_RECETA.ANULADA,
        motivo_anulacion: motivo.trim(),
        anulada_por: anuladaPor,
        anulada_en: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");

    if (error) return { receta: null, error: normalizarError(error) };

    if (!data || data.length === 0) {
      return {
        receta: null,
        error: {
          ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
          mensaje:
            "No se pudo anular la receta. Solo puede anularla quien la emitio, y solo mientras " +
            "siga vigente; si ya estaba anulada o la firmo otra persona, pideselo a la " +
            "administradora.",
        },
      };
    }

    return await obtenerReceta(id);
  } catch (error) {
    return { receta: null, error: normalizarError(error) };
  }
}
