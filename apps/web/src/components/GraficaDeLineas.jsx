import { useId } from "react";

/**
 * Grafica de lineas del catalogo (issue #916): la evolucion de una cifra en el tiempo.
 *
 * Mismo criterio que GraficaDeBarras: SVG con `viewBox` que escala solo, sin libreria, eje Y con
 * numeros legibles, y la misma informacion en una <table> visualmente oculta para un lector de
 * pantalla. Las clases son las `ec-gr-*` de ui.css, asi que las dos graficas se ven de la misma
 * familia; el color de cada serie lo pone `ec-gr-serie-N`.
 *
 * Un valor `null` es un dato que no se puede mostrar -una cifra protegida por privacidad-: corta
 * la linea en ese punto en vez de unirlo como si fuera cero, y si se da `etiquetaDeNulo` la
 * escribe sobre el eje.
 *
 * @param {object} props
 * @param {string[]} props.etiquetas Rotulos del eje X, en orden.
 * @param {Array<{nombre: string, valores: Array<number|null>}>} props.series
 * @param {string} props.titulo Lo que mide la grafica.
 * @param {string} [props.encabezadoDeEtiquetas] Encabezado de la primera columna de la tabla.
 * @param {string} [props.etiquetaDeNulo] Que escribir donde un valor es null ("< 5").
 */
