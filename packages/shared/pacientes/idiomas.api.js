// Catalogo de idiomas del paciente (issue #663).
//
// Hasta la migracion 00110 los idiomas eran un enum de Postgres, y la lista vivia duplicada en
// enums.js. Agregar uno exigia desplegar una migracion, asi que casi todo lo que no era espanol
// acababa en "otros" -- justo la informacion que hace falta para asignar interprete en una
// jornada. Ahora son una tabla y esta funcion la lee.
//
// Mismo patron que obtenerCatalogoDeCondiciones() en condiciones.api.js: una sola consulta
// ordenada, sin filtros, porque un catalogo de cuatro o veinte filas no se pagina.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

// El codigo es lo que se guarda en pacientes.idioma; el nombre es lo que se muestra.
const COLUMNAS_DEL_IDIOMA = ["codigo", "nombre"].join(", ");

/**
 * Lee el catalogo de idiomas.
 *
 * Devuelve las opciones ya con la forma que espera un SELECT de los descriptores -- `value` y
 * `label` -- y no las filas crudas: el unico consumidor es un desplegable, y devolverlas crudas
 * obligaria a cada pantalla a traducirlas, que es lo que la regla de la arquitectura prohibe.
 *
 * `value` es el codigo y no el id: `pacientes.idioma` referencia `idiomas.codigo` (00110), asi
 * que el codigo es lo que hay que enviar al registrar.
 *
 * @returns {Promise<{ idiomas: {value: string, label: string}[], error: object|null }>}
 */
export async function listarIdiomas() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("idiomas")
      .select(COLUMNAS_DEL_IDIOMA)
      .order("nombre", { ascending: true });

    if (error) return { idiomas: [], error: normalizarError(error) };

    return {
      idiomas: (data ?? []).map((fila) => ({ value: fila.codigo, label: fila.nombre })),
      error: null,
    };
  } catch (error) {
    return { idiomas: [], error: normalizarError(error) };
  }
}
