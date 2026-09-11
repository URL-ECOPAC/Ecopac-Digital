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

/**
 * Fija el presupuesto asignado a una jornada.
 *
 * Escribe `jornadas.presupuesto_asignado`: no hay tabla de presupuestos, el asignado es una
 * columna de la jornada y lo ejecutado se calcula sumando `gastos`.
 *
 * @param {string} idJornada UUID de la jornada.
 * @param {number|string} monto Cantidad a asignar. Un valor ilegible y uno negativo se rechazan
 *   igual, con el codigo de violacion de CHECK.
 * @returns {Promise<{ jornada: object|null, error: object|null }>}
 */
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

/**
 * Asignado, gastado, disponible y pendiente de una jornada.
 *
 * Devuelve `presupuesto: null` -y no ceros- cuando la jornada no tiene presupuesto asignado, a
 * diferencia de las consultas de proyecto y de sistema. La distincion es deliberada: "esta
 * jornada no lleva presupuesto" no es lo mismo que "lleva presupuesto y va en cero", y la
 * pantalla tiene que poder decir cosas distintas.
 *
 * @param {string} idJornada UUID de la jornada.
 * @returns {Promise<{ presupuesto: { asignado: number, gastado: number, disponible: number, pendiente: number }|null, error: object|null }>}
 */
export async function obtenerPresupuestoJornada(idJornada) {
  if (!idJornada) {
    return { presupuesto: null, error: null };
  }

  return consultar("presupuesto_de_jornada", { p_jornada_id: idJornada }, null);
}

/**
 * Presupuesto de un proyecto, sumando el de todas sus jornadas.
 *
 * Un proyecto sin jornadas devuelve ceros, no `null`: el proyecto existe y su ejecucion es cero,
 * que es un dato, no una ausencia. Es la diferencia con `obtenerPresupuestoJornada()`.
 *
 * @param {string} idProyecto UUID del proyecto.
 * @returns {Promise<{ presupuesto: { asignado: number, gastado: number, disponible: number, pendiente: number }|null, error: object|null }>}
 */
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

/**
 * Presupuesto agregado de toda la organizacion.
 *
 * Es el numero del panel de direccion. Sale de una funcion agregada en la base, no de leer
 * `gastos` fila por fila: asi la junta directiva ve totales sin tener acceso de lectura al
 * detalle (misma postura que los reportes agregados de `00054`).
 *
 * @returns {Promise<{ presupuesto: { asignado: number, gastado: number, disponible: number, pendiente: number }|null, error: object|null }>}
 */
export async function obtenerPresupuestoSistema() {
  return consultar("presupuesto_del_sistema", {}, { ...PRESUPUESTO_VACIO });
}

// ============================================================================
// Funciones API para la gestión de Gastos
// ============================================================================

/**
 * Registra un gasto.
 *
 * `usuarioId` es obligatorio: `gastos.registrado_por` es NOT NULL sin DEFAULT (00025) y la
 * politica de INSERT (00089) exige ademas, para quien no es administrador ni tiene
 * `presupuestos.registrar`, que sea exactamente `auth.uid()` -- mismo contrato que
 * `registrarIngreso()` en `inventario/movimientos.api.js`. Bug encontrado al verificar la #300
 * contra datos reales: esta funcion nunca lo enviaba y el INSERT reventaba con 23502 para
 * cualquier rol; las pruebas no lo detectaban porque no llegaban a un cliente real (issue #298).
 *
 * @param {object} datosGasto
 * @param {{ usuarioId: string }} contexto
 * @returns {Promise<{ gasto: object|null, error: object|null }>}
 */
export async function registrarGasto(datosGasto, { usuarioId } = {}) {
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
        registrado_por: usuarioId,
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

/**
 * Corrige un gasto que todavia no se aprobo.
 *
 * Lee el estado antes de escribir y rechaza el cambio si ya esta `aprobado`: un gasto aprobado es
 * parte de la ejecucion presupuestaria y editarlo movaria un total que alguien ya reviso. La
 * comprobacion se hace aqui por comodidad y para dar un mensaje claro; quien lo impide de verdad
 * son las politicas de UPDATE de `gastos` (`00052`).
 *
 * @param {string} idGasto UUID del gasto.
 * @param {object} datosGasto Campos a cambiar.
 * @returns {Promise<{ gasto: object|null, error: object|null }>} El gasto devuelto trae anidados
 *   su jornada y el proyecto de esa jornada.
 */
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

/**
 * Aplana `proyecto_id` (que vive en `jornadas`, no en `gastos`) a la fila del gasto, para que
 * `columna.id: 'proyecto_id'` de COLUMNAS_GASTO (columnas.js) tenga de donde leer sin que
 * DataList tenga que recorrer una ruta anidada (`gasto.jornadas.proyecto_id`), cosa que no sabe
 * hacer: lee `fila[columna.desde ?? columna.id]` como propiedad plana.
 *
 * @param {object[]} gastos Filas de `gastos` con el join a `jornadas` embebido.
 * @returns {object[]}
 */
export function conProyectoId(gastos = []) {
  return gastos.map((gasto) => ({ ...gasto, proyecto_id: gasto.jornadas?.proyecto_id ?? null }));
}

// Columnas explicitas de gastos (00025_presupuesto_gastos.sql), en vez de "*": una columna nueva
// en la tabla no debe empezar a viajar sola hasta el cliente sin que alguien lo decida aca.
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

/**
 * Gastos filtrados, del mas reciente al mas antiguo.
 *
 * El join con `jornadas` es `!inner`: un gasto sin jornada no sale. Hoy no los hay -la columna es
 * obligatoria- pero conviene saberlo antes de cambiarla.
 *
 * Los filtros se acumulan; los que no vengan no restringen nada. `fecha_inicio` y `fecha_fin` son
 * inclusivos.
 *
 * @param {{ estado?: string, categoria?: string, jornada_id?: string, proyecto_id?: string, fecha_inicio?: string, fecha_fin?: string }} [filtros]
 * @returns {Promise<{ gastos: object[], error: object|null }>} Cada gasto trae `proyecto_id`
 *   aplanado desde su jornada, para no obligar a quien lo pinta a bajar por la relacion.
 */
export async function listarGastos(filtros = {}) {
  try {
    const { estado, categoria, jornada_id, proyecto_id, fecha_inicio, fecha_fin } = filtros;

    let query = obtenerSupabase().from("gastos").select(`
        ${COLUMNAS_DE_GASTO},
        jornadas!inner (
          id,
          nombre,
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

    return { gastos: conProyectoId(data || []), error: null };
  } catch (error) {
    return { gastos: [], error: normalizarError(error) };
  }
}
