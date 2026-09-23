import { useId } from "react";

/**
 * Grafica de barras del catalogo (issue #862).
 *
 * QUE SUSTITUYE. El dashboard de impacto dibujaba sus barras con divs: un contenedor de
 * `height: 180px` fijo y un `.reporte-barras-grupo { flex: 1 }` por punto. Con un rango de treinta
 * dias agrupado por dia salian treinta barras de once pixeles, cada una con su fecha completa
 * debajo a --texto-xxs, sin truncar ni rotar: las etiquetas se solapaban hasta ser ilegibles. No
 * habia eje Y, asi que una barra no se podia leer como cantidad, solo comparar con la de al lado;
 * ni tooltip de verdad, solo el `title` del navegador; ni alternativa para un lector de pantalla.
 *
 * POR QUE SVG Y NO UNA LIBRERIA. Un `viewBox` escala solo y no necesita medir el contenedor, asi
 * que la grafica se adapta sin JavaScript de layout ni alto fijo. Ademas el catalogo de
 * componentes tiene que poder implementarse igual en apps/mobile (react-native-svg), y eso no
 * pasa con recharts.
 *
 * ACCESIBILIDAD. La grafica es `aria-hidden` y al lado va una <table> visualmente oculta con los
 * mismos numeros. Un lector de pantalla lee la tabla; quien ve la pantalla, las barras. Es la
 * unica forma de que el dato no dependa del color ni de la altura.
 *
 * @param {object} props
 * @param {Array<{etiqueta: string, valor: number}>} props.serie
 * @param {Array<{etiqueta: string, valor: number}>} [props.serieComparacion]
 * @param {string} props.titulo Lo que mide la grafica ("Pacientes atendidos por mes").
 * @param {string} [props.nombreSerie] Rotulo de la serie principal en la leyenda.
 * @param {string} [props.nombreComparacion]
 */
