import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { aCadenaFechaLocal } from "@ecopac/shared/formato/fechas.js";
const PRESUPUESTO_VACIO = {
  asignado: 0,
  gastado: 0,
  disponible: 0,
  pendiente: 0,
};

function aNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function aPresupuesto(fila) {
  if (!fila) return null;
  return {
    asignado: aNumero(fila.asignado),
    gastado: aNumero(fila.gastado),
    disponible: aNumero(fila.disponible),
    pendiente: aNumero(fila.pendiente),
  };
}

async function consultar(nombreDeFuncion, argumentos, presupuestoSinFilas) {
  try {
    const { data, error } = await obtenerSupabase().rpc(nombreDeFuncion, argumentos).maybeSingle();
    if (error) return { presupuesto: null, error: normalizarError(error) };
    return { presupuesto: aPresupuesto(data) ?? presupuestoSinFilas, error: null };
  } catch (error) {
    return { presupuesto: null, error: normalizarError(error) };
  }
}

export async function obtenerPresupuestoJornada(idJornada) {
  if (!idJornada) return { presupuesto: null, error: null };
  return consultar("presupuesto_de_jornada", { p_jornada_id: idJornada }, null);
}

export async function obtenerPresupuestoProyecto(idProyecto) {
  if (!idProyecto) return { presupuesto: null, error: null };
  return consultar(
    "presupuesto_de_proyecto",
    { p_proyecto_id: idProyecto },
    { ...PRESUPUESTO_VACIO },
  );
}

export async function obtenerPresupuestoSistema() {
  return consultar("presupuesto_del_sistema", {}, { ...PRESUPUESTO_VACIO });
}

export async function obtenerPresupuestosDeProyectos(idsDeProyecto = []) {
  const ids = (idsDeProyecto || []).filter(Boolean);
  if (ids.length === 0) return { presupuestos: {}, error: null };
  try {
    const { data, error } = await obtenerSupabase().rpc("presupuestos_de_proyectos", {
      p_proyecto_ids: ids,
    });
    if (error) return { presupuestos: {}, error: normalizarError(error) };
    const presupuestos = {};
    for (const fila of data || []) {
      presupuestos[fila.proyecto_id] = aPresupuesto(fila);
    }
    return { presupuestos, error: null };
  } catch (error) {
    return { presupuestos: {}, error: normalizarError(error) };
  }
}

export async function obtenerPresupuestosDeJornadas(idsDeJornada = []) {
  const ids = (idsDeJornada || []).filter(Boolean);
  if (ids.length === 0) return { presupuestos: {}, error: null };
  try {
    const { data, error } = await obtenerSupabase().rpc("presupuestos_de_jornadas", {
      p_jornada_ids: ids,
    });
    if (error) return { presupuestos: {}, error: normalizarError(error) };
    const presupuestos = {};
    for (const fila of data || []) {
      presupuestos[fila.jornada_id] = aPresupuesto(fila);
    }
    return { presupuestos, error: null };
  } catch (error) {
    return { presupuestos: {}, error: normalizarError(error) };
  }
}

// ============================================================================
// Funciones API para la gestión de Gastos — CORREGIDO DEFINITIVO
// ============================================================================

/** Extrae el valor real si llega como objeto {value, label} o como valor directo */
function extraerValor(campo) {
  if (!campo && campo !== 0) return "";
  if (typeof campo === "object" && campo !== null) {
    if (campo.value !== undefined) return campo.value;
    if (campo.id !== undefined) return campo.id;
  }
  return campo;
}

/** Convierte fecha de "dd/mm/aaaa" a "aaaa-mm-dd" */
function normalizarFecha(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) {
    return aCadenaFechaLocal(fecha).split("T")[0];
  }
  if (typeof fecha === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
    const partes = fecha.split("/");
    if (partes.length === 3) {
      const [dia, mes, anio] = partes;
      return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    }
  }
  return fecha;
}

