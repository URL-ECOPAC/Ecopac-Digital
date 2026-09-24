// Consultas de Supabase del catalogo de presentaciones (00144_presentaciones_catalogo.sql,
// PLAN.md punto 11).
//
// Este archivo es el unico lugar del monorepo que lee y escribe la tabla presentaciones. Mismo
// patron que principios-activos.api.js, salvo dos diferencias reales:
//
// - presentaciones no tiene nombre_normalizado (principios_activos si, desde la 00046): la
//   busqueda aqui es un ILIKE directo sobre nombre, sin normalizar acentos. El catalogo es
//   chico (siete filas sembradas) y no se penso una columna generada solo para esto; si crece
//   lo suficiente para que haga falta, se agrega entonces, igual que se agrego alla.
// - "esta en uso" se resuelve con una consulta directa a medicamentos.presentacion_id: es una FK
//   uno-a-muchos (un medicamento tiene una presentacion), no la relacion muchos-a-muchos que
//   principios activos tiene con medicamento_principio.
//
// Todas las funciones devuelven { dato, error } en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.
//
// Ninguna funcion valida aqui quien puede crear, editar o eliminar: esa regla la aplican las
// politicas de 00144 (solo administrador), y un intento sin permiso vuelve como error 42501, que
// normalizarError() ya traduce. El cliente pregunta para dibujar, el servidor decide.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

const COLUMNAS_DE_LA_PRESENTACION = ["id", "nombre", "createdAt:created_at"].join(", ");

/**
 * Traduce del camelCase de las pantallas al snake_case de la tabla, omitiendo lo no enviado.
 * Un update parcial no debe borrar lo que no toca.
 */
function aColumnasDeTabla(datos = {}) {
  const fila = {};
  if (Object.prototype.hasOwnProperty.call(datos, "nombre")) fila.nombre = datos.nombre;
  return fila;
}

/** Escapa los comodines de ILIKE (%, _) para que una busqueda literal no se interprete como patron. */
function escaparPatron(texto) {
  return texto.replace(/[%_]/g, " ").trim();
}

/**
 * Lista las presentaciones del catalogo, opcionalmente filtradas por nombre.
 *
 * @param {{ busqueda?: string }} [filtros]
 * @returns {Promise<{ presentaciones: object[], error: object|null }>}
 */
export async function listarPresentaciones({ busqueda } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("presentaciones")
      .select(COLUMNAS_DE_LA_PRESENTACION)
      .order("nombre", { ascending: true });

    const texto = typeof busqueda === "string" ? escaparPatron(busqueda) : "";
    if (texto !== "") {
      consulta = consulta.ilike("nombre", `%${texto}%`);
    }

    const { data, error } = await consulta;

    if (error) return { presentaciones: [], error: normalizarError(error) };
    return { presentaciones: data ?? [], error: null };
  } catch (error) {
    return { presentaciones: [], error: normalizarError(error) };
  }
}

/**
 * Registra una presentacion en el catalogo.
 *
 * El nombre obligatorio y unico lo exige la base de datos (NOT NULL + UNIQUE, 00144). La
 * validacion amable de formulario (nombre vacio, largo maximo) queda para el hook que construya
 * la pantalla, con CAMPOS_PRESENTACION de campos.js, igual que el resto de modulos del repo.
 *
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_PRESENTACION.
 * @returns {Promise<{ presentacion: object|null, error: object|null }>}
 */
export async function registrarPresentacion(datos) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("presentaciones")
      .insert(aColumnasDeTabla(datos))
      .select(COLUMNAS_DE_LA_PRESENTACION)
      .single();

    if (error) return { presentacion: null, error: normalizarError(error) };
    return { presentacion: data ?? null, error: null };
  } catch (error) {
    return { presentacion: null, error: normalizarError(error) };
  }
}

/**
 * Actualiza el nombre de una presentacion del catalogo.
 *
 * @param {string} id UUID de la presentacion.
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_PRESENTACION.
 * @returns {Promise<{ presentacion: object|null, error: object|null }>}
 */
export async function actualizarPresentacion(id, datos) {
  const fila = aColumnasDeTabla(datos);
  if (Object.keys(fila).length === 0) return { presentacion: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("presentaciones")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DE_LA_PRESENTACION)
      .maybeSingle();

    if (error) return { presentacion: null, error: normalizarError(error) };
    return { presentacion: data ?? null, error: null };
  } catch (error) {
    return { presentacion: null, error: normalizarError(error) };
  }
}

/**
 * Medicamentos que usan una presentacion (medicamentos.presentacion_id, 00144).
 *
 * Se consulta antes de intentar eliminarPresentacion() para poder avisar CUALES medicamentos la
 * usan, en vez de dejar que el intento falle con el 23503 generico del RESTRICT -- mismo
 * criterio de aceptacion que listarMedicamentosDePrincipio() (principios-activos.api.js, issue
 * #640): "no se borra sin avisar que medicamentos lo usan".
 *
 * @param {string} presentacionId UUID de la presentacion.
 * @returns {Promise<{ medicamentos: object[], error: object|null }>}
 */
export async function listarMedicamentosDePresentacion(presentacionId) {
  if (!presentacionId) return { medicamentos: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("medicamentos")
      .select("id, nombre")
      .eq("presentacion_id", presentacionId);

    if (error) return { medicamentos: [], error: normalizarError(error) };
    return { medicamentos: data ?? [], error: null };
  } catch (error) {
    return { medicamentos: [], error: normalizarError(error) };
  }
}

/**
 * Elimina una presentacion del catalogo.
 *
 * No hace ninguna comprobacion propia de "esta en uso": el RESTRICT de
 * medicamentos.presentacion_id (migracion 00144) ya lo impide del lado de la base de datos. Un
 * intento sobre una presentacion asociada a un medicamento vuelve como error 23503, que
 * normalizarError() clasifica como LLAVE_FORANEA con un mensaje que ya explica que el registro
 * esta relacionado con otros datos.
 *
 * @param {string} id UUID de la presentacion.
 * @returns {Promise<{ presentacion: object|null, error: object|null }>} `presentacion` es la
 *   fila eliminada, util para un mensaje de confirmacion o un deshacer.
 */
export async function eliminarPresentacion(id) {
  if (!id) return { presentacion: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("presentaciones")
      .delete()
      .eq("id", id)
      .select(COLUMNAS_DE_LA_PRESENTACION)
      .maybeSingle();

    if (error) return { presentacion: null, error: normalizarError(error) };
    return { presentacion: data ?? null, error: null };
  } catch (error) {
    return { presentacion: null, error: normalizarError(error) };
  }
}
