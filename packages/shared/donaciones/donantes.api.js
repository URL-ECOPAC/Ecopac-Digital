import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { puedeRegistrarDonaciones, puedeVerDonaciones } from "./permisos.js";
import { ESTADOS_DE_DONACION, TIPOS_DE_DONANTE } from "../enums.js";

// Este archivo tenia su propia lista, `["administrador", "junta_directiva", "socio_fundador"]`,
// con guiones bajos. El enum rol_usuario de la 00001 los escribe con espacio -'junta directiva',
// 'socio fundador'-, asi que los dos roles consultivos no coincidian nunca y la API les negaba
// la lectura del catalogo de donantes aunque la politica RLS de la 00083 si se la concede. Era
// la misma clase de error que la #598 encontro en los hooks, en otra variante de escritura.
// Ahora los dos guardas salen de permisos.js, que es el espejo de esa politica.

function validarRolEscritura(rolUsuario) {
  if (!puedeRegistrarDonaciones(rolUsuario)) {
    return {
      datos: null,
      error: { mensaje: "Operación exclusiva para el rol Administrador." },
    };
  }
  return null;
}

function validarRolLectura(rolUsuario) {
  if (!puedeVerDonaciones(rolUsuario)) {
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
const COLUMNAS_DE_DONANTE = [
  "nombre",
  "tipo",
  "contacto",
  "telefono",
  "email",
  "direccion",
  "activo",
];

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

    if (!Object.values(TIPOS_DE_DONANTE).includes(tipo)) {
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
    return { datos: null, error: normalizarError(error) };
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
    // Lista vacia y no null, por lo mismo que listarMovimientos(): quien la consume la recorre.
    return { datos: [], error: normalizarError(error) };
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

    if (datosNuevos.tipo && !Object.values(TIPOS_DE_DONANTE).includes(datosNuevos.tipo)) {
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
    return { datos: null, error: normalizarError(error) };
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
      .neq("estado", ESTADOS_DE_DONACION.ANULADA)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const totalAcumulado = (donaciones || []).reduce(
      (acc, d) => acc + (Number(d.monto_total) || 0),
      0,
    );

    return {
      datos: {
        totalAcumulado,
        donaciones: donaciones || [],
      },
      error: null,
    };
  } catch (error) {
    return { datos: null, error: normalizarError(error) };
  }
}
