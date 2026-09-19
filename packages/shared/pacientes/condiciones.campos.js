// Esquema declarativo del formulario de condiciones cronicas (issue #122).
//
// Los campos reflejan las columnas de padecimientos_cronicos (migracion 00010): condicion_id y
// fecha_diagnostico son NOT NULL, estado tiene DEFAULT 'activa' y notas es la unica nullable.
// Cuando el diccionario de datos del entregable y la migracion aplicada no coinciden, manda la
// migracion (AGENTS.md, "Fuente de verdad").

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { camposDeEdicion } from "../formularios.js";
import { ESTADOS_CONDICION_CRONICA, ETIQUETAS_ESTADO_CONDICION, opcionesDe } from "../enums.js";

export const OPCIONES_ESTADO_CONDICION = opcionesDe(
  ESTADOS_CONDICION_CRONICA,
  ETIQUETAS_ESTADO_CONDICION,
);

/**
 * Formulario para asociar una condicion cronica a un paciente.
 *
 * `estado` no es requerido porque la columna tiene DEFAULT 'activa': un alta que no lo mande
 * queda activa, que es lo que se espera al registrar un diagnostico nuevo.
 *
 * Las opciones de `condicion` salen del catalogo condiciones_cronicas, que cualquier autenticado
 * puede leer; se declaran con opcionesDesde para que las dos apps las resuelvan igual, como hace
 * filtros.js con las comunidades.
 */
export const CAMPOS_CONDICION_CRONICA = [
  {
    id: "condicion",
    label: "Condición",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "condicionesCronicas",
    validacion: { requerido: true },
  },
  {
    id: "fechaDiagnostico",
    label: "Fecha de diagnóstico",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: true },
  },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_ESTADO_CONDICION,
    validacion: { requerido: false },
  },
  {
    id: "notas",
    label: "Notas",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
];

/**
 * Correccion de un padecimiento ya asociado (issue #756): la ficha del paciente solo ofrecia
 * marcar un padecimiento como resuelto, sin forma de corregir la fecha de diagnostico o las notas
 * de un registro ya existente, pese a que actualizarCondicion() (condiciones.api.js) ya las
 * acepta. `condicion` no se edita: cambiar a que condicion se refiere un registro no es una
 * correccion de datos, es otro hecho clinico distinto (se borra y se vuelve a asociar). `estado`
 * tampoco: pasar a resuelta sigue siendo la accion dedicada marcarResuelta().
 *
 * Los dos se ven, de solo lectura (issue #840, B1): es el mismo juego de campos que el alta.
 */
export const CAMPOS_CORRECCION_CONDICION = camposDeEdicion(CAMPOS_CONDICION_CRONICA, [
  "fechaDiagnostico",
  "notas",
]);

/**
 * Los valores con que se abre la correccion de un padecimiento.
 *
 * @param {object|null} condicion Una fila de obtenerCondicionesDelPaciente(): `condicion` ya es
 *   el nombre, no el id.
 * @returns {Record<string, unknown>} Indexado por los ids de CAMPOS_CORRECCION_CONDICION.
 */
export function valoresDeCorreccionDeCondicion(condicion) {
  return {
    condicion: condicion?.condicion ?? "",
    fechaDiagnostico: condicion?.fechaDiagnostico ?? "",
    estado: condicion?.estado ?? "",
    notas: condicion?.notas ?? "",
  };
}
