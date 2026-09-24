import { useEffect } from "react";

import {
  aCadenaFechaLocal,
  formatearFechaConHora,
  formatearFechaCorta,
  formatearMoneda,
  TIPOS_DE_PRESENTACION,
} from "@ecopac/shared";
import DocumentoImprimible from "./DocumentoImprimible";

/**
 * Un reporte puesto en papel (issue #862).
 *
 * POR QUE EXISTE
 *
 * "Exportar PDF" no funcionaba en ninguna de las cuatro pantallas, y llevaba asi desde la issue
 * #216 que lo introdujo. El hook compartido useExportarPDF devolvia SIEMPRE `columnas: []` y
 * `totalizadores: {}` escritos a mano, y llamaba a construirDatosPDF() sin argumentos, asi que
 * `filas` tambien salia vacio. Ademas su `exportar(generarPDF)` esperaba recibir una funcion
 * generadora, pero las cuatro paginas lo cableaban como `onClick={exportar}`: lo que llegaba era
 * el evento del click, y `await generarPDF(datos)` reventaba. Para rematar, no habia ninguna
 * libreria de PDF en el repositorio, y los cuatro `<div id="contenido-reporte-pdf">` -con el
 * mismo id repetido- no los leia nadie.
 *
 * Y CTRL+P TAMPOCO SERVIA. index.css trae `@media print { .app-shell { display: none } }` para
 * quitar la navegacion del papel. Las pantallas de reporte viven DENTRO del shell, asi que la
 * regla escondia justo lo que se queria imprimir: salia una hoja en blanco.
 *
 * Los dos problemas son el mismo que DocumentoImprimible.jsx ya resolvio para la constancia de
 * donacion, y su propio comentario de cabecera nombra el "reporte de jornada" como caso previsto.
 * Aqui simplemente se usa: el documento se monta en un portal sobre document.body, fuera del
 * shell, y en impresion se esconde todo lo demas. Sin dependencias nuevas, y el navegador ofrece
 * "Guardar como PDF" en el mismo dialogo.
 *
 * LAS TABLAS SALEN DE LOS MISMOS DESCRIPTORES que alimentan DataList. No hay una segunda fuente
 * de verdad para el papel: si una columna cambia de nombre, cambia en los dos sitios a la vez.
 *
 * @param {object} props
 * @param {string} props.titulo
 * @param {string} [props.periodo] Texto ya formateado ("Al 22/09/2026", "Agosto 2026").
 * @param {Array<{etiqueta: string, valor: string}>} [props.filtrosAplicados]
 * @param {Array<{etiqueta: string, valor: string|number}>} [props.totales]
 * @param {Array<{titulo?: string, columnas: object[], filas: object[]}>} props.secciones
 * @param {() => void} props.alTerminar Se llama cuando el dialogo de impresion se cierra.
 */
export default function ReporteImprimible({
  titulo,
  periodo,
  filtrosAplicados = [],
  totales = [],
  secciones = [],
  catalogos = {},
  alTerminar,
}) {
  useEffect(() => {
    // Un fotograma antes de imprimir: sin el, el dialogo puede abrirse mientras el portal todavia
    // no esta pintado y la vista previa sale vacia, que es el defecto que se esta corrigiendo.
    const id = requestAnimationFrame(() => window.print());

    // afterprint cubre tanto imprimir como cancelar; no hay evento de "cancelado" aparte.
    const alCerrar = () => alTerminar?.();
    window.addEventListener("afterprint", alCerrar);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", alCerrar);
    };
  }, [alTerminar]);

  return (
    <DocumentoImprimible documento={titulo} fecha={aCadenaFechaLocal()} tamanio="carta">
      {periodo && <p className="reporte-papel-periodo">{periodo}</p>}

      {filtrosAplicados.length > 0 && (
        // Un reporte filtrado que no dice por que esta filtrado es una cifra sin contexto: en
        // papel no hay barra de filtros que mirar, asi que los criterios viajan con el.
        <p className="reporte-papel-filtros">
          {filtrosAplicados.map((filtro) => `${filtro.etiqueta}: ${filtro.valor}`).join("  ·  ")}
        </p>
      )}

      {totales.length > 0 && (
        <dl className="reporte-papel-totales">
          {totales.map((total) => (
            <div key={total.etiqueta}>
              <dt>{total.etiqueta}</dt>
              <dd>{total.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {secciones.map((seccion, indice) => (
        <section className="reporte-papel-seccion" key={seccion.titulo ?? indice}>
          {seccion.titulo && <h2 className="reporte-papel-subtitulo">{seccion.titulo}</h2>}

          {seccion.filas.length === 0 ? (
            <p className="reporte-papel-vacio">Sin datos para los criterios aplicados.</p>
          ) : (
            <table className="reporte-papel-tabla">
              <thead>
                <tr>
                  {seccion.columnas.map((columna) => (
                    <th key={columna.id}>{columna.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seccion.filas.map((fila, indiceFila) => (
                  <tr key={fila.id ?? indiceFila}>
                    {seccion.columnas.map((columna) => (
                      <td key={columna.id}>{textoDeCelda(columna, fila, catalogos)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </DocumentoImprimible>
  );
}

/**
 * El valor de una celda como TEXTO.
 *
 * El papel no dibuja chips ni avatares: un StatusChip impreso es un rectangulo de color que en
 * blanco y negro no dice nada, y en una impresora sin color no dice nada en absoluto. Por eso
 * aqui se resuelve la etiqueta del catalogo y se escribe la palabra, en vez de reutilizar el
 * componente Celda de DataList.
 *
 * El formateo de fecha y moneda sale de packages/shared, igual que en DataList: el importe de un
 * reporte impreso tiene que leerse exactamente igual que en pantalla.
 */
function textoDeCelda(columna, fila, catalogos = {}) {
  const valor = fila?.[columna.desde ?? columna.id];
  if (valor === null || valor === undefined) return "";

  switch (columna.tipo) {
    case TIPOS_DE_PRESENTACION.MONEDA:
      return formatearMoneda(valor) ?? "";
    case TIPOS_DE_PRESENTACION.FECHA:
      return formatearFechaCorta(valor) ?? "";
    case TIPOS_DE_PRESENTACION.FECHA_HORA:
      return formatearFechaConHora(valor) ?? "";
    case TIPOS_DE_PRESENTACION.BOOLEANO:
      return valor ? "Si" : "No";
    default:
      break;
  }

  // Una columna de estado guarda el valor del enum -o un booleano- y muestra la etiqueta de su
  // catalogo. Sin esto, el papel saldria con "critico" y "true" en vez de "Crítico" y "Vencido".
  if (columna.etiquetasDesde) {
    const catalogo = catalogos[columna.etiquetasDesde] ?? [];
    const opcion = catalogo.find((entrada) => entrada.value === valor);
    if (opcion) return opcion.label;
  }

  if (typeof valor === "boolean") return valor ? "Si" : "No";
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor);
}
