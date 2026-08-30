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
  TEXTO: "texto",
  TEXTO_LARGO: "texto_largo",
  NUMERO: "numero",
  FECHA: "fecha",
  HORA: "hora",
  EMAIL: "email",
  TELEFONO: "telefono",
  SELECT: "select",
  MULTI_SELECT: "multi_select",
  LISTA_REPETIBLE: "lista_repetible",
  BOOLEANO: "booleano",
  ETIQUETAS: "etiquetas",
};

/** Tipos de filtro que el componente FilterBar de cada app sabe renderizar. */
export const TIPOS_DE_FILTRO = {
  BUSQUEDA: "busqueda",
  SELECT: "select",
  RANGO: "rango",
};

/**
 * Tipos de presentacion que el componente DataList de cada app sabe dibujar, en una columna de
 * tabla (web) o en un campo de tarjeta (movil).
 *
 * Es el tercer vocabulario del contrato y faltaba. TIPOS_DE_CAMPO y TIPOS_DE_FILTRO estaban
 * declarados, pero los tipos de columna se venian escribiendo como cadena suelta en el
 * columnas.js de cada modulo, y ya habian empezado a divergir: 'moneda' se colo en presupuestos
 * sin que ningun DataList supiera dibujarlo, asi que el importe caia al caso por defecto y se
 * pintaba en crudo. Es la misma deriva que TIPOS_DE_FILTRO evita, con la diferencia de que aqui
 * no revienta: se ve mal y nadie se entera.
 *
 * Los valores son exactamente los `case` del switch de apps/web/src/components/DataList.jsx y
 * apps/mobile/src/components/DataList.js. Agregar uno aqui obliga a agregarlo en los dos.
 */
export const TIPOS_DE_PRESENTACION = {
  /** Texto tal cual. Es el caso por defecto del DataList. */
  TEXTO: "texto",
  /** Numero, con `sufijo` opcional en el descriptor. */
  NUMERO: "numero",
  /** Importe en quetzales, con formatearMoneda() de formato/moneda.js. */
  MONEDA: "moneda",
  /** Fecha corta, con formatearFechaCorta(); nunca con Intl desde la app. */
  FECHA: "fecha",
  /** Telefono. */
  TELEFONO: "telefono",
  /** Iniciales en un circulo; `desde` indica de que columna sale el texto. */
  AVATAR: "avatar",
  /** Una etiqueta de color cuyo valor guardado YA es el del enum. */
  CHIP: "chip",
  /** Varias etiquetas a partir de un arreglo. */
  CHIPS: "chips",
  /** Si / No. */
  BOOLEANO: "booleano",
  /** Etiqueta de color que resuelve su texto contra el catalogo de `etiquetasDesde`. */
  ESTADO: "estado",
};
