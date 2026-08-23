// Vocabulario compartido de los descriptores: los tipos que puede declarar un campo de
// formulario y los que puede declarar un filtro de listado.
//
// Vive fuera de los modulos de dominio porque lo usan todos, y sobre todo porque tiene que
// estar declarado UNA sola vez. Cuando cada modulo traia su propia copia, el barril
// (packages/shared/index.js) reexportaba el mismo nombre desde varios modulos con export *,
// y ESM excluye del namespace un nombre ambiguo: `import { TIPOS_DE_FILTRO } from
// '@ecopac/shared'` devolvia undefined, y FilterBar reventaba al evaluar
// TIPOS_DE_FILTRO.BUSQUEDA. Ver issue #365.
//
// Regla practica: un nombre exportado por el barril solo puede nacer en un archivo. Si dos
// modulos necesitan el mismo, va aqui y los dos lo importan.

/**
 * Tipos de control que un descriptor de campo puede declarar.
 *
 * Es la union de lo que ya declaraban pacientes, usuarios, inventario y jornadas por
 * separado; ninguna clave tenia un valor distinto entre modulos, asi que la union no
 * cambia el comportamiento de ninguno.
 */
export const TIPOS_DE_CAMPO = {
  TEXTO: 'texto',
  TEXTO_LARGO: 'texto_largo',
  NUMERO: 'numero',
  FECHA: 'fecha',
  HORA: 'hora',
  EMAIL: 'email',
  TELEFONO: 'telefono',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  LISTA_REPETIBLE: 'lista_repetible',
  BOOLEANO: 'booleano',
  ETIQUETAS: 'etiquetas',
};

/** Tipos de filtro que el componente FilterBar de cada app sabe renderizar. */
export const TIPOS_DE_FILTRO = {
  BUSQUEDA: 'busqueda',
  SELECT: 'select',
  RANGO: 'rango',
};
