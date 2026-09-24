import { exportarFilasACSV } from "@ecopac/shared";

/**
 * Descarga un listado como CSV (issue #862).
 *
 * POR QUE VIVE EN apps/web Y NO EN packages/shared. El armado del CSV -escapado RFC 4180, BOM
 * UTF-8, CRLF, anti-inyeccion de formulas, formato de fecha y moneda- ya esta en
 * packages/shared/reportes/csv.js y se reutiliza tal cual. Lo que esta funcion agrega es solo la
 * entrega: Blob, URL.createObjectURL y un <a download>, que son APIs del navegador. shared no
 * puede tocar document ni window (docs/ARQUITECTURA-FRONTEND.md), asi que la mitad de abajo tiene
 * que estar de este lado.
 *
 * POR QUE ES UNA SOLA FUNCION. Este bloque estaba copiado, identico salvo el nombre del archivo,
 * en ReporteInventarioPage, ReporteJornada, ReportePacientesPage, DashboardMetricasPage y
 * KardexMovimientosPage. Cinco copias de un bloque con una fuga de memoria sutil -ver abajo- es
 * cinco sitios donde arreglarla.
 *
 * SOBRE revokeObjectURL. Las cinco copias revocaban la URL en la linea siguiente al .click().
 * Funciona en la practica porque el navegador ya resolvio la descarga de forma sincrona, pero es
 * una carrera: si el navegador decide diferir la lectura del blob, la URL ya no existe y la
 * descarga sale vacia. Aqui se revoca en el siguiente turno del event loop, que es lo que
 * recomienda MDN, y se quita el <a> del documento.
 *
 * @param {Array<object>} columnas Descriptor de columnas de packages/shared.
 * @param {Array<object>} filas
 * @param {string} nombreDeArchivo Con extension, ej. "inventario-actual.csv".
 * @param {Record<string, Array<object>>} [catalogos] Los mismos que se le pasan a DataList, para
 *   que una columna de estado exporte su etiqueta y no el valor crudo del enum (issue #862).
 */
export default function descargarCSV(columnas, filas, nombreDeArchivo, catalogos = {}) {
  const blob = new Blob([exportarFilasACSV(filas, columnas, catalogos)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreDeArchivo;
  // Firefox no dispara la descarga de un <a> que no esta en el documento.
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();

  setTimeout(() => {
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }, 0);
}
