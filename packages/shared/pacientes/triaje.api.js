// Consultas de Supabase del triaje (signos vitales).
//
// Este archivo es el unico lugar del monorepo que lee y escribe la tabla triajes. Se queda en el
// modulo de pacientes -- la issue #117 es module:pacientes y CAMPOS_TRIAJE ya vive en campos.js --
// con el mismo patron de nombres que donaciones/ usa para proyectos.api.js y avance.api.js.
//
// EL IMC NO SE ENVIA NUNCA, Y ESO NO ES UN OLVIDO
//
// La 00013 lo declara como columna generada:
//
//   imc NUMERIC(4, 1) GENERATED ALWAYS AS (ROUND(peso / POWER(talla / 100.0, 2), 1)) STORED
//
// Postgres rechaza cualquier INSERT o UPDATE que intente escribirla, asi que MAPA_COLUMNAS no la
// incluye. Es el criterio de aceptacion 4 -- "el IMC se lee de la base y no se recalcula en el
// cliente" -- resuelto por el esquema: aqui solo hay que pedirla de vuelta en el select.
//
// Ese POWER(talla / 100.0, 2) fija ademas la unidad del criterio 5: talla va en CENTIMETROS. Si
// una pantalla enviara metros, el IMC saldria absurdo sin que nada fallara.
//
// REGISTRAR Y CORREGIR SON DOS FUNCIONES, NO UNA
//
// Las politicas de la 00033 dejan INSERT a administrador, medico y voluntario general, pero
// UPDATE solo a administrador y medico. O sea que quien toma el triaje en campo puede no poder
// corregirlo. Una sola funcion que hiciera upsert lo escondería: el voluntario recibiria un 42501
// confuso al reintentar, en vez de una pantalla que no le ofrece corregir.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
export { puedeCorregirTriaje, puedeTomarTriaje } from "./permisos.js";
import { validarCambioDeTriaje, validarTriaje } from "./triaje.validaciones.js";

/**
 * Del camelCase de CAMPOS_TRIAJE al snake_case de la tabla.
 *
 * `imc` no esta y no puede estar: es columna generada. Tampoco `atencion_id` ni `tomado_por`,
 * que no vienen del formulario sino del contexto de quien registra.
 */
const MAPA_COLUMNAS_DEL_TRIAJE = {
  presionSistolica: "presion_sistolica",
  presionDiastolica: "presion_diastolica",
  frecuenciaCardiaca: "frecuencia_cardiaca",
  glucosa: "glucosa",
  peso: "peso",
  talla: "talla",
  temperatura: "temperatura",
};

// Se enumeran las columnas en vez de pedir "*" para que una columna nueva en triajes no empiece a
// viajar sola hasta el cliente. `imc` si se pide: es lo que la base calculo.
const COLUMNAS_DEL_TRIAJE = [
  "id",
  "atencionId:atencion_id",
  "presionSistolica:presion_sistolica",
  "presionDiastolica:presion_diastolica",
  "frecuenciaCardiaca:frecuencia_cardiaca",
  "glucosa",
  "peso",
  "talla",
  "temperatura",
  "imc",
  "tomadoPor:tomado_por",
  "tomadoEn:tomado_en",
].join(", ");

/**
 * Traduce al snake_case de la tabla, omitiendo lo que no venga.
 *
 * Un valor opcional que llega vacio se envia como NULL y no como cadena vacia: la columna es
 * NUMERIC y PostgREST rechazaria "". Es lo que hace posible el triaje parcial.
 */
function aColumnasDeTabla(valores = {}) {
  const fila = {};
  for (const [campo, columna] of Object.entries(MAPA_COLUMNAS_DEL_TRIAJE)) {
    if (!Object.prototype.hasOwnProperty.call(valores, campo)) continue;

    const valor = valores[campo];
    fila[columna] = valor === "" || valor === undefined ? null : valor;
  }
  return fila;
}

/**
 * Registra los signos vitales de una atencion.
 *
 * `atencion_id` es UNIQUE en la 00013: una atencion tiene un solo triaje. Un segundo intento
 * vuelve como 23505, y aqui se traduce a un mensaje que dice que hacer -- corregirlo -- en vez de
 * mostrar el error crudo de la base.
 *
 * @param {string} atencionId UUID de la atencion.
 * @param {object} valores Valores indexados por el id de CAMPOS_TRIAJE.
 * @param {object} opciones
 * @param {string} opciones.tomadoPor UUID del perfil que tomo los signos.
 * @returns {Promise<{ triaje: object|null, errores: Record<string,string>, error: object|null }>}
 */
