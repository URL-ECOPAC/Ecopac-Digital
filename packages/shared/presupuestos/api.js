import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

const PRESUPUESTO_VACIO = {
  asignado: 0,
  gastado: 0,
  disponible: 0,
  pendiente: 0,
};

/**
 * Convierte a numero para LEER un valor que la base ya devolvio.
 *
 * Cae en 0 cuando no hay numero porque leyendo eso es lo correcto: una jornada sin gastos
 * aprobados tiene cero gastado, no un gastado desconocido.
 *
 * NO sirve para validar lo que se va a ESCRIBIR: ahi un valor ilegible tiene que fallar, no
 * convertirse en cero. Para eso esta aNumeroAEscribir().
 */
function aNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Convierte a numero para ESCRIBIR, o devuelve null si el valor no es un numero utilizable.
 *
 * Rechaza null, undefined, la cadena vacia, la cadena de espacios y cualquier cosa que no sea
 * un numero finito. `Number("")` y `Number(null)` son 0, y `Number("  ")` tambien, asi que
 * comprobar solo con Number.isFinite() no basta: hay que descartar antes el vacio.
 *
 * Existe por la issue #597. asignarPresupuestoJornada() validaba con aNumero(), que devuelve 0
 * para todo lo ilegible: un monto que llegara como "abc", undefined o un campo de formulario
 * vacio no fallaba la guarda de negativo, pasaba como 0 y se escribia como el presupuesto de la
 * jornada. La jornada quedaba en cero sin ninguna senal de que algo salio mal, y desde ahi
 * presupuesto_de_jornada() reportaba disponible cero y la pantalla parecia estar diciendo la
 * verdad.
 */
function aNumeroAEscribir(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" && valor.trim() === "") return null;

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function aPresupuesto(fila) {
  if (!fila) {
    return null;
  }

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

    if (error) {
      return { presupuesto: null, error: normalizarError(error) };
    }

    return { presupuesto: aPresupuesto(data) ?? presupuestoSinFilas, error: null };
  } catch (error) {
    return { presupuesto: null, error: normalizarError(error) };
  }
}

export async function asignarPresupuestoJornada(idJornada, monto) {
  if (!idJornada) {
    return { jornada: null, error: null };
  }

  // Un monto ilegible y uno negativo se rechazan igual y con el mismo codigo: los dos son
  // datos que la jornada no puede aceptar, y quien llama solo necesita saber que no se guardo.
  const cantidad = aNumeroAEscribir(monto);
  if (cantidad === null || cantidad < 0) {
    return { jornada: null, error: normalizarError({ code: "23514" }) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornadas")
      .update({ presupuesto_asignado: cantidad })
      .eq("id", idJornada)
      .select("id, presupuesto_asignado")
      .maybeSingle();

    if (error) {
      return { jornada: null, error: normalizarError(error) };
    }

    return { jornada: data ?? null, error: null };
  } catch (error) {
    return { jornada: null, error: normalizarError(error) };
  }
}

export async function obtenerPresupuestoJornada(idJornada) {
  if (!idJornada) {
    return { presupuesto: null, error: null };
  }

  return consultar("presupuesto_de_jornada", { p_jornada_id: idJornada }, null);
}

export async function obtenerPresupuestoProyecto(idProyecto) {
  if (!idProyecto) {
    return { presupuesto: null, error: null };
  }

  return consultar(
    "presupuesto_de_proyecto",
    { p_proyecto_id: idProyecto },
    {
      ...PRESUPUESTO_VACIO,
    },
  );
}

export async function obtenerPresupuestoSistema() {
  return consultar("presupuesto_del_sistema", {}, { ...PRESUPUESTO_VACIO });
}

// ============================================================================
// Funciones API para la gestión de Gastos
// ============================================================================

export async function registrarGasto(datosGasto) {
  try {
    const { concepto, categoria, monto, fecha, responsable_id, jornada_id } = datosGasto || {};

    const { data, error } = await obtenerSupabase()
      .from("gastos")
      .insert({
        concepto,
        categoria,
        monto: aNumero(monto),
        fecha,
        responsable_id: responsable_id || null,
        jornada_id,
      })
      .select(
        `
        *,
        jornadas (
          id,
          proyecto_id,
          proyectos (
            id,
            nombre
          )
        )
      `,
      )
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
  if (!idGasto) {
    return { gasto: null, error: null };
  }

  try {
    const supabase = obtenerSupabase();

    // Validar que el gasto no esté en estado 'aprobado'
    const { data: gastoExistente, error: errorConsulta } = await supabase
      .from("gastos")
      .select("estado")
      .eq("id", idGasto)
      .maybeSingle();

    if (errorConsulta) {
      return { gasto: null, error: normalizarError(errorConsulta) };
    }

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

    if (concepto !== undefined) updates.concepto = concepto;
    if (categoria !== undefined) updates.categoria = categoria;
    if (monto !== undefined) updates.monto = aNumero(monto);
    if (fecha !== undefined) updates.fecha = fecha;
    if (responsable_id !== undefined) updates.responsable_id = responsable_id || null;

    const { data, error } = await supabase
      .from("gastos")
      .update(updates)
      .eq("id", idGasto)
      .select(
        `
        *,
        jornadas (
          id,
          proyecto_id,
          proyectos (
            id,
            nombre
          )
        )
      `,
      )
      .single();

    if (error) {
      return { gasto: null, error: normalizarError(error) };
    }

    return { gasto: data, error: null };
  } catch (error) {
    return { gasto: null, error: normalizarError(error) };
  }
}

export async function listarGastos(filtros = {}) {
  try {
    const { estado, categoria, jornada_id, proyecto_id, fecha_inicio, fecha_fin } = filtros;

    let query = obtenerSupabase().from("gastos").select(`
        *,
        jornadas!inner (
          id,
          proyecto_id,
          proyectos (
            id,
            nombre
          )
        )
      `);

    if (estado) {
      query = query.eq("estado", estado);
    }

    if (categoria) {
      query = query.eq("categoria", categoria);
    }

    if (jornada_id) {
      query = query.eq("jornada_id", jornada_id);
    }

    if (proyecto_id) {
      query = query.eq("jornadas.proyecto_id", proyecto_id);
    }

    if (fecha_inicio) {
      query = query.gte("fecha", fecha_inicio);
    }

    if (fecha_fin) {
      query = query.lte("fecha", fecha_fin);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return { gastos: [], error: normalizarError(error) };
    }

    return { gastos: data || [], error: null };
  } catch (error) {
    return { gastos: [], error: normalizarError(error) };
  }
}
