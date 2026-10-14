// Consultas de Supabase de la bitacora de auditoria (issue #643), sobre eventos_auditoria
// (00026_auditoria_borrado_logico.sql). Solo lectura: la tabla la escriben triggers SECURITY
// DEFINER, nunca un cliente.
//
// No hace falta ninguna migracion nueva para esta pantalla: el GRANT SELECT ON eventos_auditoria
// TO anon, authenticated ya existe (00032, reforzado en 00038) y la politica RLS "Solo
// administrador lee eventos_auditoria" ya restringe la lectura real -esta capa solo arma la
// consulta, la autorizacion la decide el servidor.

import { aCadenaFechaLocal, aFechaLocal } from "../formato/fechas.js";
import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { listarUsuarios } from "../usuarios/api.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";

const COLUMNAS_DEL_EVENTO =
  "id, tablaAfectada:tabla_afectada, filaId:fila_id, operacion, realizadoPor:realizado_por, " +
  "realizadoEn:realizado_en, valoresAnteriores:valores_anteriores, valoresNuevos:valores_nuevos";

/**
 * El dia calendario siguiente a `fecha` ("AAAA-MM-DD"), tambien como "AAAA-MM-DD".
 *
 * `realizado_en` es TIMESTAMPTZ, no DATE (a diferencia de donaciones.fecha, donde un `.lte()`
 * simple ya cubre el dia completo): un `.lte("realizado_en", "2026-09-19")` se interpretaria
 * como la medianoche de ese dia y excluiria el resto de la jornada. Por eso el filtro "hasta" se
 * aplica como `.lt("realizado_en", diaSiguiente(hasta))`, un limite superior exclusivo.
 *
 * Usa aFechaLocal()/aCadenaFechaLocal() y no `new Date(cadena)`/`toISOString()` a proposito
 * (issue #849): esas dos aplican conversion de zona horaria y ya causaron un dia de corrimiento
 * en otros modulos.
 *
 * @param {string|null} fecha
 * @returns {string|null}
 */
export function diaSiguiente(fecha) {
  const local = aFechaLocal(fecha);
  if (!local) return null;

  local.setDate(local.getDate() + 1);
  return aCadenaFechaLocal(local);
}

/**
 * Lista paginada de eventos_auditoria, mas reciente primero. `realizado_por` viaja crudo (UUID
 * o null): resolverlo a un nombre es trabajo del hook, con el catalogo de listarPerfilesParaFiltro()
 * (ver esa funcion mas abajo).
 *
 * Calca la paginacion real de listarUsuarios() (usuarios/api.js): `limite`/`pagina` opcionales,
 * `count: "exact"` solo cuando se pagina, `.range()` para no traer la tabla completa (criterio
 * de aceptacion de la issue #643: "la tabla crece sin limite y no se puede traer entera").
 *
 * @param {{ usuarioId?: string, tablaAfectada?: string, desde?: string, hasta?: string, limite?: number, pagina?: number }} [opciones]
 * @returns {Promise<{ eventos: object[], total: number, error: object|null }>}
 */
export async function listarEventosAuditoria({
  usuarioId,
  tablaAfectada,
  desde,
  hasta,
  limite,
  pagina = 1,
} = {}) {
  try {
    const pagina_ = Math.max(1, Number(pagina) || 1);
    const porPagina = limite === undefined || limite === null ? null : Math.max(1, Number(limite));

    let consulta = obtenerSupabase()
      .from("eventos_auditoria")
      .select(COLUMNAS_DEL_EVENTO, porPagina === null ? undefined : { count: "exact" })
      .order("realizado_en", { ascending: false });

    if (usuarioId) consulta = consulta.eq("realizado_por", usuarioId);
    if (tablaAfectada) consulta = consulta.eq("tabla_afectada", tablaAfectada);
    if (desde) consulta = consulta.gte("realizado_en", desde);
    if (hasta) consulta = consulta.lt("realizado_en", diaSiguiente(hasta));

    if (porPagina !== null) {
      const inicio = (pagina_ - 1) * porPagina;
      consulta = consulta.range(inicio, inicio + porPagina - 1);
    }

    const { data, error, count } = await consulta;
    if (error) return { eventos: [], total: 0, error: normalizarError(error) };

    return { eventos: data ?? [], total: count ?? (data ?? []).length, error: null };
  } catch (error) {
    return { eventos: [], total: 0, error: normalizarError(error) };
  }
}

/**
 * Catalogo `{ value, label }` de perfiles: alimenta el filtro "Usuario" y, en el hook, el mapa
 * que resuelve `realizado_por` a un nombre para mostrar.
 *
 * Trae TODOS los perfiles, activos e inactivos -a diferencia de proyectos/filtros.js, que solo
 * trae activos porque elige un responsable a futuro-: un evento viejo puede ser de alguien ya
 * desactivado, y tiene que seguir siendo filtrable y legible.
 *
 * Reutiliza listarUsuarios(): usuarios/api.js es el unico archivo del monorepo que lee la tabla
 * perfiles (ver su propio comentario de cabecera), asi que esta capa no repite esa consulta.
 *
 * @returns {Promise<{ opciones: Array<{value:string,label:string}>, error: object|null }>}
 */
export async function listarPerfilesParaFiltro() {
  const { usuarios, error } = await listarUsuarios({});
  if (error) return { opciones: [], error };

  const opciones = usuarios.map((perfil) => ({
    value: perfil.id,
    label: nombreCompletoDe(perfil),
  }));

  return { opciones, error: null };
}
