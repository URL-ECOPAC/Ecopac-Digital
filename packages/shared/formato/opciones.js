// Comparacion de texto de interfaz contra las opciones de un catalogo.
//
// Lo usan los selectores multiples de las dos apps para que escribir "cirujano" elija la opcion
// "Cirujano" que ya existe, en vez de crear un duplicado que solo difiere en mayusculas o en un
// acento. Tres modulos ya tenian su propio quitarAcentos() privado; este es el publico.

/**
 * Minusculas, sin acentos y con los espacios colapsados. "Pediatría " y "pediatria" quedan iguales.
 *
 * @param {unknown} texto
 * @returns {string}
 */
export function textoComparable(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La opcion `{ value, label }` cuya etiqueta coincide con el texto, o null.
 *
 * @param {{ value: unknown, label: string }[]} opciones
 * @param {string} texto
 */
export function buscarOpcionPorEtiqueta(opciones = [], texto = "") {
  const buscado = textoComparable(texto);
  if (!buscado) return null;
  return opciones.find((opcion) => textoComparable(opcion?.label) === buscado) ?? null;
}