export default function GraficaDeBarras({
  serie = [],
  serieComparacion = [],
  titulo,
  nombreSerie = "Principal",
  nombreComparacion = "Comparación",
}) {
  const id = useId();
  const hayComparacion = serieComparacion.length > 0;

  if (serie.length === 0) {
    return <p className="ec-gr-vacio">Sin datos para graficar en el período seleccionado.</p>;
  }

  // Coordenadas del viewBox. Son unidades del dibujo, no pixeles de pantalla: el SVG las escala
  // al ancho real. El alto se fija aqui para que la proporcion sea estable.
  const ANCHO = 800;
  const ALTO = 300;
  const MARGEN = { arriba: 16, derecha: 8, abajo: 48, izquierda: 56 };
  const areaAncho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const areaAlto = ALTO - MARGEN.arriba - MARGEN.abajo;

  const maximo = Math.max(
    ...serie.map((p) => Number(p.valor) || 0),
    ...serieComparacion.map((p) => Number(p.valor) || 0),
    // Con todo en cero, un maximo de 0 daria una division por cero al calcular las alturas.
    1,
  );
  const tope = redondearHaciaArriba(maximo);
  const marcas = marcasDelEje(tope);

  const anchoGrupo = areaAncho / serie.length;
  // Deja aire entre grupos; con dos series, cada barra ocupa la mitad de lo disponible.
  //
  // El tope de 72 unidades es lo que impide que con dos o tres puntos salgan losas del ancho de
  // media grafica: una barra muy ancha deja de leerse como barra y el ojo la toma por un bloque
  // de color. Por debajo de ese tope manda el reparto proporcional.
  const ANCHO_MAXIMO_DE_BARRA = 72;
  const anchoBarra = Math.min(
    (anchoGrupo * 0.62) / (hayComparacion ? 2 : 1),
    ANCHO_MAXIMO_DE_BARRA,
  );

  const alturaDe = (valor) => ((Number(valor) || 0) / tope) * areaAlto;

  // Con muchos puntos las etiquetas no caben: se muestra una de cada N en vez de encimarlas.
  const saltoEtiqueta = Math.ceil(serie.length / 12);

  return (
    <figure className="ec-grafica">
      <figcaption className="ec-gr-titulo">{titulo}</figcaption>

      {/* El scroll aparece solo cuando hay tantos puntos que una barra bajaria de ~28 unidades.
          Con pocos, la grafica ocupa el ancho disponible sin barra de desplazamiento. */}
      <div className="ec-gr-lienzo" style={{ overflowX: serie.length > 16 ? "auto" : "visible" }}>
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          preserveAspectRatio="xMidYMid meet"
          className="ec-gr-svg"
          style={{ minWidth: serie.length > 16 ? `${serie.length * 42}px` : undefined }}
          role="img"
          aria-labelledby={`${id}-titulo`}
        >
          <title id={`${id}-titulo`}>{titulo}</title>

          {/* Eje Y: la linea guia y su numero. Sin esto una barra solo se puede comparar, no leer. */}
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

          {serie.map((punto, indice) => {
            const xGrupo = MARGEN.izquierda + indice * anchoGrupo;
            const comparado = serieComparacion[indice];
            const centro = xGrupo + anchoGrupo / 2;
            const xPrincipal = hayComparacion ? centro - anchoBarra : centro - anchoBarra / 2;

            return (
              <g key={indice}>
                <rect
                  x={xPrincipal}
                  y={MARGEN.arriba + areaAlto - alturaDe(punto.valor)}
                  width={anchoBarra}
                  height={alturaDe(punto.valor)}
                  className="ec-gr-barra"
                >
                  <title>{`${punto.etiqueta}: ${Number(punto.valor).toLocaleString("es-GT")}`}</title>
                </rect>

                {hayComparacion && comparado && (
                  <rect
                    x={centro}
                    y={MARGEN.arriba + areaAlto - alturaDe(comparado.valor)}
                    width={anchoBarra}
                    height={alturaDe(comparado.valor)}
                    className="ec-gr-barra ec-gr-barra--comparacion"
                  >
                    <title>
                      {`${comparado.etiqueta}: ${Number(comparado.valor).toLocaleString("es-GT")}`}
                    </title>
                  </rect>
                )}

                {indice % saltoEtiqueta === 0 && (
                  <text
                    x={centro}
                    y={ALTO - MARGEN.abajo + 20}
                    className="ec-gr-etiqueta"
                    textAnchor="middle"
                  >
                    {punto.etiqueta}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={MARGEN.izquierda}
            y1={MARGEN.arriba + areaAlto}
            x2={ANCHO - MARGEN.derecha}
            y2={MARGEN.arriba + areaAlto}
            className="ec-gr-eje"
          />
        </svg>
      </div>

      {hayComparacion && (
        <ul className="ec-gr-leyenda">
          <li>
            <span className="ec-gr-muestra" aria-hidden="true" />
            {nombreSerie}
          </li>
          <li>
            <span className="ec-gr-muestra ec-gr-muestra--comparacion" aria-hidden="true" />
            {nombreComparacion}
          </li>
        </ul>
      )}

      {/* La misma informacion, para quien no ve la grafica. `visually-hidden` de Bootstrap la
          saca de la vista sin sacarla del arbol de accesibilidad, al contrario que display:none. */}
      <table className="visually-hidden">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">{nombreSerie}</th>
            {hayComparacion && <th scope="col">{nombreComparacion}</th>}
          </tr>
        </thead>
        <tbody>
          {serie.map((punto, indice) => (
            <tr key={indice}>
              <th scope="row">{punto.etiqueta}</th>
              <td>{punto.valor}</td>
              {hayComparacion && <td>{serieComparacion[indice]?.valor ?? ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Sube el maximo al siguiente numero redondo, para que el eje termine en una cifra legible. */
function redondearHaciaArriba(maximo) {
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  return Math.ceil(maximo / magnitud) * magnitud;
}

/**
 * Marcas del eje Y: cero, el tope y hasta tres intermedias, SIN REPETIR.
 *
 * El `new Set` no es cosmetico. Con un tope pequeno -el caso normal de una base recien sembrada,
 * o de un periodo con pocos datos- redondear las cinco fracciones daba numeros repetidos: con
 * tope 1 salia [0, 0, 1, 1, 1]. Eso dibujaba la misma linea guia cinco veces y, como la marca era
 * tambien la `key` de React, llenaba la consola de "Encountered two children with the same key".
 *
 * Ademas de quitar el aviso, arregla el eje: un eje que repite el mismo numero tres veces no se
 * puede leer.
 */
function marcasDelEje(tope) {
  const valores = [0, 0.25, 0.5, 0.75, 1].map((fraccion) => Math.round(tope * fraccion));
  return [...new Set(valores)];
}