export async function registrarTriaje(atencionId, valores = {}, { tomadoPor } = {}) {
  if (!atencionId || !tomadoPor) {
    return {
      triaje: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "Hace falta la atencion y quien toma los signos para registrar el triaje.",
      },
    };
  }

  const errores = validarTriaje(valores);
  if (Object.keys(errores).length > 0) return { triaje: null, errores, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("triajes")
      .insert({
        ...aColumnasDeTabla(valores),
        atencion_id: atencionId,
        tomado_por: tomadoPor,
      })
      .select(COLUMNAS_DEL_TRIAJE)
      .maybeSingle();

    if (error) {
      const normalizado = normalizarError(error);
      if (normalizado.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD) {
        return {
          triaje: null,
          errores: {},
          error: {
            ...normalizado,
            mensaje:
              "Esta atencion ya tiene triaje registrado. Si hay que cambiar un valor, corregilo.",
          },
        };
      }
      return { triaje: null, errores: {}, error: normalizado };
    }

    return { triaje: data ?? null, errores: {}, error: null };
  } catch (error) {
    return { triaje: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Corrige un triaje ya registrado.
 *
 * Separada de registrarTriaje() porque la politica de UPDATE de la 00033 es mas estrecha que la
 * de INSERT: solo administrador y medico. Un voluntario general puede tomar el triaje pero no
 * corregirlo, y eso lo tiene que saber la pantalla antes de ofrecer el boton
 * (ver puedeCorregirTriaje).
 *
 * Solo se envia lo que venga en `valores`: una correccion de la glucosa no borra el peso.
 *
 * @param {string} triajeId UUID del triaje.
 * @param {object} valores Valores a cambiar, indexados por el id de CAMPOS_TRIAJE.
 * @returns {Promise<{ triaje: object|null, errores: Record<string,string>, error: object|null }>}
 */
export async function actualizarTriaje(triajeId, valores = {}) {
  if (!triajeId) return { triaje: null, errores: {}, error: null };

  const fila = aColumnasDeTabla(valores);
  if (Object.keys(fila).length === 0) return { triaje: null, errores: {}, error: null };

  // Solo se valida lo que se esta cambiando: si se corrige la glucosa, no hay que exigir una
  // presion que ya esta en la fila y que esta llamada no toca.
  const errores = validarCambioDeTriaje(valores);
  if (Object.keys(errores).length > 0) return { triaje: null, errores, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("triajes")
      .update(fila)
      .eq("id", triajeId)
      .select(COLUMNAS_DEL_TRIAJE)
      .maybeSingle();

    if (error) return { triaje: null, errores: {}, error: normalizarError(error) };

    // Sin fila de vuelta, la correccion NO ocurrio, y hay que decirlo.
    //
    // Comprobado contra PostgREST: cuando la politica de UPDATE filtra la fila -- un voluntario
    // general intentando corregir -- la respuesta es 204 con CERO filas afectadas, no un 42501.
    // Es decir que RLS bloquea en silencio. Devolver { triaje: null, error: null } dejaria a la
    // pantalla creyendo que guardo.
    //
    // Es lo contrario de lo que hace cerrarAtencion() en atenciones/api.js, donde "ninguna fila"
    // si es un desenlace aceptable: alla la atencion ya no estaba en la cola, que era lo que
    // queria quien llamo. Aqui el valor sigue como estaba.
    if (!data) {
      return {
        triaje: null,
        errores: {},
        error: {
          ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
          mensaje:
            "No se pudo corregir el triaje: puede que ya no exista o que tu rol no pueda editarlo.",
        },
      };
    }

    return { triaje: data, errores: {}, error: null };
  } catch (error) {
    return { triaje: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Historico de triajes de un paciente, del mas antiguo al mas reciente.
 *
 * EN UNA SOLA CONSULTA, y eso es un requisito, no una optimizacion: la issue #129 -- la grafica
 * de evolucion en web -- pide que "los datos salgan de la API de triaje, sin consultas
 * adicionales por punto". La atencion y su jornada se piden embebidas, que es como
 * jornadas/api.js ya trae comunidad y responsable.
 *
 * El historico cruza varias atenciones, no varios triajes de una: atencion_id es UNIQUE, asi que
 * la evolucion de un paciente es un triaje por jornada.
 *
 * Se ordena ascendente porque una grafica se lee de izquierda a derecha en el tiempo.
 *
 * @param {string} pacienteId UUID del paciente.
 * @returns {Promise<{ triajes: object[], error: object|null }>}
 */
export async function obtenerTriajes(pacienteId) {
  if (!pacienteId) return { triajes: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("triajes")
      .select(
        `${COLUMNAS_DEL_TRIAJE}, atencion:atenciones!inner(pacienteId:paciente_id, jornadaId:jornada_id, jornada:jornadas(nombre, fecha))`,
      )
      .eq("atenciones.paciente_id", pacienteId)
      .order("tomado_en", { ascending: true });

    if (error) return { triajes: [], error: normalizarError(error) };
    return { triajes: data ?? [], error: null };
  } catch (error) {
    return { triajes: [], error: normalizarError(error) };
  }
}
