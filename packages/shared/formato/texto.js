// Formato de texto para presentar valores que vienen de la base tal como se guardaron.
//
// Los enums de Postgres y muchos campos de texto libre llegan en minuscula ("aprobado",
// "en_curso", "consulta general"). Cada pantalla los capitalizaba a su manera -o no lo hacia, y
// un chip decia "aprobado"-. Estas dos funciones son la forma unica.

/**
 * Primera letra en mayuscula y el resto tal cual. Para texto libre ("consulta general" ->
 * "Consulta general"): no toca siglas ni nombres propios que ya vengan bien escritos.
 *
 * @param {unknown} texto
 * @returns {string} Cadena vacia si no hay texto.
 */
export function mayusculaInicial(texto) {
  if (texto === null || texto === undefined) return "";
  const limpio = String(texto).trim();
  if (!limpio) return "";
  return limpio.charAt(0).toLocaleUpperCase("es") + limpio.slice(1);
}

/**
 * Etiqueta legible de un valor de enum sin tabla de etiquetas propia: guiones bajos a espacios y
 * mayuscula inicial ("en_curso" -> "En curso", "aprobado" -> "Aprobado").
 *
 * @param {unknown} valor
 * @returns {string}
 */
export function etiquetaDeValor(valor) {
  if (valor === null || valor === undefined) return "";
  return mayusculaInicial(String(valor).replace(/_/g, " "));
}
