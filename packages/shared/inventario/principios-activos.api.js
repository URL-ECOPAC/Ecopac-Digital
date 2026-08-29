// Consultas de Supabase del catalogo de principios activos.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, como indica el encabezado de api/index.js. Este archivo es el unico
// lugar del monorepo que lee y escribe la tabla principios_activos. Se llama
// principios-activos.api.js y no api.js porque inventario/ lo va a construir mas de una
// issue en paralelo (medicamentos, lotes, movimientos...); un api.js unico seria un iman de
// conflictos, mismo criterio que packages/shared/proyectos/api.js.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js:
// quien las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el
// render.
//
// Ninguna funcion valida aqui quien puede crear, editar o eliminar: esa regla la aplican las
// politicas de 00034_politicas_rls_inventario.sql y 00046_catalogo_principios_activos.sql
// (solo administrador), y un intento sin permiso vuelve como error 42501, que
// normalizarError() ya traduce. Duplicar el chequeo de rol aqui violaria el mismo criterio
// que documenta packages/shared/jornadas/permisos.js: el cliente pregunta para dibujar, el
// servidor decide.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva no empiece a
// viajar sola hasta el cliente. nombre_normalizado no se expone: es un detalle de como la
// base de datos garantiza unicidad y busqueda sin acentos (00046), no un dato que la
// pantalla necesite mostrar o editar.
const COLUMNAS_DEL_PRINCIPIO_ACTIVO = ["id", "nombre", "createdAt:created_at"].join(", ");

/**
 * Traduce del camelCase de las pantallas al snake_case de la tabla, omitiendo lo no enviado.
 * Un update parcial no debe borrar lo que no toca.
 */
function aColumnasDeTabla(datos = {}) {
  const fila = {};
  if (Object.prototype.hasOwnProperty.call(datos, "nombre")) fila.nombre = datos.nombre;
  return fila;
}

/**
 * Quita los acentos de un texto para compararlo contra nombre_normalizado.
 *
 * nombre_normalizado (00046) se calcula con lower(public.f_unaccent(nombre)); ILIKE ya
 * ignora mayusculas por su cuenta, pero no quita acentos, asi que el termino de busqueda
 * tiene que pasar por el mismo tratamiento antes de compararlo o "medico" nunca
 * encontraria "médico". La descomposicion NFD separa cada letra acentuada en la letra base
 * mas su marca diacritica, que es lo mismo que hace el diccionario unaccent de Postgres.
 */
function quitarAcentos(texto) {
  return texto.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

/** Escapa los comodines de ILIKE (%, _) para que una busqueda literal no se interprete como patron. */
function escaparPatron(texto) {
  return texto.replace(/[%_]/g, " ").trim();
}

/**
 * Lista los principios activos del catalogo, opcionalmente filtrados por nombre.
 *
 * La busqueda es un filtro mas de listar, no una funcion aparte: mismo criterio que
 * packages/shared/usuarios/api.js con su filtro `busqueda`. Compara contra
 * nombre_normalizado para que "medico" encuentre "Médico" sin importar como haya escrito
 * los acentos quien busca.
 *
 * @param {{ busqueda?: string }} [filtros]
 * @returns {Promise<{ principiosActivos: object[], error: object|null }>}
 */
export async function listarPrincipiosActivos({ busqueda } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("principios_activos")
      .select(COLUMNAS_DEL_PRINCIPIO_ACTIVO)
      .order("nombre", { ascending: true });

    const texto = typeof busqueda === "string" ? escaparPatron(quitarAcentos(busqueda)) : "";
    if (texto !== "") {
      consulta = consulta.ilike("nombre_normalizado", `%${texto}%`);
    }

    const { data, error } = await consulta;

    if (error) return { principiosActivos: [], error: normalizarError(error) };
    // Siempre un arreglo: una lista vacia se dibuja sola, un null obliga a comprobarlo cada vez.
    return { principiosActivos: data ?? [], error: null };
  } catch (error) {
    // Un fallo de red no llega por el campo error sino como excepcion del fetch.
    return { principiosActivos: [], error: normalizarError(error) };
  }
}

/**
 * Registra un principio activo en el catalogo.
 *
 * El nombre obligatorio lo exige la base de datos con NOT NULL; que no se repita (ni
 * siquiera con acentos u mayusculas distintas) lo exige el UNIQUE sobre
 * nombre_normalizado (00046). La validacion amable de formulario (nombre vacio, largo
 * maximo) queda para el hook que construya la pantalla, con CAMPOS_PRINCIPIO_ACTIVO de
 * campos.js, igual que el resto de modulos del repo.
 *
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_PRINCIPIO_ACTIVO.
 * @returns {Promise<{ principioActivo: object|null, error: object|null }>}
 */
export async function registrarPrincipioActivo(datos) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("principios_activos")
      .insert(aColumnasDeTabla(datos))
      .select(COLUMNAS_DEL_PRINCIPIO_ACTIVO)
      .single();

    if (error) return { principioActivo: null, error: normalizarError(error) };
    return { principioActivo: data ?? null, error: null };
  } catch (error) {
    return { principioActivo: null, error: normalizarError(error) };
  }
}

/**
 * Actualiza el nombre de un principio activo del catalogo.
 *
 * @param {string} id UUID del principio activo.
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_PRINCIPIO_ACTIVO.
 * @returns {Promise<{ principioActivo: object|null, error: object|null }>}
 */
export async function actualizarPrincipioActivo(id, datos) {
  const fila = aColumnasDeTabla(datos);
  if (Object.keys(fila).length === 0) return { principioActivo: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("principios_activos")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_PRINCIPIO_ACTIVO)
      .maybeSingle();

    if (error) return { principioActivo: null, error: normalizarError(error) };
    return { principioActivo: data ?? null, error: null };
  } catch (error) {
    return { principioActivo: null, error: normalizarError(error) };
  }
}

/**
 * Elimina un principio activo del catalogo.
 *
 * No hace ninguna comprobacion propia de "esta en uso": el RESTRICT de
 * medicamento_principio.principio_id (migracion 00016) ya lo impide del lado de la base de
 * datos. Un intento sobre un principio activo asociado a un medicamento vuelve como error
 * 23503, que normalizarError() clasifica como LLAVE_FORANEA con un mensaje que ya explica
 * que el registro esta relacionado con otros datos.
 *
 * @param {string} id UUID del principio activo.
 * @returns {Promise<{ principioActivo: object|null, error: object|null }>} `principioActivo`
 *   es la fila eliminada, util para un mensaje de confirmacion o un deshacer.
 */
export async function eliminarPrincipioActivo(id) {
  if (!id) return { principioActivo: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("principios_activos")
      .delete()
      .eq("id", id)
      .select(COLUMNAS_DEL_PRINCIPIO_ACTIVO)
      .maybeSingle();

    if (error) return { principioActivo: null, error: normalizarError(error) };
    return { principioActivo: data ?? null, error: null };
  } catch (error) {
    return { principioActivo: null, error: normalizarError(error) };
  }
}
