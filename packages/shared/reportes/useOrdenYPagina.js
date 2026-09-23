import { useCallback, useEffect, useMemo, useState } from "react";

// Ordenamiento y paginacion en cliente para las tablas de reportes (issue #862).
//
// POR QUE EN CLIENTE Y NO EN LA BASE. Los cinco reportes son agregados que ya vienen completos
// del servidor: obtenerReporteDeInventario agrupa por medicamento, fn_reporte_pacientes_atendidos
// devuelve un renglon por grupo, obtenerReporteDeVencimientos uno por lote y bodega. Paginar con
// .range() obligaria a una segunda consulta solo para los totales -que se calculan sobre el
// conjunto entero, no sobre la pagina-, y a que el orden lo decidiera PostgREST y no la pantalla.
// Con decenas o centenas de filas, ordenar en memoria es inmediato y deja los totales intactos.
//
// NO CONOCE NINGUN REPORTE. Recibe filas y un descriptor de columnas ya resueltos; quien decide
// que columna es ordenable es el descriptor (`ordenable: true`), no este hook.
//
// TODA LA LOGICA VIVE EN FUNCIONES PURAS EXPORTADAS -compararValores, ordenarFilas, contarPaginas,
// recortarAPagina, siguienteOrden-, y el hook solo las cose con useState. Es la convencion del
// paquete: vitest.config.js corre en environment "node" a proposito, sin DOM, asi que un hook no
// se puede montar con renderHook. Mismo criterio que presupuestos/useEjecucionPresupuestal.js y
// jornadas/useJornadasKanban.js, que lo documentan en sus pruebas. El comportamiento del hook
// montado se ejercita desde las pruebas de pantalla de apps/web, que si tienen jsdom.

/** Filas por pagina. 25 entra en una pantalla de laptop sin obligar a desplazarse a buscar el pie. */
export const TAMANO_DE_PAGINA_POR_DEFECTO = 25;

export const DIRECCIONES = Object.freeze({ ASC: "asc", DESC: "desc" });

/**
 * Compara dos valores de celda respetando su tipo.
 *
 * Los nulos van SIEMPRE al final, en las dos direcciones: un medicamento sin fecha de vencimiento
 * no es "el que vence primero" ni "el ultimo", es un dato que falta, y mezclarlo entre los que si
 * tienen fecha hace leer mal la tabla.
 */
export function esVacio(valor) {
  return valor === null || valor === undefined || valor === "";
}

export function compararValores(uno, otro) {
  if (esVacio(uno) && esVacio(otro)) return 0;
  if (esVacio(uno)) return 1;
  if (esVacio(otro)) return -1;

  if (typeof uno === "number" && typeof otro === "number") return uno - otro;
  if (typeof uno === "boolean" && typeof otro === "boolean") return Number(uno) - Number(otro);

  // Una fecha ISO (AAAA-MM-DD) ordena igual como texto que como fecha, y compararla como texto
  // evita construir un Date -que con una cadena sin hora se corre un dia segun la zona-.
  return String(uno).localeCompare(String(otro), "es", { numeric: true, sensitivity: "base" });
}

/** Ordena una copia de `filas` por la clave de una columna. No muta el arreglo recibido. */
export function ordenarFilas(filas, orden, columnas = []) {
  if (!orden?.id) return filas;

  const columna = columnas.find((c) => c.id === orden.id);
  // `desde` es la misma clave plana que lee DataList para pintar la celda: ordenar por otra cosa
  // que la que se ve en pantalla seria mentir sobre lo que se ordeno.
  const clave = columna?.desde ?? orden.id;
  const signo = orden.direccion === DIRECCIONES.DESC ? -1 : 1;

  return [...filas].sort((uno, otro) => {
    const valorUno = uno?.[clave];
    const valorOtro = otro?.[clave];

    // Los vacios quedan FUERA del signo. Multiplicarlos por -1 los subiria al principio en
    // descendente, y "los lotes sin fecha de vencimiento primero" no es lo que nadie pidio al
    // ordenar por fecha: la ausencia de dato no es un extremo de la escala, es otra cosa.
    if (esVacio(valorUno) || esVacio(valorOtro)) return compararValores(valorUno, valorOtro);

    return signo * compararValores(valorUno, valorOtro);
  });
}

/** Cuantas paginas hacen falta. Un conjunto vacio es UNA pagina vacia, no cero. */
export function contarPaginas(total, tamanoPagina = TAMANO_DE_PAGINA_POR_DEFECTO) {
  return Math.max(1, Math.ceil(total / tamanoPagina));
}

/** La rebanada que toca a una pagina, 1-indexada. */
export function recortarAPagina(
  filas = [],
  numeroDePagina = 1,
  tamanoPagina = TAMANO_DE_PAGINA_POR_DEFECTO,
) {
  const desde = (numeroDePagina - 1) * tamanoPagina;
  return filas.slice(desde, desde + tamanoPagina);
}

/**
 * Siguiente estado de orden al pulsar una columna.
 *
 * Primer clic ascendente, segundo descendente, tercero lo quita y devuelve el orden natural que
 * trae la API -que no es arbitrario: vencimientos viene por dias restantes ascendente y jornada
 * por frecuencia descendente, y esos son los ordenes en los que cada reporte se lee mejor-.
 */
export function siguienteOrden(actual, id) {
  if (actual?.id !== id) return { id, direccion: DIRECCIONES.ASC };
  if (actual.direccion === DIRECCIONES.ASC) return { id, direccion: DIRECCIONES.DESC };
  return null;
}

/**
 * Estado de orden y pagina de una tabla de reporte.
 *
 * @param {object[]} filas El conjunto completo, ya agregado.
 * @param {object} [opciones]
 * @param {object[]} [opciones.columnas] Descriptor, para resolver `desde` al ordenar.
 * @param {{id: string, direccion: string}} [opciones.ordenInicial]
 * @param {number} [opciones.tamanoPagina]
 */
export function useOrdenYPagina(
  filas = [],
  { columnas = [], ordenInicial = null, tamanoPagina = TAMANO_DE_PAGINA_POR_DEFECTO } = {},
) {
  const [orden, setOrden] = useState(ordenInicial);
  const [numeroDePagina, setNumeroDePagina] = useState(1);

  const total = filas.length;
  const totalPaginas = contarPaginas(total, tamanoPagina);

  // Cambiar un filtro puede dejar menos paginas de las que habia: sin esto, quien estaba en la 7
  // se queda mirando una tabla vacia con el pie diciendo "Pagina 7 de 2".
  useEffect(() => {
    setNumeroDePagina((actual) => Math.min(actual, totalPaginas));
  }, [totalPaginas]);

  const ordenadas = useMemo(() => ordenarFilas(filas, orden, columnas), [filas, orden, columnas]);

  const pagina = useMemo(
    () => recortarAPagina(ordenadas, numeroDePagina, tamanoPagina),
    [ordenadas, numeroDePagina, tamanoPagina],
  );

  /** Reordenar devuelve a la primera pagina: seguir en la 7 tras cambiar el criterio no dice nada. */
  const alternarOrden = useCallback((id) => {
    setNumeroDePagina(1);
    setOrden((actual) => siguienteOrden(actual, id));
  }, []);

  const irAPagina = useCallback(
    (destino) => {
      setNumeroDePagina(Math.min(Math.max(1, destino), totalPaginas));
    },
    [totalPaginas],
  );

  return {
    pagina,
    filasOrdenadas: ordenadas,
    orden,
    alternarOrden,
    numeroDePagina,
    totalPaginas,
    irAPagina,
    total,
  };
}
