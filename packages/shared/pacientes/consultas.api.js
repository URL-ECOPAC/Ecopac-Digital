import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { puedeRegistrarEnJornada } from "../jornadas/validaciones.js";

const COLUMNAS_DE_LA_CONSULTA = [
  "id",
  "expedienteId:expediente_id",
  "atencionId:atencion_id",
  "medicoId:medico_id",
  "jornadaId:jornada_id",
  "motivoConsulta:motivo_consulta",
  "antecedentes",
  "sintomas",
  "exploracion",
  "tratamiento",
  "observaciones",
  "planSeguimiento:plan_seguimiento",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(", ");

const COLUMNAS_CON_DETALLE = [
  COLUMNAS_DE_LA_CONSULTA,
  "diagnosticos:consulta_diagnostico(esPrincipal:es_principal, diagnostico:diagnosticos(id, codigo, nombre))",
  "receta:recetas(id, folio, indicacionesGenerales:indicaciones_generales)",
].join(", ");

const CAMPOS_EDITABLES = {
  motivoConsulta: "motivo_consulta",
  antecedentes: "antecedentes",
  sintomas: "sintomas",
  exploracion: "exploracion",
  tratamiento: "tratamiento",
  observaciones: "observaciones",
  planSeguimiento: "plan_seguimiento",
};

function aColumnasDeTabla(datos = {}) {
  const fila = {};
  for (const [campo, columna] of Object.entries(CAMPOS_EDITABLES)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

function aConsulta(fila) {
  if (!fila) return null;

  const diagnosticos = (fila.diagnosticos ?? []).map((union) => ({
    id: union.diagnostico?.id ?? null,
    codigo: union.diagnostico?.codigo ?? null,
    nombre: union.diagnostico?.nombre ?? null,
    esPrincipal: union.esPrincipal === true,
  }));

  return {
    id: fila.id,
    expedienteId: fila.expedienteId,
    atencionId: fila.atencionId,
    medicoId: fila.medicoId,
    jornadaId: fila.jornadaId,
    motivoConsulta: fila.motivoConsulta,
    antecedentes: fila.antecedentes ?? null,
    sintomas: fila.sintomas ?? null,
    exploracion: fila.exploracion ?? null,
    tratamiento: fila.tratamiento ?? null,
    observaciones: fila.observaciones ?? null,
    planSeguimiento: fila.planSeguimiento ?? null,
    diagnosticos,
    diagnosticoPrincipal: diagnosticos.find((diagnostico) => diagnostico.esPrincipal) ?? null,
    receta: fila.receta ?? null,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

function filasDeDiagnostico(consultaId, diagnosticos = []) {
  return diagnosticos.map((diagnostico) => ({
    consulta_id: consultaId,
    diagnostico_id: diagnostico.diagnosticoId ?? diagnostico.id,
    es_principal: diagnostico.esPrincipal === true,
  }));
}

/**
 * Registra una consulta medica y, opcionalmente, sus diagnosticos.
 *
 * El motivo de consulta es el unico campo obligatorio: el resto queda opcional a proposito para
 * no bloquear el registro en campo, tal como pide el criterio de aceptacion, y la 00018 lo
 * respalda con NOT NULL solo sobre motivo_consulta.
 *
 * Antes de gastar la llamada comprueba el estado de la jornada con puedeRegistrarEnJornada(),
 * el mismo helper que usa iniciarAtencion(): el trigger validar_jornada_en_curso (00018) lo va
 * a rechazar igual, pero desde aqui el mensaje explica que hacer en vez de devolver un error
 * generico, porque normalizarError() no traduce el P0001 que lanza un RAISE EXCEPTION. Si la
 * pantalla ya cargo la jornada, puede pasar estadoDeJornada y ahorrarse la consulta.
 *
 * Quien puede registrar, y sobre que jornada, lo deciden las politicas RLS de la 00033: solo el
 * administrador, o un medico asignado a esa jornada registrando como si mismo.
 *
 * Los diagnosticos se insertan en una segunda llamada, asi que no es atomico: hacerlo en una
 * sola transaccion exigiria una funcion RPC, que es alcance de otra issue. Si esa segunda
 * llamada falla, la consulta ya creada viaja igual en la respuesta junto al error, para que la
 * pantalla reintente solo los diagnosticos en vez de perder lo escrito.
 *
 * @param {object} datos Campos de la consulta en camelCase.
 * @param {object} [opciones]
 * @param {string} [opciones.estadoDeJornada] Estado ya conocido de la jornada.
 * @returns {Promise<{ consulta: object|null, error: object|null }>}
 */
export async function registrarConsulta(datos = {}, { estadoDeJornada } = {}) {
  const { expediente, atencion, medico, jornada, motivoConsulta, diagnosticos = [] } = datos;

  if (!expediente || !atencion || !medico || !jornada) {
    return {
      consulta: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Hacen falta el expediente, la atencion, el medico y la jornada.",
      },
    };
  }

  if (typeof motivoConsulta !== "string" || motivoConsulta.trim() === "") {
    return {
      consulta: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "El motivo de consulta es obligatorio.",
      },
    };
  }

  try {
    const supabase = obtenerSupabase();

    let estado = estadoDeJornada;
    if (estado === undefined) {
      const { data, error } = await supabase
        .from("jornadas")
        .select("estado")
        .eq("id", jornada)
        .maybeSingle();

      if (error) return { consulta: null, error: normalizarError(error) };
      if (!data) {
        return {
          consulta: null,
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
        consulta: null,
        error: { ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK), mensaje: motivo },
      };
    }

    const { data: creada, error } = await supabase
      .from("consultas")
      .insert({
        expediente_id: expediente,
        atencion_id: atencion,
        medico_id: medico,
        jornada_id: jornada,
        ...aColumnasDeTabla({ ...datos, motivoConsulta: motivoConsulta.trim() }),
      })
      .select(COLUMNAS_DE_LA_CONSULTA)
      .single();

    if (error) return { consulta: null, error: normalizarError(error) };

    if (diagnosticos.length > 0) {
      const { error: errorDiagnosticos } = await supabase
        .from("consulta_diagnostico")
        .insert(filasDeDiagnostico(creada.id, diagnosticos));

      if (errorDiagnosticos) {
        return { consulta: aConsulta(creada), error: normalizarError(errorDiagnosticos) };
      }
    }

    return await obtenerConsulta(creada.id);
  } catch (error) {
    return { consulta: null, error: normalizarError(error) };
  }
}

/**
 * Devuelve una consulta con sus diagnosticos y su receta, en una sola llamada.
 *
 * Los tres niveles se piden embebidos en vez de con tres consultas encadenadas: PostgREST
 * resuelve el join por las llaves foraneas de la 00018 y la 00019, y asi la ficha clinica se
 * dibuja sin estados intermedios a medio cargar.
 *
 * @param {string} id UUID de la consulta.
 * @returns {Promise<{ consulta: object|null, error: object|null }>}
 */
export async function obtenerConsulta(id) {
  if (!id) {
    return {
      consulta: null,
      error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("consultas")
      .select(COLUMNAS_CON_DETALLE)
      .eq("id", id)
      .maybeSingle();

    if (error) return { consulta: null, error: normalizarError(error) };
    if (!data) {
      return {
        consulta: null,
        error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS),
      };
    }

    return { consulta: aConsulta(data), error: null };
  } catch (error) {
    return { consulta: null, error: normalizarError(error) };
  }
}

/**
 * Actualiza los campos de texto de una consulta.
 *
 * Quien puede modificarla lo decide RLS (00033): el medico que la registro o el administrador.
 * Un intento sin permiso vuelve como 42501, que normalizarError() ya traduce; no se comprueba
 * aqui para no tener dos definiciones de la misma regla.
 *
 * Ni el expediente, ni la atencion, ni el medico, ni la jornada se pueden cambiar: reasignar una
 * consulta a otra atencion o a otra jornada no es editarla, es otra cosa.
 *
 * @param {string} id UUID de la consulta.
 * @param {object} datos Campos editables en camelCase.
 * @returns {Promise<{ consulta: object|null, error: object|null }>}
 */
export async function actualizarConsulta(id, datos = {}) {
  if (!id) {
    return {
      consulta: null,
      error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
    };
  }

  const cambios = aColumnasDeTabla(datos);
  if (Object.keys(cambios).length === 0) return await obtenerConsulta(id);

  if (
    Object.prototype.hasOwnProperty.call(cambios, "motivo_consulta") &&
    String(cambios.motivo_consulta ?? "").trim() === ""
  ) {
    return {
      consulta: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "El motivo de consulta es obligatorio.",
      },
    };
  }

  try {
    const { error } = await obtenerSupabase().from("consultas").update(cambios).eq("id", id);

    if (error) return { consulta: null, error: normalizarError(error) };
    return await obtenerConsulta(id);
  } catch (error) {
    return { consulta: null, error: normalizarError(error) };
  }
}
