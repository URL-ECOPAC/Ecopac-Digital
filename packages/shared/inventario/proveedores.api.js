// Consultas de Supabase de los proveedores (issue #143).
//
// Reemplaza a packages/shared/servicios/inventarioServicio.ts, que pedia proveedores.activo,
// proveedores.telefono y proveedores.correo. La tabla real (00017_proveedores_bodegas.sql) es
//
//   proveedores (id, nombre, contacto, tipo tipo_proveedor, created_at, updated_at)
//
// con una sola columna `contacto` de texto libre y sin columna `activo`. `tipo` si existe, pero
// sus valores son los del enum tipo_proveedor -('comercial', 'donante')-, no los que declaraba
// aquel archivo.
//
// Convenciones del modulo (mismas que lotes.api.js): `{ dato, error }` en vez de excepciones, y
// ninguna decision de permisos aqui. Quien impide escribir son las politicas de la 00062: SELECT
// abierto a autenticados, el resto solo administrador.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";

// Los valores del enum tipo_proveedor (TIPOS_DE_PROVEEDOR, OPCIONES_TIPO_PROVEEDOR) nacen en
// inventario/campos.js y no se redeclaran aqui: un nombre que el barril reciba desde dos archivos
// queda ambiguo y ESM lo excluye del namespace (issue #365).

const COLUMNAS_DEL_PROVEEDOR = [
  "id",
  "nombre",
  "contacto",
  "tipo",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(", ");

/** Traduce del camelCase de las pantallas al snake_case de la tabla proveedores. */
function aColumnasDeTabla(datos = {}) {
  const mapa = {
    nombre: "nombre",
    contacto: "contacto",
    tipo: "tipo",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

function aProveedor(fila) {
  if (!fila) return null;

  return {
    id: fila.id,
    nombre: fila.nombre,
    contacto: fila.contacto,
    tipo: fila.tipo,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

/**
 * Registra un proveedor nuevo.
 *
 * Exige nombre y tipo: las dos columnas son NOT NULL (00017) y nombre es ademas UNIQUE. `contacto`
 * es nullable. El valor de `tipo` no se comprueba aqui contra el enum: quien lo hace cumplir es
 * Postgres, y un valor invalido vuelve como error que normalizarError() ya traduce.
 *
 * @param {{ nombre: string, tipo: string, contacto?: string }} datos
 * @returns {Promise<{ proveedor: object|null, error: object|null }>}
 */
export async function registrarProveedor(datos = {}) {
  if (!datos.nombre || !datos.tipo) {
    return { proveedor: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proveedores")
      .insert(aColumnasDeTabla(datos))
      .select(COLUMNAS_DEL_PROVEEDOR)
      .single();

    if (error) return { proveedor: null, error: normalizarError(error) };
    return { proveedor: aProveedor(data), error: null };
  } catch (error) {
    return { proveedor: null, error: normalizarError(error) };
  }
}

/**
 * Actualiza un proveedor existente. Solo viajan las claves presentes en `datos`.
 *
 * @param {string} id UUID del proveedor.
 * @param {{ nombre?: string, tipo?: string, contacto?: string }} datos
 * @returns {Promise<{ proveedor: object|null, error: object|null }>}
 */
export async function actualizarProveedor(id, datos = {}) {
  if (!id) {
    return { proveedor: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  const cambios = aColumnasDeTabla(datos);
  if (Object.keys(cambios).length === 0) {
    return { proveedor: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proveedores")
      .update(cambios)
      .eq("id", id)
      .select(COLUMNAS_DEL_PROVEEDOR)
      .single();

    if (error) return { proveedor: null, error: normalizarError(error) };
    return { proveedor: aProveedor(data), error: null };
  } catch (error) {
    return { proveedor: null, error: normalizarError(error) };
  }
}

/**
 * Lista los proveedores, ordenados por nombre.
 *
 * @param {{ busqueda?: string, tipo?: string }} [filtros]
 * @returns {Promise<{ proveedores: object[], error: object|null }>}
 */
export async function listarProveedores({ busqueda, tipo } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("proveedores")
      .select(COLUMNAS_DEL_PROVEEDOR)
      .order("nombre", { ascending: true });

    if (busqueda) consulta = consulta.ilike("nombre", `%${busqueda}%`);
    if (tipo) consulta = consulta.eq("tipo", tipo);

    const { data, error } = await consulta;

    if (error) return { proveedores: [], error: normalizarError(error) };
    return { proveedores: (data ?? []).map(aProveedor), error: null };
  } catch (error) {
    return { proveedores: [], error: normalizarError(error) };
  }
}

/**
 * Un proveedor por id.
 *
 * @param {string} id UUID del proveedor.
 * @returns {Promise<{ proveedor: object|null, error: object|null }>}
 */
export async function obtenerProveedor(id) {
  if (!id) {
    return { proveedor: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proveedores")
      .select(COLUMNAS_DEL_PROVEEDOR)
      .eq("id", id)
      .single();

    if (error) return { proveedor: null, error: normalizarError(error) };
    return { proveedor: aProveedor(data), error: null };
  } catch (error) {
    return { proveedor: null, error: normalizarError(error) };
  }
}
