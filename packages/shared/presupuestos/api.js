import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

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
    const { data, error } = await obtenerSupabase()
      .rpc(nombreDeFuncion, argumentos)
      .maybeSingle();

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

  const cantidad = aNumero(monto);
  if (cantidad < 0) {
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

  return consultar("presupuesto_de_proyecto", { p_proyecto_id: idProyecto }, {
    ...PRESUPUESTO_VACIO,
  });
}

export async function obtenerPresupuestoSistema() {
  return consultar("presupuesto_del_sistema", {}, { ...PRESUPUESTO_VACIO });
}
