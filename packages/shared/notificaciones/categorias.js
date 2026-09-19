// Descriptores de las categorias de notificacion (issue #755): etiqueta, tono de color y a donde
// lleva cada una en cada plataforma. Las dos apps los leen de aqui para que el buzon web y el
// movil agrupen, rotulen y pinten igual.
//
// EL TONO ES UN NOMBRE DE TOKEN, NO UN COLOR
//
// `tono` es una clave de `colors` de @ecopac/ui-tokens. La web la consume como
// var(--color-<tono>) y el movil como colors[tono]: ninguna de las dos escribe un color, y un
// tono que no exista lo detecta categorias.test.js. La eleccion sigue docs/DISENO.md:
//   - caducidad: el acento de Inventario (warning), el mismo de "Por vencer".
//   - stock: danger, el de "Sin stock".
//   - validacion: info, el de "Pendiente de validacion".
//   - presupuestos: el acento de Presupuestos (danger, el magenta del logo).
//
// EL DESTINO
//
// En la web el destino es el `enlace` de la propia notificacion, que escribe la migracion 00138.
// El movil no tiene esas rutas: usa `destinoMovil`, una clave que la pantalla traduce a su
// navegador. Validacion y presupuestos no tienen pantalla movil -la bandeja de validacion y la de
// gastos existen solo en la web-, asi que su destino movil es null y el buzon lo dice en vez de
// llevar a una pantalla que no es.

import { CATEGORIAS_NOTIFICACION, ETIQUETAS_CATEGORIA_NOTIFICACION } from "../enums.js";

export const DESTINOS_MOVILES_NOTIFICACION = Object.freeze({
  ALERTAS_DE_INVENTARIO: "alertasDeInventario",
  EXISTENCIAS: "existencias",
});

const { CADUCIDAD, STOCK, VALIDACION, PRESUPUESTOS } = CATEGORIAS_NOTIFICACION;

/** En este orden se muestran los grupos cuando el buzon agrupa por categoria. */
export const DESCRIPTORES_CATEGORIA_NOTIFICACION = Object.freeze([
  Object.freeze({
    categoria: CADUCIDAD,
    etiqueta: ETIQUETAS_CATEGORIA_NOTIFICACION[CADUCIDAD],
    tono: "warning",
    destinoMovil: DESTINOS_MOVILES_NOTIFICACION.ALERTAS_DE_INVENTARIO,
  }),
  Object.freeze({
    categoria: STOCK,
    etiqueta: ETIQUETAS_CATEGORIA_NOTIFICACION[STOCK],
    tono: "danger",
    destinoMovil: DESTINOS_MOVILES_NOTIFICACION.EXISTENCIAS,
  }),
  Object.freeze({
    categoria: VALIDACION,
    etiqueta: ETIQUETAS_CATEGORIA_NOTIFICACION[VALIDACION],
    tono: "info",
    destinoMovil: null,
  }),
  Object.freeze({
    categoria: PRESUPUESTOS,
    etiqueta: ETIQUETAS_CATEGORIA_NOTIFICACION[PRESUPUESTOS],
    tono: "danger",
    destinoMovil: null,
  }),
]);

const POR_CATEGORIA = new Map(DESCRIPTORES_CATEGORIA_NOTIFICACION.map((d) => [d.categoria, d]));

/**
 * Descriptor de una categoria. Una categoria desconocida es un contrato roto entre la base y el
 * paquete -el enum crecio y enums.js no-, asi que lanza en vez de devolver un descriptor vacio.
 *
 * @param {string} categoria
 */
export function descriptorDeCategoria(categoria) {
  const descriptor = POR_CATEGORIA.get(categoria);
  if (!descriptor) {
    throw new Error(`Categoria de notificacion desconocida: "${categoria}".`);
  }
  return descriptor;
}

/**
 * Agrupa las notificaciones por categoria, en el orden de DESCRIPTORES_CATEGORIA_NOTIFICACION, y
 * conserva dentro de cada grupo el orden en que llegaron. Solo devuelve los grupos con algo.
 *
 * @param {object[]} notificaciones
 * @returns {{ categoria: string, etiqueta: string, tono: string, noLeidas: number,
 *   notificaciones: object[] }[]}
 */
export function agruparPorCategoria(notificaciones) {
  return DESCRIPTORES_CATEGORIA_NOTIFICACION.map((descriptor) => {
    const delGrupo = notificaciones.filter((n) => n.categoria === descriptor.categoria);
    return {
      categoria: descriptor.categoria,
      etiqueta: descriptor.etiqueta,
      tono: descriptor.tono,
      noLeidas: delGrupo.filter((n) => !n.leida).length,
      notificaciones: delGrupo,
    };
  }).filter((grupo) => grupo.notificaciones.length > 0);
}
