// Presentacion legible de un evento de la bitacora de auditoria (issue #643), a partir de
// valoresAnteriores/valoresNuevos (to_jsonb(OLD)/to_jsonb(NEW) de la 00026, columnas de la
// tabla auditada tal cual, en snake_case). Un JSON crudo es correcto pero incomodo de leer; esto
// arma un diff campo por campo en su lugar, sin inventar un diccionario de traducciones por cada
// una de las ocho tablas auditadas (serian decenas de columnas, y crece cada vez que una de esas
// tablas gana una columna nueva).

import { formatearFechaConHora, formatearFechaCorta } from "../formato/fechas.js";

// Las unicas columnas en ingles de las tablas auditadas: las marcas de tiempo que cada tabla trae
// desde su migracion de creacion. El resto ya esta en español y basta con separar las palabras.
const NOMBRES_DE_CAMPO = {
  created_at: "Creado",
  updated_at: "Actualizado",
};

/** "fecha_nacimiento" -> "Fecha Nacimiento". Genérico: solo traduce las columnas en ingles. */
export function nombreDeCampo(clave) {
  if (NOMBRES_DE_CAMPO[clave]) return NOMBRES_DE_CAMPO[clave];
  return clave
    .split("_")
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(" ");
}

// to_jsonb() deja las columnas DATE como "2026-09-18" y las TIMESTAMPTZ como
// "2026-09-18T04:22:59.45233+00:00". Se reconocen por su forma, sin saber de que columna vienen.
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MARCA_DE_TIEMPO_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Un valor de columna a texto: null/undefined como "-", booleanos como Si/No, fechas como
 * "18/09/2026" y marcas de tiempo como "18/09/2026 10:22" en hora local; el resto tal cual.
 */
export function formatearValorDeAuditoria(valor) {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "string" && FECHA_ISO.test(valor)) {
    return formatearFechaCorta(valor) || valor;
  }
  if (typeof valor === "string" && MARCA_DE_TIEMPO_ISO.test(valor)) {
    return formatearFechaConHora(valor) || valor;
  }
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/**
 * Diff legible de un evento, segun tenga o no valoresAnteriores/valoresNuevos.
 *
 * - Sin `valoresAnteriores` (insercion): se listan todos los campos de `valoresNuevos`.
 * - Sin `valoresNuevos` (eliminacion, DELETE en el trigger de la 00026): se listan todos los
 *   campos de `valoresAnteriores`.
 * - Con ambos (actualizacion o baja): solo los campos cuyo valor cambio, cada uno con su antes
 *   y su despues. Los que no cambiaron no aparecen -- es lo que alguien revisando la bitacora
 *   quiere ver primero, no releer veinte columnas iguales.
 *
 * @param {{ valoresAnteriores: object|null, valoresNuevos: object|null }} evento
 * @returns {{ tipo: "creacion"|"eliminacion"|"cambio", campos: object[] }}
 */
export function diferenciaDeEvento({ valoresAnteriores, valoresNuevos }) {
  if (!valoresAnteriores) {
    return {
      tipo: "creacion",
      campos: Object.entries(valoresNuevos ?? {}).map(([clave, valor]) => ({
        clave,
        nombre: nombreDeCampo(clave),
        valor: formatearValorDeAuditoria(valor),
      })),
    };
  }

  if (!valoresNuevos) {
    return {
      tipo: "eliminacion",
      campos: Object.entries(valoresAnteriores ?? {}).map(([clave, valor]) => ({
        clave,
        nombre: nombreDeCampo(clave),
        valor: formatearValorDeAuditoria(valor),
      })),
    };
  }

  const claves = new Set([...Object.keys(valoresAnteriores), ...Object.keys(valoresNuevos)]);
  const campos = [];
  for (const clave of claves) {
    const antes = valoresAnteriores[clave];
    const despues = valoresNuevos[clave];
    if (JSON.stringify(antes) === JSON.stringify(despues)) continue;

    campos.push({
      clave,
      nombre: nombreDeCampo(clave),
      antes: formatearValorDeAuditoria(antes),
      despues: formatearValorDeAuditoria(despues),
    });
  }

  return { tipo: "cambio", campos };
}
