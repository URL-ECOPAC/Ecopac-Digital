// Registro de donaciones (issue #635).
//
// La #191 se cerro sin entregar este archivo: existia lectura (donantes.api.js,
// historial.api.js, ingreso.api.js) pero ningun `.insert()` sobre `donaciones` ni
// `donacion_detalle` en todo el repo. `registrarDonacion()` es la escritura que faltaba.
//
// Llama a una funcion de base (fn_registrar_donacion, migracion 00114) en vez de encadenar varias
// sentencias desde el cliente: supabase-js no soporta transacciones multi-sentencia, y una
// donacion con detalle necesita que el INSERT de la donacion y el de cada renglon vivan o mueran
// juntos (criterio 1 de #635). Mismo patron que fn_registrar_paciente (00057) y fn_generar_receta
// (00066). No es SECURITY DEFINER: quien puede escribir lo deciden las politicas de la 00083
// (es_administrador()), igual que en esos dos precedentes.
//
// Aqui vivia tambien anularDonacion(). Desde la 00173 una donacion ya no se anula -no hay proceso
// para devolver lo donado- y fn_anular_donacion ya no existe (issue #911).

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { validarDonacion } from "./validaciones.js";
import { puedeRegistrarDonaciones } from "./permisos.js";

function validarRolEscritura(rolUsuario) {
  if (!puedeRegistrarDonaciones(rolUsuario)) {
    return {
      datos: null,
      error: { mensaje: "Operación exclusiva para el rol Administrador." },
    };
  }
  return null;
}

/** Numero o null: convierte "" y undefined a null en vez de a NaN/0, para no fingir un dato. */
function numeroONulo(valor) {
  if (valor === "" || valor === undefined || valor === null) return null;
  return Number(valor);
}

/**
 * Detalle listo para `fn_registrar_donacion`: solo las columnas reales de `donacion_detalle`.
 * `fechaVencimiento` no viaja: esa columna no existe en `donacion_detalle` (vive en `lotes`, y se
 * captura al generar el ingreso de inventario).
 *
 * `medicamentoId` SI viaja desde la #840: es `donacion_detalle.medicamento_id` (00135), y con el
 * la funcion arma la descripcion y la unidad desde el catalogo. Hasta entonces se quedaba en el
 * estado del formulario y el paso de ingreso a inventario tenia que adivinar el medicamento.
 *
 * @param {object[]} [detalles]
 * @returns {object[]}
 */
export function aDetalleParaGuardar(detalles = []) {
  return detalles.map(({ descripcion, cantidad, unidad, monto, medicamentoId }) => ({
    descripcion: descripcion || null,
    cantidad: numeroONulo(cantidad),
    unidad: unidad || null,
    monto: numeroONulo(monto),
    medicamentoId: medicamentoId || null,
  }));
}

/**
 * Fila de `donaciones` (columnas snake_case, tal como la devuelve `fn_registrar_donacion`) en la
 * forma camelCase que usa el resto del modulo, mismo criterio que
 * `aDonacion()` en historial.api.js. Sin donante embebido: la funcion de base no lo trae, y quien
 * llama ya conoce el donante que envio.
 */
function aDonacionRegistrada(fila) {
  return {
    id: fila.id,
    donanteId: fila.donante_id,
    proyectoId: fila.proyecto_id,
    jornadaId: fila.jornada_id ?? null,
    tipo: fila.tipo,
    fecha: fila.fecha,
    observaciones: fila.observaciones,
    estado: fila.estado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladaPor: fila.anulada_por,
    anuladaEn: fila.anulada_en,
    registradoPor: fila.registrado_por,
  };
}

/**
 * Registra una donacion y sus renglones de detalle (issue #635).
 *
 * Valida con `validarDonacion()` antes de escribir (criterio 3); si hay errores, no llega a
 * Supabase. Solo administrador puede escribir -RLS de la 00083 lo exige igual, esto es UX, no
 * seguridad (regla de alcance)-, y `registrado_por` lo fija `fn_registrar_donacion` con
 * `auth.uid()`, nunca un valor de este objeto (criterio 4).
 *
 * `fn_registrar_donacion` devuelve JSONB (`{ donacion, detalleIds }`), no `RETURNS donaciones`:
 * sin `.single()` (ese modificador es para cuando PostgREST envuelve en arreglo el resultado de
 * una funcion que devuelve una fila de tabla; un escalar JSONB ya llega tal cual, mismo criterio
 * que `fn_generar_receta` en recetas.api.js, que tampoco usa `.single()`). `datos.detalleIds`
 * trae el id real de cada renglon de `donacion_detalle`, en el mismo orden que se envio
 * `donacion.detalles`: lo necesita el hook para poder ofrecer despues el paso de generar el
 * ingreso de inventario con un id que existe de verdad (criterio 6; ver useRegistroDonacion.js).
 *
 * @param {{ donanteId?: string, proyectoId?: string, jornadaId?: string, tipo?: string,
 *   fecha?: string, observaciones?: string, detalles?: object[] }} donacion
 * @param {{ rolUsuario: string }} contexto
 * @returns {Promise<{ datos: (object & { detalleIds: string[] })|null, error: object|null }>}
 *   `error.campos` trae el detalle por campo cuando el fallo es de validacion.
 */
export async function registrarDonacion(donacion = {}, { rolUsuario } = {}) {
  const errorRol = validarRolEscritura(rolUsuario);
  if (errorRol) return errorRol;

  const erroresDeValidacion = validarDonacion(donacion);
  if (Object.keys(erroresDeValidacion).length > 0) {
    return {
      datos: null,
      error: {
        mensaje: "Revisa los datos del formulario antes de registrar la donación.",
        campos: erroresDeValidacion,
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_registrar_donacion", {
      p_donante_id: donacion.donanteId,
      p_tipo: donacion.tipo,
      p_fecha: donacion.fecha,
      p_detalle: aDetalleParaGuardar(donacion.detalles),
      p_proyecto_id: donacion.proyectoId || null,
      p_observaciones: donacion.observaciones || null,
      // 00153: la jornada para la que se recibio. Con jornada, la base toma el proyecto de ella.
      p_jornada_id: donacion.jornadaId || null,
    });

    if (error) return { datos: null, error: normalizarError(error) };

    return {
      datos: { ...aDonacionRegistrada(data.donacion), detalleIds: data.detalleIds ?? [] },
      error: null,
    };
  } catch (error) {
    return { datos: null, error: normalizarError(error) };
  }
}
