// Helper para traer TODAS las filas de una consulta que agrega o cuenta en el cliente
// (issue #773).
//
// supabase/config.toml fija `max_rows = 1000`: PostgREST corta ahi cualquier `.select()` sin
// `.range()`, sin lanzar ningun error. Una funcion que liste para pintar una tabla paginada por
// la UI puede vivir con eso (la pantalla ya pagina por su cuenta). El problema real es la funcion
// que SUMA o CUENTA en JavaScript despues de un `.select()` sin rango: pasadas las 1000 filas, el
// total empieza a mentir en silencio. `obtenerTodasLasFilas()` es para esas -- no para listar,
// sino para agregar sobre el universo completo cuando agregar en la base (como ya hace
// `presupuesto_de_proyecto()`, 00040) no es una opcion sencilla.
//
// No es la solucion preferida: paginar en el cliente para sumar sigue trayendo todas las filas a
// la red, solo que en varios viajes en vez de que PostgREST las corte en silencio. Donde el
// agregado se pueda mover a una funcion SQL (SUM/COUNT en la base), esa sigue siendo la mejor
// opcion. Este helper es para los casos donde eso no es sencillo (agregados con reglas de
// negocio en JS, como calcularTotalesPorTipo() en donaciones/historial.api.js) y para los que
// nadie ha migrado todavia.

/** Tamano de pagina por defecto, igual al `max_rows` real de supabase/config.toml. */
const TAMANO_DE_PAGINA_POR_DEFECTO = 1000;

/**
 * Trae todas las filas de una consulta, paginando con `.range()` hasta que una pagina vuelva
 * incompleta.
 *
 * `fabricaDeConsulta` es una FUNCION que construye la consulta desde cero (`() =>
 * supabase.from(...).select(...).eq(...)`), no la consulta ya armada: un query builder de
 * supabase-js no se puede reutilizar despues de `await`, asi que cada pagina necesita su propia
 * instancia con el mismo `.select()`/filtros y solo el `.range()` distinto.
 *
 * @param {() => import("@supabase/supabase-js").PostgrestFilterBuilder} fabricaDeConsulta
 * @param {{ tamanoDePagina?: number }} [opciones]
 * @returns {Promise<{ filas: object[]|null, error: object|null }>}
 */
export async function obtenerTodasLasFilas(
  fabricaDeConsulta,
  { tamanoDePagina = TAMANO_DE_PAGINA_POR_DEFECTO } = {},
) {
  const filas = [];
  let desde = 0;

  for (;;) {
    const { data, error } = await fabricaDeConsulta().range(desde, desde + tamanoDePagina - 1);

    if (error) {
      return { filas: null, error };
    }

    const pagina = data ?? [];
    filas.push(...pagina);

    if (pagina.length < tamanoDePagina) {
      return { filas, error: null };
    }

    desde += tamanoDePagina;
  }
}
