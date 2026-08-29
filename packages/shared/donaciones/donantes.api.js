import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

const ROLES_LECTURA = ["administrador", "junta_directiva", "socio_fundador"];

function validarRolEscritura(rolUsuario) {
  if (rolUsuario !== "administrador") {
    return {
      datos: null,
      error: { mensaje: "Operación exclusiva para el rol Administrador." },
    };
  }
  return null;
}

function validarRolLectura(rolUsuario) {
  if (!ROLES_LECTURA.includes(rolUsuario)) {
    return {
      datos: null,
      error: { mensaje: "No tienes permisos de lectura para el catálogo de donantes." },
    };
  }
  return null;
}

/**
 * Columnas escribibles de `donantes` (00022_donantes_donaciones.sql). Se enumeran para que un
 * campo que el formulario invente no viaje hasta PostgREST: la issue #509 entro por
 * `documento_identidad`, que nunca existio en el esquema y hacia fallar el alta entera con
 * 42703.
 */
const COLUMNAS_DE_DONANTE = ["nombre", "tipo", "contacto", "telefono", "email", "direccion", "activo"];

/**
 * Deja de un objeto solo las claves que son columnas de `donantes`.
 *
 * @param {object} datos
 * @returns {object}
 */
function soloColumnasDeDonante(datos = {}) {
  return Object.fromEntries(
    Object.entries(datos).filter(([clave]) => COLUMNAS_DE_DONANTE.includes(clave)),
  );
}

/**
 * Registra un nuevo donante (persona u organización).
 */
export async function registrarDonante(datosDonante, { rolUsuario }) {
  const errorRol = validarRolEscritura(rolUsuario);
  if (errorRol) return errorRol;

  try {
    const { tipo, nombre, contacto, telefono, email, direccion } = datosDonante;

    if (!["persona", "organizacion"].includes(tipo)) {
      return {
        datos: null,
        error: { mensaje: "El tipo de donante debe ser 'persona' o 'organizacion'." },
      };
    }

    if (!nombre || !nombre.trim()) {
      return {
        datos: null,
        error: { mensaje: "El nombre del donante es obligatorio." },
      };
    }

    const supabase = obtenerSupabase();
    const { data, error } = await supabase
      .from("donantes")
      .insert({
        tipo,
        nombre,
        contacto,
        telefono,
        email,
        direccion,
        activo: true,
      })
      .select()
      .single();

    if (error) throw error;
    return { datos: data, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Consulta la lista de donantes con opción de filtro por nombre.
 */
export async function listarDonantes({ busqueda, soloActivos = true } = {}, { rolUsuario }) {
  const errorRol = validarRolLectura(rolUsuario);
  if (errorRol) return errorRol;

  try {
    const supabase = obtenerSupabase();
    let query = supabase.from("donantes").select("*");

    if (soloActivos) {
      query = query.eq("activo", true);
    }

    if (busqueda && busqueda.trim()) {
      query = query.ilike("nombre", `%${busqueda.trim()}%`);
    }

    const { data, error } = await query.order("nombre", { ascending: true });
    if (error) throw error;

    return { datos: data || [], error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Actualiza la información de un donante existente.
 */
export async function actualizarDonante(idDonante, datosNuevos, { rolUsuario }) {
  const errorRol = validarRolEscritura(rolUsuario);
  if (errorRol) return errorRol;

  try {
    const supabase = obtenerSupabase();

    if (datosNuevos.tipo && !["persona", "organizacion"].includes(datosNuevos.tipo)) {
      return {
        datos: null,
        error: { mensaje: "El tipo de donante debe ser 'persona' o 'organizacion'." },
      };
    }

    const { data, error } = await supabase
      .from("donantes")
      .update(soloColumnasDeDonante(datosNuevos))
      .eq("id", idDonante)
      .select()
      .single();

    if (error) throw error;
    return { datos: data, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Dar de baja a un donante (borrado lógico, seteando activo = false).
 */
export async function darDeBajaDonante(idDonante, { rolUsuario }) {
  return actualizarDonante(idDonante, { activo: false }, { rolUsuario });
}

/**
 * Consulta el total acumulado y el historial de donaciones realizadas por un donante.
 */
export async function obtenerHistoricoDonante(idDonante, { rolUsuario }) {
  const errorRol = validarRolLectura(rolUsuario);
  if (errorRol) return errorRol;

  try {
    const supabase = obtenerSupabase();

    const { data: donaciones, error } = await supabase
      .from("donaciones")
      .select("*")
      .eq("donante_id", idDonante)
      .neq("estado", "anulada")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const totalAcumulado = (donaciones || []).reduce(
      (acc, d) => acc + (Number(d.monto_total) || 0),
      0
    );

    return {
      datos: {
        totalAcumulado,
        donaciones: donaciones || [],
      },
      error: null,
    };
  } catch (error) {
    return normalizarError(error);
  }
}