export default function GraficaDeLineas({
  etiquetas = [],
  series = [],
  titulo,
  encabezadoDeEtiquetas = "Período",
  etiquetaDeNulo,
}) {
  const id = useId();

  if (etiquetas.length === 0 || series.length === 0) {
    return <p className="ec-gr-vacio">Sin datos para graficar en el período seleccionado.</p>;
  }

  const ANCHO = 800;
  const ALTO = 300;
  const MARGEN = { arriba: 16, derecha: 24, abajo: 48, izquierda: 56 };
  const areaAncho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const areaAlto = ALTO - MARGEN.arriba - MARGEN.abajo;

  const maximo = Math.max(
    ...series.flatMap((serie) => serie.valores.map((valor) => Number(valor) || 0)),
    1,
  );
  const tope = redondearHaciaArriba(maximo);
  const marcas = marcasDelEje(tope);

  // Con un solo punto no hay tramo que dibujar: el punto va al centro.
  const pasoX = etiquetas.length > 1 ? areaAncho / (etiquetas.length - 1) : 0;
  const xDe = (indice) =>
    etiquetas.length > 1 ? MARGEN.izquierda + indice * pasoX : MARGEN.izquierda + areaAncho / 2;
  const yDe = (valor) => MARGEN.arriba + areaAlto - ((Number(valor) || 0) / tope) * areaAlto;
  const saltoEtiqueta = Math.ceil(etiquetas.length / 12);
  const formatear = (valor) => Number(valor).toLocaleString("es-GT");

  return (
    <figure className="ec-grafica">
      <figcaption className="ec-gr-titulo">{titulo}</figcaption>

      <div className="ec-gr-lienzo">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          preserveAspectRatio="xMidYMid meet"
          className="ec-gr-svg"
          role="img"
          aria-labelledby={`${id}-titulo`}
        >
          <title id={`${id}-titulo`}>{titulo}</title>

          {marcas.map((marca) => {
            const y = MARGEN.arriba + areaAlto - (marca / tope) * areaAlto;
            return (
              <g key={marca}>
                <line
                  x1={MARGEN.izquierda}
                  y1={y}
                  x2={ANCHO - MARGEN.derecha}
                  y2={y}
                  className="ec-gr-guia"
                />
                <text x={MARGEN.izquierda - 8} y={y + 4} className="ec-gr-numero" textAnchor="end">
                  {marca.toLocaleString("es-GT")}
                </text>
              </g>
            );
          })}

          {series.map((serie, posicion) => {
            // El color sale de la clase ec-gr-serie-N de ui.css.
            return (
              <g key={posicion} className={`ec-gr-serie-${(posicion % 6) + 1}`}>
                {tramosSinNulos(serie.valores).map((tramo, indiceDeTramo) => (
                  <polyline
                    key={indiceDeTramo}
                    points={tramo
                      .map((indice) => `${xDe(indice)},${yDe(serie.valores[indice])}`)
                      .join(" ")}
                    className="ec-gr-linea"
                  />
                ))}

                {serie.valores.map((valor, indice) =>
                  valor === null || valor === undefined ? (
                    etiquetaDeNulo && (
                      <text
                        key={indice}
                        x={xDe(indice)}
                        y={MARGEN.arriba + areaAlto - 4}
                        className="ec-gr-nulo"
                        textAnchor="middle"
                      >
                        {etiquetaDeNulo}
                        <title>{`${etiquetas[indice]}: ${etiquetaDeNulo}`}</title>
                      </text>
                    )
                  ) : (
                    <circle
                      key={indice}
                      cx={xDe(indice)}
                      cy={yDe(valor)}
                      r={4}
                      className="ec-gr-punto"
                    >
                      <title>{`${etiquetas[indice]}: ${formatear(valor)}`}</title>
                    </circle>
                  ),
                )}
              </g>
            );
          })}

          {etiquetas.map((etiqueta, indice) =>
            indice % saltoEtiqueta === 0 ? (
              <text
                key={indice}
                x={xDe(indice)}
                y={ALTO - MARGEN.abajo + 20}
                className="ec-gr-etiqueta"
                textAnchor="middle"
              >
                {etiqueta}
              </text>
            ) : null,
          )}

          <line
            x1={MARGEN.izquierda}
            y1={MARGEN.arriba + areaAlto}
            x2={ANCHO - MARGEN.derecha}
            y2={MARGEN.arriba + areaAlto}
            className="ec-gr-eje"
          />
        </svg>
      </div>

      {series.length > 1 && (
        <ul className="ec-gr-leyenda">
          {series.map((serie, posicion) => (
            <li key={posicion}>
              <span
                className={`ec-gr-muestra ec-gr-muestra--serie ec-gr-serie-${(posicion % 6) + 1}`}
                aria-hidden="true"
              />
              {serie.nombre}
            </li>
          ))}
        </ul>
      )}

      <table className="visually-hidden">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">{encabezadoDeEtiquetas}</th>
            {series.map((serie, posicion) => (
              <th scope="col" key={posicion}>
                {serie.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {etiquetas.map((etiqueta, indice) => (
            <tr key={indice}>
              <th scope="row">{etiqueta}</th>
              {series.map((serie, posicion) => {
                const valor = serie.valores[indice];
                return (
                  <td key={posicion}>
                    {valor === null || valor === undefined ? (etiquetaDeNulo ?? "") : valor}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Los indices de cada tramo continuo de valores no nulos: [5, null, 3, 4] -> [[0], [2, 3]]. Un
 * tramo de un solo punto no dibuja linea, pero su circulo si aparece.
 */
function tramosSinNulos(valores) {
  const tramos = [];
  let actual = [];
  valores.forEach((valor, indice) => {
    if (valor === null || valor === undefined) {
      if (actual.length > 0) tramos.push(actual);
      actual = [];
    } else {
      actual.push(indice);
    }
  });
  if (actual.length > 0) tramos.push(actual);
  return tramos.filter((tramo) => tramo.length > 1);
}

/** Sube el maximo al siguiente numero redondo, como en GraficaDeBarras. */
function redondearHaciaArriba(maximo) {
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  return Math.ceil(maximo / magnitud) * magnitud;
}

/** Cero, el tope y hasta tres intermedias, sin repetir (ver GraficaDeBarras). */
function marcasDelEje(tope) {
  const valores = [0, 0.25, 0.5, 0.75, 1].map((fraccion) => Math.round(tope * fraccion));
  return [...new Set(valores)];
}
