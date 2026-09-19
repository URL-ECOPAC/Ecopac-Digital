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

/**
 * Cuantas opciones hacen que un selector ofrezca buscar (issue #840, G4). Con menos, la lista se
 * ve entera sin desplazarse y un buscador es un paso de mas; con mas -el catalogo de
 * diagnosticos, el de comunidades- recorrerla a ojo en un telefono no es practico.
 */
export const OPCIONES_PARA_OFRECER_BUSQUEDA = 8;

/**
 * Las opciones cuya etiqueta contiene el texto, ignorando mayusculas, acentos y espacios de mas.
 * "gastr" encuentra "Gastritis aguda"; "diarrea" encuentra "Diarrea". Cada palabra buscada tiene
 * que aparecer, en cualquier orden: "aguda farin" encuentra "Faringitis aguda".
 *
 * @param {{ value: unknown, label: string }[]} opciones
 * @param {string} texto
 * @returns {{ value: unknown, label: string }[]}
 */
export function filtrarOpcionesPorTexto(opciones = [], texto = "") {
  const palabras = textoComparable(texto).split(" ").filter(Boolean);
  if (palabras.length === 0) return opciones;
  return opciones.filter((opcion) => {
    const etiqueta = textoComparable(opcion?.label);
    return palabras.every((palabra) => etiqueta.includes(palabra));
  });
}