export async function registrarGasto(datosGasto, { usuarioId, estado } = {}) {
  try {
    const { concepto, categoria, monto, fecha, responsable_id, jornada_id } = datosGasto || {};

    //  Extraer y limpiar TODOS los valores
    const categoriaTexto = String(extraerValor(categoria)).trim();
    const jornadaIdLimpio = extraerValor(jornada_id);
    const responsableIdLimpio = extraerValor(responsable_id);
    const fechaFormateada = normalizarFecha(fecha);
    const montoNum = Number(monto);

    console.log(" Enviando:", {
      concepto,
      categoria: categoriaTexto,
      monto: montoNum,
      fechaRecibida: fecha,
      fechaEnviada: fechaFormateada,
      jornada_id: jornadaIdLimpio,
      responsable_id: responsableIdLimpio,
      registrado_por: usuarioId,
    });

    const { data, error } = await obtenerSupabase()
      .from("gastos")
      .insert({
        concepto: concepto?.trim() || "",
        categoria: categoriaTexto,
        monto: montoNum,
        fecha: fechaFormateada,
        jornada_id: jornadaIdLimpio || null,
        responsable_id: responsableIdLimpio || null,
        registrado_por: usuarioId,
        estado: estado || "pendiente",
      })
      .select("*")
      .single();

    if (error) {
      return { gasto: null, error: normalizarError(error) };
    }
    return { gasto: data, error: null };
  } catch (error) {
    return { gasto: null, error: normalizarError(error) };
  }
}

export async function editarGasto(idGasto, datosGasto) {
  if (!idGasto) return { gasto: null, error: null };
  try {
    const supabase = obtenerSupabase();
    const { data: gastoExistente, error: errorConsulta } = await supabase
      .from("gastos")
      .select("estado")
      .eq("id", idGasto)
      .maybeSingle();

    if (errorConsulta) return { gasto: null, error: normalizarError(errorConsulta) };
    if (gastoExistente && gastoExistente.estado === "aprobado") {
      return {
        gasto: null,
        error: normalizarError({
          message: "Un gasto aprobado no se puede editar",
          code: "GASTO_APROBADO_NO_EDITABLE",
        }),
      };
    }

    const { concepto, categoria, monto, fecha, responsable_id } = datosGasto || {};
    const updates = {};
    if (concepto !== undefined) updates.concepto = concepto.trim();
    if (categoria !== undefined) updates.categoria = String(extraerValor(categoria)).trim();
    if (monto !== undefined) updates.monto = Number(monto);
    if (fecha !== undefined) updates.fecha = normalizarFecha(fecha);
    if (responsable_id !== undefined) updates.responsable_id = extraerValor(responsable_id) || null;

    const { data, error } = await supabase
      .from("gastos")
      .update(updates)
      .eq("id", idGasto)
      .select(
        `
        *,
        jornadas ( id, proyecto_id, proyectos ( id, nombre ) )
        `,
      )
      .single();

    if (error) return { gasto: null, error: normalizarError(error) };
    return { gasto: data, error: null };
  } catch (error) {
    return { gasto: null, error: normalizarError(error) };
  }
}

export async function listarCategoriasGasto() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("gastos")
      .select("categoria")
      .not("categoria", "is", null)
      .order("categoria", { ascending: true });

    if (error) {
      return { categorias: [], error };
    }

    const unicas = [...new Set(data.map((fila) => fila.categoria))];
    const opciones = unicas.map((nombre) => ({ value: nombre, label: nombre }));
    return { categorias: opciones, error: null };
  } catch (error) {
    return { categorias: [], error };
  }
}

export function conProyectoId(gastos = []) {
  return gastos.map((gasto) => ({ ...gasto, proyecto_id: gasto.jornadas?.proyecto_id ?? null }));
}

const COLUMNAS_DE_GASTO = [
  "id",
  "jornada_id",
  "concepto",
  "categoria",
  "monto",
  "fecha",
  "responsable_id",
  "estado",
  "registrado_por",
  "aprobado_por",
  "aprobado_en",
  "motivo_rechazo",
  "created_at",
  "updated_at",
].join(", ");

export async function listarGastos(filtros = {}) {
  try {
    const { estado, categoria, jornada_id, proyecto_id, fecha_inicio, fecha_fin } = filtros;
    let query = obtenerSupabase().from("gastos").select(`
      ${COLUMNAS_DE_GASTO},
      jornadas!inner ( id, nombre, proyecto_id, proyectos ( id, nombre ) )
    `);

    if (estado) query = query.eq("estado", estado);
    if (categoria) query = query.eq("categoria", categoria);
    if (jornada_id) query = query.eq("jornada_id", jornada_id);
    if (proyecto_id) query = query.eq("jornadas.proyecto_id", proyecto_id);
    if (fecha_inicio) query = query.gte("fecha", normalizarFecha(fecha_inicio));
    if (fecha_fin) query = query.lte("fecha", normalizarFecha(fecha_fin));

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return { gastos: [], error: normalizarError(error) };
    return { gastos: conProyectoId(data || []), error: null };
  } catch (error) {
    return { gastos: [], error: normalizarError(error) };
  }
}
