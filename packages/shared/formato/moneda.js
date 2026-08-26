// Formateo de importes.
//
// Vive en shared y no en cada app por la misma razon que formatearFechaCorta: el resultado tiene
// que ser identico en web y en movil. Intl.NumberFormat esta disponible en los dos entornos, pero
// el locale por defecto no: en un telefono depende de la configuracion de quien lo usa, y el mismo
// gasto acabaria escrito 'Q1,250.00' en una pantalla y 'Q1.250,00' en la otra.

/** Todo el sistema opera en quetzales; no hay multi-moneda en el esquema. */
export const MONEDA = 'GTQ';

const FORMATO = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: MONEDA,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un importe en quetzales.
 *
 * Devuelve null cuando no hay valor, para que la celda quede vacia en vez de mostrar 'Q0.00' y
 * hacer pasar por cero un dato que no se registro.
 *
 * @param {number|string|null|undefined} valor
 * @returns {string|null}
 */
export function formatearMoneda(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  const numero = Number(valor);
  if (Number.isNaN(numero)) return null;

  return FORMATO.format(numero);
}
