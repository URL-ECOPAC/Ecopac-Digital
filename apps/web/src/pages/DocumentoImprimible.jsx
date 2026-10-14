import { createPortal } from "react-dom";

import { organizacion } from "@ecopac/ui-tokens";
import { formatearFechaCorta } from "@ecopac/shared";

/**
 * El envoltorio de todo documento que se imprime: constancia, receta, cuadro de turnos, reporte
 * de jornada (issue #840).
 *
 * POR QUE EXISTE
 *
 * Habia dos problemas y los dos venian de que cada documento resolvia la impresion por su cuenta.
 *
 * 1. LA CONSTANCIA SALIA EN BLANCO. `@media print` traia `.app-shell { display: none !important }`
 *    para quitar la navegacion. La receta sobrevivia porque se monta en un portal, fuera del
 *    shell; la constancia es una ruta normal, vive DENTRO del shell, asi que desaparecia con el.
 *    La regla escondia el documento que se queria imprimir.
 *
 *    Ahora lo imprimible no es "lo que sobrevive a esconder el shell": es lo que se monta aqui,
 *    en un portal sobre document.body, y en impresion se esconde todo lo demas.
 *
 * 2. NINGUNO LLEVABA LOGO Y CADA UNO TENIA SU CABECERA. Tres identidades distintas para la misma
 *    organizacion (ver `organizacion` en @ecopac/ui-tokens). Aqui se dibuja una sola vez.
 *
 * SOBRE EL TAMANO DE PAGINA. `tamanio` elige entre dos paginas CON NOMBRE (`@page carta` y
 * `@page media-carta`, en index.css). El comentario anterior del CSS daba por hecho que no se
 * podia: "dos reglas @page en la misma hoja de estilos no se combinan por clase, compiten por el
 * documento entero". Eso vale para reglas `@page` anonimas; las paginas con nombre existen justo
 * para esto y se asignan con la propiedad `page`. Asi la receta sigue en media carta y la
 * constancia sale en carta, sin que una le cambie el tamano a la otra.
 *
 * @param {object} props
 * @param {string} props.documento Titulo del papel ("Constancia de donacion recibida").
 * @param {string} [props.folio] Correlativo, si el documento lo tiene.
 * @param {string} [props.fecha] Fecha del documento, en ISO.
 * @param {"carta"|"media-carta"} [props.tamanio] Tamano de pagina. Carta por defecto.
 * @param {React.ReactNode} [props.pie] Contenido del pie (firmas). Sin pie no se dibuja nada.
 */
export default function DocumentoImprimible({
  documento,
  folio,
  fecha,
  tamanio = "carta",
  pie,
  children,
}) {
  return createPortal(
    <article className={`doc-imprimible doc-imprimible--${tamanio}`}>
      <header className="doc-imprimible__encabezado">
        {/* El logo es decorativo: el nombre de la organizacion va al lado en texto, asi que
            repetirlo en el alt solo lo haria sonar dos veces en un lector de pantalla. */}
        <img className="doc-imprimible__logo" src={organizacion.logo} alt="" aria-hidden="true" />

        <div className="doc-imprimible__identidad">
          <p className="doc-imprimible__organizacion">{organizacion.nombre}</p>
          <p className="doc-imprimible__pais">{organizacion.pais}</p>
        </div>

        <div className="doc-imprimible__referencia">
          {folio && <p className="doc-imprimible__folio">{folio}</p>}
          {fecha && <p className="doc-imprimible__fecha">{formatearFechaCorta(fecha)}</p>}
        </div>
      </header>

      <h1 className="doc-imprimible__titulo">{documento}</h1>

      <div className="doc-imprimible__cuerpo">{children}</div>

      {pie && <footer className="doc-imprimible__pie">{pie}</footer>}
    </article>,
    document.body,
  );
}

/**
 * Una linea de firma del pie. Se usa suelta o de a dos; el pie las acomoda en fila.
 *
 * Va aqui y no en cada documento porque la firma es parte del formato del papel, no del
 * contenido: una constancia y una receta firman igual.
 */
export function LineaDeFirma({ rotulo }) {
  return (
    <div className="doc-imprimible__firma">
      <span className="doc-imprimible__linea-firma" />
      <p className="doc-imprimible__rotulo-firma">{rotulo}</p>
    </div>
  );
}
