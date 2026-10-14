import { Card as CardBootstrap } from "react-bootstrap";

/**
 * Tarjeta: base visual de cualquier bloque agrupado de un dashboard, y de las tarjetas que
 * DataList dibuja en movil.
 *
 * Si se pasa `onClick` la tarjeta se vuelve interactiva, y entonces tiene que serlo tambien
 * para el teclado y para un lector de pantalla: por eso recibe role, tabIndex y responde a
 * Enter y espacio. Un div con onClick y nada mas solo funciona con raton.
 *
 * `accent` pinta una cinta del color del modulo en el borde superior. Se le pasa una variable de
 * tokens (`var(--accent-inventario)`), nunca un color escrito a mano: es lo mismo que la
 * rejilla de accesos del inicio ya hacia en linea, subido al componente para que cualquier
 * pantalla pueda identificar una tarjeta con el color de su modulo.
 *
 * `subtitle` y `actions` existen porque media docena de pantallas dibujaban la misma cabecera a
 * mano dentro del cuerpo de la tarjeta -un h6, un parrafo apagado y una fila de botones a la
 * derecha-, cada una con su propio espaciado.
 */
export default function Card({
  children,
  title,
  subtitle,
  actions,
  accent,
  onClick,
  className = "",
  style,
  ...rest
}) {
  const interactiva = typeof onClick === "function";

  const propsDeInteraccion = interactiva
    ? {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (evento) => {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            onClick(evento);
          }
        },
      }
    : {};

  const clases = [accent ? "ec-card--acento" : null, className].filter(Boolean).join(" ");

  const hayCabecera = Boolean(title || subtitle || actions);

  return (
    <CardBootstrap
      className={clases || undefined}
      style={{
        cursor: interactiva ? "pointer" : undefined,
        ...(accent ? { "--ec-acento": accent } : null),
        ...style,
      }}
      {...propsDeInteraccion}
      {...rest}
    >
      <CardBootstrap.Body>
        {hayCabecera && (
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
            <div>
              {title && (
                <CardBootstrap.Title as="h2" className="h6 mb-0">
                  {title}
                </CardBootstrap.Title>
              )}
              {subtitle && <p className="ec-card-subtitulo mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="ec-acciones">{actions}</div>}
          </div>
        )}
        {children}
      </CardBootstrap.Body>
    </CardBootstrap>
  );
}
