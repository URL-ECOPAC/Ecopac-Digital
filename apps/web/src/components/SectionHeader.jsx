import { AccionesDeCabecera } from "./PageHeader";

/**
 * Encabezado de una seccion o de una pestana dentro de una pantalla que ya tiene su PageHeader.
 *
 * Las pestanas de inventario titulaban cada una a su manera: "Alertas de Vencimiento" a --texto-xxl
 * (mas grande que el titulo de la propia pantalla), "Bandeja de Validacion" a --texto-xl con
 * "#1e293b", "Administracion" como un h3 a --texto-md, "Mis movimientos" como un h4 de Bootstrap.
 * Este es el escalon de debajo de PageHeader: la misma letra, un tamano menos, el filete del
 * modulo a la izquierda y las acciones de la seccion a la derecha con los botones del catalogo.
 *
 * `actions` tiene la misma forma que en PageHeader.
 */
export default function SectionHeader({ title, subtitle, actions = [], children }) {
  return (
    <div className="ec-seccion-cabecera">
      <div className="ec-cabecera-texto">
        <h2 className="ec-seccion-titulo mb-0">{title}</h2>
        {subtitle && <p className="ec-cabecera-subtitulo">{subtitle}</p>}
        {children}
      </div>
      <AccionesDeCabecera actions={actions} />
    </div>
  );
}
