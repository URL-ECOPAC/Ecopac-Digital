import PageHeader, { AccionesDeCabecera } from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";

/**
 * Cabecera de un reporte que puede vivir solo o como pestana del hub de reportes.
 *
 * Solo, es un PageHeader normal. Dentro del hub (`incrustado`), la pantalla ya tiene su titulo
 * -"Reportes e impacto"- y un segundo <h1> debajo de las pestanas repetiria la jerarquia: queda
 * la descripcion del reporte y sus acciones (exportar) en una sola fila.
 */
export default function CabeceraDeReporte({ incrustado = false, title, subtitle, actions = [] }) {
  if (!incrustado) {
    return <PageHeader title={title} subtitle={subtitle} actions={actions} />;
  }

  return (
    <div className="reporte-barra">
      {subtitle && <p className="ec-cabecera-subtitulo m-0">{subtitle}</p>}
      <AccionesDeCabecera actions={actions} />
    </div>
  );
}

/** ScreenContainer cuando el reporte va solo; nada cuando ya esta dentro del de la pantalla. */
export function ContenedorDeReporte({ incrustado = false, children }) {
  return incrustado ? <>{children}</> : <ScreenContainer>{children}</ScreenContainer>;
}
