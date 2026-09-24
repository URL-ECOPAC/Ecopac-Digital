// Normalizacion de lo que las pantallas mandan a las columnas de proyectos.

/**
 * Convierte un campo vacio en `null`, que es lo que Postgres espera para "sin valor".
 *
 * Los formularios rellenan todo con `""`, y una columna DATE rechaza esa cadena con 22007
 * (invalid input syntax for type date): asi fallaban editar un proyecto sin fechas y crear un
 * hito sin fecha real. Tambien cubre un UUID opcional (`responsable_id`) y el texto libre, donde
 * "" y NULL significan lo mismo pero solo NULL se puede consultar como "sin dato".
 *
 * Solo toca cadenas vacias o de puros espacios; cualquier otro valor pasa igual, incluido
 * `undefined`, para que un update parcial siga sin enviar lo que no se toco.
 *
 * @param {unknown} valor
 * @returns {unknown}
 */
export function vacioANull(valor) {
  if (typeof valor === "string" && valor.trim() === "") return null;
  return valor;
}
